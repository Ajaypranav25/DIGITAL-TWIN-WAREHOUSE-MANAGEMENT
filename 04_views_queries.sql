-- =============================================================================
-- FILE: 04_views_queries.sql
-- PROJECT: Digital Twin Warehouse Management System
-- DESCRIPTION: Analytical views and queries for the live digital twin state,
--              anomaly reporting, and inventory utilization.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- VIEW 1: vw_live_digital_twin_state
--
-- Purpose : The primary "live digital twin" read surface.
-- Shows   : Zone -> Rack -> Bin -> Product, occupancy metrics, and the most
--           recent sensor reading for each sensor in the same zone.
-- Usage   : SELECT * FROM vw_live_digital_twin_state;
--           SELECT * FROM vw_live_digital_twin_state WHERE ZoneName = 'Z-B Cold Storage';
-- -----------------------------------------------------------------------------

CREATE OR REPLACE VIEW vw_live_digital_twin_state AS
WITH latest_sensor_readings AS (
    -- Get the single most-recent reading for every sensor (window function)
    SELECT
        sr.SensorID,
        sr.ReadingValue,
        sr.Unit,
        sr.RecordedAt,
        ROW_NUMBER() OVER (PARTITION BY sr.SensorID ORDER BY sr.RecordedAt DESC) AS rn
    FROM SensorReading sr
),
zone_sensors AS (
    -- Aggregate latest readings per zone as a summary
    SELECT
        s.ZoneID,
        STRING_AGG(
            s.SensorType || ': ' ||
            COALESCE(lsr.ReadingValue::TEXT, 'N/A') || ' ' ||
            COALESCE(lsr.Unit, '') ||
            ' (at ' || COALESCE(TO_CHAR(lsr.RecordedAt, 'HH24:MI:SS'), 'no data') || ')',
            ' | '
        ) AS SensorSummary,
        MAX(lsr.RecordedAt) AS LastReadingAt
    FROM Sensor s
    LEFT JOIN latest_sensor_readings lsr ON lsr.SensorID = s.SensorID AND lsr.rn = 1
    WHERE s.Status = 'Active'
    GROUP BY s.ZoneID
)
SELECT
    -- Hierarchy
    w.WarehouseID,
    w.Name                                          AS WarehouseName,
    z.ZoneID,
    z.ZoneName,
    z.ZoneType,
    r.RackID,
    r.RackCode,
    b.BinID,
    b.BinCode,

    -- Inventory
    p.ProductID,
    p.ProductName,
    p.SKU,
    p.Category,
    ii.Quantity                                     AS CurrentUnitsOfProduct,

    -- Bin occupancy
    b.CurrentStock                                  AS BinCurrentStock,
    b.Capacity                                      AS BinMaxCapacity,
    ROUND(b.CurrentStock::NUMERIC / b.Capacity * 100, 1)
                                                    AS BinUtilisationPct,
    CASE
        WHEN b.CurrentStock  = b.Capacity            THEN 'FULL'
        WHEN b.CurrentStock >= b.Capacity * 0.9      THEN 'NEAR FULL (>=90%)'
        WHEN b.CurrentStock >= b.Capacity * 0.5      THEN 'MODERATE (50-89%)'
        WHEN b.CurrentStock  > 0                     THEN 'LOW (<50%)'
        ELSE                                              'EMPTY'
    END                                             AS BinOccupancyStatus,

    -- Sensor snapshot for the zone
    zs.SensorSummary                                AS ZoneSensorReadings,
    zs.LastReadingAt                                AS ZoneLastSensorAt,

    -- Metadata
    ii.LastUpdated                                  AS StockLastUpdated

FROM Warehouse w
JOIN Zone        z  ON z.WarehouseID = w.WarehouseID
JOIN Rack        r  ON r.ZoneID      = z.ZoneID
JOIN Bin         b  ON b.RackID      = r.RackID
LEFT JOIN InventoryItem ii ON ii.BinID = b.BinID
LEFT JOIN Product       p  ON p.ProductID = ii.ProductID
LEFT JOIN zone_sensors  zs ON zs.ZoneID = z.ZoneID
ORDER BY w.WarehouseID, z.ZoneID, r.RackID, b.BinID, p.ProductName;




