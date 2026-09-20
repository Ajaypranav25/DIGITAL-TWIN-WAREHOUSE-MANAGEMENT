const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { asyncHandler } = require('../middleware/asyncHandler');

// GET /api/warehouses
router.get('/', asyncHandler(async (req, res) => {
  const result = await pool.query('SELECT WarehouseID as "warehouseId", Name as "name", Location as "location", TotalCapacity as "totalCapacity", ManagerName as "managerName", CreatedAt as "createdAt" FROM Warehouse ORDER BY WarehouseID');
  res.json(result.rows);
}));

// GET /api/warehouses/:id
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const result = await pool.query(`
    SELECT w.WarehouseID as "warehouseId", w.Name as "name", w.Location as "location", w.TotalCapacity as "totalCapacity", w.ManagerName as "managerName", w.CreatedAt as "createdAt",
    (SELECT COUNT(*) FROM Zone WHERE WarehouseID = w.WarehouseID) as "zoneCount"
    FROM Warehouse w
    WHERE w.WarehouseID = $1
  `, [id]);
  
  if (result.rows.length === 0) {
    res.status(404);
    throw new Error('Warehouse not found');
  }
  
  res.json(result.rows[0]);
}));

module.exports = router;
