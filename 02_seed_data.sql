-- =============================================================================
-- FILE: 02_seed_data.sql
-- PROJECT: Digital Twin Warehouse Management System
-- DESCRIPTION: Realistic seed / sample data covering all 15 tables.
--              Provides a coherent narrative across two warehouses.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. WAREHOUSES  (2 facilities)
-- -----------------------------------------------------------------------------
INSERT INTO Warehouse (Name, Location, TotalCapacity, ManagerName) VALUES
  ('North Hub Logistics Center',  'Industrial Park, Delhi, IN',   5000, 'Rajesh Kumar'),
  ('South Bay Distribution Hub',  'Port Area, Chennai, IN',       8000, 'Priya Sharma');

-- -----------------------------------------------------------------------------
-- 2. ZONES  (5 zones across the two warehouses)
-- -----------------------------------------------------------------------------
INSERT INTO Zone (WarehouseID, ZoneName, ZoneType, FloorArea_sqm) VALUES
  (1, 'Z-A General Storage',    'General',      1200.00),   -- ZoneID 1
  (1, 'Z-B Cold Storage',       'Cold Storage',  400.00),   -- ZoneID 2
  (1, 'Z-C Electronics Vault',  'Electronics',   300.00),   -- ZoneID 3
  (2, 'Z-D Bulk Goods',         'Bulk',         2500.00),   -- ZoneID 4
  (2, 'Z-E Hazmat Compound',    'Hazmat',        500.00);   -- ZoneID 5

-- -----------------------------------------------------------------------------
-- 3. RACKS  (3 racks per zone = 15 racks total)
-- -----------------------------------------------------------------------------
INSERT INTO Rack (ZoneID, RackCode, NumberOfShelves, MaxWeightKg) VALUES
  -- Zone 1 racks
  (1, 'R-A01', 5, 2000.00), (1, 'R-A02', 5, 2000.00), (1, 'R-A03', 4, 1500.00),
  -- Zone 2 racks
  (2, 'R-B01', 3, 800.00),  (2, 'R-B02', 3, 800.00),  (2, 'R-B03', 3, 800.00),
  -- Zone 3 racks
  (3, 'R-C01', 4, 600.00),  (3, 'R-C02', 4, 600.00),  (3, 'R-C03', 3, 500.00),
  -- Zone 4 racks
  (4, 'R-D01', 6, 5000.00), (4, 'R-D02', 6, 5000.00), (4, 'R-D03', 5, 4000.00),
  -- Zone 5 racks
  (5, 'R-E01', 3, 1000.00), (5, 'R-E02', 3, 1000.00), (5, 'R-E03', 2, 800.00);

-- -----------------------------------------------------------------------------
-- 4. BINS  (2?3 bins per rack - 36 bins total; we insert representative sample)
-- -----------------------------------------------------------------------------
INSERT INTO Bin (RackID, BinCode, Capacity, CurrentStock) VALUES
  -- Rack 1 (R-A01)
  (1, 'BIN-001', 100, 60), (1, 'BIN-002', 100, 100), (1, 'BIN-003', 100, 45),
  -- Rack 2 (R-A02)
  (2, 'BIN-004', 100, 80), (2, 'BIN-005', 100,  0),  (2, 'BIN-006', 100, 20),
  -- Rack 3 (R-A03)
  (3, 'BIN-007',  80, 80), (3, 'BIN-008',  80, 30),
  -- Rack 4 (R-B01) - Cold Storage
  (4, 'BIN-009',  50, 48), (4, 'BIN-010',  50, 12),
  -- Rack 5 (R-B02)
  (5, 'BIN-011',  50, 50), (5, 'BIN-012',  50, 22),
  -- Rack 6 (R-B03)
  (6, 'BIN-013',  50, 35),
  -- Rack 7 (R-C01) - Electronics
  (7, 'BIN-014',  40, 39), (7, 'BIN-015',  40, 15),
  -- Rack 8 (R-C02)
  (8, 'BIN-016',  40, 40),
  -- Rack 9 (R-C03)
  (9, 'BIN-017',  30, 10),
  -- Rack 10 (R-D01) - Bulk
  (10,'BIN-018', 200,180), (10,'BIN-019', 200, 90),
  -- Rack 11 (R-D02)
  (11,'BIN-020', 200, 50), (11,'BIN-021', 200,200),
  -- Rack 12 (R-D03)
  (12,'BIN-022', 150, 70),
  -- Rack 13 (R-E01) - Hazmat
  (13,'BIN-023',  30, 28), (13,'BIN-024',  30, 10),
  -- Rack 14 (R-E02)
  (14,'BIN-025',  30, 30),
  -- Rack 15 (R-E03)
  (15,'BIN-026',  20,  5);

