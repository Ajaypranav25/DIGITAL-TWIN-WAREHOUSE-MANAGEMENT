const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { asyncHandler } = require('../middleware/asyncHandler');
const { body, validationResult } = require('express-validator');

// GET /api/products
router.get('/', asyncHandler(async (req, res) => {
  const result = await pool.query('SELECT ProductID as "productId", SKU as "sku", ProductName as "productName", Category as "category", UnitWeightKg as "unitWeightKg", UnitPrice as "unitPrice", ReorderLevel as "reorderLevel", CreatedAt as "createdAt" FROM Product ORDER BY ProductID');
  res.json(result.rows);
}));

// GET /api/products/low-stock
router.get('/low-stock', asyncHandler(async (req, res) => {
  const result = await pool.query(`
    SELECT p.ProductID as "productId", p.SKU as "sku", p.ProductName as "productName", p.ReorderLevel as "reorderLevel",
           COALESCE(SUM(i.Quantity), 0) as "currentTotalQuantity"
    FROM Product p
    LEFT JOIN InventoryItem i ON p.ProductID = i.ProductID
    GROUP BY p.ProductID, p.SKU, p.ProductName, p.ReorderLevel
    HAVING COALESCE(SUM(i.Quantity), 0) < p.ReorderLevel
    ORDER BY "currentTotalQuantity" ASC
  `);
  res.json(result.rows);
}));

// GET /api/products/:id
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const result = await pool.query('SELECT ProductID as "productId", SKU as "sku", ProductName as "productName", Category as "category", UnitWeightKg as "unitWeightKg", UnitPrice as "unitPrice", ReorderLevel as "reorderLevel", CreatedAt as "createdAt" FROM Product WHERE ProductID = $1', [id]);
  
  if (result.rows.length === 0) {
    res.status(404);
    throw new Error('Product not found');
  }
  
  res.json(result.rows[0]);
}));

// POST /api/products
router.post('/', [
  body('sku').notEmpty().withMessage('SKU is required'),
  body('productName').notEmpty().withMessage('ProductName is required'),
  body('category').notEmpty().withMessage('Category is required'),
  body('unitWeightKg').isFloat({ min: 0 }).withMessage('UnitWeightKg must be a positive number'),
  body('unitPrice').isFloat({ min: 0 }).withMessage('UnitPrice must be a positive number'),
  body('reorderLevel').isInt({ min: 0 }).withMessage('ReorderLevel must be a non-negative integer')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400);
    return res.json({ error: true, message: 'Validation failed', detail: errors.array() });
  }

  const { sku, productName, category, unitWeightKg, unitPrice, reorderLevel } = req.body;
  
  const result = await pool.query(
    'INSERT INTO Product (SKU, ProductName, Category, UnitWeightKg, UnitPrice, ReorderLevel) VALUES ($1, $2, $3, $4, $5, $6) RETURNING ProductID as "productId", SKU as "sku", ProductName as "productName", Category as "category", UnitWeightKg as "unitWeightKg", UnitPrice as "unitPrice", ReorderLevel as "reorderLevel", CreatedAt as "createdAt"',
    [sku, productName, category, unitWeightKg, unitPrice, reorderLevel]
  );
  
  res.status(201).json(result.rows[0]);
}));

module.exports = router;
