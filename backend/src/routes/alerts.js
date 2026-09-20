const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { asyncHandler } = require('../middleware/asyncHandler');
const { body, validationResult } = require('express-validator');

// GET /api/alerts
router.get('/', asyncHandler(async (req, res) => {
  const { status = 'Open', zone_id, severity } = req.query;
  
  let query = 'SELECT AlertID as "alertId", ZoneID as "zoneId", SensorID as "sensorId", BinID as "binId", AlertType as "alertType", Severity as "severity", Message as "message", Status as "status", RaisedAt as "raisedAt", ResolvedAt as "resolvedAt" FROM Alert WHERE 1=1';
  const params = [];
  
  if (status) {
    params.push(status);
    query += ` AND Status = $${params.length}`;
  }
  
  if (zone_id) {
    params.push(zone_id);
    query += ` AND ZoneID = $${params.length}`;
  }
  
  if (severity) {
    params.push(severity);
    query += ` AND Severity = $${params.length}`;
  }
  
  query += ' ORDER BY RaisedAt DESC';
  
  const result = await pool.query(query, params);
  res.json(result.rows);
}));

// GET /api/alerts/report
router.get('/report', asyncHandler(async (req, res) => {
  const result = await pool.query('SELECT * FROM vw_alert_anomaly_report');
  res.json(result.rows);
}));

// PATCH /api/alerts/:id
router.patch('/:id', [
  body('status').isIn(['Acknowledged', 'Resolved']).withMessage('Status must be Acknowledged or Resolved')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400);
    return res.json({ error: true, message: 'Validation failed', detail: errors.array() });
  }

  const { id } = req.params;
  const { status } = req.body;
  
  const resolvedAtClause = status === 'Resolved' ? ', ResolvedAt = CURRENT_TIMESTAMP' : '';
  
  const result = await pool.query(
    `UPDATE Alert SET Status = $1 ${resolvedAtClause} WHERE AlertID = $2 RETURNING AlertID as "alertId", ZoneID as "zoneId", SensorID as "sensorId", BinID as "binId", AlertType as "alertType", Severity as "severity", Message as "message", Status as "status", RaisedAt as "raisedAt", ResolvedAt as "resolvedAt"`,
    [status, id]
  );
  
  if (result.rows.length === 0) {
    res.status(404);
    throw new Error('Alert not found');
  }
  
  res.json(result.rows[0]);
}));

module.exports = router;
