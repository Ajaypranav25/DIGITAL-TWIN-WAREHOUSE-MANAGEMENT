/**
 * REST API tests. Only read-only requests and requests that the database
 * rejects are used, so the demo data is not modified.
 * Requires the dev server running on API_URL (default http://localhost:3001).
 *
 * Run: npm test
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');

const API = process.env.API_URL || 'http://localhost:3001/api';

const call = async (method, path, body) => {
  const res = await fetch(API + path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json() };
};

test('GET /dashboard/summary reports utilisation as stock / capacity', async () => {
  const { status, body } = await call('GET', '/dashboard/summary');
  assert.equal(status, 200);
  assert.equal(body.warehouses, 3);
  const expected = Math.round((body.totalStock / body.totalCapacity) * 10000) / 100;
  assert.equal(body.utilizationPct, expected);
});

test('GET /alerts includes the zone name and honours filters', async () => {
  const { status, body } = await call('GET', '/alerts?status=Open&severity=Critical');
  assert.equal(status, 200);
  assert.ok(body.length > 0);
  for (const alert of body) {
    assert.equal(alert.status, 'Open');
    assert.equal(alert.severity, 'Critical');
    assert.ok(alert.zoneName, 'zoneName should be populated');
  }
});

test('GET /sensors returns the unit of the latest reading', async () => {
  const { body } = await call('GET', '/sensors');
  const coldRoom = body.find((s) => s.sensorId === 16);
  assert.equal(coldRoom.latestUnit, 'degC');
  assert.equal(Number(coldRoom.latestReading), -11.2);
});

test('GET /inventory exposes InventoryItemID for every stocked placement', async () => {
  const { body } = await call('GET', '/inventory?warehouse_id=1');
  const stocked = body.filter((row) => row.productid !== null);
  assert.ok(stocked.length > 0);
  assert.ok(stocked.every((row) => Number.isInteger(row.inventoryitemid)));
});

test('POST /inventory with a product already in that bin returns 409', async () => {
  const { status } = await call('POST', '/inventory', { binId: 1, productId: 6, quantity: 1 });
  assert.equal(status, 409);
});

test('PATCH /inventory beyond bin capacity returns 400 with the trigger message', async () => {
  const { body: inv } = await call('GET', '/inventory?warehouse_id=1');
  const row = inv.find((r) => r.bincode === 'A1-R02-B01');
  const { status, body } = await call('PATCH', `/inventory/${row.inventoryitemid}`, { quantity: 999 });
  assert.equal(status, 400);
  assert.match(body.message, /CAPACITY EXCEEDED/);
});

test('POST /orders/:id/fulfil with insufficient stock fails and leaves the order Pending', async () => {
  const { status, body } = await call('POST', '/orders/8/fulfil');
  assert.equal(status, 400);
  assert.match(body.message, /Insufficient stock/);
  const { body: order } = await call('GET', '/orders/8');
  assert.equal(order.status, 'Pending');
});

test('malformed ids return 400 instead of 500', async () => {
  const { status } = await call('GET', '/orders/abc');
  assert.equal(status, 400);
});

test('PATCH /alerts rejects an unknown status', async () => {
  const { status } = await call('PATCH', '/alerts/1', { status: 'Deleted' });
  assert.equal(status, 400);
});

test('PATCH /sensors rejects an unknown status', async () => {
  const { status } = await call('PATCH', '/sensors/1', { status: 'Broken' });
  assert.equal(status, 400);
});
