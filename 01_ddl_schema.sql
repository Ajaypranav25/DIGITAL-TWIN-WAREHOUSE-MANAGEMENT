-- =============================================================================
-- FILE: 01_ddl_schema.sql
-- PROJECT: Digital Twin Warehouse Management System
-- DESCRIPTION: Schema creation script - all tables in 3NF.
--              Compatible with PostgreSQL 14+ (and largely SQL-92/MySQL 8+).
-- AUTHOR: Digital Twin WMS Team
-- DATE: 2026-09-20
-- =============================================================================

-- Drop existing objects to allow clean re-runs (reverse dependency order)
DROP TABLE IF EXISTS DigitalTwinSnapshot CASCADE;
DROP TABLE IF EXISTS Shipment          CASCADE;
DROP TABLE IF EXISTS OrderItem         CASCADE;
DROP TABLE IF EXISTS "Order"           CASCADE;
DROP TABLE IF EXISTS Alert             CASCADE;
DROP TABLE IF EXISTS SensorReading     CASCADE;
DROP TABLE IF EXISTS Sensor            CASCADE;
DROP TABLE IF EXISTS Equipment         CASCADE;
DROP TABLE IF EXISTS Employee          CASCADE;
DROP TABLE IF EXISTS InventoryItem     CASCADE;
DROP TABLE IF EXISTS Bin               CASCADE;
DROP TABLE IF EXISTS Rack              CASCADE;
DROP TABLE IF EXISTS Zone              CASCADE;
DROP TABLE IF EXISTS Product           CASCADE;
DROP TABLE IF EXISTS Warehouse         CASCADE;

-- =============================================================================
-- 1. WAREHOUSE
--    Root of the physical hierarchy.
-- =============================================================================
CREATE TABLE Warehouse (
    WarehouseID     SERIAL          PRIMARY KEY,
    Name            VARCHAR(120)    NOT NULL,
    Location        VARCHAR(255)    NOT NULL,
    TotalCapacity   INT             NOT NULL CHECK (TotalCapacity > 0),
    ManagerName     VARCHAR(120)    NOT NULL,
    CreatedAt       TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);




-- =============================================================================
-- 2. ZONE
--    A logical subdivision of a warehouse (e.g., "Cold Storage", "Hazmat").
-- =============================================================================
CREATE TABLE Zone (
    ZoneID          SERIAL          PRIMARY KEY,
    WarehouseID     INT             NOT NULL REFERENCES Warehouse(WarehouseID) ON DELETE CASCADE,
    ZoneName        VARCHAR(100)    NOT NULL,
    ZoneType        VARCHAR(60)     NOT NULL
                        CHECK (ZoneType IN ('General','Cold Storage','Hazmat','Flammable','Electronics','Bulk')),
    FloorArea_sqm   NUMERIC(10,2)   NOT NULL CHECK (FloorArea_sqm > 0),
    CreatedAt       TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);



-- =============================================================================
-- 3. RACK
--    A physical shelving unit within a zone.
-- =============================================================================
CREATE TABLE Rack (
    RackID          SERIAL          PRIMARY KEY,
    ZoneID          INT             NOT NULL REFERENCES Zone(ZoneID) ON DELETE CASCADE,
    RackCode        VARCHAR(30)     NOT NULL,
    NumberOfShelves SMALLINT        NOT NULL CHECK (NumberOfShelves > 0),
    MaxWeightKg     NUMERIC(10,2)   NOT NULL CHECK (MaxWeightKg > 0),
    CreatedAt       TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    UNIQUE (ZoneID, RackCode)
);



-- =============================================================================
-- 4. BIN
--    The smallest storage unit - one shelf slot on a rack.
-- =============================================================================
CREATE TABLE Bin (
    BinID           SERIAL          PRIMARY KEY,
    RackID          INT             NOT NULL REFERENCES Rack(RackID) ON DELETE CASCADE,
    BinCode         VARCHAR(30)     NOT NULL,
    Capacity        INT             NOT NULL CHECK (Capacity > 0),
    CurrentStock    INT             NOT NULL DEFAULT 0 CHECK (CurrentStock >= 0),
    CreatedAt       TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    UNIQUE (RackID, BinCode),
    CONSTRAINT chk_stock_lte_capacity CHECK (CurrentStock <= Capacity)
);




-- =============================================================================
-- 5. PRODUCT
--    Master data for a stock-keeping unit.
-- =============================================================================
CREATE TABLE Product (
    ProductID       SERIAL          PRIMARY KEY,
    SKU             VARCHAR(60)     NOT NULL UNIQUE,
    ProductName     VARCHAR(200)    NOT NULL,
    Category        VARCHAR(80)     NOT NULL,
    UnitWeightKg    NUMERIC(8,3)    NOT NULL CHECK (UnitWeightKg > 0),
    UnitPrice       NUMERIC(12,2)   NOT NULL CHECK (UnitPrice >= 0),
    ReorderLevel    INT             NOT NULL DEFAULT 10 CHECK (ReorderLevel >= 0),
    CreatedAt       TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);




