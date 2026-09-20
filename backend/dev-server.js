/**
 * dev-server.js
 * ─────────────────────────────────────────────────────────────────────────────
 * All-in-one dev launcher for Digital Twin WMS backend.
 *
 * 1. Starts an embedded PostgreSQL instance (real PG binary, no external install)
 * 2. Creates the `digital_twin_wms` database on first run
 * 3. Runs all 4 SQL scripts (schema -> seed -> triggers -> views) cleanly
 * 4. Starts the Express API server on port 3001
 *
 * Usage:  node dev-server.js
 * ─────────────────────────────────────────────────────────────────────────────
 */

const EmbeddedPostgres = require('embedded-postgres').default;
const { Client }       = require('pg');
const path             = require('path');
const fs               = require('fs');

// ── Config ──────────────────────────────────────────────────────────────────
const PG_PORT     = 5432;
const PG_USER     = 'postgres';
const PG_PASSWORD = 'postgres';
const DB_NAME     = 'digital_twin_wms';
const DATA_DIR    = path.join(__dirname, '.pg-data');

// SQL scripts relative to repo root (one level up from backend/)
const REPO_ROOT   = path.join(__dirname, '..');
const SCRIPTS = [
  { file: '01_ddl_schema.sql',          label: 'DDL Schema' },
  { file: '02_seed_data.sql',           label: 'Seed Data' },
  { file: '03_triggers_procedures.sql', label: 'Triggers & Procedures' },
  { file: '04_views_queries.sql',       label: 'Views & Queries' },
];

const STAMP_FILE  = path.join(DATA_DIR, '.scripts_loaded');

const log = (msg) => console.log(`\x1b[36m[dev-server]\x1b[0m ${msg}`);
const ok  = (msg) => console.log(`\x1b[32m[dev-server]\x1b[0m ${msg}`);
const warn = (msg) => console.log(`\x1b[33m[dev-server]\x1b[0m ${msg}`);
const err = (msg) => console.error(`\x1b[31m[dev-server]\x1b[0m ${msg}`);

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Splits a SQL file into individual statements, correctly handling:
 *  - $$ dollar-quoted blocks (plpgsql functions/procedures)
 *  - Standard ; terminated statements
 *  - -- line comments and /* */ /* block comments
 */
function splitStatements(sql) {
  const statements = [];
  let current = '';
  let dollarTag = null; // inside $...$ or $$ block
  let i = 0;

  while (i < sql.length) {
    if (dollarTag === null) {
      const dollarMatch = sql.slice(i).match(/^(\$[a-zA-Z0-9_]*\$)/);
      if (dollarMatch) {
        dollarTag = dollarMatch[1];
        current += dollarTag;
        i += dollarTag.length;
        continue;
      }
    } else {
      if (sql.slice(i).startsWith(dollarTag)) {
        current += dollarTag;
        i += dollarTag.length;
        dollarTag = null;
        continue;
      }
    }

    const ch = sql[i];

    if (dollarTag === null && ch === ';') {
      current += ch;
      const trimmed = current.trim();
      if (trimmed && trimmed !== ';') {
        statements.push(trimmed);
      }
      current = '';
      i++;
      continue;
    }

    // Skip -- line comments (outside dollar blocks)
    if (dollarTag === null && ch === '-' && sql[i + 1] === '-') {
      while (i < sql.length && sql[i] !== '\n') i++;
      current += '\n';
      continue;
    }

    // Skip /* */ block comments (outside dollar blocks)
    if (dollarTag === null && ch === '/' && sql[i + 1] === '*') {
      i += 2;
      while (i < sql.length && !(sql[i] === '*' && sql[i + 1] === '/')) i++;
      i += 2;
      current += ' ';
      continue;
    }

    current += ch;
    i++;
  }

  const trimmed = current.trim();
  if (trimmed) statements.push(trimmed);

  return statements.filter(s => s.length > 1);
}

