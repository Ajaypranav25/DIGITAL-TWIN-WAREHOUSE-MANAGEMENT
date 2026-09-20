/**
 * setup-db.js
 * Connects to the already-running embedded PostgreSQL and runs all 4 SQL scripts.
 * Handles $$ dollar-quoted blocks, CALL statements, and DROP IF EXISTS safely.
 *
 * Run: node setup-db.js
 */

const { Client } = require('pg');
const path = require('path');
const fs   = require('fs');

const REPO_ROOT = path.join(__dirname, '..');

const SCRIPTS = [
  { file: '01_ddl_schema.sql',          label: 'DDL Schema' },
  { file: '02_seed_data.sql',           label: 'Seed Data' },
  { file: '03_triggers_procedures.sql', label: 'Triggers & Procedures' },
  { file: '04_views_queries.sql',       label: 'Views & Queries' },
];

const ok  = (m) => console.log('\x1b[32m✓\x1b[0m', m);
const log = (m) => console.log('\x1b[36m→\x1b[0m', m);
const warn = (m) => console.log('\x1b[33m⚠\x1b[0m', m);

/**
 * Splits a SQL file into individual statements, correctly handling:
 *  - $$ dollar-quoted blocks (plpgsql functions/procedures)
 *  - Standard ; terminated statements
 *  - -- line comments and  block comments
 */
function splitStatements(sql) {
  const statements = [];
  let current = '';
  let dollarTag = null; // inside $...$ or $$ block
  let i = 0;

  while (i < sql.length) {
    // Check for dollar-quoting start
    if (dollarTag === null) {
      const dollarMatch = sql.slice(i).match(/^(\$[a-zA-Z0-9_]*\$)/);
      if (dollarMatch) {
        dollarTag = dollarMatch[1];
        current += dollarTag;
        i += dollarTag.length;
        continue;
      }
    } else {
      // Check for dollar-quoting end
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

  // Catch any trailing statement without trailing semicolon
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

  log(`Running: ${label} (${scriptFile})`);
  const sql = fs.readFileSync(fullPath, { encoding: 'utf8' });
  const statements = splitStatements(sql);
  let ok_count = 0, skip_count = 0;

  for (const stmt of statements) {
    try {
      await client.query(stmt);
      ok_count++;
    } catch (e) {
      const msg = e.message || '';
      // Tolerate benign errors (already exists, DROP on non-existent, etc.)
      if (
        e.code === '42P07' || // duplicate_table
        e.code === '42710' || // duplicate_object
        e.code === '42P16' || // invalid_table_definition on add constraint that exists
        e.code === '23505' || // unique_violation (seed data dupe)
        msg.includes('already exists') ||
        msg.includes('does not exist') && stmt.toUpperCase().startsWith('DROP') ||
        msg.includes('multiple primary keys')
      ) {
        skip_count++;
      } else {
        warn(`  SKIP (${e.code}): ${msg.slice(0, 120)}`);
        skip_count++;
      }
    }
  }
  ok(`${label}: ${ok_count} statements OK, ${skip_count} skipped`);
}

async function main() {
  const client = new Client({
    host:     'localhost',
    port:     5432,
    user:     'postgres',
    password: 'postgres',
    database: 'digital_twin_wms',
  });

  log('Connecting to embedded PostgreSQL …');
  await client.connect();
  await client.query("SET client_encoding = 'UTF8'");
  ok('Connected!');

  for (const { file, label } of SCRIPTS) {
    await runScript(client, file, label);
  }

  await client.end();
  ok('Database setup complete ✓');
}

main().catch((e) => {
  console.error('\x1b[31mFATAL:\x1b[0m', e.message);
  process.exit(1);
});
