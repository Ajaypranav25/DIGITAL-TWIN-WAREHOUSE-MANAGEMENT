const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { asyncHandler } = require('../middleware/asyncHandler');

// GET /api/dashboard/summary
router.get('/summary', asyncHandler(async (req, res) => {
  const [
    { rows: [{ count: warehouses }] },
    { rows: [{ count: zones }] },
    { rows: [{ count: bins, capacity: totalCapacity, stock: binStock }] },
    { rows: [{ count: occupiedBins }] },
    { rows: [{ sum: totalStock }] },
    { rows: [{ count: openAlerts }] },
    { rows: [{ count: criticalAlerts }] },
    { rows: [{ count: activeSensors }] },
    { rows: [{ count: pendingOrders }] },
    { rows: [{ count: todayFulfilled }] }
  ] = await Promise.all([
    pool.query('SELECT COUNT(*) FROM Warehouse'),
    pool.query('SELECT COUNT(*) FROM Zone'),
    pool.query('SELECT COUNT(*), COALESCE(SUM(Capacity), 0) AS capacity, COALESCE(SUM(CurrentStock), 0) AS stock FROM Bin'),
    pool.query('SELECT COUNT(*) FROM Bin WHERE CurrentStock > 0'),
    pool.query('SELECT COALESCE(SUM(quantity), 0) AS sum FROM inventoryitem'),
    pool.query("SELECT COUNT(*) FROM Alert WHERE Status = 'Open'"),
    pool.query("SELECT COUNT(*) FROM Alert WHERE Status = 'Open' AND Severity = 'Critical'"),
    pool.query("SELECT COUNT(*) FROM Sensor WHERE Status = 'Active'"),
    pool.query("SELECT COUNT(*) FROM \"Order\" WHERE Status = 'Pending'"),
    // An order counts on the day it was dispatched, not the day it was placed
    pool.query("SELECT COUNT(*) FROM Shipment WHERE ShippedAt::DATE = CURRENT_DATE")
  ]);

  // Utilisation = units stored / units the bins can hold (same basis as vw_inventory_utilisation)
  const utilizationPct = totalCapacity > 0 ? (binStock / totalCapacity) * 100 : 0;

  res.json({
    warehouses: parseInt(warehouses, 10),
    zones: parseInt(zones, 10),
    bins: parseInt(bins, 10),
    occupiedBins: parseInt(occupiedBins, 10),
    totalCapacity: parseInt(totalCapacity, 10),
    totalStock: parseInt(totalStock, 10),
    openAlerts: parseInt(openAlerts, 10),
    criticalAlerts: parseInt(criticalAlerts, 10),
    activeSensors: parseInt(activeSensors, 10),
    pendingOrders: parseInt(pendingOrders, 10),
    todayFulfilled: parseInt(todayFulfilled, 10),
    utilizationPct: parseFloat(utilizationPct.toFixed(2))
  });
}));

module.exports = router;
