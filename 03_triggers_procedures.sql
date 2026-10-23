-- =============================================================================
-- FILE: 03_triggers_procedures.sql
-- PROJECT: Digital Twin Warehouse Management System
-- DESCRIPTION: Advanced DB logic - Triggers, Stored Procedures, and a
--              Transaction block demonstrating order fulfilment.
--              Written for PostgreSQL 14+.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- SECTION A: BIN CAPACITY MANAGEMENT
--
-- When an InventoryItem row is INSERTED, UPDATED or DELETED:
--   1. Recalculate Bin.CurrentStock as the SUM of all InventoryItems in that bin.
--   2. If the new stock > Bin.Capacity, raise a DB-level EXCEPTION (rejects write).
--   3. If the new stock = Bin.Capacity, log a HIGH-severity 'Overstocked' Alert.
--   4. If the bin drops below capacity again, open Overstocked alerts for it
--      are auto-resolved (the physical condition has cleared).
--   5. If an item is moved to another bin, the old bin is re-synced as well.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_sync_bin_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_bin_id        INT;
    v_capacity      INT;
    v_new_stock     INT;
    v_zone_id       INT;
    v_bin_code      VARCHAR(30);
    v_existing_alert INT;
BEGIN
    -- NEW is NULL for DELETE, so work out which bin changed
    IF TG_OP = 'DELETE' THEN
        v_bin_id := OLD.BinID;
    ELSE
        v_bin_id := NEW.BinID;
    END IF;

    -- Item moved to another bin: the bin it left must be re-synced too
    IF TG_OP = 'UPDATE' AND OLD.BinID <> NEW.BinID THEN
        UPDATE Bin
           SET CurrentStock = (SELECT COALESCE(SUM(Quantity), 0)
                                 FROM InventoryItem
                                WHERE BinID = OLD.BinID)
         WHERE BinID = OLD.BinID;
    END IF;

    -- -- 1. Compute the new aggregate stock for this bin ----------------------
    SELECT COALESCE(SUM(Quantity), 0)
      INTO v_new_stock
      FROM InventoryItem
     WHERE BinID = v_bin_id;

    -- -- 2. Fetch bin metadata ------------------------------------------------
    SELECT b.Capacity, b.BinCode,
           r.ZoneID
      INTO v_capacity, v_bin_code, v_zone_id
      FROM Bin  b
      JOIN Rack r ON r.RackID = b.RackID
     WHERE b.BinID = v_bin_id;

    -- Bin itself is being deleted (ON DELETE CASCADE) - nothing to sync
    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    -- -- 3. Hard-block: reject if stock would exceed capacity -----------------
    IF v_new_stock > v_capacity THEN
        RAISE EXCEPTION
            'CAPACITY EXCEEDED: Bin % (ID=%) cannot hold % units - max capacity is %.',
            v_bin_code, v_bin_id, v_new_stock, v_capacity;
    END IF;

    -- -- 4. Update Bin.CurrentStock -------------------------------------------
    UPDATE Bin
       SET CurrentStock = v_new_stock
     WHERE BinID = v_bin_id;

    -- -- 5. Raise alert if bin is now exactly at capacity (full) --------------
    IF v_new_stock = v_capacity THEN
        -- Avoid duplicate open alerts for the same bin
        SELECT COUNT(*) INTO v_existing_alert
          FROM Alert
         WHERE BinID   = v_bin_id
           AND AlertType = 'Overstocked'
           AND Status  IN ('Open', 'Acknowledged');

        IF v_existing_alert = 0 THEN
            INSERT INTO Alert (ZoneID, BinID, AlertType, Severity, Message, Status)
            VALUES (
                v_zone_id,
                v_bin_id,
                'Overstocked',
                'High',
                FORMAT('Bin %s (ID=%s) has reached 100%% capacity (%s/%s units). '
                       || 'No further stock can be added until items are removed.',
                       v_bin_code, v_bin_id, v_new_stock, v_capacity),
                'Open'
            );
            RAISE NOTICE 'ALERT RAISED: Bin % is now full (%/% units).', v_bin_code, v_new_stock, v_capacity;
        END IF;
    ELSE
        -- -- 6. Bin has free space again: the overstock condition has cleared --
        UPDATE Alert
           SET Status = 'Resolved', ResolvedAt = NOW()
         WHERE BinID = v_bin_id
           AND AlertType = 'Overstocked'
           AND Status IN ('Open', 'Acknowledged');
    END IF;

    RETURN NULL;  -- return value is ignored for AFTER triggers
END;
$$;

