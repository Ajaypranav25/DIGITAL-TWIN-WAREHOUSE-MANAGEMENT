/**
 * sql-runner.js
 * Shared helpers used by dev-server.js and setup-db.js to load the numbered
 * SQL scripts from the repository root.
 */

const path = require('path');
const fs   = require('fs');

const REPO_ROOT = path.join(__dirname, '..');

const SCRIPTS = [
  { file: '01_ddl_schema.sql',          label: 'DDL Schema' },
  { file: '02_seed_data.sql',           label: 'Seed Data' },
  { file: '03_triggers_procedures.sql', label: 'Triggers & Procedures' },
  { file: '04_views_queries.sql',       label: 'Views & Queries' },
  { file: '05_access_lockdown.sql',     label: 'Access Lockdown' },
];

// Errors that are expected when a script is re-run against an existing DB
const BENIGN_CODES = new Set([
  '42P07', // duplicate_table
  '42710', // duplicate_object
]);

/**
 * Splits a SQL file into individual statements, correctly handling:
 *  - $$ / $tag$ dollar-quoted blocks (plpgsql functions/procedures)
 *  - 'single-quoted' strings (a ; or -- inside a string is not a delimiter)
 *  - "double-quoted" identifiers such as "Order"
 *  - -- line comments and block comments
 */
function splitStatements(sql) {
  const statements = [];
  let current = '';
  let i = 0;

  const push = () => {
    const trimmed = current.trim();
    if (trimmed && trimmed !== ';') statements.push(trimmed);
    current = '';
  };

  while (i < sql.length) {
    const ch = sql[i];
    const next = sql[i + 1];

    // Dollar-quoted block: copy verbatim up to the matching tag
    const dollarMatch = ch === '$' && sql.slice(i).match(/^\$[a-zA-Z0-9_]*\$/);
    if (dollarMatch) {
      const tag = dollarMatch[0];
      const end = sql.indexOf(tag, i + tag.length);
      const stop = end === -1 ? sql.length : end + tag.length;
      current += sql.slice(i, stop);
      i = stop;
      continue;
    }

    // Quoted string or identifier: copy verbatim, '' / "" are escaped quotes
    if (ch === "'" || ch === '"') {
      let j = i + 1;
      while (j < sql.length) {
        if (sql[j] === ch && sql[j + 1] === ch) { j += 2; continue; }
        if (sql[j] === ch) break;
        j++;
      }
      current += sql.slice(i, j + 1);
      i = j + 1;
      continue;
    }

    if (ch === '-' && next === '-') {
      while (i < sql.length && sql[i] !== '\n') i++;
      current += '\n';
      continue;
    }

    if (ch === '/' && next === '*') {
      const end = sql.indexOf('*/', i + 2);
      i = end === -1 ? sql.length : end + 2;
      current += ' ';
      continue;
    }

    current += ch;
    i++;
    if (ch === ';') push();
  }

  push();
  return statements;
}

/**
 * Runs one script statement by statement.
 * Returns the number of statements that failed for a non-benign reason.
 */
async function runScript(client, scriptFile, label, log) {
  const fullPath = path.join(REPO_ROOT, scriptFile);
  if (!fs.existsSync(fullPath)) {
    log.warn(`${label}: file not found — skipping`);
    return 0;
  }

  log.info(`Loading: ${label} (${scriptFile})`);
  const statements = splitStatements(fs.readFileSync(fullPath, 'utf8'));
  let okCount = 0, skipCount = 0, failCount = 0;

  for (const stmt of statements) {
    try {
      await client.query(stmt);
      okCount++;
    } catch (e) {
      if (BENIGN_CODES.has(e.code)) {
        skipCount++;
        continue;
      }
      failCount++;
      const preview = stmt.replace(/\s+/g, ' ').slice(0, 80);
      log.error(`  FAILED (${e.code}): ${e.message}\n    in: ${preview}…`);
    }
  }

  const summary = `  ${label}: ${okCount} OK, ${skipCount} already present, ${failCount} failed`;
  if (failCount > 0) log.warn(summary); else log.ok(summary);
  return failCount;
}

async function runAllScripts(client, log) {
  let failures = 0;
  for (const { file, label } of SCRIPTS) {
    failures += await runScript(client, file, label, log);
  }
  return failures;
}

module.exports = { SCRIPTS, splitStatements, runScript, runAllScripts };
