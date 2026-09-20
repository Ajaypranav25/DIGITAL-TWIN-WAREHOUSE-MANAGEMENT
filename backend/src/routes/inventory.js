const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { asyncHandler } = require('../middleware/asyncHandler');
const { body, validationResult } = require('express-validator');

// GET /api/inventory
router.get('/', asyncHandler(async (req, res) => {
  const { warehouse_id, zone_id } = req.query;
  let query = 'SELECT * FROM vw_live_digital_twin_state';
  const params = [];
  const conditions = [];

  if (warehouse_id) {
    params.push(warehouse_id);
    conditions.push(`WarehouseID = $${params.length}`);
  }

  if (zone_id) {
    params.push(zone_id);
    conditions.push(`ZoneID = $${params.length}`);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  const result = await pool.query(query, params);
  res.json(result.rows);
}));

// GET /api/inventory/utilisation
router.get('/utilisation', asyncHandler(async (req, res) => {
  const { warehouse_id } = req.query;
  let query = 'SELECT * FROM vw_inventory_utilisation';
  const params = [];

  if (warehouse_id) {
    params.push(warehouse_id);
    query += ' WHERE WarehouseID = $1';
  }

  const result = await pool.query(query, params);
  res.json(result.rows);
}));

// POST /api/inventory
router.post('/', [
  body('binId').isInt().withMessage('Valid BinID is required'),
  body('productId').isInt().withMessage('Valid ProductID is required'),
  body('quantity').isInt({ min: 1 }).withMessage('Quantity must be positive integer')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400);
    return res.json({ error: true, message: 'Validation failed', detail: errors.array() });
  }

  const { binId, productId, quantity } = req.body;
  
  const result = await pool.query(
    'INSERT INTO InventoryItem (BinID, ProductID, Quantity) VALUES ($1, $2, $3) RETURNING InventoryItemID as "inventoryItemId", BinID as "binId", ProductID as "productId", Quantity as "quantity", LastUpdated as "lastUpdated"',
    [binId, productId, quantity]
  );
  
  res.status(201).json(result.rows[0]);
}));

// PATCH /api/inventory/:id
router.patch('/:id', [
  body('quantity').isInt({ min: 0 }).withMessage('Quantity must be non-negative integer')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400);
    return res.json({ error: true, message: 'Validation failed', detail: errors.array() });
  }

  const { id } = req.params;
  const { quantity } = req.body;
  
  const result = await pool.query(
    'UPDATE InventoryItem SET Quantity = $1, LastUpdated = CURRENT_TIMESTAMP WHERE InventoryItemID = $2 RETURNING InventoryItemID as "inventoryItemId", BinID as "binId", ProductID as "productId", Quantity as "quantity", LastUpdated as "lastUpdated"',
    [quantity, id]
  );
  
  if (result.rows.length === 0) {
    res.status(404);
    throw new Error('Inventory item not found');
  }
  
  res.json(result.rows[0]);
}));

module.exports = router;