-- Attach trigger - fires AFTER INSERT, UPDATE or DELETE on InventoryItem
DROP TRIGGER IF EXISTS trg_bin_stock_sync ON InventoryItem;
CREATE TRIGGER trg_bin_stock_sync
    AFTER INSERT OR UPDATE OF Quantity, BinID OR DELETE
    ON InventoryItem
    FOR EACH ROW
    EXECUTE FUNCTION fn_sync_bin_stock();




-- -----------------------------------------------------------------------------
-- SECTION B: SENSOR THRESHOLD BREACH ALERT
--
-- When a SensorReading is INSERTED:
--   - Look up the parent Sensor's ThresholdMin and ThresholdMax.
--   - If the ReadingValue falls outside [ThresholdMin, ThresholdMax],
--     insert a HIGH or CRITICAL severity Alert.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_check_sensor_threshold()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_sensor        RECORD;
    v_severity      VARCHAR(20);
    v_alert_msg     TEXT;
    v_breach_type   TEXT;
BEGIN
    -- Fetch sensor config
    SELECT s.SensorType, s.ThresholdMin, s.ThresholdMax,
           s.ZoneID, s.Status
      INTO v_sensor
      FROM Sensor s
     WHERE s.SensorID = NEW.SensorID;

    -- Skip threshold check if sensor has no thresholds defined or is inactive
    IF v_sensor.ThresholdMin IS NULL AND v_sensor.ThresholdMax IS NULL THEN
        RETURN NEW;
    END IF;
    IF v_sensor.Status = 'Faulty' THEN
        RETURN NEW;
    END IF;

    -- Determine breach direction
    IF v_sensor.ThresholdMax IS NOT NULL AND NEW.ReadingValue > v_sensor.ThresholdMax THEN
        v_breach_type := 'HIGH';
    ELSIF v_sensor.ThresholdMin IS NOT NULL AND NEW.ReadingValue < v_sensor.ThresholdMin THEN
        v_breach_type := 'LOW';
    ELSE
        RETURN NEW;  -- No breach - exit cleanly
    END IF;

    -- Assign severity based on sensor type and breach magnitude
    v_severity := CASE
        WHEN v_sensor.SensorType IN ('Temperature', 'CO2', 'Smoke') THEN 'Critical'
        ELSE 'High'
    END;

    v_alert_msg := FORMAT(
        '[THRESHOLD BREACH] Sensor %s (%s) recorded %s %s. '
        || 'Breached %s threshold of %s. Zone ID: %s. Timestamp: %s.',
        NEW.SensorID,
        v_sensor.SensorType,
        NEW.ReadingValue,
        NEW.Unit,
        v_breach_type,
        CASE v_breach_type WHEN 'HIGH' THEN v_sensor.ThresholdMax::TEXT
                           ELSE v_sensor.ThresholdMin::TEXT END,
        v_sensor.ZoneID,
        NEW.RecordedAt
    );

    INSERT INTO Alert (ZoneID, SensorID, AlertType, Severity, Message, Status)
    VALUES (v_sensor.ZoneID, NEW.SensorID, 'Threshold Breach', v_severity, v_alert_msg, 'Open');

    RAISE NOTICE 'SENSOR ALERT [%]: Sensor % breached % threshold. Value=%, Limit=%',
        v_severity, NEW.SensorID, v_breach_type, NEW.ReadingValue,
        CASE v_breach_type WHEN 'HIGH' THEN v_sensor.ThresholdMax ELSE v_sensor.ThresholdMin END;

    RETURN NEW;
END;
$$;

-- Attach trigger - fires AFTER INSERT on SensorReading
DROP TRIGGER IF EXISTS trg_sensor_threshold_check ON SensorReading;
CREATE TRIGGER trg_sensor_threshold_check
    AFTER INSERT
    ON SensorReading
    FOR EACH ROW
    EXECUTE FUNCTION fn_check_sensor_threshold();




-- -----------------------------------------------------------------------------
-- SECTION B2: SENSOR FAILURE ALERT
--
-- When a Sensor's Status is UPDATED to 'Faulty':
--   - Insert a 'Sensor Failure' Alert for that sensor's zone (once - no
--     duplicate while an earlier failure alert is still unresolved).
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_sensor_failure_alert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_existing_alert INT;
BEGIN
    IF NEW.Status <> 'Faulty' OR OLD.Status = 'Faulty' THEN
        RETURN NULL;
    END IF;

    SELECT COUNT(*) INTO v_existing_alert
      FROM Alert
     WHERE SensorID  = NEW.SensorID
       AND AlertType = 'Sensor Failure'
       AND Status    IN ('Open', 'Acknowledged');

    IF v_existing_alert = 0 THEN
        INSERT INTO Alert (ZoneID, SensorID, BinID, AlertType, Severity, Message, Status)
        VALUES (
            NEW.ZoneID,
            NEW.SensorID,
            NEW.BinID,
            'Sensor Failure',
            'Medium',
            FORMAT('[SENSOR FAILURE] %s sensor %s (ID=%s) changed from %s to Faulty. '
                   || 'Readings from this device are no longer trusted.',
                   NEW.SensorType, COALESCE(NEW.Model, 'unknown model'), NEW.SensorID, OLD.Status),
            'Open'
        );
        RAISE NOTICE 'SENSOR FAILURE ALERT: Sensor % is now Faulty.', NEW.SensorID;
    END IF;

    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sensor_failure_alert ON Sensor;