-- -----------------------------------------------------------------------------
-- 5. PRODUCTS  (12 unique SKUs)
-- -----------------------------------------------------------------------------
INSERT INTO Product (SKU, ProductName, Category, UnitWeightKg, UnitPrice, ReorderLevel) VALUES
  ('SKU-0001', 'Industrial Grade Bolt M12',     'Hardware',     0.050,   2.50,  50),
  ('SKU-0002', 'Bearing 6205-ZZ',               'Hardware',     0.085,  12.00,  30),
  ('SKU-0003', 'Organic Frozen Peas 500g',      'Food',         0.500,   1.80, 100),
  ('SKU-0004', 'Greek Yogurt 1L',               'Food',         1.020,   2.20,  80),
  ('SKU-0005', 'Laptop Core i7 16GB',           'Electronics', 1.800, 850.00,   5),
  ('SKU-0006', 'USB-C Hub 7-Port',              'Electronics', 0.220,  28.00,  15),
  ('SKU-0007', 'Safety Gloves (Pair)',          'Safety',       0.120,   4.50,  40),
  ('SKU-0008', 'Bulk Cement 50kg Bag',          'Construction',50.000,   9.00,  20),
  ('SKU-0009', 'Chemical Solvent Drum 200L',    'Chemicals',  180.000, 250.00,   5),
  ('SKU-0010', 'Packaging Bubble Wrap 50m',     'Packaging',    3.500,  15.00,  25),
  ('SKU-0011', 'LED Floodlight 100W',           'Electrical',   1.200,  45.00,  10),
  ('SKU-0012', 'Steel Cable 10mm x 100m',       'Hardware',    65.000, 120.00,   8);

-- -----------------------------------------------------------------------------
-- 6. INVENTORY ITEMS  (products distributed across bins)
-- -----------------------------------------------------------------------------
INSERT INTO InventoryItem (BinID, ProductID, Quantity, LastUpdated) VALUES
  -- General Storage (Zone A)
  (1,  1,  60, NOW() - INTERVAL '2 hours'),
  (2,  2, 100, NOW() - INTERVAL '1 hour'),       -- bin full
  (3,  7,  45, NOW() - INTERVAL '3 hours'),
  (4,  10,  80, NOW() - INTERVAL '4 hours'),
  (6,  11,  20, NOW() - INTERVAL '5 hours'),
  (7,  12,  80, NOW() - INTERVAL '6 hours'),     -- bin full (80/80)
  (8,  1,  30, NOW() - INTERVAL '7 hours'),
  -- Cold Storage (Zone B)
  (9,  3,  48, NOW() - INTERVAL '1 hour'),       -- near full (48/50)
  (10, 4,  12, NOW() - INTERVAL '2 hours'),
  (11, 3,  50, NOW() - INTERVAL '30 minutes'),   -- bin full
  (12, 4,  22, NOW() - INTERVAL '90 minutes'),
  (13, 3,  35, NOW() - INTERVAL '2 hours'),
  -- Electronics (Zone C)
  (14, 5,  39, NOW() - INTERVAL '1 day'),        -- near full (39/40)
  (15, 6,  15, NOW() - INTERVAL '2 days'),
  (16, 5,  40, NOW() - INTERVAL '12 hours'),     -- bin full
  (17, 6,  10, NOW() - INTERVAL '3 days'),
  -- Bulk (Zone D)
  (18, 8, 180, NOW() - INTERVAL '6 hours'),
  (19, 8,  90, NOW() - INTERVAL '4 hours'),
  (20, 10,  50, NOW() - INTERVAL '8 hours'),
  (21, 8, 200, NOW() - INTERVAL '2 hours'),      -- bin full
  (22, 10,  70, NOW() - INTERVAL '3 hours'),
  -- Hazmat (Zone E)
  (23, 9,  28, NOW() - INTERVAL '1 day'),        -- near full (28/30)
  (24, 9,  10, NOW() - INTERVAL '2 days'),
  (25, 9,  30, NOW() - INTERVAL '12 hours'),     -- bin full
  (26, 9,   5, NOW() - INTERVAL '3 days');

