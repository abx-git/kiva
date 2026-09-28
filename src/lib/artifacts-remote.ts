import type { KivaConfig } from '../config';
import { getSupabase } from './supabase';

export type ArtifactVisibility = 'private' | 'community';

export interface ServerArtifactRow {
  id: string;
  instructionId: string;
  ownerId: string;
  fileName: string;
  visibility: ArtifactVisibility;
  createdAt: string;
  storagePath: string | null;
}

export async function fetchServerArtifacts(
  config: KivaConfig,
): Promise<{ ok: true; rows: ServerArtifactRow[] } | { ok: false; message: string }> {
  const supabase = getSupabase(config);
  if (!supabase) {
    return { ok: false, message: 'Supabase is not configured.' };
  }

  const { data, error } = await supabase
    .from('artifacts')
    .select('id, instruction_id, owner_id, file_name, visibility, created_at, storage_path')
    .order('created_at', { ascending: false });

  if (error) {
    return { ok: false, message: error.message };
  }

  const rows: ServerArtifactRow[] = (data ?? []).map((row) => ({
    id: row.id as string,
    instructionId: row.instruction_id as string,
    ownerId: row.owner_id as string,
    fileName: row.file_name as string,
    visibility: row.visibility as ArtifactVisibility,
    createdAt: row.created_at as string,
    storagePath: (row.storage_path as string | null) ?? null,
  }));

  return { ok: true, rows };
}

export async function patchArtifactVisibility(
  config: KivaConfig,
  artifactId: string,
  visibility: ArtifactVisibility,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const supabase = getSupabase(config);
  if (!supabase) {
    return { ok: false, message: 'Supabase is not configured.' };
  }

  const { error } = await supabase
    .from('artifacts')
    .update({
      visibility,
      published_at: visibility === 'community' ? new Date().toISOString() : null,
    })
    .eq('id', artifactId);

  if (error) {
    return { ok: false, message: error.message };
  }
  return { ok: true };
}

export async function deleteServerArtifact(
  config: KivaConfig,
  storagePath: string | null,
  artifactId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const supabase = getSupabase(config);
  if (!supabase) {
    return { ok: false, message: 'Supabase is not configured.' };
  }

  if (storagePath) {
    const { error: storageError } = await supabase.storage.from('artifacts').remove([storagePath]);
    if (storageError) {
      return { ok: false, message: storageError.message };
    }
  }

  const { error } = await supabase.from('artifacts').delete().eq('id', artifactId);
  if (error) {
    return { ok: false, message: error.message };
  }
  return { ok: true };
}

export async function downloadServerArtifact(
  config: KivaConfig,
  storagePath: string,
): Promise<{ ok: true; blob: Blob } | { ok: false; message: string }> {
  const supabase = getSupabase(config);
  if (!supabase) {
    return { ok: false, message: 'Supabase is not configured.' };
  }

  const { data, error } = await supabase.storage.from('artifacts').download(storagePath);
  if (error || !data) {
    return { ok: false, message: error?.message ?? 'Download failed.' };
  }
  return { ok: true, blob: data };
}
