/**
 * PostgreSQL connection settings shared by the API pool, setup-db.js and the tests.
 *
 * - Hosted database (Vercel / Neon / Supabase): set DATABASE_URL (or POSTGRES_URL,
 *   which the Vercel Postgres integrations inject). SSL options such as
 *   ?sslmode=require are read from the URL by node-postgres.
 * - Local development: DB_HOST / DB_PORT / DB_NAME / DB_USER / DB_PASSWORD,
 *   defaulting to the embedded PostgreSQL started by dev-server.js.
 */
function connectionConfig() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (url) {
    return { connectionString: url };
  }
  return {
    host:     process.env.DB_HOST || 'localhost',
    port:     Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME || 'digital_twin_wms',
    user:     process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  };
}

module.exports = { connectionConfig };