-- -----------------------------------------------------------------------------
-- 7. SENSORS
-- -----------------------------------------------------------------------------
INSERT INTO Sensor (ZoneID, BinID, SensorType, Model, InstallDate, Status, ThresholdMin, ThresholdMax) VALUES
  -- Zone 1 General
  (1, NULL, 'Temperature', 'DS18B20-Pro',      '2024-01-10', 'Active',  10.0,  30.0),
  (1, NULL, 'Weight',      'LoadCell-1T',       '2024-01-10', 'Active',   0.0,1800.0),
  (1, 2,    'RFID',        'Zebra FX7500',      '2024-02-15', 'Active',  NULL,  NULL),
  -- Zone 2 Cold Storage
  (2, NULL, 'Temperature', 'DS18B20-Pro',      '2024-01-12', 'Active',  -5.0,   8.0),
  (2, NULL, 'Humidity',    'DHT22-Pro',         '2024-01-12', 'Active',  60.0,  80.0),
  (2, 9,    'Weight',      'LoadCell-200kg',    '2024-03-01', 'Active',   0.0, 100.0),
  -- Zone 3 Electronics
  (3, NULL, 'Temperature', 'DS18B20-Hi',       '2024-01-15', 'Active',  15.0,  25.0),
  (3, NULL, 'Humidity',    'DHT22-Pro',         '2024-01-15', 'Active',  30.0,  60.0),
  (3, 14,   'RFID',        'Zebra FX9600',      '2024-02-20', 'Faulty',  NULL,  NULL),
  -- Zone 4 Bulk
  (4, NULL, 'Weight',      'FloorScale-5T',    '2024-01-20', 'Active',   0.0,4500.0),
  (4, NULL, 'Temperature', 'DS18B20-Pro',      '2024-01-20', 'Active',   5.0,  40.0),
  -- Zone 5 Hazmat
  (5, NULL, 'CO2',         'CO2Meter-NDIR',     '2024-01-25', 'Active', 400.0,1000.0),
  (5, NULL, 'Smoke',       'SmokeDetect-X2',   '2024-01-25', 'Active',   0.0,   0.5),
  (5, NULL, 'Temperature', 'DS18B20-Pro',      '2024-01-25', 'Active',   5.0,  35.0);
  -- SensorIDs: 1..14

