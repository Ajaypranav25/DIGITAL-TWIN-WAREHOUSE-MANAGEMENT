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
    return { connectionString: withLibpqSslSemantics(url) };
  }
  return {
    host:     process.env.DB_HOST || 'localhost',
    port:     Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME || 'digital_twin_wms',
    user:     process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  };
}

/**
 * node-postgres 8.x treats sslmode=require/prefer as verify-full, which rejects
 * hosted poolers (e.g. Supabase) whose certificates chain to a provider CA that
 * Node does not ship. Opt in to standard libpq meaning instead: the connection
 * is encrypted but the CA is not checked. sslmode=verify-full is left untouched.
 */
function withLibpqSslSemantics(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    return rawUrl;
  }
  const sslmode = url.searchParams.get('sslmode');
  if (['require', 'prefer'].includes(sslmode) && !url.searchParams.has('uselibpqcompat')) {
    url.searchParams.set('uselibpqcompat', 'true');
  }
  return url.toString();
}

module.exports = { connectionConfig };
