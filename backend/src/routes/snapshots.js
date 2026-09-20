const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { asyncHandler } = require('../middleware/asyncHandler');

// GET /api/snapshots
router.get('/', asyncHandler(async (req, res) => {
  const { warehouse_id } = req.query;
  let query = 'SELECT SnapshotID as "snapshotId", WarehouseID as "warehouseId", SnapshotTime as "snapshotTime", TotalBins as "totalBins", OccupiedBins as "occupiedBins", TotalStockUnits as "totalStockUnits", ActiveAlerts as "activeAlerts", ActiveSensors as "activeSensors", SnapshotPayloadJSON as "snapshotPayloadJson", CreatedBy as "createdBy" FROM DigitalTwinSnapshot';
  const params = [];
  
  if (warehouse_id) {
    query += ' WHERE WarehouseID = $1';
    params.push(warehouse_id);
  }
  
  query += ' ORDER BY SnapshotTime DESC';
  
  const result = await pool.query(query, params);
  res.json(result.rows);
}));

// POST /api/snapshots/:warehouse_id
router.post('/:warehouse_id', asyncHandler(async (req, res) => {
  const { warehouse_id } = req.params;
  
  try {
    await pool.query('CALL sp_take_snapshot($1)', [warehouse_id]);
    res.json({ success: true, message: 'Snapshot taken successfully' });
  } catch (e) {
    res.status(400).json({ error: true, message: e.message });
  }
}));

module.exports = router;