-- -----------------------------------------------------------------------------
-- VIEW 2: vw_alert_anomaly_report
--
-- Purpose : Anomaly report - unresolved alerts grouped by Zone and Severity.
-- Usage   : SELECT * FROM vw_alert_anomaly_report;
--           SELECT * FROM vw_alert_anomaly_report WHERE Severity = 'Critical';
-- -----------------------------------------------------------------------------

CREATE OR REPLACE VIEW vw_alert_anomaly_report AS
SELECT
    w.Name                                          AS WarehouseName,
    z.ZoneName,
    z.ZoneType,
    a.Severity,
    a.AlertType,
    COUNT(a.AlertID)                                AS AlertCount,
    MIN(a.RaisedAt)                                 AS OldestAlertAt,
    MAX(a.RaisedAt)                                 AS NewestAlertAt,
    EXTRACT(EPOCH FROM (NOW() - MIN(a.RaisedAt)))/3600
                                                    AS OldestAlertAgeHours,
    STRING_AGG(a.Message, ' || ' ORDER BY a.RaisedAt DESC)
                                                    AS AlertMessages
FROM Alert   a
JOIN Zone    z ON z.ZoneID      = a.ZoneID
JOIN Warehouse w ON w.WarehouseID = z.WarehouseID
WHERE a.Status IN ('Open', 'Acknowledged')  -- unresolved only
GROUP BY w.Name, z.ZoneName, z.ZoneType, a.Severity, a.AlertType
ORDER BY
    CASE a.Severity
        WHEN 'Critical' THEN 1
        WHEN 'High'     THEN 2
        WHEN 'Medium'   THEN 3
        WHEN 'Low'      THEN 4
    END,
    AlertCount DESC;




-- -----------------------------------------------------------------------------
-- VIEW 3: vw_inventory_utilisation
--
-- Purpose : Inventory utilisation - percentage bin occupancy aggregated
--           by Warehouse and Zone.
-- Usage   : SELECT * FROM vw_inventory_utilisation;
-- -----------------------------------------------------------------------------

CREATE OR REPLACE VIEW vw_inventory_utilisation AS
SELECT
    w.WarehouseID,
    w.Name                                                  AS WarehouseName,
    z.ZoneID,
    z.ZoneName,
    z.ZoneType,

    -- Bin counts
    COUNT(b.BinID)                                          AS TotalBins,
    COUNT(b.BinID) FILTER (WHERE b.CurrentStock = 0)        AS EmptyBins,
    COUNT(b.BinID) FILTER (WHERE b.CurrentStock = b.Capacity) AS FullBins,

    -- Stock units
    SUM(b.Capacity)                                         AS TotalCapacityUnits,
    SUM(b.CurrentStock)                                     AS TotalStockUnits,

    -- Utilisation percentage
    ROUND(
        SUM(b.CurrentStock)::NUMERIC / NULLIF(SUM(b.Capacity), 0) * 100
    , 1)                                                    AS UtilisationPct,

    -- Zone health label
    CASE
        WHEN ROUND(SUM(b.CurrentStock)::NUMERIC / NULLIF(SUM(b.Capacity),0)*100,1) = 100  THEN 'CRITICAL - Zone Full'
        WHEN ROUND(SUM(b.CurrentStock)::NUMERIC / NULLIF(SUM(b.Capacity),0)*100,1) >= 90  THEN 'WARNING - Near Capacity'
        WHEN ROUND(SUM(b.CurrentStock)::NUMERIC / NULLIF(SUM(b.Capacity),0)*100,1) >= 60  THEN 'MODERATE'
        WHEN ROUND(SUM(b.CurrentStock)::NUMERIC / NULLIF(SUM(b.Capacity),0)*100,1) >  0   THEN 'LOW USAGE'
        ELSE                                                                                    'UNUSED'
    END                                                     AS ZoneHealthStatus,

    -- Distinct products in the zone
    COUNT(DISTINCT ii.ProductID)                            AS UniqueProducts

