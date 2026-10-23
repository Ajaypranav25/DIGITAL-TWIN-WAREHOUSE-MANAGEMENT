const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { asyncHandler } = require('../middleware/asyncHandler');
const { body, validationResult } = require('express-validator');

const MAX_READINGS = 500;
const SENSOR_STATUSES = ['Active', 'Inactive', 'Faulty', 'Maintenance'];

// GET /api/sensors
router.get('/', asyncHandler(async (req, res) => {
  const { zone_id } = req.query;
  let query = `
    SELECT s.SensorID as "sensorId", s.ZoneID as "zoneId", s.BinID as "binId", s.SensorType as "sensorType", s.Model as "model", s.InstallDate as "installDate", s.Status as "status", s.ThresholdMin as "thresholdMin", s.ThresholdMax as "thresholdMax",
    z.ZoneName as "zoneName",
    lr.ReadingValue as "latestReading", lr.Unit as "latestUnit", lr.RecordedAt as "latestReadingTime"
    FROM Sensor s
    JOIN Zone z ON z.ZoneID = s.ZoneID
    LEFT JOIN LATERAL (
      SELECT ReadingValue, Unit, RecordedAt
      FROM SensorReading sr
      WHERE sr.SensorID = s.SensorID
      ORDER BY RecordedAt DESC
      LIMIT 1
    ) lr ON true
  `;
  const params = [];
  
  if (zone_id) {
    query += ' WHERE s.ZoneID = $1';
    params.push(zone_id);
  }
  
  query += ' ORDER BY s.SensorID';
  
  const result = await pool.query(query, params);
  res.json(result.rows);
}));

// GET /api/sensors/:id/readings
router.get('/:id/readings', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, MAX_READINGS);
  
  const result = await pool.query(
    'SELECT ReadingID as "readingId", SensorID as "sensorId", ReadingValue as "readingValue", Unit as "unit", RecordedAt as "recordedAt" FROM SensorReading WHERE SensorID = $1 ORDER BY RecordedAt DESC LIMIT $2',
    [id, limit]
  );
  
  res.json(result.rows);
}));

// POST /api/sensors/:id/readings
router.post('/:id/readings', [
  body('readingValue').isFloat().withMessage('Reading value must be a number'),
  body('unit').notEmpty().withMessage('Unit is required')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400);
    return res.json({ error: true, message: 'Validation failed', detail: errors.array() });
  }

  const { id } = req.params;
  const { readingValue, unit } = req.body;
  
  // Insert reading and let trigger handle thresholds
  const result = await pool.query(
    'INSERT INTO SensorReading (SensorID, ReadingValue, Unit) VALUES ($1, $2, $3) RETURNING ReadingID as "readingId", SensorID as "sensorId", ReadingValue as "readingValue", Unit as "unit", RecordedAt as "recordedAt"',
    [id, readingValue, unit]
  );
  
  res.status(201).json(result.rows[0]);
}));

// PATCH /api/sensors/:id  - change device status (Faulty fires trg_sensor_failure_alert)
router.patch('/:id', [
  body('status').isIn(SENSOR_STATUSES).withMessage(`Status must be one of ${SENSOR_STATUSES.join(', ')}`)
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400);
    return res.json({ error: true, message: 'Validation failed', detail: errors.array() });
  }

  const result = await pool.query(
    'UPDATE Sensor SET Status = $1 WHERE SensorID = $2 RETURNING SensorID as "sensorId", Status as "status"',
    [req.body.status, req.params.id]
  );

  if (result.rows.length === 0) {
    res.status(404);
    throw new Error('Sensor not found');
  }

  res.json(result.rows[0]);
}));

module.exports = router;
