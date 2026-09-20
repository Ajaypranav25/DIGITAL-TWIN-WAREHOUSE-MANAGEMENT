const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { asyncHandler } = require('../middleware/asyncHandler');

// GET /api/employees
router.get('/', asyncHandler(async (req, res) => {
  const { zone_id } = req.query;
  let query = 'SELECT EmployeeID as "employeeId", ZoneID as "zoneId", FirstName as "firstName", LastName as "lastName", Role as "role", Email as "email", PhoneNumber as "phoneNumber", HireDate as "hireDate", IsActive as "isActive" FROM Employee';
  const params = [];
  
  if (zone_id) {
    query += ' WHERE ZoneID = $1';
    params.push(zone_id);
  }
  
  query += ' ORDER BY EmployeeID';
  
  const result = await pool.query(query, params);
  res.json(result.rows);
}));

module.exports = router;
