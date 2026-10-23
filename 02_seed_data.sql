-- =============================================================================
-- FILE: 02_seed_data.sql
-- PROJECT: Digital Twin Warehouse Management System
-- DESCRIPTION: Seed / sample data covering all 15 tables.
--              Story: one retailer running three facilities -
--                * Chennai Central Fulfilment Centre  (general, bulk, hazmat)
--                * Bengaluru Tech Logistics Hub       (electronics, general, flammables)
--                * Vellore Cold Chain Depot           (frozen food, chilled pharma)
--              The data is deliberately shaped for a live demo:
--                * several bins are exactly full  -> Overstocked alerts
--                * some bins hold 2 products      -> M:N via InventoryItem
--                * 5 products sit below reorder   -> low-stock report
--                * 3 sensors are breaching NOW    -> Threshold Breach alerts
--                * 1 faulty + 1 maintenance sensor
--                * pending orders that succeed (one spans two bins - FIFO)
--                  and one that must fail and ROLL BACK (insufficient stock)
--              Prices are in INR.
--
-- NOTE: Runs BEFORE 03_triggers_procedures.sql, so no trigger fires here.
--       Bin.CurrentStock and Order.TotalAmount are therefore derived with
--       set-based UPDATEs after the detail rows are inserted.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. WAREHOUSES  (3 facilities)
-- -----------------------------------------------------------------------------
-- TotalCapacity = sum of the capacities of all bins in the warehouse (units)
INSERT INTO Warehouse (Name, Location, TotalCapacity, ManagerName) VALUES
  ('Chennai Central Fulfilment Centre', 'SIPCOT Industrial Park, Sriperumbudur, Chennai, TN', 1850, 'Karthik Subramanian'),
  ('Bengaluru Tech Logistics Hub', 'Electronic City Phase II, Hosur Road, Bengaluru, KA', 1250, 'Ananya Rao'),
  ('Vellore Cold Chain Depot', 'Katpadi Industrial Estate, Vellore, TN', 2690, 'Mohammed Irfan');

-- -----------------------------------------------------------------------------
-- 2. ZONES  (8 zones)
-- -----------------------------------------------------------------------------
INSERT INTO Zone (WarehouseID, ZoneName, ZoneType, FloorArea_sqm) VALUES
  (1, 'A1 - General Merchandise',   'General',        1800.00),
  (1, 'A2 - Bulk Storage',          'Bulk',           2600.00),
  (1, 'A3 - Hazmat Cage',           'Hazmat',          450.00),
  (2, 'B1 - Electronics Vault',     'Electronics',     700.00),
  (2, 'B2 - General Storage',       'General',        1200.00),
  (2, 'B3 - Flammables Store',      'Flammable',       300.00),
  (3, 'C1 - Frozen Storage',        'Cold Storage',    650.00),
  (3, 'C2 - Chilled Pharma',        'Cold Storage',    500.00);
-- ZoneIDs: A1=1, A2=2, A3=3, B1=4, B2=5, B3=6, C1=7, C2=8

-- -----------------------------------------------------------------------------
-- 3. RACKS  (20 racks)
-- -----------------------------------------------------------------------------
INSERT INTO Rack (ZoneID, RackCode, NumberOfShelves, MaxWeightKg) VALUES
  (1, 'A1-R01', 5, 2000.00),
  (1, 'A1-R02', 5, 2000.00),
  (1, 'A1-R03', 4, 1500.00),
  (2, 'A2-R01', 3, 30000.00),
  (2, 'A2-R02', 2, 8000.00),
  (2, 'A2-R03', 3, 10000.00),
  (3, 'A3-R01', 3, 1200.00),
  (3, 'A3-R02', 2, 1000.00),
  (4, 'B1-R01', 4, 600.00),
  (4, 'B1-R02', 4, 800.00),
  (4, 'B1-R03', 3, 500.00),
  (5, 'B2-R01', 5, 2000.00),
  (5, 'B2-R02', 5, 2000.00),
  (6, 'B3-R01', 3, 900.00),
  (6, 'B3-R02', 3, 900.00),
  (7, 'C1-R01', 4, 1500.00),
  (7, 'C1-R02', 4, 1500.00),
  (7, 'C1-R03', 4, 1500.00),
  (8, 'C2-R01', 6, 400.00),
  (8, 'C2-R02', 6, 400.00);

-- -----------------------------------------------------------------------------
-- 4. BINS  (39 bins; CurrentStock is derived after step 6)
-- -----------------------------------------------------------------------------
INSERT INTO Bin (RackID, BinCode, Capacity) VALUES
  ( 1, 'A1-R01-B01', 120),
  ( 1, 'A1-R01-B02', 120),
  ( 1, 'A1-R01-B03', 120),
  ( 2, 'A1-R02-B01', 100),
  ( 2, 'A1-R02-B02', 100),
  ( 2, 'A1-R02-B03', 100),
  ( 3, 'A1-R03-B01',  80),
  ( 3, 'A1-R03-B02',  80),
  ( 4, 'A2-R01-B01', 300),
  ( 4, 'A2-R01-B02', 300),
  ( 5, 'A2-R02-B01',  60),
  ( 5, 'A2-R02-B02',  60),
  ( 6, 'A2-R03-B01', 200),
  ( 7, 'A3-R01-B01',  40),
  ( 7, 'A3-R01-B02',  40),
  ( 8, 'A3-R02-B01',  30),
  ( 9, 'B1-R01-B01',  50),
  ( 9, 'B1-R01-B02',  50),
  ( 9, 'B1-R01-B03',  50),
  (10, 'B1-R02-B01', 150),
  (10, 'B1-R02-B02', 150),
  (11, 'B1-R03-B01',  40),
  (12, 'B2-R01-B01', 120),
  (12, 'B2-R01-B02', 120),
  (13, 'B2-R02-B01', 120),
  (13, 'B2-R02-B02', 120),
  (13, 'B2-R02-B03', 120),
  (14, 'B3-R01-B01',  60),
  (14, 'B3-R01-B02',  40),
  (15, 'B3-R02-B01',  60),
  (16, 'C1-R01-B01', 200),
  (16, 'C1-R01-B02', 200),
  (17, 'C1-R02-B01', 120),
  (17, 'C1-R02-B02', 120),
  (18, 'C1-R03-B01', 150),
  (19, 'C2-R01-B01', 500),
  (19, 'C2-R01-B02', 500),
  (20, 'C2-R02-B01', 500),
  (20, 'C2-R02-B02', 400);

