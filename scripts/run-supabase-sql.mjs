#!/usr/bin/env node
/**
 * Apply supabase/kiva/setup.sql using a Postgres connection string.
 * Requires env SUPABASE_DB_URL (never commit; use Cloud Agent / local shell secrets).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';

const url = process.env.SUPABASE_DB_URL?.trim();
if (!url) {
  console.error(
    'Missing SUPABASE_DB_URL.\n' +
      'Supabase Dashboard → Project Settings → Database → Connection string → URI\n' +
      '(use the password for the database user; prefer "Direct connection" for DDL).',
  );
  process.exit(1);
}

const sqlPath = join(import.meta.dirname, '..', 'supabase', 'kiva', 'setup.sql');
const sql = readFileSync(sqlPath, 'utf8');

const client = new pg.Client({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();
  await client.query(sql);
  console.log(`Applied ${sqlPath}`);
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
} finally {
  await client.end();
}
