const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { asyncHandler } = require('../middleware/asyncHandler');

// GET /api/bins
router.get('/', asyncHandler(async (req, res) => {
  const { zone_id, rack_id } = req.query;
  let query = `
    SELECT b.BinID as "binId", b.RackID as "rackId", b.BinCode as "binCode", b.Capacity as "capacity", b.CurrentStock as "currentStock", b.CreatedAt as "createdAt"
    FROM Bin b
  `;
  const params = [];
  let conditions = [];
  
  if (rack_id) {
    params.push(rack_id);
    conditions.push(`b.RackID = $${params.length}`);
  }
  
  if (zone_id) {
    query += ' JOIN Rack r ON b.RackID = r.RackID ';
    params.push(zone_id);
    conditions.push(`r.ZoneID = $${params.length}`);
  }
  
  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }
  
  query += ' ORDER BY b.BinID';
  
  const result = await pool.query(query, params);
  res.json(result.rows);
}));

// GET /api/bins/:id
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const binResult = await pool.query('SELECT BinID as "binId", RackID as "rackId", BinCode as "binCode", Capacity as "capacity", CurrentStock as "currentStock", CreatedAt as "createdAt" FROM Bin WHERE BinID = $1', [id]);
  
  if (binResult.rows.length === 0) {
    res.status(404);
    throw new Error('Bin not found');
  }
  
  const itemsResult = await pool.query(`
    SELECT i.InventoryItemID as "inventoryItemId", i.ProductID as "productId", p.ProductName as "productName", p.SKU as "sku", i.Quantity as "quantity", i.LastUpdated as "lastUpdated"
    FROM InventoryItem i
    JOIN Product p ON i.ProductID = p.ProductID
    WHERE i.BinID = $1
  `, [id]);
  
  const bin = binResult.rows[0];
  bin.inventoryItems = itemsResult.rows;
  
  res.json(bin);
}));

module.exports = router;