-- -----------------------------------------------------------------------------
-- 5. PRODUCTS  (22 SKUs, prices in INR)
-- -----------------------------------------------------------------------------
INSERT INTO Product (SKU, ProductName, Category, UnitWeightKg, UnitPrice, ReorderLevel) VALUES
  ('SKU-ELE-1001', 'Business Laptop 14in (i5, 16GB)',        'Electronics',     1.600,  68500.00,  10),
  ('SKU-ELE-1002', 'Android Tablet 10.5in (128GB)',          'Electronics',     0.480,  18999.00,  15),
  ('SKU-ELE-1003', 'Wireless Over-Ear Headphones',           'Electronics',     0.250,   1499.00,  40),
  ('SKU-ELE-1004', 'USB-C 7-in-1 Hub',                       'Electronics',     0.200,   3299.00,  25),
  ('SKU-ELE-1005', 'Single-Board Computer 8GB',              'Electronics',     0.100,   8250.00,  20),
  ('SKU-HDW-2001', 'Stainless Hex Bolt M12 (Box of 100)',    'Hardware',        5.200,    950.00,  30),
  ('SKU-HDW-2002', 'Sealed Ball Bearing 6205-2RS',           'Hardware',        0.130,    420.00,  50),
  ('SKU-CON-3001', 'OPC 53 Grade Cement 50kg Bag',           'Construction',   50.000,    420.00,  80),
  ('SKU-CON-3002', 'TMT Steel Rebar 12mm Bundle',            'Construction',   85.000,   6800.00,  10),
  ('SKU-CHM-4001', 'Isopropyl Alcohol 99% (20L Drum)',       'Chemicals',      16.500,   3600.00,   8),
  ('SKU-CHM-4002', 'Sodium Hypochlorite 10% (50L Can)',      'Chemicals',      55.000,   2750.00,   6),
  ('SKU-FLM-4501', 'Paint Thinner (5L Can)',                 'Flammables',      4.400,    640.00,  20),
  ('SKU-FLM-4502', 'Commercial LPG Cylinder 19kg',           'Flammables',     34.000,   1850.00,  10),
  ('SKU-FOD-5001', 'Frozen Green Peas 1kg',                  'Frozen Food',     1.000,    180.00, 120),
  ('SKU-FOD-5002', 'Ice Cream Tub 4L',                       'Frozen Food',     2.300,    520.00,  60),
  ('SKU-FOD-5003', 'Frozen Parathas (Pack of 20)',           'Frozen Food',     1.600,    310.00,  80),
  ('SKU-PHA-6001', 'Insulin Glargine Pen 100IU/ml',          'Pharma',          0.080,    780.00, 100),
  ('SKU-PHA-6002', 'Hepatitis B Vaccine Vial',               'Pharma',          0.040,    340.00, 150),
  ('SKU-PKG-7001', '5-Ply Corrugated Box (Pack of 50)',      'Packaging',       9.000,   1250.00,  40),
  ('SKU-SAF-8001', 'Nitrile Gloves (Box of 100)',            'Safety',          0.600,    540.00,  50),
  ('SKU-SAF-8002', 'Industrial Safety Helmet (ISI)',         'Safety',          0.400,    285.00,  60),
  ('SKU-ELC-9001', 'LED Floodlight 100W',                    'Electrical',      1.300,   2450.00,  20);

-- -----------------------------------------------------------------------------
-- 6. INVENTORY ITEMS  (38 placements - bridge between Bin and Product)
-- -----------------------------------------------------------------------------
INSERT INTO InventoryItem (BinID, ProductID, Quantity, LastUpdated) VALUES
  ( 1,  6,  60, NOW() - INTERVAL '30 hours'), -- A1-R01-B01 Stainless Hex Bolt M12 (Box of 100) (shared bin)
  ( 1,  7,  40, NOW() - INTERVAL '20 hours'), -- A1-R01-B01 Sealed Ball Bearing 6205-2RS (shared bin)
  ( 2,  7, 120, NOW() - INTERVAL '3 hours'), -- A1-R01-B02 Sealed Ball Bearing 6205-2RS (bin FULL)
  ( 4, 19,  70, NOW() - INTERVAL '12 hours'), -- A1-R02-B01 5-Ply Corrugated Box (Pack of 50)
  ( 5, 20,  45, NOW() - INTERVAL '40 hours'), -- A1-R02-B02 Nitrile Gloves (Box of 100) (shared bin)
  ( 5, 21,  30, NOW() - INTERVAL '26 hours'), -- A1-R02-B02 Industrial Safety Helmet (ISI) (shared bin)
  ( 6, 21,  25, NOW() - INTERVAL '8 hours'), -- A1-R02-B03 Industrial Safety Helmet (ISI)
  ( 7, 19,  20, NOW() - INTERVAL '50 hours'), -- A1-R03-B01 5-Ply Corrugated Box (Pack of 50)
  ( 9,  8, 300, NOW() - INTERVAL '5 hours'), -- A2-R01-B01 OPC 53 Grade Cement 50kg Bag (bin FULL)
  (10,  8, 210, NOW() - INTERVAL '30 hours'), -- A2-R01-B02 OPC 53 Grade Cement 50kg Bag
  (11,  9,  18, NOW() - INTERVAL '72 hours'), -- A2-R02-B01 TMT Steel Rebar 12mm Bundle
  (13,  8,  90, NOW() - INTERVAL '52 hours'), -- A2-R03-B01 OPC 53 Grade Cement 50kg Bag
  (14, 10,  22, NOW() - INTERVAL '60 hours'), -- A3-R01-B01 Isopropyl Alcohol 99% (20L Drum)
  (15, 11,  12, NOW() - INTERVAL '90 hours'), -- A3-R01-B02 Sodium Hypochlorite 10% (50L Can)
  (16, 10,  30, NOW() - INTERVAL '10 hours'), -- A3-R02-B01 Isopropyl Alcohol 99% (20L Drum) (bin FULL)
  (17,  1,   5, NOW() - INTERVAL '20 hours'), -- B1-R01-B01 Business Laptop 14in (i5, 16GB)
  (18,  2,  48, NOW() - INTERVAL '6 hours'), -- B1-R01-B02 Android Tablet 10.5in (128GB)
  (19,  5,  35, NOW() - INTERVAL '44 hours'), -- B1-R01-B03 Single-Board Computer 8GB
  (20,  3, 120, NOW() - INTERVAL '4 hours'), -- B1-R02-B01 Wireless Over-Ear Headphones (bin FULL)
  (20,  4,  30, NOW() - INTERVAL '4 hours'), -- B1-R02-B01 USB-C 7-in-1 Hub (bin FULL)
  (21,  4,  40, NOW() - INTERVAL '70 hours'), -- B1-R02-B02 USB-C 7-in-1 Hub
  (22,  1,   3, NOW() - INTERVAL '96 hours'), -- B1-R03-B01 Business Laptop 14in (i5, 16GB)
  (23, 19,  90, NOW() - INTERVAL '18 hours'), -- B2-R01-B01 5-Ply Corrugated Box (Pack of 50)
  (24, 20,  60, NOW() - INTERVAL '22 hours'), -- B2-R01-B02 Nitrile Gloves (Box of 100)
  (25,  6,  35, NOW() - INTERVAL '64 hours'), -- B2-R02-B01 Stainless Hex Bolt M12 (Box of 100)
  (26,  7,  15, NOW() - INTERVAL '80 hours'), -- B2-R02-B02 Sealed Ball Bearing 6205-2RS
  (28, 12,  42, NOW() - INTERVAL '48 hours'), -- B3-R01-B01 Paint Thinner (5L Can)
  (29, 13,   6, NOW() - INTERVAL '30 hours'), -- B3-R01-B02 Commercial LPG Cylinder 19kg
  (30, 12,  18, NOW() - INTERVAL '6 hours'), -- B3-R02-B01 Paint Thinner (5L Can)
  (31, 14, 180, NOW() - INTERVAL '7 hours'), -- C1-R01-B01 Frozen Green Peas 1kg
  (32, 14,  95, NOW() - INTERVAL '28 hours'), -- C1-R01-B02 Frozen Green Peas 1kg (shared bin)
  (32, 16,  60, NOW() - INTERVAL '15 hours'), -- C1-R01-B02 Frozen Parathas (Pack of 20) (shared bin)
  (33, 15, 120, NOW() - INTERVAL '2 hours'), -- C1-R02-B01 Ice Cream Tub 4L (bin FULL)
  (34, 16,  70, NOW() - INTERVAL '33 hours'), -- C1-R02-B02 Frozen Parathas (Pack of 20)
  (36, 17,  40, NOW() - INTERVAL '26 hours'), -- C2-R01-B01 Insulin Glargine Pen 100IU/ml
  (37, 18, 320, NOW() - INTERVAL '14 hours'), -- C2-R01-B02 Hepatitis B Vaccine Vial
  (38, 17,  20, NOW() - INTERVAL '9 hours'), -- C2-R02-B01 Insulin Glargine Pen 100IU/ml (shared bin)
  (38, 18,  90, NOW() - INTERVAL '9 hours'); -- C2-R02-B01 Hepatitis B Vaccine Vial (shared bin)