-- =============================================================================
-- 6. INVENTORY ITEM  (Associative / Bridge entity: Bin <-> Product)
--    Resolves the M:N between Bin and Product.
--    Each row represents a quantity of ONE product stored in ONE bin.
-- =============================================================================
CREATE TABLE InventoryItem (
    InventoryItemID SERIAL          PRIMARY KEY,
    BinID           INT             NOT NULL REFERENCES Bin(BinID) ON DELETE CASCADE,
    ProductID       INT             NOT NULL REFERENCES Product(ProductID) ON DELETE RESTRICT,
    Quantity        INT             NOT NULL DEFAULT 0 CHECK (Quantity >= 0),
    LastUpdated     TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    UNIQUE (BinID, ProductID)           -- one product appears at most once per bin
);



-- =============================================================================
-- 7. SENSOR
--    A physical IoT device installed in a zone (or at a bin).
-- =============================================================================
CREATE TABLE Sensor (
    SensorID        SERIAL          PRIMARY KEY,
    ZoneID          INT             NOT NULL REFERENCES Zone(ZoneID) ON DELETE CASCADE,
    BinID           INT                      REFERENCES Bin(BinID)  ON DELETE SET NULL,  -- optional bin-level
    SensorType      VARCHAR(60)     NOT NULL
                        CHECK (SensorType IN ('Temperature','Humidity','Weight','RFID','Smoke','CO2','Vibration')),
    Model           VARCHAR(100),
    InstallDate     DATE            NOT NULL,
    Status          VARCHAR(20)     NOT NULL DEFAULT 'Active'
                        CHECK (Status IN ('Active','Inactive','Faulty','Maintenance')),
    ThresholdMin    NUMERIC(10,3),
    ThresholdMax    NUMERIC(10,3)
);



-- =============================================================================
-- 8. SENSOR READING
--    Time-series records of each sensor measurement (append-only).
-- =============================================================================
CREATE TABLE SensorReading (
    ReadingID       SERIAL          PRIMARY KEY,
    SensorID        INT             NOT NULL REFERENCES Sensor(SensorID) ON DELETE CASCADE,
    ReadingValue    NUMERIC(12,4)   NOT NULL,
    Unit            VARCHAR(20)     NOT NULL,   -- e.g. 'degC', 'kg', '%', 'boolean'
    RecordedAt      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);


-- Composite index to speed up "latest reading per sensor" queries
CREATE INDEX idx_sr_sensor_time ON SensorReading(SensorID, RecordedAt DESC);

-- =============================================================================
-- 9. ALERT
--    An anomaly record raised by trigger logic or automated checks.
-- =============================================================================
CREATE TABLE Alert (
    AlertID         SERIAL          PRIMARY KEY,
    ZoneID          INT                      REFERENCES Zone(ZoneID)  ON DELETE SET NULL,
    SensorID        INT                      REFERENCES Sensor(SensorID) ON DELETE SET NULL,
    BinID           INT                      REFERENCES Bin(BinID)    ON DELETE SET NULL,
    AlertType       VARCHAR(60)     NOT NULL
                        CHECK (AlertType IN ('Overstocked','Threshold Breach','Sensor Failure',
                                             'Low Stock','Equipment Fault','Environmental')),
    Severity        VARCHAR(20)     NOT NULL
                        CHECK (Severity IN ('Low','Medium','High','Critical')),
    Message         TEXT            NOT NULL,
    Status          VARCHAR(20)     NOT NULL DEFAULT 'Open'
                        CHECK (Status IN ('Open','Acknowledged','Resolved')),
    RaisedAt        TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    ResolvedAt      TIMESTAMPTZ,
    CONSTRAINT chk_resolved_after_raised CHECK (ResolvedAt IS NULL OR ResolvedAt >= RaisedAt)
);



-- =============================================================================
-- 10. EMPLOYEE
--     Warehouse staff who can be assigned to zones.
-- =============================================================================
CREATE TABLE Employee (
    EmployeeID      SERIAL          PRIMARY KEY,
    ZoneID          INT                      REFERENCES Zone(ZoneID) ON DELETE SET NULL,
    FirstName       VARCHAR(80)     NOT NULL,
    LastName        VARCHAR(80)     NOT NULL,
    Role            VARCHAR(60)     NOT NULL
                        CHECK (Role IN ('Manager','Operator','Technician','Security','Analyst','Driver')),
    Email           VARCHAR(150)    NOT NULL UNIQUE,
    PhoneNumber     VARCHAR(20),
    HireDate        DATE            NOT NULL,
    IsActive        BOOLEAN         NOT NULL DEFAULT TRUE
);



-- =============================================================================
-- 11. EQUIPMENT
--     Machinery/vehicles assigned to zones (forklifts, conveyors, etc.).
-- =============================================================================
CREATE TABLE Equipment (
    EquipmentID     SERIAL          PRIMARY KEY,
    ZoneID          INT                      REFERENCES Zone(ZoneID) ON DELETE SET NULL,
    EquipmentName   VARCHAR(120)    NOT NULL,
    EquipmentType   VARCHAR(60)     NOT NULL
                        CHECK (EquipmentType IN ('Forklift','Conveyor','Crane','RFID Scanner',
                                                  'Pallet Jack','Robot','Charging Station','Other')),
    SerialNumber    VARCHAR(80)     NOT NULL UNIQUE,
    Status          VARCHAR(20)     NOT NULL DEFAULT 'Operational'
                        CHECK (Status IN ('Operational','Under Maintenance','Decommissioned')),
    LastServiceDate DATE
);