-- -----------------------------------------------------------------------------
-- 8. SENSOR READINGS  (time-series history - recent readings)
-- -----------------------------------------------------------------------------
INSERT INTO SensorReading (SensorID, ReadingValue, Unit, RecordedAt) VALUES
  -- SensorID 1: Zone-A Temperature (normal)
  (1, 22.4, 'degC', NOW() - INTERVAL '10 minutes'),
  (1, 22.1, 'degC', NOW() - INTERVAL '20 minutes'),
  (1, 21.8, 'degC', NOW() - INTERVAL '30 minutes'),
  -- SensorID 2: Zone-A Weight
  (2, 1420.5, 'kg', NOW() - INTERVAL '10 minutes'),
  (2, 1380.0, 'kg', NOW() - INTERVAL '20 minutes'),
  -- SensorID 3: Zone-A RFID (1 = tag detected, 0 = absent)
  (3, 1.0, 'boolean', NOW() - INTERVAL '5 minutes'),
  -- SensorID 4: Zone-B Cold Temperature - BREACH (above 8degC threshold)
  (4, 26.8, 'degC', NOW() - INTERVAL '5 minutes'),   -- BREACH: > 8degC
  (4,  7.2, 'degC', NOW() - INTERVAL '15 minutes'),
  (4,  6.5, 'degC', NOW() - INTERVAL '30 minutes'),
  -- SensorID 5: Zone-B Humidity (normal)
  (5, 72.3, '%', NOW() - INTERVAL '10 minutes'),
  (5, 71.8, '%', NOW() - INTERVAL '20 minutes'),
  -- SensorID 6: Zone-B Bin-9 Weight
  (6, 47.8, 'kg', NOW() - INTERVAL '10 minutes'),
  -- SensorID 7: Zone-C Electronics Temperature - BREACH (above 25degC)
  (7, 27.3, 'degC', NOW() - INTERVAL '3 minutes'),   -- BREACH: > 25degC
  (7, 24.9, 'degC', NOW() - INTERVAL '13 minutes'),
  -- SensorID 8: Zone-C Humidity (normal)
  (8, 45.2, '%', NOW() - INTERVAL '10 minutes'),
  -- SensorID 9: Faulty RFID (no recent readings)
  -- SensorID 10: Zone-D Floor Weight
  (10, 8200.0, 'kg', NOW() - INTERVAL '15 minutes'),
  (10, 7900.5, 'kg', NOW() - INTERVAL '30 minutes'),
  -- SensorID 11: Zone-D Temperature (normal)
  (11, 18.6, 'degC', NOW() - INTERVAL '10 minutes'),
  -- SensorID 12: Zone-E CO2 (slightly elevated)
  (12, 650.0, 'ppm', NOW() - INTERVAL '10 minutes'),
  (12, 420.0, 'ppm', NOW() - INTERVAL '20 minutes'),
  -- SensorID 13: Zone-E Smoke (normal)
  (13,  0.02, 'AU',  NOW() - INTERVAL '10 minutes'),
  -- SensorID 14: Zone-E Temperature (normal)
  (14, 28.5, 'degC', NOW() - INTERVAL '10 minutes'),
  (14, 27.0, 'degC', NOW() - INTERVAL '20 minutes');

-- -----------------------------------------------------------------------------
-- 9. ALERTS
-- -----------------------------------------------------------------------------
INSERT INTO Alert (ZoneID, SensorID, BinID, AlertType, Severity, Message, Status, RaisedAt) VALUES
  -- Overstocked bin (BIN-002 = BinID 2, Zone 1)
  (1, NULL, 2,  'Overstocked',       'High',     'BIN-002 in R-A01 is at 100% capacity (100/100 units). No further stocking allowed.',                   'Open',         NOW() - INTERVAL '1 hour'),
  -- Temperature breach in Cold Storage (Zone 2, Sensor 4)
  (2, 4,    NULL,'Threshold Breach', 'Critical', 'Zone-B Cold Storage: Temperature sensor DS18B20-Pro read 26.8degC, breaching max threshold of 8.0degC.',   'Open',         NOW() - INTERVAL '5 minutes'),
  -- Temperature breach in Electronics (Zone 3, Sensor 7)
  (3, 7,    NULL,'Threshold Breach', 'High',     'Zone-C Electronics: Temperature 27.3degC exceeds maximum safe limit of 25degC. Risk of equipment damage.', 'Open',         NOW() - INTERVAL '3 minutes'),
  -- Faulty sensor alert (Zone 3, Sensor 9)
  (3, 9,    NULL,'Sensor Failure',   'Medium',   'RFID Sensor (Zebra FX9600) in Zone-C is FAULTY. Last ping was 48 hours ago.',                          'Acknowledged', NOW() - INTERVAL '2 days'),
  -- Overstocked bins (BIN-007 = BinID 7, Zone 1)
  (1, NULL, 7,  'Overstocked',       'High',     'BIN-007 in R-A03 is at 100% capacity (80/80 units).',                                                   'Resolved',     NOW() - INTERVAL '6 hours'),
  -- Low stock alert (Product 5 / SKU-0005 in Electronics)
  (3, NULL, NULL,'Low Stock',        'Medium',   'Laptop (SKU-0005) total stock is 79 units. Approaching reorder level of 5. Replenishment recommended.', 'Open',         NOW() - INTERVAL '4 hours'),
  -- Bin 21 full (Zone D)
  (4, NULL, 21, 'Overstocked',       'High',     'BIN-021 in R-D02 is at 100% capacity (200/200 units).',                                                 'Open',         NOW() - INTERVAL '2 hours'),
  -- Bin 25 full (Zone E Hazmat)
  (5, NULL, 25, 'Overstocked',       'Critical', 'BIN-025 in R-E02 is at FULL capacity (30/30 units). Hazmat overflow is a safety violation.',            'Open',         NOW() - INTERVAL '12 hours');