-- Derive the controlled-redundancy column Bin.CurrentStock from the bridge table
UPDATE Bin b
   SET CurrentStock = COALESCE((SELECT SUM(ii.Quantity)
                                  FROM InventoryItem ii
                                 WHERE ii.BinID = b.BinID), 0);

-- -----------------------------------------------------------------------------
-- 7. SENSORS  (20 IoT devices)
-- -----------------------------------------------------------------------------
INSERT INTO Sensor (ZoneID, BinID, SensorType, Model, InstallDate, Status, ThresholdMin, ThresholdMax) VALUES
  (1, NULL, 'Temperature', 'DS18B20-Pro',     '2025-01-10', 'Active',         10.00,    35.00),
  (1, NULL, 'Humidity',    'DHT22-Pro',       '2025-01-10', 'Active',         30.00,    70.00),
  (1,    2, 'Weight',      'LoadCell-500kg',  '2025-02-14', 'Active',          0.00,   500.00),
  (2, NULL, 'Weight',      'FloorScale-40T',  '2025-01-12', 'Active',          0.00, 40000.00),
  (2, NULL, 'Vibration',   'VibroSense-V2',   '2025-03-03', 'Active',          0.00,     8.00),
  (3, NULL, 'CO2',         'NDIR-CO2-K30',    '2025-01-15', 'Active',        350.00,  1000.00),
  (3, NULL, 'Smoke',       'SmokeDetect-X2',  '2025-01-15', 'Active',          0.00,     0.50),
  (3, NULL, 'Temperature', 'DS18B20-Pro',     '2025-01-15', 'Active',          5.00,    30.00),
  (4, NULL, 'Temperature', 'DS18B20-Hi',      '2025-02-01', 'Active',         18.00,    26.00),
  (4, NULL, 'Humidity',    'DHT22-Pro',       '2025-02-01', 'Active',         35.00,    55.00),
  (4,   17, 'RFID',        'Zebra FX9600',    '2025-02-20', 'Active',          NULL,     NULL),
  (5, NULL, 'Temperature', 'DS18B20-Pro',     '2025-02-05', 'Active',         10.00,    35.00),
  (5, NULL, 'RFID',        'Zebra FX7500',    '2025-02-05', 'Faulty',          NULL,     NULL),
  (6, NULL, 'Smoke',       'SmokeDetect-X2',  '2025-02-10', 'Active',          0.00,     0.30),
  (6, NULL, 'Temperature', 'DS18B20-Pro',     '2025-02-10', 'Maintenance',     5.00,    28.00),
  (7, NULL, 'Temperature', 'ColdTrack-T9',    '2025-01-20', 'Active',        -25.00,   -15.00),
  (7, NULL, 'Humidity',    'DHT22-Cold',      '2025-01-20', 'Active',         60.00,    90.00),
  (7,   33, 'Weight',      'LoadCell-300kg',  '2025-03-11', 'Active',          0.00,   300.00),
  (8, NULL, 'Temperature', 'ColdTrack-T9',    '2025-01-22', 'Active',          2.00,     8.00),
  (8, NULL, 'Humidity',    'DHT22-Pro',       '2025-01-22', 'Active',         35.00,    60.00);
-- SensorIDs 1..20 in the order above