-- =============================================================================
-- 12. ORDER
--     A customer purchase/fulfilment request.
-- =============================================================================
CREATE TABLE "Order" (
    OrderID         SERIAL          PRIMARY KEY,
    CustomerName    VARCHAR(150)    NOT NULL,
    CustomerEmail   VARCHAR(150),
    OrderDate       TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    Status          VARCHAR(30)     NOT NULL DEFAULT 'Pending'
                        CHECK (Status IN ('Pending','Processing','Partially Fulfilled',
                                          'Fulfilled','Cancelled')),
    TotalAmount     NUMERIC(14,2)   NOT NULL DEFAULT 0 CHECK (TotalAmount >= 0),
    Notes           TEXT
);



-- =============================================================================
-- 13. ORDER ITEM  (Associative / Bridge entity: Order <-> Product)
--     Resolves the M:N between Order and Product.
-- =============================================================================
CREATE TABLE OrderItem (
    OrderItemID     SERIAL          PRIMARY KEY,
    OrderID         INT             NOT NULL REFERENCES "Order"(OrderID) ON DELETE CASCADE,
    ProductID       INT             NOT NULL REFERENCES Product(ProductID) ON DELETE RESTRICT,
    Quantity        INT             NOT NULL CHECK (Quantity > 0),
    UnitPriceAtSale NUMERIC(12,2)  NOT NULL CHECK (UnitPriceAtSale >= 0),
    UNIQUE (OrderID, ProductID)
);



-- =============================================================================
-- 14. SHIPMENT
--     Records the physical dispatch of an order from the warehouse.
-- =============================================================================
CREATE TABLE Shipment (
    ShipmentID      SERIAL          PRIMARY KEY,
    OrderID         INT             NOT NULL UNIQUE REFERENCES "Order"(OrderID) ON DELETE CASCADE,
    ShippedAt       TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    Carrier         VARCHAR(100)    NOT NULL,
    TrackingNumber  VARCHAR(100),
    EstimatedArrival DATE,
    Status          VARCHAR(30)     NOT NULL DEFAULT 'In Transit'
                        CHECK (Status IN ('Preparing','In Transit','Delivered','Failed','Returned'))
);



-- =============================================================================
-- 15. DIGITAL TWIN SNAPSHOT
--     Periodic point-in-time snapshot of a warehouse's overall state.
--     Enables "time travel" / historical reconstruction queries.
-- =============================================================================
CREATE TABLE DigitalTwinSnapshot (
    SnapshotID          SERIAL          PRIMARY KEY,
    WarehouseID         INT             NOT NULL REFERENCES Warehouse(WarehouseID) ON DELETE CASCADE,
    SnapshotTime        TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    TotalBins           INT             NOT NULL CHECK (TotalBins >= 0),
    OccupiedBins        INT             NOT NULL CHECK (OccupiedBins >= 0),
    TotalStockUnits     INT             NOT NULL CHECK (TotalStockUnits >= 0),
    ActiveAlerts        INT             NOT NULL DEFAULT 0 CHECK (ActiveAlerts >= 0),
    ActiveSensors       INT             NOT NULL CHECK (ActiveSensors >= 0),
    SnapshotPayloadJSON JSONB,          -- full JSON payload for replay/simulation
    CreatedBy           VARCHAR(100)    NOT NULL DEFAULT 'system',
    CONSTRAINT chk_occupied_lte_total CHECK (OccupiedBins <= TotalBins)
);




-- =============================================================================
-- ADDITIONAL INDEXES FOR COMMON QUERY PATTERNS
-- =============================================================================
CREATE INDEX idx_zone_warehouse      ON Zone(WarehouseID);
CREATE INDEX idx_rack_zone           ON Rack(ZoneID);
CREATE INDEX idx_bin_rack            ON Bin(RackID);
CREATE INDEX idx_inv_bin             ON InventoryItem(BinID);
CREATE INDEX idx_inv_product         ON InventoryItem(ProductID);
CREATE INDEX idx_sensor_zone         ON Sensor(ZoneID);
CREATE INDEX idx_alert_zone          ON Alert(ZoneID);
CREATE INDEX idx_alert_status        ON Alert(Status);
CREATE INDEX idx_orderitem_order     ON OrderItem(OrderID);
CREATE INDEX idx_orderitem_product   ON OrderItem(ProductID);
CREATE INDEX idx_snapshot_warehouse  ON DigitalTwinSnapshot(WarehouseID, SnapshotTime DESC);
CREATE INDEX idx_employee_zone       ON Employee(ZoneID);
CREATE INDEX idx_equipment_zone      ON Equipment(ZoneID);

-- =============================================================================
-- END OF DDL SCRIPT
-- =============================================================================