CREATE TRIGGER trg_sensor_failure_alert
    AFTER UPDATE OF Status
    ON Sensor
    FOR EACH ROW
    EXECUTE FUNCTION fn_sensor_failure_alert();




-- -----------------------------------------------------------------------------
-- SECTION C: ORDER FULFILMENT STORED PROCEDURE
--
-- sp_fulfil_order(p_order_id INT)
--   Atomically:
--     1. Validates the order is in a fulfillable state.
--     2. For each OrderItem, locates sufficient InventoryItem stock across bins.
--     3. Decrements stock (FIFO: oldest stock first).
--     4. Updates Order.Status -> 'Fulfilled'.
--     5. Creates a Shipment record.
--     6. Rolls back the entire transaction on any failure.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE PROCEDURE sp_fulfil_order(p_order_id INT)
LANGUAGE plpgsql
AS $$
DECLARE
    v_order_status  VARCHAR(30);
    v_item          RECORD;     -- OrderItem cursor row
    v_bin_row       RECORD;     -- candidate bin inventory row
    v_remaining     INT;        -- units still to deduct for current order line
    v_deduct        INT;        -- units to deduct from a single bin
    v_total_fulfilled INT := 0;
BEGIN
    -- -- Step 1: Lock and validate order -------------------------------------
    SELECT Status INTO v_order_status
      FROM "Order"
     WHERE OrderID = p_order_id
       FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order % does not exist.', p_order_id;
    END IF;

    IF v_order_status NOT IN ('Pending', 'Processing') THEN
        RAISE EXCEPTION 'Order % cannot be fulfilled - current status: %.', p_order_id, v_order_status;
    END IF;

    -- Mark order as Processing
    UPDATE "Order" SET Status = 'Processing' WHERE OrderID = p_order_id;

    -- -- Step 2: Process each order line -------------------------------------
    FOR v_item IN
        SELECT oi.OrderItemID, oi.ProductID, oi.Quantity, p.ProductName
          FROM OrderItem oi
          JOIN Product   p  ON p.ProductID = oi.ProductID
         WHERE oi.OrderID = p_order_id
    LOOP
        v_remaining := v_item.Quantity;

        -- FIFO: pick the oldest stock first (least recently updated bin)
        FOR v_bin_row IN
            SELECT ii.InventoryItemID, ii.BinID, ii.Quantity
              FROM InventoryItem ii
             WHERE ii.ProductID = v_item.ProductID
               AND ii.Quantity  > 0
             ORDER BY ii.LastUpdated ASC,       -- FIFO: oldest stock leaves first
                      ii.InventoryItemID ASC
               FOR UPDATE SKIP LOCKED           -- concurrent-safe
        LOOP
            EXIT WHEN v_remaining <= 0;

            v_deduct    := LEAST(v_remaining, v_bin_row.Quantity);
            v_remaining := v_remaining - v_deduct;

            -- Decrement InventoryItem - triggers trg_bin_stock_sync automatically
            UPDATE InventoryItem
               SET Quantity    = Quantity - v_deduct,
                   LastUpdated = NOW()
             WHERE InventoryItemID = v_bin_row.InventoryItemID;

        END LOOP;

        -- -- Step 3: Check if we had enough stock -----------------------------
        IF v_remaining > 0 THEN
            RAISE EXCEPTION
                'Insufficient stock for product "%" (ID=%). Need %, short by %.',
                v_item.ProductName, v_item.ProductID, v_item.Quantity, v_remaining;
        END IF;

        v_total_fulfilled := v_total_fulfilled + 1;
    END LOOP;

    -- -- Step 4: Mark order as Fulfilled -------------------------------------
    UPDATE "Order"
       SET Status = 'Fulfilled'
     WHERE OrderID = p_order_id;

    -- -- Step 5: Create Shipment record ---------------------------------------
    INSERT INTO Shipment (OrderID, Carrier, TrackingNumber, EstimatedArrival, Status)
    VALUES (
        p_order_id,
        'Internal Dispatch',
        'INT-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(p_order_id::TEXT, 5, '0'),
        CURRENT_DATE + 3,
        'Preparing'
    );

    RAISE NOTICE 'Order % fulfilled successfully. % product line(s) processed. Shipment created.',
        p_order_id, v_total_fulfilled;