-- -----------------------------------------------------------------------------
-- 8. SENSOR READINGS  (time series: one reading every 20 minutes, last 4 hours)
--    Faulty / Maintenance sensors only have older readings.
-- -----------------------------------------------------------------------------
INSERT INTO SensorReading (SensorID, ReadingValue, Unit, RecordedAt) VALUES
  ( 1, 28.5, 'degC', NOW() - INTERVAL '2 minutes'),
  ( 1, 29.0, 'degC', NOW() - INTERVAL '22 minutes'),
  ( 1, 29.0, 'degC', NOW() - INTERVAL '42 minutes'),
  ( 1, 29.4, 'degC', NOW() - INTERVAL '62 minutes'),
  ( 1, 28.5, 'degC', NOW() - INTERVAL '82 minutes'),
  ( 1, 28.7, 'degC', NOW() - INTERVAL '102 minutes'),
  ( 1, 29.1, 'degC', NOW() - INTERVAL '122 minutes'),
  ( 1, 29.1, 'degC', NOW() - INTERVAL '142 minutes'),
  ( 1, 29.3, 'degC', NOW() - INTERVAL '162 minutes'),
  ( 1, 29.1, 'degC', NOW() - INTERVAL '182 minutes'),
  ( 1, 29.3, 'degC', NOW() - INTERVAL '202 minutes'),
  ( 1, 29.3, 'degC', NOW() - INTERVAL '222 minutes'),
  ( 2, 55.8, '%', NOW() - INTERVAL '2 minutes'),
  ( 2, 55.3, '%', NOW() - INTERVAL '22 minutes'),
  ( 2, 54.2, '%', NOW() - INTERVAL '42 minutes'),
  ( 2, 55.3, '%', NOW() - INTERVAL '62 minutes'),
  ( 2, 53.8, '%', NOW() - INTERVAL '82 minutes'),
  ( 2, 56.0, '%', NOW() - INTERVAL '102 minutes'),
  ( 2, 54.8, '%', NOW() - INTERVAL '122 minutes'),
  ( 2, 55.9, '%', NOW() - INTERVAL '142 minutes'),
  ( 2, 55.6, '%', NOW() - INTERVAL '162 minutes'),
  ( 2, 55.5, '%', NOW() - INTERVAL '182 minutes'),
  ( 2, 54.1, '%', NOW() - INTERVAL '202 minutes'),
  ( 2, 54.3, '%', NOW() - INTERVAL '222 minutes'),
  ( 3, 15.7, 'kg', NOW() - INTERVAL '2 minutes'),
  ( 3, 15.7, 'kg', NOW() - INTERVAL '22 minutes'),
  ( 3, 15.7, 'kg', NOW() - INTERVAL '42 minutes'),
  ( 3, 15.7, 'kg', NOW() - INTERVAL '62 minutes'),
  ( 3, 15.6, 'kg', NOW() - INTERVAL '82 minutes'),
  ( 3, 15.5, 'kg', NOW() - INTERVAL '102 minutes'),
  ( 3, 15.6, 'kg', NOW() - INTERVAL '122 minutes'),
  ( 3, 15.6, 'kg', NOW() - INTERVAL '142 minutes'),
  ( 3, 15.6, 'kg', NOW() - INTERVAL '162 minutes'),
  ( 3, 15.6, 'kg', NOW() - INTERVAL '182 minutes'),
  ( 3, 15.7, 'kg', NOW() - INTERVAL '202 minutes'),
  ( 3, 15.6, 'kg', NOW() - INTERVAL '222 minutes'),
  ( 4, 31518.6, 'kg', NOW() - INTERVAL '2 minutes'),
  ( 4, 31385.9, 'kg', NOW() - INTERVAL '22 minutes'),
  ( 4, 31550.6, 'kg', NOW() - INTERVAL '42 minutes'),
  ( 4, 31467.3, 'kg', NOW() - INTERVAL '62 minutes'),
  ( 4, 31481.3, 'kg', NOW() - INTERVAL '82 minutes'),
  ( 4, 31475.7, 'kg', NOW() - INTERVAL '102 minutes'),
  ( 4, 31520.6, 'kg', NOW() - INTERVAL '122 minutes'),
  ( 4, 31499.6, 'kg', NOW() - INTERVAL '142 minutes'),
  ( 4, 31407.9, 'kg', NOW() - INTERVAL '162 minutes'),
  ( 4, 31501.5, 'kg', NOW() - INTERVAL '182 minutes'),
  ( 4, 31560.0, 'kg', NOW() - INTERVAL '202 minutes'),
  ( 4, 31524.0, 'kg', NOW() - INTERVAL '222 minutes'),
  ( 5, 2.1, 'mm/s', NOW() - INTERVAL '2 minutes'),
  ( 5, 2.4, 'mm/s', NOW() - INTERVAL '22 minutes'),
  ( 5, 1.9, 'mm/s', NOW() - INTERVAL '42 minutes'),
  ( 5, 2.0, 'mm/s', NOW() - INTERVAL '62 minutes'),
  ( 5, 2.4, 'mm/s', NOW() - INTERVAL '82 minutes'),
  ( 5, 2.1, 'mm/s', NOW() - INTERVAL '102 minutes'),
  ( 5, 2.1, 'mm/s', NOW() - INTERVAL '122 minutes'),
  ( 5, 1.7, 'mm/s', NOW() - INTERVAL '142 minutes'),
  ( 5, 1.9, 'mm/s', NOW() - INTERVAL '162 minutes'),
  ( 5, 1.8, 'mm/s', NOW() - INTERVAL '182 minutes'),
  ( 5, 1.7, 'mm/s', NOW() - INTERVAL '202 minutes'),
  ( 5, 2.3, 'mm/s', NOW() - INTERVAL '222 minutes'),
  ( 6, 1180.0, 'ppm', NOW() - INTERVAL '2 minutes'),
  ( 6, 968.3, 'ppm', NOW() - INTERVAL '22 minutes'),
  ( 6, 855.4, 'ppm', NOW() - INTERVAL '42 minutes'),
  ( 6, 761.5, 'ppm', NOW() - INTERVAL '62 minutes'),
  ( 6, 638.5, 'ppm', NOW() - INTERVAL '82 minutes'),
  ( 6, 655.0, 'ppm', NOW() - INTERVAL '102 minutes'),
  ( 6, 641.6, 'ppm', NOW() - INTERVAL '122 minutes'),
  ( 6, 645.9, 'ppm', NOW() - INTERVAL '142 minutes'),
  ( 6, 650.5, 'ppm', NOW() - INTERVAL '162 minutes'),
  ( 6, 639.3, 'ppm', NOW() - INTERVAL '182 minutes'),
  ( 6, 637.7, 'ppm', NOW() - INTERVAL '202 minutes'),
  ( 6, 631.9, 'ppm', NOW() - INTERVAL '222 minutes'),
  ( 7, 0.031, 'AU', NOW() - INTERVAL '2 minutes'),
  ( 7, 0.043, 'AU', NOW() - INTERVAL '22 minutes'),
  ( 7, 0.042, 'AU', NOW() - INTERVAL '42 minutes'),
  ( 7, 0.039, 'AU', NOW() - INTERVAL '62 minutes'),
  ( 7, 0.040, 'AU', NOW() - INTERVAL '82 minutes'),
  ( 7, 0.040, 'AU', NOW() - INTERVAL '102 minutes'),
  ( 7, 0.048, 'AU', NOW() - INTERVAL '122 minutes'),
  ( 7, 0.035, 'AU', NOW() - INTERVAL '142 minutes'),
  ( 7, 0.040, 'AU', NOW() - INTERVAL '162 minutes'),
  ( 7, 0.040, 'AU', NOW() - INTERVAL '182 minutes'),
  ( 7, 0.047, 'AU', NOW() - INTERVAL '202 minutes'),
  ( 7, 0.046, 'AU', NOW() - INTERVAL '222 minutes'),
  ( 8, 26.1, 'degC', NOW() - INTERVAL '2 minutes'),
  ( 8, 26.4, 'degC', NOW() - INTERVAL '22 minutes'),
  ( 8, 26.3, 'degC', NOW() - INTERVAL '42 minutes'),
  ( 8, 25.8, 'degC', NOW() - INTERVAL '62 minutes'),
  ( 8, 26.4, 'degC', NOW() - INTERVAL '82 minutes'),
  ( 8, 25.6, 'degC', NOW() - INTERVAL '102 minutes'),
  ( 8, 26.2, 'degC', NOW() - INTERVAL '122 minutes'),
  ( 8, 26.3, 'degC', NOW() - INTERVAL '142 minutes'),
  ( 8, 26.0, 'degC', NOW() - INTERVAL '162 minutes'),
  ( 8, 26.0, 'degC', NOW() - INTERVAL '182 minutes'),
  ( 8, 26.5, 'degC', NOW() - INTERVAL '202 minutes'),
  ( 8, 26.5, 'degC', NOW() - INTERVAL '222 minutes'),
  ( 9, 22.8, 'degC', NOW() - INTERVAL '2 minutes'),
  ( 9, 22.5, 'degC', NOW() - INTERVAL '22 minutes'),
  ( 9, 22.2, 'degC', NOW() - INTERVAL '42 minutes'),
  ( 9, 22.3, 'degC', NOW() - INTERVAL '62 minutes'),
  ( 9, 22.5, 'degC', NOW() - INTERVAL '82 minutes'),
  ( 9, 22.2, 'degC', NOW() - INTERVAL '102 minutes'),
  ( 9, 22.7, 'degC', NOW() - INTERVAL '122 minutes'),
  ( 9, 22.4, 'degC', NOW() - INTERVAL '142 minutes'),
  ( 9, 22.5, 'degC', NOW() - INTERVAL '162 minutes'),
  ( 9, 22.1, 'degC', NOW() - INTERVAL '182 minutes'),
  ( 9, 22.1, 'degC', NOW() - INTERVAL '202 minutes'),
  ( 9, 22.6, 'degC', NOW() - INTERVAL '222 minutes'),
  (10, 61.4, '%', NOW() - INTERVAL '2 minutes'),
  (10, 54.8, '%', NOW() - INTERVAL '22 minutes'),
  (10, 53.5, '%', NOW() - INTERVAL '42 minutes'),
  (10, 51.2, '%', NOW() - INTERVAL '62 minutes'),
  (10, 48.2, '%', NOW() - INTERVAL '82 minutes'),
  (10, 47.8, '%', NOW() - INTERVAL '102 minutes'),
  (10, 48.3, '%', NOW() - INTERVAL '122 minutes'),
  (10, 48.0, '%', NOW() - INTERVAL '142 minutes'),
  (10, 47.6, '%', NOW() - INTERVAL '162 minutes'),
  (10, 48.1, '%', NOW() - INTERVAL '182 minutes'),
  (10, 48.5, '%', NOW() - INTERVAL '202 minutes'),
  (10, 47.5, '%', NOW() - INTERVAL '222 minutes'),
  (11, 5, 'tags', NOW() - INTERVAL '2 minutes'),
  (11, 5, 'tags', NOW() - INTERVAL '22 minutes'),
  (11, 5, 'tags', NOW() - INTERVAL '42 minutes'),
  (11, 5, 'tags', NOW() - INTERVAL '62 minutes'),
  (11, 5, 'tags', NOW() - INTERVAL '82 minutes'),
  (11, 5, 'tags', NOW() - INTERVAL '102 minutes'),
  (11, 5, 'tags', NOW() - INTERVAL '122 minutes'),
  (11, 5, 'tags', NOW() - INTERVAL '142 minutes'),
  (11, 5, 'tags', NOW() - INTERVAL '162 minutes'),
  (11, 5, 'tags', NOW() - INTERVAL '182 minutes'),
  (11, 5, 'tags', NOW() - INTERVAL '202 minutes'),
  (11, 5, 'tags', NOW() - INTERVAL '222 minutes'),
  (12, 27.0, 'degC', NOW() - INTERVAL '2 minutes'),
  (12, 27.0, 'degC', NOW() - INTERVAL '22 minutes'),
  (12, 27.1, 'degC', NOW() - INTERVAL '42 minutes'),
  (12, 26.6, 'degC', NOW() - INTERVAL '62 minutes'),
  (12, 27.1, 'degC', NOW() - INTERVAL '82 minutes'),
  (12, 26.6, 'degC', NOW() - INTERVAL '102 minutes'),
  (12, 27.1, 'degC', NOW() - INTERVAL '122 minutes'),
  (12, 27.0, 'degC', NOW() - INTERVAL '142 minutes'),
  (12, 26.7, 'degC', NOW() - INTERVAL '162 minutes'),
  (12, 27.3, 'degC', NOW() - INTERVAL '182 minutes'),
  (12, 27.1, 'degC', NOW() - INTERVAL '202 minutes'),
  (12, 26.4, 'degC', NOW() - INTERVAL '222 minutes'),
  (13, 88, 'tags', NOW() - INTERVAL '2880 minutes'),
  (13, 86, 'tags', NOW() - INTERVAL '2900 minutes'),
  (13, 88, 'tags', NOW() - INTERVAL '2920 minutes'),
  (13, 88, 'tags', NOW() - INTERVAL '2940 minutes'),
  (13, 88, 'tags', NOW() - INTERVAL '2960 minutes'),
  (13, 86, 'tags', NOW() - INTERVAL '2980 minutes'),
  (14, 0.017, 'AU', NOW() - INTERVAL '2 minutes'),
  (14, 0.024, 'AU', NOW() - INTERVAL '22 minutes'),
  (14, 0.024, 'AU', NOW() - INTERVAL '42 minutes'),
  (14, 0.016, 'AU', NOW() - INTERVAL '62 minutes'),
  (14, 0.022, 'AU', NOW() - INTERVAL '82 minutes'),
  (14, 0.017, 'AU', NOW() - INTERVAL '102 minutes'),
  (14, 0.018, 'AU', NOW() - INTERVAL '122 minutes'),
  (14, 0.020, 'AU', NOW() - INTERVAL '142 minutes'),
  (14, 0.024, 'AU', NOW() - INTERVAL '162 minutes'),
  (14, 0.019, 'AU', NOW() - INTERVAL '182 minutes'),
  (14, 0.017, 'AU', NOW() - INTERVAL '202 minutes'),
  (14, 0.017, 'AU', NOW() - INTERVAL '222 minutes'),
  (15, 24.0, 'degC', NOW() - INTERVAL '1560 minutes'),
  (15, 24.5, 'degC', NOW() - INTERVAL '1580 minutes'),
  (15, 24.3, 'degC', NOW() - INTERVAL '1600 minutes'),
  (15, 23.8, 'degC', NOW() - INTERVAL '1620 minutes'),
  (15, 23.7, 'degC', NOW() - INTERVAL '1640 minutes'),
  (15, 24.0, 'degC', NOW() - INTERVAL '1660 minutes'),
  (16, -11.2, 'degC', NOW() - INTERVAL '2 minutes'),
  (16, -15.1, 'degC', NOW() - INTERVAL '22 minutes'),
  (16, -16.0, 'degC', NOW() - INTERVAL '42 minutes'),
  (16, -17.6, 'degC', NOW() - INTERVAL '62 minutes'),
  (16, -19.0, 'degC', NOW() - INTERVAL '82 minutes'),
  (16, -19.0, 'degC', NOW() - INTERVAL '102 minutes'),
  (16, -18.9, 'degC', NOW() - INTERVAL '122 minutes'),
  (16, -19.2, 'degC', NOW() - INTERVAL '142 minutes'),
  (16, -19.1, 'degC', NOW() - INTERVAL '162 minutes'),
  (16, -18.9, 'degC', NOW() - INTERVAL '182 minutes'),
  (16, -19.0, 'degC', NOW() - INTERVAL '202 minutes'),
  (16, -18.9, 'degC', NOW() - INTERVAL '222 minutes'),
  (17, 78.7, '%', NOW() - INTERVAL '2 minutes'),
  (17, 78.2, '%', NOW() - INTERVAL '22 minutes'),
  (17, 78.2, '%', NOW() - INTERVAL '42 minutes'),
  (17, 78.5, '%', NOW() - INTERVAL '62 minutes'),
  (17, 76.9, '%', NOW() - INTERVAL '82 minutes'),
  (17, 78.8, '%', NOW() - INTERVAL '102 minutes'),
  (17, 76.8, '%', NOW() - INTERVAL '122 minutes'),
  (17, 77.8, '%', NOW() - INTERVAL '142 minutes'),
  (17, 76.8, '%', NOW() - INTERVAL '162 minutes'),
  (17, 76.7, '%', NOW() - INTERVAL '182 minutes'),
  (17, 77.6, '%', NOW() - INTERVAL '202 minutes'),
  (17, 78.9, '%', NOW() - INTERVAL '222 minutes'),
  (18, 276.1, 'kg', NOW() - INTERVAL '2 minutes'),
  (18, 275.6, 'kg', NOW() - INTERVAL '22 minutes'),
  (18, 275.8, 'kg', NOW() - INTERVAL '42 minutes'),
  (18, 276.1, 'kg', NOW() - INTERVAL '62 minutes'),
  (18, 275.6, 'kg', NOW() - INTERVAL '82 minutes'),
  (18, 276.4, 'kg', NOW() - INTERVAL '102 minutes'),
  (18, 275.7, 'kg', NOW() - INTERVAL '122 minutes'),
  (18, 275.8, 'kg', NOW() - INTERVAL '142 minutes'),
  (18, 275.5, 'kg', NOW() - INTERVAL '162 minutes'),
  (18, 276.4, 'kg', NOW() - INTERVAL '182 minutes'),
  (18, 276.4, 'kg', NOW() - INTERVAL '202 minutes'),
  (18, 275.8, 'kg', NOW() - INTERVAL '222 minutes'),
  (19, 5.4, 'degC', NOW() - INTERVAL '2 minutes'),
  (19, 4.8, 'degC', NOW() - INTERVAL '22 minutes'),
  (19, 4.9, 'degC', NOW() - INTERVAL '42 minutes'),
  (19, 5.0, 'degC', NOW() - INTERVAL '62 minutes'),
  (19, 4.9, 'degC', NOW() - INTERVAL '82 minutes'),
  (19, 5.1, 'degC', NOW() - INTERVAL '102 minutes'),
  (19, 5.4, 'degC', NOW() - INTERVAL '122 minutes'),
  (19, 5.3, 'degC', NOW() - INTERVAL '142 minutes'),
  (19, 5.0, 'degC', NOW() - INTERVAL '162 minutes'),
  (19, 5.1, 'degC', NOW() - INTERVAL '182 minutes'),
  (19, 5.2, 'degC', NOW() - INTERVAL '202 minutes'),
  (19, 5.2, 'degC', NOW() - INTERVAL '222 minutes'),
  (20, 47.1, '%', NOW() - INTERVAL '2 minutes'),
  (20, 47.8, '%', NOW() - INTERVAL '22 minutes'),
  (20, 48.2, '%', NOW() - INTERVAL '42 minutes'),
  (20, 48.2, '%', NOW() - INTERVAL '62 minutes'),
  (20, 47.9, '%', NOW() - INTERVAL '82 minutes'),
  (20, 48.4, '%', NOW() - INTERVAL '102 minutes'),
  (20, 47.2, '%', NOW() - INTERVAL '122 minutes'),
  (20, 47.7, '%', NOW() - INTERVAL '142 minutes'),
  (20, 48.0, '%', NOW() - INTERVAL '162 minutes'),
  (20, 48.9, '%', NOW() - INTERVAL '182 minutes'),
  (20, 47.5, '%', NOW() - INTERVAL '202 minutes'),
  (20, 47.6, '%', NOW() - INTERVAL '222 minutes');