FROM Warehouse   w
JOIN Zone        z  ON z.WarehouseID = w.WarehouseID
JOIN Rack        r  ON r.ZoneID      = z.ZoneID
JOIN Bin         b  ON b.RackID      = r.RackID
LEFT JOIN InventoryItem ii ON ii.BinID = b.BinID AND ii.Quantity > 0
GROUP BY w.WarehouseID, w.Name, z.ZoneID, z.ZoneName, z.ZoneType
ORDER BY w.WarehouseID, UtilisationPct DESC;




-- =============================================================================
-- AD-HOC ANALYTICAL QUERIES
-- (Can be run standalone or wrapped as additional views / reporting queries)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- QUERY Q1: Live Digital Twin State - full view
-- -----------------------------------------------------------------------------
-- SELECT * FROM vw_live_digital_twin_state;


-- -----------------------------------------------------------------------------
-- QUERY Q2: Top 5 bins closest to overflowing (by utilisation %)
-- -----------------------------------------------------------------------------
SELECT
    w.Name          AS Warehouse,
    z.ZoneName,
    r.RackCode,
    b.BinCode,
    b.CurrentStock,
    b.Capacity,
    ROUND(b.CurrentStock::NUMERIC / b.Capacity * 100, 1) AS UtilPct,
    STRING_AGG(p.ProductName, ', ')                       AS Products
FROM Bin         b
JOIN Rack        r  ON r.RackID      = b.RackID
JOIN Zone        z  ON z.ZoneID      = r.ZoneID
JOIN Warehouse   w  ON w.WarehouseID = z.WarehouseID
LEFT JOIN InventoryItem ii ON ii.BinID    = b.BinID
LEFT JOIN Product       p  ON p.ProductID = ii.ProductID
GROUP BY w.Name, z.ZoneName, r.RackCode, b.BinCode, b.CurrentStock, b.Capacity
ORDER BY UtilPct DESC
LIMIT 5;


-- -----------------------------------------------------------------------------
-- QUERY Q3: Anomaly report - unresolved alerts with age and location path
-- -----------------------------------------------------------------------------
SELECT
    a.AlertID,
    w.Name                                                         AS Warehouse,
    z.ZoneName,
    b.BinCode,
    s.SensorType,
    a.AlertType,
    a.Severity,
    a.Status,
    a.Message,
    a.RaisedAt,
    ROUND(EXTRACT(EPOCH FROM (NOW() - a.RaisedAt)) / 3600, 1)     AS AgeHours
FROM Alert       a
LEFT JOIN Zone   z  ON z.ZoneID      = a.ZoneID
LEFT JOIN Warehouse w ON w.WarehouseID = z.WarehouseID
LEFT JOIN Bin    b  ON b.BinID       = a.BinID
LEFT JOIN Sensor s  ON s.SensorID    = a.SensorID
WHERE a.Status IN ('Open', 'Acknowledged')
ORDER BY
    CASE a.Severity WHEN 'Critical' THEN 1 WHEN 'High' THEN 2
                    WHEN 'Medium'   THEN 3 ELSE 4 END,
    a.RaisedAt ASC;


-- -----------------------------------------------------------------------------
-- QUERY Q4: Products with stock below their reorder level (across all bins)
-- -----------------------------------------------------------------------------
SELECT
    p.SKU,
    p.ProductName,
    p.Category,
    p.ReorderLevel,
    COALESCE(SUM(ii.Quantity), 0)   AS TotalStockAllBins,
    COUNT(DISTINCT ii.BinID)        AS BinCount,
    CASE WHEN COALESCE(SUM(ii.Quantity),0) < p.ReorderLevel
         THEN '! REORDER NOW'
         ELSE 'OK'
    END                             AS ReorderStatus
