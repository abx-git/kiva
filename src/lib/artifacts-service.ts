import type { KivaConfig } from '../config';
import { getSupabase } from './supabase';
import { getArtifactBlob, putArtifactBlob } from './artifacts-blobs';
import type { LocalArtifactRecord } from './artifacts-types';
import { getArtifact, listAllArtifacts, saveArtifact } from './artifacts-local';

export const ARTIFACTS_BUCKET = 'artifacts';

export async function registerArtifactFromFile(
  instructionId: string,
  file: File,
  visibility: 'private' | 'community',
): Promise<LocalArtifactRecord> {
  const id = crypto.randomUUID();
  const sha256 = await hashFileSha256(file);
  await putArtifactBlob(id, file);

  const record: LocalArtifactRecord = {
    id,
    instructionId,
    fileName: file.name,
    sha256,
    createdAt: new Date().toISOString(),
    syncStatus: 'local',
    visibility,
    remoteId: null,
    errorMessage: null,
    sizeBytes: file.size,
  };
  await saveArtifact(record);
  return record;
}

export async function uploadArtifact(
  config: KivaConfig,
  artifactId: string,
  ownerId: string,
): Promise<{ ok: true; record: LocalArtifactRecord } | { ok: false; message: string }> {
  const supabase = getSupabase(config);
  if (!supabase) {
    return { ok: false, message: 'Supabase is not configured.' };
  }

  const meta = await getArtifact(artifactId);
  if (!meta) {
    return { ok: false, message: 'Artifact not found.' };
  }

  const blob = await getArtifactBlob(artifactId);
  if (!blob) {
    return { ok: false, message: 'Local file is missing.' };
  }

  const uploading: LocalArtifactRecord = { ...meta, syncStatus: 'uploading', errorMessage: null };
  await saveArtifact(uploading);

  const storagePath = `${ownerId}/${artifactId}/${meta.fileName}`;
  const { error: uploadError } = await supabase.storage
    .from(ARTIFACTS_BUCKET)
    .upload(storagePath, blob, { upsert: true, contentType: blob.type || undefined });

  if (uploadError) {
    const failed: LocalArtifactRecord = {
      ...uploading,
      syncStatus: 'error',
      errorMessage: uploadError.message,
    };
    await saveArtifact(failed);
    return { ok: false, message: uploadError.message };
  }

  const { data: row, error: insertError } = await supabase
    .from('artifacts')
    .insert({
      id: artifactId,
      instruction_id: meta.instructionId,
      owner_id: ownerId,
      file_name: meta.fileName,
      sha256: meta.sha256,
      storage_path: storagePath,
      visibility: meta.visibility,
      published_at: meta.visibility === 'community' ? new Date().toISOString() : null,
    })
    .select('id')
    .single();

  if (insertError) {
    const failed: LocalArtifactRecord = {
      ...uploading,
      syncStatus: 'error',
      errorMessage: insertError.message,
    };
    await saveArtifact(failed);
    return { ok: false, message: insertError.message };
  }

  const published: LocalArtifactRecord = {
    ...meta,
    syncStatus: 'published',
    remoteId: row?.id ?? artifactId,
    errorMessage: null,
  };
  await saveArtifact(published);
  return { ok: true, record: published };
}

export async function refreshArtifactList(): Promise<LocalArtifactRecord[]> {
  return listAllArtifacts();
}

async function hashFileSha256(file: Blob): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