-- -----------------------------------------------------------------------------
-- 9. ALERTS  (history that the triggers would have produced, plus manual ones)
-- -----------------------------------------------------------------------------
INSERT INTO Alert (ZoneID, SensorID, BinID, AlertType, Severity, Message, Status, RaisedAt, ResolvedAt) VALUES
  (3, 6, NULL, 'Threshold Breach', 'Critical',
   '[THRESHOLD BREACH] Sensor 6 (CO2) recorded 1180.0 ppm. Breached HIGH threshold of 1000.000. Zone ID: 3.',
   'Open', NOW() - INTERVAL '2 minutes', NULL),
  (4, 10, NULL, 'Threshold Breach', 'High',
   '[THRESHOLD BREACH] Sensor 10 (Humidity) recorded 61.4 %. Breached HIGH threshold of 55.000. Zone ID: 4.',
   'Acknowledged', NOW() - INTERVAL '2 minutes', NULL),
  (7, 16, NULL, 'Threshold Breach', 'Critical',
   '[THRESHOLD BREACH] Sensor 16 (Temperature) recorded -11.2 degC. Breached HIGH threshold of -15.000. Zone ID: 7.',
   'Open', NOW() - INTERVAL '2 minutes', NULL),
  (5, 13, NULL, 'Sensor Failure', 'Medium',
   '[SENSOR FAILURE] RFID sensor Zebra FX7500 (ID=13) changed from Active to Faulty. Readings from this device are no longer trusted.',
   'Open', NOW() - INTERVAL '46 hours', NULL),
  (1, NULL, 2, 'Overstocked', 'High',
   'Bin A1-R01-B02 (ID=2) has reached 100% capacity (120/120 units). No further stock can be added until items are removed.',
   'Acknowledged', NOW() - INTERVAL '3 hours', NULL),
  (2, NULL, 9, 'Overstocked', 'High',
   'Bin A2-R01-B01 (ID=9) has reached 100% capacity (300/300 units). No further stock can be added until items are removed.',
   'Open', NOW() - INTERVAL '5 hours', NULL),
  (3, NULL, 16, 'Overstocked', 'Critical',
   'Bin A3-R02-B01 (ID=16) has reached 100% capacity (30/30 units). No further stock can be added until items are removed. Hazmat overflow is a safety violation.',
   'Open', NOW() - INTERVAL '10 hours', NULL),
  (4, NULL, 20, 'Overstocked', 'High',
   'Bin B1-R02-B01 (ID=20) has reached 100% capacity (150/150 units). No further stock can be added until items are removed.',
   'Open', NOW() - INTERVAL '4 hours', NULL),
  (7, NULL, 33, 'Overstocked', 'High',
   'Bin C1-R02-B01 (ID=33) has reached 100% capacity (120/120 units). No further stock can be added until items are removed.',
   'Open', NOW() - INTERVAL '2 hours', NULL),
  (4, NULL, NULL, 'Low Stock', 'Medium',
   'Business Laptop 14in (i5, 16GB) (SKU-ELE-1001): total stock 8 units is below reorder level 10. Raise a purchase order.',
   'Open', NOW() - INTERVAL '3 hours', NULL),
  (8, NULL, NULL, 'Low Stock', 'High',
   'Insulin Glargine Pen 100IU/ml (SKU-PHA-6001): total stock 60 units is below reorder level 100. Raise a purchase order.',
   'Open', NOW() - INTERVAL '3 hours', NULL),
  (2, NULL, NULL, 'Equipment Fault', 'High',
   'Diesel Forklift FL-02 (CHN-FL-0002) reported a hydraulic pressure drop. Taken out of service for repair.',
   'Acknowledged', NOW() - INTERVAL '30 hours', NULL),
  (1, NULL, NULL, 'Environmental', 'Low',
   'Dock door A1-D3 left open for more than 15 minutes during unloading.',
   'Resolved', NOW() - INTERVAL '20 hours', NOW() - INTERVAL '19 hours'),
  (8, 19, NULL, 'Threshold Breach', 'Critical',
   '[THRESHOLD BREACH] Sensor 19 (Temperature) recorded 8.6 degC. Breached HIGH threshold of 8.000. Zone ID: 8.',
   'Resolved', NOW() - INTERVAL '52 hours', NOW() - INTERVAL '51 hours'),
  (5, NULL, 23, 'Overstocked', 'High',
   'Bin B2-R01-B01 (ID=23) has reached 100% capacity (120/120 units). No further stock can be added until items are removed.',
   'Resolved', NOW() - INTERVAL '40 hours', NOW() - INTERVAL '36 hours');

