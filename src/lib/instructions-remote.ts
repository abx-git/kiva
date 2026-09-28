import type { KivaConfig } from '../config';
import { getSupabase } from './supabase';
import type { InstructionRow } from './instructions-types';

export const INSTRUCTIONS_BUCKET = 'instructions';

export async function fetchPublishedInstructions(
  config: KivaConfig,
): Promise<{ ok: true; rows: InstructionRow[] } | { ok: false; message: string }> {
  const supabase = getSupabase(config);
  if (!supabase) {
    return { ok: false, message: 'Supabase is not configured.' };
  }

  const { data, error } = await supabase
    .from('instructions')
    .select('id, slug, title, version, description, storage_path, updated_at')
    .eq('published', true)
    .order('title');

  if (error) {
    return { ok: false, message: mapPostgresSetupError(error.message) };
  }

  return { ok: true, rows: (data ?? []) as InstructionRow[] };
}

export async function downloadInstructionBlob(
  config: KivaConfig,
  storagePath: string,
): Promise<{ ok: true; blob: Blob } | { ok: false; message: string }> {
  const supabase = getSupabase(config);
  if (!supabase) {
    return { ok: false, message: 'Supabase is not configured.' };
  }

  const { data, error } = await supabase.storage.from(INSTRUCTIONS_BUCKET).download(storagePath);
  if (error || !data) {
    return { ok: false, message: error?.message ?? 'Download failed.' };
  }

  return { ok: true, blob: data };
}

function mapPostgresSetupError(message: string): string {
  if (
    /schema cache/i.test(message) ||
    /does not exist/i.test(message) ||
    /could not find the table/i.test(message)
  ) {
    return 'Database not set up yet. In Supabase: SQL Editor → run the script supabase/kiva/setup.sql (creates tables and storage).';
  }
  return message;
}

export function fileNameFromStoragePath(storagePath: string): string {
  const parts = storagePath.split('/');
  const last = parts[parts.length - 1];
  return last || 'instruction.bin';
}