FROM Product p
LEFT JOIN InventoryItem ii ON ii.ProductID = p.ProductID
GROUP BY p.ProductID, p.SKU, p.ProductName, p.Category, p.ReorderLevel
HAVING COALESCE(SUM(ii.Quantity), 0) < p.ReorderLevel
ORDER BY TotalStockAllBins ASC;


-- -----------------------------------------------------------------------------
-- QUERY Q5: Order fulfilment summary with shipment status
-- -----------------------------------------------------------------------------
SELECT
    o.OrderID,
    o.CustomerName,
    o.OrderDate,
    o.Status                        AS OrderStatus,
    o.TotalAmount,
    COUNT(oi.OrderItemID)           AS LineItems,
    SUM(oi.Quantity)                AS TotalUnitsOrdered,
    sh.TrackingNumber,
    sh.Carrier,
    sh.Status                       AS ShipmentStatus,
    sh.EstimatedArrival
FROM "Order"   o
LEFT JOIN OrderItem  oi ON oi.OrderID    = o.OrderID
LEFT JOIN Shipment   sh ON sh.OrderID    = o.OrderID
GROUP BY o.OrderID, o.CustomerName, o.OrderDate, o.Status, o.TotalAmount,
         sh.TrackingNumber, sh.Carrier, sh.Status, sh.EstimatedArrival
ORDER BY o.OrderDate DESC;


-- -----------------------------------------------------------------------------
-- QUERY Q6: Digital Twin Time-Travel - warehouse state evolution over time
--           (requires DigitalTwinSnapshot records)
-- -----------------------------------------------------------------------------
SELECT
    dts.SnapshotID,
    w.Name                          AS WarehouseName,
    dts.SnapshotTime,
    dts.TotalBins,
    dts.OccupiedBins,
    dts.TotalStockUnits,
    dts.ActiveAlerts,
    dts.ActiveSensors,
    ROUND(dts.OccupiedBins::NUMERIC / NULLIF(dts.TotalBins,0) * 100, 1)
                                    AS OccupancyPct,
    LAG(dts.TotalStockUnits) OVER (PARTITION BY dts.WarehouseID ORDER BY dts.SnapshotTime)
                                    AS PrevSnapshotStock,
    dts.TotalStockUnits -
    LAG(dts.TotalStockUnits) OVER (PARTITION BY dts.WarehouseID ORDER BY dts.SnapshotTime)
                                    AS StockDeltaSinceLast
FROM DigitalTwinSnapshot dts
JOIN Warehouse w ON w.WarehouseID = dts.WarehouseID
ORDER BY dts.WarehouseID, dts.SnapshotTime;


-- -----------------------------------------------------------------------------
-- QUERY Q7: Sensor health dashboard - active vs faulty sensors per zone
-- -----------------------------------------------------------------------------
SELECT
    w.Name                          AS Warehouse,
    z.ZoneName,
    COUNT(s.SensorID)               AS TotalSensors,
    COUNT(s.SensorID) FILTER (WHERE s.Status = 'Active')            AS Active,
    COUNT(s.SensorID) FILTER (WHERE s.Status = 'Faulty')            AS Faulty,
    COUNT(s.SensorID) FILTER (WHERE s.Status = 'Maintenance')       AS InMaintenance,
    COUNT(s.SensorID) FILTER (WHERE s.Status = 'Inactive')          AS Inactive,
    ROUND(
        COUNT(s.SensorID) FILTER (WHERE s.Status = 'Active')::NUMERIC
        / NULLIF(COUNT(s.SensorID), 0) * 100
    , 1)                            AS ActiveRatePct
FROM Sensor    s
JOIN Zone      z  ON z.ZoneID      = s.ZoneID
JOIN Warehouse w  ON w.WarehouseID = z.WarehouseID
GROUP BY w.Name, z.ZoneName
ORDER BY w.Name, ActiveRatePct ASC;


-- -----------------------------------------------------------------------------
-- QUERY Q8: Inventory utilisation - full view
-- -----------------------------------------------------------------------------
-- SELECT * FROM vw_inventory_utilisation;

-- =============================================================================
-- END OF VIEWS & QUERIES SCRIPT
-- =============================================================================