-- -----------------------------------------------------------------------------
-- 10. EMPLOYEES  (16 staff; managers have no single zone)
-- -----------------------------------------------------------------------------
INSERT INTO Employee (ZoneID, FirstName, LastName, Role, Email, PhoneNumber, HireDate) VALUES
  (NULL, 'Karthik',   'Subramanian',  'Manager',    'karthik.s@chennai.dtwms.in',       '+91-9840011001', '2019-06-03'),
  (   1, 'Priya',     'Venkatesh',    'Operator',   'priya.v@chennai.dtwms.in',         '+91-9840011002', '2022-02-14'),
  (   2, 'Suresh',    'Natarajan',    'Driver',     'suresh.n@chennai.dtwms.in',        '+91-9840011003', '2021-08-23'),
  (   3, 'Divya',     'Ramesh',       'Technician', 'divya.r@chennai.dtwms.in',         '+91-9840011004', '2023-01-09'),
  (   3, 'Arun',      'Kumar',        'Security',   'arun.k@chennai.dtwms.in',          '+91-9840011005', '2020-11-30'),
  (NULL, 'Ananya',    'Rao',          'Manager',    'ananya.rao@bengaluru.dtwms.in',    '+91-9880022001', '2018-04-16'),
  (   4, 'Rahul',     'Hegde',        'Analyst',    'rahul.h@bengaluru.dtwms.in',       '+91-9880022002', '2023-07-03'),
  (   4, 'Sneha',     'Gowda',        'Operator',   'sneha.g@bengaluru.dtwms.in',       '+91-9880022003', '2022-10-10'),
  (   5, 'Vivek',     'Shetty',       'Operator',   'vivek.s@bengaluru.dtwms.in',       '+91-9880022004', '2024-01-22'),
  (   6, 'Farhan',    'Sheikh',       'Technician', 'farhan.s@bengaluru.dtwms.in',      '+91-9880022005', '2021-05-17'),
  (NULL, 'Mohammed',  'Irfan',        'Manager',    'irfan.m@vellore.dtwms.in',         '+91-9790033001', '2020-03-02'),
  (   7, 'Lakshmi',   'Narayanan',    'Operator',   'lakshmi.n@vellore.dtwms.in',       '+91-9790033002', '2022-06-27'),
  (   7, 'Gokul',     'Krishnan',     'Driver',     'gokul.k@vellore.dtwms.in',         '+91-9790033003', '2023-09-11'),
  (   8, 'Meera',     'Joseph',       'Technician', 'meera.j@vellore.dtwms.in',         '+91-9790033004', '2021-12-06'),
  (   8, 'Harini',    'Balaji',       'Analyst',    'harini.b@vellore.dtwms.in',        '+91-9790033005', '2024-08-19'),
  (   1, 'Sathish',   'Murugan',      'Operator',   'sathish.m@chennai.dtwms.in',       '+91-9840011006', '2024-03-04');

