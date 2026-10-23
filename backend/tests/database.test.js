/**
 * Database-logic tests: triggers, stored procedures and views.
 * Every test runs inside a transaction that is rolled back, so the seed data
 * is left untouched. Requires the dev server (embedded PostgreSQL) running.
 *
 * Run: npm test
 */
const { test, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { Client } = require('pg');

const client = new Client({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'digital_twin_wms',
});

const one = async (sql, params) => (await client.query(sql, params)).rows[0];
const binStock = async (binCode) =>
  (await one('SELECT CurrentStock FROM Bin WHERE BinCode = $1', [binCode])).currentstock;
const inventoryRow = (binCode, sku) => one(
  `SELECT ii.InventoryItemID AS id, ii.Quantity AS qty
     FROM InventoryItem ii
     JOIN Bin b ON b.BinID = ii.BinID
     JOIN Product p ON p.ProductID = ii.ProductID
    WHERE b.BinCode = $1 AND p.SKU = $2`, [binCode, sku]);

before(() => client.connect());
after(() => client.end());
beforeEach(() => client.query('BEGIN'));
afterEach(() => client.query('ROLLBACK'));

test('seed: every Bin.CurrentStock equals the sum of its inventory items', async () => {
  const { mismatches } = await one(`
    SELECT COUNT(*)::INT AS mismatches
      FROM Bin b
     WHERE b.CurrentStock <> COALESCE((SELECT SUM(Quantity) FROM InventoryItem WHERE BinID = b.BinID), 0)`);
  assert.equal(mismatches, 0);
});

test('trg_bin_stock_sync: updating a quantity re-syncs the bin', async () => {
  const row = await inventoryRow('A1-R02-B01', 'SKU-PKG-7001'); // 70 of 100
  await client.query('UPDATE InventoryItem SET Quantity = 55 WHERE InventoryItemID = $1', [row.id]);
  assert.equal(await binStock('A1-R02-B01'), 55);
});

test('trg_bin_stock_sync: exceeding capacity is rejected', async () => {
  const row = await inventoryRow('A1-R02-B01', 'SKU-PKG-7001');
  await assert.rejects(
    client.query('UPDATE InventoryItem SET Quantity = 101 WHERE InventoryItemID = $1', [row.id]),
    /CAPACITY EXCEEDED/,
  );
});

test('trg_bin_stock_sync: filling a bin to 100% raises one Overstocked alert', async () => {
  const row = await inventoryRow('A1-R02-B01', 'SKU-PKG-7001');
  await client.query('UPDATE InventoryItem SET Quantity = 100 WHERE InventoryItemID = $1', [row.id]);
  await client.query('UPDATE InventoryItem SET Quantity = 100, LastUpdated = NOW() WHERE InventoryItemID = $1', [row.id]);
  const { n } = await one(`
    SELECT COUNT(*)::INT AS n FROM Alert a JOIN Bin b ON b.BinID = a.BinID
     WHERE b.BinCode = 'A1-R02-B01' AND a.AlertType = 'Overstocked' AND a.Status = 'Open'`);
  assert.equal(n, 1);
});

test('trg_bin_stock_sync: emptying space in a full bin auto-resolves its Overstocked alert', async () => {
  const row = await inventoryRow('A2-R01-B01', 'SKU-CON-3001'); // 300 / 300, alert open
  await client.query('UPDATE InventoryItem SET Quantity = 250 WHERE InventoryItemID = $1', [row.id]);
  const { n } = await one(`
    SELECT COUNT(*)::INT AS n FROM Alert a JOIN Bin b ON b.BinID = a.BinID
     WHERE b.BinCode = 'A2-R01-B01' AND a.AlertType = 'Overstocked' AND a.Status <> 'Resolved'`);
  assert.equal(n, 0);
});

test('trg_bin_stock_sync: deleting an inventory item lowers the bin stock', async () => {
  const row = await inventoryRow('A1-R01-B01', 'SKU-HDW-2002'); // shared bin: 60 bolts + 40 bearings
  await client.query('DELETE FROM InventoryItem WHERE InventoryItemID = $1', [row.id]);
  assert.equal(await binStock('A1-R01-B01'), 60);
});

test('trg_bin_stock_sync: moving an item re-syncs both the old and the new bin', async () => {
  const row = await inventoryRow('A1-R02-B03', 'SKU-SAF-8002'); // 25 helmets
  await client.query(
    `UPDATE InventoryItem SET BinID = (SELECT BinID FROM Bin WHERE BinCode = 'A1-R03-B02')
      WHERE InventoryItemID = $1`, [row.id]);
  assert.equal(await binStock('A1-R02-B03'), 0);
  assert.equal(await binStock('A1-R03-B02'), 25);
});

test('trg_sensor_threshold_check: a breaching reading raises an alert, a normal one does not', async () => {
  const count = async () => (await one(
    "SELECT COUNT(*)::INT AS n FROM Alert WHERE SensorID = 19 AND AlertType = 'Threshold Breach'")).n;
  const startCount = await count();
  await client.query("INSERT INTO SensorReading (SensorID, ReadingValue, Unit) VALUES (19, 5.0, 'degC')");
  assert.equal(await count(), startCount);
  await client.query("INSERT INTO SensorReading (SensorID, ReadingValue, Unit) VALUES (19, 9.4, 'degC')");
  assert.equal(await count(), startCount + 1);
  const alert = await one(
    "SELECT Severity, Message FROM Alert WHERE SensorID = 19 ORDER BY AlertID DESC LIMIT 1");
  assert.equal(alert.severity, 'Critical');
  assert.match(alert.message, /HIGH threshold of 8/);
});

test('trg_sensor_failure_alert: marking a sensor Faulty raises exactly one alert', async () => {
  await client.query("UPDATE Sensor SET Status = 'Faulty' WHERE SensorID = 1");
  await client.query("UPDATE Sensor SET Status = 'Active' WHERE SensorID = 1");
  await client.query("UPDATE Sensor SET Status = 'Faulty' WHERE SensorID = 1");
  const { n } = await one(
    "SELECT COUNT(*)::INT AS n FROM Alert WHERE SensorID = 1 AND AlertType = 'Sensor Failure' AND Status = 'Open'");
  assert.equal(n, 1);
});

test('sp_fulfil_order: picks oldest stock first (FIFO) and creates a shipment', async () => {
  // Order 6 = 50 x Paint Thinner; B3-R01-B01 (42, oldest) then B3-R02-B01 (18, newest)
  await client.query('CALL sp_fulfil_order(6)');
  assert.equal(await binStock('B3-R01-B01'), 0);
  assert.equal(await binStock('B3-R02-B01'), 10);
  const order = await one('SELECT Status FROM "Order" WHERE OrderID = 6');
  assert.equal(order.status, 'Fulfilled');
  const shipment = await one('SELECT Status, TrackingNumber FROM Shipment WHERE OrderID = 6');
  assert.equal(shipment.status, 'Preparing');
  assert.match(shipment.trackingnumber, /^INT-\d{8}-00006$/);
});

test('sp_fulfil_order: insufficient stock rolls back every change', async () => {
  // Order 8 asks for 25 laptops; only 8 exist
  const before = await binStock('B1-R01-B01');
  await client.query('SAVEPOINT s');
  await assert.rejects(client.query('CALL sp_fulfil_order(8)'), /Insufficient stock/);
  await client.query('ROLLBACK TO SAVEPOINT s');
  assert.equal(await binStock('B1-R01-B01'), before);
  assert.equal((await one('SELECT Status FROM "Order" WHERE OrderID = 8')).status, 'Pending');
  assert.equal(await one('SELECT 1 FROM Shipment WHERE OrderID = 8'), undefined);
});

test('sp_fulfil_order: an already fulfilled order is rejected', async () => {
  await assert.rejects(client.query('CALL sp_fulfil_order(1)'), /cannot be fulfilled/);
});

test('vw_inventory_utilisation: totals are not inflated by bins holding several products', async () => {
  const view = await one(
    'SELECT SUM(TotalBins)::INT AS bins, SUM(TotalStockUnits)::INT AS stock, SUM(TotalCapacityUnits)::INT AS cap FROM vw_inventory_utilisation');
  const raw = await one(
    'SELECT COUNT(*)::INT AS bins, SUM(CurrentStock)::INT AS stock, SUM(Capacity)::INT AS cap FROM Bin');
  assert.deepEqual(view, raw);
});

test('seed: every warehouse has a snapshot taken by sp_take_snapshot', async () => {
  const { n } = await one("SELECT COUNT(DISTINCT WarehouseID)::INT AS n FROM DigitalTwinSnapshot WHERE CreatedBy = 'sp_take_snapshot'");
  assert.equal(n, 3);
});

test('sp_take_snapshot: stores live metrics and a per-bin JSON payload', async () => {
  await client.query('CALL sp_take_snapshot(3)');
  const snap = await one(`
    SELECT TotalBins, TotalStockUnits, jsonb_array_length(SnapshotPayloadJSON) AS payload_bins
      FROM DigitalTwinSnapshot WHERE WarehouseID = 3 ORDER BY SnapshotID DESC LIMIT 1`);
  const live = await one(`
    SELECT COUNT(*)::INT AS bins, SUM(b.CurrentStock)::INT AS stock
      FROM Bin b JOIN Rack r ON r.RackID = b.RackID JOIN Zone z ON z.ZoneID = r.ZoneID
     WHERE z.WarehouseID = 3`);
  assert.equal(snap.totalbins, live.bins);
  assert.equal(snap.totalstockunits, live.stock);
  assert.equal(snap.payload_bins, live.bins);
});
