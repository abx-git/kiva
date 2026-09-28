#!/usr/bin/env node
/**
 * Write kiva/.env from process env when Cloud Agent or CI injects VITE_* vars.
 * Skips when .env already exists (local override).
 */
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const envPath = join(root, '.env');

if (existsSync(envPath)) {
  process.exit(0);
}

const url = process.env.VITE_SUPABASE_URL?.trim() ?? '';
const key = process.env.VITE_SUPABASE_ANON_KEY?.trim() ?? '';

if (!url || !key) {
  process.exit(0);
}

const body = `# Generated from environment variables (Cloud Agent / CI)\nVITE_SUPABASE_URL=${url}\nVITE_SUPABASE_ANON_KEY=${key}\n`;
writeFileSync(envPath, body, 'utf8');