-- -----------------------------------------------------------------------------
-- 11. EQUIPMENT  (14 assets)
-- -----------------------------------------------------------------------------
INSERT INTO Equipment (ZoneID, EquipmentName, EquipmentType, SerialNumber, Status, LastServiceDate) VALUES
  (   1, 'Electric Forklift FL-01',          'Forklift',         'CHN-FL-0001', 'Operational',       '2026-08-18'),
  (   1, 'Hand Pallet Jack PJ-01',           'Pallet Jack',      'CHN-PJ-0001', 'Operational',       '2026-06-30'),
  (   2, 'Diesel Forklift FL-02 (5T)',       'Forklift',         'CHN-FL-0002', 'Under Maintenance', '2026-10-21'),
  (   2, 'Overhead Gantry Crane GC-01',      'Crane',            'CHN-CR-0001', 'Operational',       '2026-09-05'),
  (   3, 'Explosion-Proof Forklift FL-03',   'Forklift',         'CHN-FL-0003', 'Operational',       '2026-07-14'),
  (   4, 'Autonomous Picking Robot AMR-1',   'Robot',            'BLR-RB-0001', 'Operational',       '2026-10-01'),
  (   4, 'RFID Handheld Reader RH-01',       'RFID Scanner',     'BLR-RF-0001', 'Operational',       '2026-09-12'),
  (   5, 'Belt Conveyor CV-01',              'Conveyor',         'BLR-CV-0001', 'Operational',       '2026-08-02'),
  (   5, 'AMR Charging Dock CD-01',          'Charging Station', 'BLR-CS-0001', 'Operational',       '2026-07-25'),
  (   6, 'Spark-Proof Pallet Jack PJ-02',    'Pallet Jack',      'BLR-PJ-0002', 'Operational',       '2026-05-19'),
  (   7, 'Cold Room Forklift FL-04',         'Forklift',         'VLR-FL-0001', 'Operational',       '2026-09-28'),
  (   8, 'Pharma Tote Conveyor CV-02',       'Conveyor',         'VLR-CV-0001', 'Operational',       '2026-10-09'),
  (NULL, 'Mobile RFID Portal MP-01',         'RFID Scanner',     'CHN-RF-0009', 'Operational',       '2026-06-11'),
  (NULL, 'Legacy Barcode Gun BG-07',         'Other',            'BLR-OT-0007', 'Decommissioned',    '2024-12-01');

-- -----------------------------------------------------------------------------
-- 12. ORDERS  (12 customer orders; TotalAmount derived after step 13)
-- -----------------------------------------------------------------------------
INSERT INTO "Order" (CustomerName, CustomerEmail, OrderDate, Status, Notes) VALUES
  ('Reliance Digital Retail',        'procurement@reliancedigital.example',    NOW() - INTERVAL '6 days', 'Fulfilled',  'Festive season laptop restock'),
  ('L&T Construction',               'stores@lnt-construction.example',        NOW() - INTERVAL '5 days', 'Fulfilled',  'Site 14 - Sriperumbudur flyover'),
  ('Apollo Pharmacy',                'coldchain@apollopharmacy.example',       NOW() - INTERVAL '3 days', 'Fulfilled',  'Maintain 2-8 degC during transit'),
  ('Zepto Dark Store - Velachery',   'ops.velachery@zepto.example',            NOW() - INTERVAL '1 day', 'Fulfilled',  'Frozen aisle replenishment'),
  ('Croma Electronics',              'supply@croma.example',                   NOW() - INTERVAL '8 hours', 'Processing', 'Picking in progress'),
  ('Asian Paints Dealer - Tambaram', 'tambaram.dealer@asianpaints.example',    NOW() - INTERVAL '5 hours', 'Pending',    'Demo: spans two bins (FIFO)'),
  ('Manipal Hospitals',              'pharmacy@manipalhospitals.example',      NOW() - INTERVAL '4 hours', 'Pending',    'Urgent - ICU stock'),
  ('Infosys Mysuru Campus',          'it.assets@infosys.example',              NOW() - INTERVAL '3 hours', 'Pending',    'Demo: exceeds stock - will roll back'),
  ('Swiggy Instamart',               'instamart.supply@swiggy.example',        NOW() - INTERVAL '2 hours', 'Pending',    NULL),
  ('Tata Projects Ltd',              'site.stores@tataprojects.example',       NOW() - INTERVAL '1 hour', 'Pending',    'Safety kit for new crew'),
  ('Hotel Saravana Bhavan',          'kitchen@saravanabhavan.example',         NOW() - INTERVAL '2 days', 'Cancelled',  'Customer cancelled - supplier changed'),
  ('VIT Vellore - Central Stores',   'central.stores@vit.example',             NOW() - INTERVAL '30 minutes', 'Pending',    'IoT lab equipment');
