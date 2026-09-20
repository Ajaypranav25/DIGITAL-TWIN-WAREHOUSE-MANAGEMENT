const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { asyncHandler } = require('../middleware/asyncHandler');

// GET /api/equipment
router.get('/', asyncHandler(async (req, res) => {
  const { zone_id } = req.query;
  let query = 'SELECT EquipmentID as "equipmentId", ZoneID as "zoneId", EquipmentName as "equipmentName", EquipmentType as "equipmentType", SerialNumber as "serialNumber", Status as "status", LastServiceDate as "lastServiceDate" FROM Equipment';
  const params = [];
  
  if (zone_id) {
    query += ' WHERE ZoneID = $1';
    params.push(zone_id);
  }
  
  query += ' ORDER BY EquipmentID';
  
  const result = await pool.query(query, params);
  res.json(result.rows);
}));

module.exports = router;
