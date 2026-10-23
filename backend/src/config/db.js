const { Pool } = require('pg');
const { connectionConfig } = require('./connection');

// Serverless instances are short-lived and many may run at once, so keep each
// instance's share of the database's connection limit small on Vercel.
const pool = new Pool({
  ...connectionConfig(),
  max: process.env.VERCEL ? 5 : 10,
});

module.exports = pool;