-- OrderIDs 1..12 in the order above

-- -----------------------------------------------------------------------------
-- 13. ORDER ITEMS  (bridge between Order and Product; price frozen at sale time)
-- -----------------------------------------------------------------------------
INSERT INTO OrderItem (OrderID, ProductID, Quantity, UnitPriceAtSale) VALUES
  ( 1,  1,   2,  69900.00), -- Reliance Digital Retail: Business Laptop 14in (i5, 16GB) (sold at 69900.00; list price is now 68500.00)
  ( 1,  4,  10,   3299.00), -- Reliance Digital Retail: USB-C 7-in-1 Hub
  ( 2,  8, 150,    420.00), -- L&T Construction: OPC 53 Grade Cement 50kg Bag
  ( 2,  9,   6,   6800.00), -- L&T Construction: TMT Steel Rebar 12mm Bundle
  ( 3, 18, 200,    340.00), -- Apollo Pharmacy: Hepatitis B Vaccine Vial
  ( 3, 17,  40,    780.00), -- Apollo Pharmacy: Insulin Glargine Pen 100IU/ml
  ( 4, 14,  80,    180.00), -- Zepto Dark Store - Velachery: Frozen Green Peas 1kg
  ( 4, 15,  20,    520.00), -- Zepto Dark Store - Velachery: Ice Cream Tub 4L
  ( 5,  3,  40,   1499.00), -- Croma Electronics: Wireless Over-Ear Headphones
  ( 5,  2,   5,  18999.00), -- Croma Electronics: Android Tablet 10.5in (128GB)
  ( 6, 12,  50,    640.00), -- Asian Paints Dealer - Tambaram: Paint Thinner (5L Can)
  ( 7, 17,  30,    780.00), -- Manipal Hospitals: Insulin Glargine Pen 100IU/ml
  ( 7, 18, 100,    340.00), -- Manipal Hospitals: Hepatitis B Vaccine Vial
  ( 8,  1,  25,  68500.00), -- Infosys Mysuru Campus: Business Laptop 14in (i5, 16GB)
  ( 9, 16,  50,    310.00), -- Swiggy Instamart: Frozen Parathas (Pack of 20)
  ( 9, 14,  60,    180.00), -- Swiggy Instamart: Frozen Green Peas 1kg
  (10,  6,  40,    950.00), -- Tata Projects Ltd: Stainless Hex Bolt M12 (Box of 100)
  (10, 21,  20,    285.00), -- Tata Projects Ltd: Industrial Safety Helmet (ISI)
  (10, 20,  30,    540.00), -- Tata Projects Ltd: Nitrile Gloves (Box of 100)
  (11, 13,  10,   1850.00), -- Hotel Saravana Bhavan: Commercial LPG Cylinder 19kg
  (12,  5,  20,   8250.00), -- VIT Vellore - Central Stores: Single-Board Computer 8GB
  (12,  3,  15,   1499.00); -- VIT Vellore - Central Stores: Wireless Over-Ear Headphones

UPDATE "Order" o
   SET TotalAmount = COALESCE((SELECT SUM(oi.Quantity * oi.UnitPriceAtSale)
                                 FROM OrderItem oi
                                WHERE oi.OrderID = o.OrderID), 0);

-- -----------------------------------------------------------------------------
-- 14. SHIPMENTS  (one per fulfilled order)
-- -----------------------------------------------------------------------------
INSERT INTO Shipment (OrderID, ShippedAt, Carrier, TrackingNumber, EstimatedArrival, Status) VALUES
  (1, NOW() - INTERVAL '5 days', 'Blue Dart Express',  'BD-2026101801', CURRENT_DATE - 2, 'Delivered'),
  (2, NOW() - INTERVAL '4 days', 'VRL Logistics',      'VRL-2026101902', CURRENT_DATE - 1, 'Delivered'),
  (3, NOW() - INTERVAL '2 days', 'Snowman Cold Chain', 'SNW-2026102103', CURRENT_DATE + 1, 'In Transit'),
  (4, NOW() - INTERVAL '20 hours', 'Delhivery',          'DLV-2026102204', CURRENT_DATE + 1, 'In Transit');

-- -----------------------------------------------------------------------------
-- 15. DIGITAL TWIN SNAPSHOTS  (historical captures for the time-travel view)
--     Derived from the live state above so the history trends into the
--     present: stock was higher before the fulfilled orders shipped out.
--     03_triggers_procedures.sql then appends a fresh snapshot per warehouse.
-- -----------------------------------------------------------------------------
INSERT INTO DigitalTwinSnapshot
  (WarehouseID, SnapshotTime, TotalBins, OccupiedBins, TotalStockUnits,
   ActiveAlerts, ActiveSensors, SnapshotPayloadJSON, CreatedBy)
SELECT live.WarehouseID,
       NOW() - make_interval(hours => h.HoursAgo),
       live.TotalBins,
       LEAST(live.TotalBins, live.OccupiedBins + h.ExtraOccupied),
       ROUND(live.TotalStock * h.StockFactor)::INT,
       h.ActiveAlerts,
       live.ActiveSensors + h.ExtraSensors,
       NULL,
       'scheduler'
  FROM (SELECT z.WarehouseID,
               COUNT(b.BinID)                               AS TotalBins,
               COUNT(b.BinID) FILTER (WHERE b.CurrentStock > 0) AS OccupiedBins,
               COALESCE(SUM(b.CurrentStock), 0)             AS TotalStock,
               (SELECT COUNT(*) FROM Sensor s JOIN Zone z2 ON z2.ZoneID = s.ZoneID
                 WHERE z2.WarehouseID = z.WarehouseID AND s.Status = 'Active') AS ActiveSensors
          FROM Zone z
          JOIN Rack r ON r.ZoneID = z.ZoneID
          JOIN Bin  b ON b.RackID = r.RackID
         GROUP BY z.WarehouseID) live
 CROSS JOIN (VALUES
       -- HoursAgo, ExtraOccupied, StockFactor, ActiveAlerts, ExtraSensors
       (72, 1, 1.22, 1, 1),
       (48, 1, 1.15, 2, 1),
       (24, 1, 1.09, 3, 0),
       (12, 0, 1.05, 3, 0),
       ( 6, 0, 1.02, 4, 0)
     ) AS h(HoursAgo, ExtraOccupied, StockFactor, ActiveAlerts, ExtraSensors);

-- =============================================================================
-- END OF SEED DATA SCRIPT
-- =============================================================================
