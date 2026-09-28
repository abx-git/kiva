import type { KivaConfig } from '../config';
import { INSTRUCTIONS_BUCKET } from './instructions-remote';
import { getSupabase } from './supabase';

export interface InstructionAdminRow {
  id: string;
  slug: string;
  title: string;
  version: string;
  description: string | null;
  storagePath: string;
  published: boolean;
  updatedAt: string;
}

export interface InstructionFormInput {
  slug: string;
  title: string;
  version: string;
  description: string;
  published: boolean;
  storagePath: string;
  file: File | null;
}

export async function listAllInstructionsForAdmin(
  config: KivaConfig,
): Promise<{ ok: true; rows: InstructionAdminRow[] } | { ok: false; message: string }> {
  const supabase = getSupabase(config);
  if (!supabase) return { ok: false, message: 'Supabase is not configured.' };

  const { data, error } = await supabase
    .from('instructions')
    .select('id, slug, title, version, description, storage_path, published, updated_at')
    .order('title');

  if (error) return { ok: false, message: error.message };

  const rows: InstructionAdminRow[] = (data ?? []).map((row) => ({
    id: row.id as string,
    slug: row.slug as string,
    title: row.title as string,
    version: row.version as string,
    description: (row.description as string | null) ?? null,
    storagePath: row.storage_path as string,
    published: Boolean(row.published),
    updatedAt: row.updated_at as string,
  }));

  return { ok: true, rows };
}

export async function createInstructionAsAdmin(
  config: KivaConfig,
  input: InstructionFormInput,
  userId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!input.file) return { ok: false, message: 'Choose a file for the new instruction.' };

  const upload = await uploadInstructionFile(config, input.storagePath, input.file);
  if (!upload.ok) return upload;

  const supabase = getSupabase(config);
  if (!supabase) return { ok: false, message: 'Supabase is not configured.' };

  const { error } = await supabase.from('instructions').insert({
    slug: input.slug.trim(),
    title: input.title.trim(),
    version: input.version.trim() || '1.0.0',
    description: input.description.trim() || null,
    storage_path: input.storagePath,
    published: input.published,
    created_by: userId,
  });

  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function updateInstructionAsAdmin(
  config: KivaConfig,
  instructionId: string,
  input: InstructionFormInput,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const supabase = getSupabase(config);
  if (!supabase) return { ok: false, message: 'Supabase is not configured.' };

  if (input.file) {
    const upload = await uploadInstructionFile(config, input.storagePath, input.file);
    if (!upload.ok) return upload;
  }

  const { error } = await supabase
    .from('instructions')
    .update({
      slug: input.slug.trim(),
      title: input.title.trim(),
      version: input.version.trim() || '1.0.0',
      description: input.description.trim() || null,
      storage_path: input.storagePath,
      published: input.published,
      updated_at: new Date().toISOString(),
    })
    .eq('id', instructionId);

  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function deleteInstructionAsAdmin(
  config: KivaConfig,
  row: InstructionAdminRow,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const supabase = getSupabase(config);
  if (!supabase) return { ok: false, message: 'Supabase is not configured.' };

  const { error } = await supabase.from('instructions').delete().eq('id', row.id);
  if (error) return { ok: false, message: error.message };

  if (row.storagePath) {
    await supabase.storage.from(INSTRUCTIONS_BUCKET).remove([row.storagePath]);
  }

  return { ok: true };
}

export function defaultStoragePath(slug: string, fileName: string): string {
  const safeSlug = slug.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '');
  const base = safeSlug || 'instruction';
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]+/g, '_');
  return `${base}/${safeName}`;
}

async function uploadInstructionFile(
  config: KivaConfig,
  storagePath: string,
  file: File,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const supabase = getSupabase(config);
  if (!supabase) return { ok: false, message: 'Supabase is not configured.' };

  const { error } = await supabase.storage
    .from(INSTRUCTIONS_BUCKET)
    .upload(storagePath, file, { upsert: true, contentType: file.type || undefined });

  if (error) return { ok: false, message: error.message };
  return { ok: true };
}
