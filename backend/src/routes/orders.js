const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { asyncHandler } = require('../middleware/asyncHandler');
const { body, validationResult } = require('express-validator');

// GET /api/orders
router.get('/', asyncHandler(async (req, res) => {
  const result = await pool.query(`
    SELECT o.OrderID as "orderId", o.CustomerName as "customerName", o.CustomerEmail as "customerEmail", o.OrderDate as "orderDate", o.Status as "status", o.TotalAmount as "totalAmount", o.Notes as "notes",
           s.ShipmentID as "shipmentId", s.Carrier as "carrier", s.TrackingNumber as "trackingNumber", s.EstimatedArrival as "estimatedArrival", s.Status as "shipmentStatus"
    FROM "Order" o
    LEFT JOIN Shipment s ON o.OrderID = s.OrderID
    ORDER BY o.OrderDate DESC
  `);
  res.json(result.rows);
}));

// GET /api/orders/:id
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const orderResult = await pool.query(`
    SELECT OrderID as "orderId", CustomerName as "customerName", CustomerEmail as "customerEmail", OrderDate as "orderDate", Status as "status", TotalAmount as "totalAmount", Notes as "notes"
    FROM "Order" WHERE OrderID = $1
  `, [id]);
  
  if (orderResult.rows.length === 0) {
    res.status(404);
    throw new Error('Order not found');
  }
  
  const itemsResult = await pool.query(`
    SELECT oi.OrderItemID as "orderItemId", oi.ProductID as "productId", p.ProductName as "productName", oi.Quantity as "quantity", oi.UnitPriceAtSale as "unitPriceAtSale"
    FROM OrderItem oi
    JOIN Product p ON oi.ProductID = p.ProductID
    WHERE oi.OrderID = $1
  `, [id]);
  
  const order = orderResult.rows[0];
  order.items = itemsResult.rows;
  
  res.json(order);
}));

// POST /api/orders
router.post('/', [
  body('customerName').notEmpty().withMessage('Customer name required'),
  body('customerEmail').isEmail().withMessage('Valid email required'),
  body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
  body('items.*.productId').isInt(),
  body('items.*.quantity').isInt({ min: 1 })
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400);
    return res.json({ error: true, message: 'Validation failed', detail: errors.array() });
  }

  const { customerName, customerEmail, notes, items } = req.body;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    
    let totalAmount = 0;
    const enrichedItems = [];
    
    for (const item of items) {
      const pRes = await client.query('SELECT UnitPrice FROM Product WHERE ProductID = $1', [item.productId]);
      if (pRes.rows.length === 0) {
        throw new Error(`Product ${item.productId} not found`);
      }
      const price = parseFloat(pRes.rows[0].unitprice);
      totalAmount += price * item.quantity;
      enrichedItems.push({ ...item, price });
    }
    
    const oRes = await client.query(
      'INSERT INTO "Order" (CustomerName, CustomerEmail, TotalAmount, Notes) VALUES ($1, $2, $3, $4) RETURNING OrderID as "orderId", CustomerName as "customerName", CustomerEmail as "customerEmail", OrderDate as "orderDate", Status as "status", TotalAmount as "totalAmount", Notes as "notes"',
      [customerName, customerEmail, totalAmount, notes]
    );
    const order = oRes.rows[0];
    const orderId = order.orderId;
    
    for (const item of enrichedItems) {
      await client.query(
        'INSERT INTO OrderItem (OrderID, ProductID, Quantity, UnitPriceAtSale) VALUES ($1, $2, $3, $4)',
        [orderId, item.productId, item.quantity, item.price]
      );
    }
    
    await client.query('COMMIT');
    res.status(201).json(order);
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(400);
    throw e;
  } finally {
    client.release();
  }
}));

// POST /api/orders/:id/fulfil
router.post('/:id/fulfil', asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  try {
    await pool.query('CALL sp_fulfil_order($1)', [id]);
    res.json({ success: true, message: 'Order fulfilled successfully' });
  } catch (e) {
    res.status(400).json({ error: true, message: e.message });
  }
}));

module.exports = router;