EXCEPTION
    WHEN OTHERS THEN
        -- Any error -> PostgreSQL automatically rolls back the calling transaction
        RAISE EXCEPTION 'Order fulfilment FAILED for Order %: %', p_order_id, SQLERRM;
END;
$$;




-- -----------------------------------------------------------------------------
-- SECTION D: DIGITAL TWIN SNAPSHOT PROCEDURE
--
-- sp_take_snapshot(p_warehouse_id INT)
--   Computes live warehouse metrics and appends a DigitalTwinSnapshot row.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE PROCEDURE sp_take_snapshot(p_warehouse_id INT)
LANGUAGE plpgsql
AS $$
DECLARE
    v_total_bins        INT;
    v_occupied_bins     INT;
    v_total_stock       INT;
    v_active_alerts     INT;
    v_active_sensors    INT;
    v_payload           JSONB;
BEGIN
    -- Compute metrics from live data
    SELECT COUNT(b.BinID),
           COUNT(b.BinID) FILTER (WHERE b.CurrentStock > 0),
           COALESCE(SUM(b.CurrentStock), 0)
      INTO v_total_bins, v_occupied_bins, v_total_stock
      FROM Bin  b
      JOIN Rack r ON r.RackID = b.RackID
      JOIN Zone z ON z.ZoneID = r.ZoneID
     WHERE z.WarehouseID = p_warehouse_id;

    SELECT COUNT(*) INTO v_active_alerts
      FROM Alert   a
      JOIN Zone    z ON z.ZoneID = a.ZoneID
     WHERE z.WarehouseID = p_warehouse_id
       AND a.Status IN ('Open', 'Acknowledged');

    SELECT COUNT(*) INTO v_active_sensors
      FROM Sensor  s
      JOIN Zone    z ON z.ZoneID = s.ZoneID
     WHERE z.WarehouseID = p_warehouse_id
       AND s.Status = 'Active';

    -- Build a compact JSON payload for replay
    SELECT jsonb_agg(
               jsonb_build_object(
                   'BinID',        b.BinID,
                   'BinCode',      b.BinCode,
                   'CurrentStock', b.CurrentStock,
                   'Capacity',     b.Capacity,
                   'ZoneID',       z.ZoneID
               )
           )
      INTO v_payload
      FROM Bin  b
      JOIN Rack r ON r.RackID = b.RackID
      JOIN Zone z ON z.ZoneID = r.ZoneID
     WHERE z.WarehouseID = p_warehouse_id;

    INSERT INTO DigitalTwinSnapshot
        (WarehouseID, TotalBins, OccupiedBins, TotalStockUnits,
         ActiveAlerts, ActiveSensors, SnapshotPayloadJSON, CreatedBy)
    VALUES
        (p_warehouse_id, v_total_bins, v_occupied_bins, v_total_stock,
         v_active_alerts, v_active_sensors, v_payload, 'sp_take_snapshot');

    RAISE NOTICE 'Snapshot captured for Warehouse %: % bins, % occupied, % units, % alerts.',
        p_warehouse_id, v_total_bins, v_occupied_bins, v_total_stock, v_active_alerts;
END;
$$;




-- -----------------------------------------------------------------------------
-- SECTION E: DEMONSTRATION - EXPLICIT TRANSACTION BLOCK
--
-- The calls below show how to use the procedure within an explicit transaction
-- so that an application can perform setup/teardown around the call.
-- -----------------------------------------------------------------------------

/*  -- Usage Example (run manually in psql or application code) --------------

BEGIN;
    -- Fulfil Order #3 (FreshMart - cold-chain peas & yogurt)
    CALL sp_fulfil_order(3);
COMMIT;

-- If anything above raises an exception the transaction is automatically
-- rolled back, leaving all tables unchanged.

-- Equivalent with explicit ROLLBACK guard (psql script style):
\set ON_ERROR_ROLLBACK on
BEGIN;
    CALL sp_fulfil_order(99);   -- will fail: order 99 does not exist
COMMIT;
-- -> ROLLBACK is issued automatically by ON_ERROR_ROLLBACK setting

---------------------------------------------------------------------------- */

-- Take a fresh snapshot for every warehouse (safe to run anytime)
CALL sp_take_snapshot(1);
CALL sp_take_snapshot(2);
CALL sp_take_snapshot(3);

-- =============================================================================
-- END OF TRIGGERS & PROCEDURES SCRIPT
-- =============================================================================
