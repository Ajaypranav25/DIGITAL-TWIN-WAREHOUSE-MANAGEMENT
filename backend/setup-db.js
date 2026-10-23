/**
 * setup-db.js
 * Connects to the already-running embedded PostgreSQL and runs all 4 SQL scripts.
 * Statement splitting ($$ blocks, quoted strings, comments) lives in sql-runner.js.
 *
 * Run: node setup-db.js
 */

require('dotenv').config();
const { Client } = require('pg');
const { runAllScripts } = require('./sql-runner');
const { connectionConfig } = require('./src/config/connection');

const log = {
  info:  (m) => console.log('\x1b[36m→\x1b[0m', m),
  ok:    (m) => console.log('\x1b[32m✓\x1b[0m', m),
  warn:  (m) => console.log('\x1b[33m⚠\x1b[0m', m),
  error: (m) => console.error('\x1b[31m✗\x1b[0m', m),
};

async function main() {
  // DATABASE_URL targets a hosted database; otherwise the local embedded one
  const client = new Client(connectionConfig());

  log.info(process.env.DATABASE_URL || process.env.POSTGRES_URL
    ? 'Connecting to DATABASE_URL …'
    : 'Connecting to local PostgreSQL …');
  await client.connect();
  await client.query("SET client_encoding = 'UTF8'");
  log.ok('Connected!');

  const failures = await runAllScripts(client, log);
  await client.end();

  if (failures > 0) {
    log.error(`Database setup finished with ${failures} failed statement(s).`);
    process.exit(1);
  }
  log.ok('Database setup complete ✓');
}

main().catch((e) => {
  console.error('\x1b[31mFATAL:\x1b[0m', e.message);
  process.exit(1);
});