async function runScript(client, scriptFile, label) {
  const fullPath = path.join(REPO_ROOT, scriptFile);
  if (!fs.existsSync(fullPath)) {
    warn(`${label}: file not found — skipping`);
    return;
  }

  log(`Loading: ${label} (${scriptFile})`);
  const sql = fs.readFileSync(fullPath, { encoding: 'utf8' });
  const statements = splitStatements(sql);
  let ok_count = 0, skip_count = 0;

  for (const stmt of statements) {
    try {
      await client.query(stmt);
      ok_count++;
    } catch (e) {
      const msg = e.message || '';
      if (
        e.code === '42P07' ||
        e.code === '42710' ||
        e.code === '42P16' ||
        e.code === '23505' ||
        msg.includes('already exists') ||
        (msg.includes('does not exist') && stmt.toUpperCase().startsWith('DROP')) ||
        msg.includes('multiple primary keys')
      ) {
        skip_count++;
      } else {
        warn(`  SKIP (${e.code}): ${msg.slice(0, 120)}`);
        skip_count++;
      }
    }
  }
  ok(`  ${label}: ${ok_count} OK, ${skip_count} skipped/cached`);
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  // Check for stale postmaster.pid from a previous forced kill
  const pidFile = path.join(DATA_DIR, 'postmaster.pid');
  if (fs.existsSync(pidFile)) {
    log('Cleaning up stale postmaster.pid …');
    try { fs.unlinkSync(pidFile); } catch (e) {}
  }

  const pg = new EmbeddedPostgres({
    databaseDir: DATA_DIR,
    user:        PG_USER,
    password:    PG_PASSWORD,
    port:        PG_PORT,
    persistent:  true,
    onLog: () => {}, // silence verbose internal pg logging
    onError: (m) => warn(m.trim()),
  });

  const versionFile = path.join(DATA_DIR, 'PG_VERSION');
  if (!fs.existsSync(versionFile)) {
    log(`Initializing new PostgreSQL cluster in: ${DATA_DIR}`);
    await pg.initialise();
  } else {
    log(`Using existing PostgreSQL cluster in: ${DATA_DIR}`);
  }

  log('Starting PostgreSQL server …');
  await pg.start();
  ok(`PostgreSQL started on port ${PG_PORT}`);
  await sleep(600);

  // ── 2. Create application database ───────────────────────────────────────
  const adminClient = new Client({
    host: 'localhost', port: PG_PORT,
    user: PG_USER, password: PG_PASSWORD,
    database: 'postgres',
  });
  await adminClient.connect();

  const { rows } = await adminClient.query(
    `SELECT 1 FROM pg_database WHERE datname = $1`, [DB_NAME]
  );
  if (rows.length === 0) {
    await adminClient.query(`CREATE DATABASE ${DB_NAME}`);
    ok(`Database '${DB_NAME}' created.`);
  } else {
    log(`Database '${DB_NAME}' is ready.`);
  }
  await adminClient.end();

  // ── 3. Run SQL setup scripts if needed ─────────────────────────────────────
  if (!fs.existsSync(STAMP_FILE)) {
    const appClient = new Client({
      host:     'localhost',
      port:     PG_PORT,
      user:     PG_USER,
      password: PG_PASSWORD,
      database: DB_NAME,
    });
    await appClient.connect();
    await appClient.query("SET client_encoding = 'UTF8'");

    log('Applying SQL scripts to database …');
    for (const { file, label } of SCRIPTS) {
      await runScript(appClient, file, label);
    }
    await appClient.end();
    fs.writeFileSync(STAMP_FILE, new Date().toISOString());
    ok('All database scripts loaded and verified ✓');
  } else {
    log('Database schemas & seed data already loaded.');
  }

  // ── 4. Set env vars + start Express ──────────────────────────────────────
  process.env.DB_HOST     = 'localhost';
  process.env.DB_PORT     = String(PG_PORT);
  process.env.DB_NAME     = DB_NAME;
  process.env.DB_USER     = PG_USER;
  process.env.DB_PASSWORD = PG_PASSWORD;
  process.env.PORT        = process.env.PORT || '3001';
  process.env.NODE_ENV    = 'development';
  process.env.CORS_ORIGIN = 'http://localhost:5173';

  ok(`Starting Express API server on port ${process.env.PORT} …`);
  ok('═══════════════════════════════════════════════════════');
  ok(`  API Health :  http://localhost:${process.env.PORT}/api/health`);
  ok(`  API Root   :  http://localhost:${process.env.PORT}/api/dashboard/summary`);
  ok(`  Frontend   :  http://localhost:5173`);
  ok('═══════════════════════════════════════════════════════');

  // Graceful shutdown
  const shutdown = async () => {
    log('Shutting down embedded PostgreSQL …');
    try { await pg.stop(); } catch (e) {}
    process.exit(0);
  };
  process.on('SIGINT',  shutdown);
  process.on('SIGTERM', shutdown);

  require('./server');
}

main().catch((e) => {
  err('FATAL: ' + e.message);
  console.error(e);
  process.exit(1);
});