-- Update resolved alert timestamp
UPDATE Alert SET ResolvedAt = NOW() - INTERVAL '5 hours' WHERE AlertID = 5;

-- -----------------------------------------------------------------------------
-- 10. EMPLOYEES
-- -----------------------------------------------------------------------------
INSERT INTO Employee (ZoneID, FirstName, LastName, Role, Email, PhoneNumber, HireDate) VALUES
  (1,    'Arjun',   'Mehta',     'Operator',   'arjun.mehta@northhub.in',    '+91-9810000001', '2022-03-15'),
  (2,    'Sunita',  'Reddy',     'Technician', 'sunita.reddy@northhub.in',   '+91-9810000002', '2021-07-01'),
  (3,    'Vikram',  'Singh',     'Analyst',    'vikram.singh@northhub.in',   '+91-9810000003', '2023-01-10'),
  (NULL, 'Deepa',   'Nair',      'Manager',    'deepa.nair@northhub.in',     '+91-9810000004', '2020-06-01'),
  (4,    'Rohit',   'Verma',     'Operator',   'rohit.verma@southbay.in',    '+91-9820000001', '2022-11-20'),
  (5,    'Kavya',   'Pillai',    'Technician', 'kavya.pillai@southbay.in',   '+91-9820000002', '2023-05-05'),
  (5,    'Samuel',  'Thomas',    'Security',   'samuel.thomas@southbay.in',  '+91-9820000003', '2021-09-14'),
  (NULL, 'Meena',   'Krishnan',  'Manager',    'meena.krishnan@southbay.in', '+91-9820000004', '2019-04-01'),
  (4,    'Aditya',  'Joshi',     'Driver',     'aditya.joshi@southbay.in',   '+91-9820000005', '2024-02-28'),
  (1,    'Lakshmi', 'Iyer',      'Operator',   'lakshmi.iyer@northhub.in',   '+91-9810000005', '2023-08-12');

-- -----------------------------------------------------------------------------
-- 11. EQUIPMENT
-- -----------------------------------------------------------------------------
INSERT INTO Equipment (ZoneID, EquipmentName, EquipmentType, SerialNumber, Status, LastServiceDate) VALUES
  (1, 'Forklift Alpha-1',         'Forklift',        'FK-NH-001', 'Operational',        '2026-07-15'),
  (1, 'Pallet Jack A',            'Pallet Jack',     'PJ-NH-001', 'Operational',        '2026-06-01'),
  (2, 'Cold Room Conveyor B',     'Conveyor',        'CV-NH-002', 'Operational',        '2026-08-01'),
  (3, 'RFID Handheld Scanner C',  'RFID Scanner',    'RF-NH-003', 'Under Maintenance',  '2026-05-20'),
  (4, 'Heavy-Duty Crane D1',      'Crane',           'CR-SB-001', 'Operational',        '2026-09-01'),
  (4, 'Autonomous Robot D2',      'Robot',           'RB-SB-001', 'Operational',        '2026-09-10'),
  (5, 'Hazmat Forklift E',        'Forklift',        'FK-SB-002', 'Operational',        '2026-07-20'),
  (5, 'Charging Station E',       'Charging Station','CS-SB-001', 'Operational',        '2026-08-15'),
  (NULL,'Mobile RFID Portal 1',   'RFID Scanner',    'RF-NH-004', 'Operational',        '2026-06-30'),
  (NULL,'Mobile RFID Portal 2',   'RFID Scanner',    'RF-SB-005', 'Decommissioned',     '2025-12-01');

