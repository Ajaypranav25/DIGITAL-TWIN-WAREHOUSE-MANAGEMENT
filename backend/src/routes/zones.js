const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { asyncHandler } = require('../middleware/asyncHandler');

// GET /api/zones
router.get('/', asyncHandler(async (req, res) => {
  const { warehouse_id } = req.query;
  let query = 'SELECT ZoneID as "zoneId", WarehouseID as "warehouseId", ZoneName as "zoneName", ZoneType as "zoneType", FloorArea_sqm as "floorAreaSqm", CreatedAt as "createdAt" FROM Zone';
  const params = [];
  
  if (warehouse_id) {
    query += ' WHERE WarehouseID = $1';
    params.push(warehouse_id);
  }
  
  query += ' ORDER BY ZoneID';
  
  const result = await pool.query(query, params);
  res.json(result.rows);
}));

// GET /api/zones/:id
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const result = await pool.query(`
    SELECT z.ZoneID as "zoneId", z.WarehouseID as "warehouseId", z.ZoneName as "zoneName", z.ZoneType as "zoneType", z.FloorArea_sqm as "floorAreaSqm", z.CreatedAt as "createdAt",
    (SELECT COUNT(*) FROM Rack WHERE ZoneID = z.ZoneID) as "rackCount",
    (SELECT COUNT(*) FROM Alert WHERE ZoneID = z.ZoneID AND Status = 'Open') as "alertCount"
    FROM Zone z
    WHERE z.ZoneID = $1
  `, [id]);
  
  if (result.rows.length === 0) {
    res.status(404);
    throw new Error('Zone not found');
  }
  
  res.json(result.rows[0]);
}));

module.exports = router;