-- -----------------------------------------------------------------------------
-- 12. ORDERS
-- -----------------------------------------------------------------------------
INSERT INTO "Order" (CustomerName, CustomerEmail, OrderDate, Status, TotalAmount, Notes) VALUES
  ('TechMart Retailers Pvt Ltd', 'orders@techmart.in',   NOW() - INTERVAL '3 days',  'Fulfilled',           2550.00, 'Express delivery requested'),
  ('BuildRight Infra Corp',      'purchase@buildright.in',NOW() - INTERVAL '2 days',  'Processing',          1800.00, 'Cement order Q4'),
  ('FreshMart Stores',           'supply@freshmart.in',  NOW() - INTERVAL '1 day',   'Pending',              330.00, 'Cold-chain items only'),
  ('SafeGuard Industries',       'safety@safeguard.in',  NOW() - INTERVAL '5 hours', 'Pending',              225.00, NULL),
  ('Apex Engineering Ltd',       'eng@apex.in',          NOW() - INTERVAL '4 days',  'Fulfilled',            520.00, 'Bearings for maintenance project'),
  ('Global Pack Solutions',      'gps@globalpack.in',    NOW() - INTERVAL '6 hours', 'Pending',              450.00, NULL);

-- -----------------------------------------------------------------------------
-- 13. ORDER ITEMS
-- -----------------------------------------------------------------------------
INSERT INTO OrderItem (OrderID, ProductID, Quantity, UnitPriceAtSale) VALUES
  -- Order 1: TechMart - 3 laptops + 5 USB hubs
  (1, 5,  3, 850.00),
  (1, 6,  5,  28.00),
  -- Order 2: BuildRight - 200 cement bags
  (2, 8,200,   9.00),
  -- Order 3: FreshMart - 50 peas + 60 yogurt
  (3, 3, 50,   1.80),
  (3, 4, 60,   2.20),
  -- Order 4: SafeGuard - 50 safety gloves
  (4, 7, 50,   4.50),
  -- Order 5: Apex - 40 bearings + 20 bolts
  (5, 2, 40,  12.00),
  (5, 1, 20,   2.50),
  -- Order 6: Global Pack - 30 bubble wrap rolls
  (6,10, 30,  15.00);

-- -----------------------------------------------------------------------------
-- 14. SHIPMENTS  (only fulfilled orders have shipments)
-- -----------------------------------------------------------------------------
INSERT INTO Shipment (OrderID, ShippedAt, Carrier, TrackingNumber, EstimatedArrival, Status) VALUES
  (1, NOW() - INTERVAL '2 days',  'BlueDart Express', 'BD-20240918-7782', '2026-09-22', 'In Transit'),
  (5, NOW() - INTERVAL '3 days',  'DTDC Courier',     'DT-20240917-3341', '2026-09-21', 'Delivered');

-- -----------------------------------------------------------------------------
-- 15. DIGITAL TWIN SNAPSHOTS  (periodic warehouse-state captures)
-- -----------------------------------------------------------------------------
INSERT INTO DigitalTwinSnapshot
  (WarehouseID, SnapshotTime, TotalBins, OccupiedBins, TotalStockUnits, ActiveAlerts, ActiveSensors, CreatedBy)
VALUES
  -- Warehouse 1 snapshots (North Hub)
  (1, NOW() - INTERVAL '24 hours', 18, 15, 1050, 2, 8, 'system'),
  (1, NOW() - INTERVAL '12 hours', 18, 16, 1100, 3, 8, 'system'),
  (1, NOW() - INTERVAL '6 hours',  18, 17, 1125, 3, 8, 'system'),
  (1, NOW() - INTERVAL '1 hour',   18, 17, 1143, 5, 7, 'system'),  -- sensor 9 now faulty -> active=7
  -- Warehouse 2 snapshots (South Bay)
  (2, NOW() - INTERVAL '24 hours', 10,  7, 1800, 1, 5, 'system'),
  (2, NOW() - INTERVAL '12 hours', 10,  8, 2020, 2, 5, 'system'),
  (2, NOW() - INTERVAL '6 hours',  10,  8, 2100, 3, 5, 'system'),
  (2, NOW() - INTERVAL '1 hour',   10,  9, 2233, 3, 5, 'system');

-- =============================================================================
-- END OF SEED DATA SCRIPT
-- =============================================================================
