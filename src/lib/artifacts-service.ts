import type { KivaConfig } from '../config';
import { deleteArtifactBlob, getArtifactBlob, putArtifactBlob } from './artifacts-blobs';
import { deleteArtifactRecord, getArtifact, listAllArtifacts, saveArtifact } from './artifacts-local';
import {
  deleteServerArtifact,
  downloadServerArtifact,
  fetchServerArtifacts,
  patchArtifactVisibility,
  type ServerArtifactRow,
} from './artifacts-remote';
import type { LocalArtifactRecord } from './artifacts-types';
import { getSupabase } from './supabase';

export const ARTIFACTS_BUCKET = 'artifacts';

export type { ServerArtifactRow };

export async function registerArtifactFromFile(
  instructionId: string,
  file: File,
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
    visibility: 'private',
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
): Promise<{ ok: true } | { ok: false; message: string }> {
  const supabase = getSupabase(config);
  if (!supabase) {
    return { ok: false, message: 'Supabase is not configured.' };
  }

  const meta = await getArtifact(artifactId);
  if (!meta) {
    return { ok: false, message: 'Draft not found.' };
  }

  const blob = await getArtifactBlob(artifactId);
  if (!blob) {
    return { ok: false, message: 'Local file is missing.' };
  }

  const storagePath = `${ownerId}/${artifactId}/${meta.fileName}`;
  const { error: uploadError } = await supabase.storage
    .from(ARTIFACTS_BUCKET)
    .upload(storagePath, blob, { upsert: true, contentType: blob.type || undefined });

  if (uploadError) {
    return { ok: false, message: mapStorageSetupError(uploadError.message) };
  }

  const { error: insertError } = await supabase.from('artifacts').insert({
    id: artifactId,
    instruction_id: meta.instructionId,
    owner_id: ownerId,
    file_name: meta.fileName,
    sha256: meta.sha256,
    storage_path: storagePath,
    visibility: meta.visibility,
    published_at: meta.visibility === 'community' ? new Date().toISOString() : null,
  });

  if (insertError) {
    return { ok: false, message: insertError.message };
  }

  await deleteArtifactBlob(artifactId);
  await deleteArtifactRecord(artifactId);
  return { ok: true };
}

export async function listLocalDrafts(): Promise<LocalArtifactRecord[]> {
  const all = await listAllArtifacts();
  return all.filter((a) => a.syncStatus === 'local' || a.syncStatus === 'error');
}

export async function deleteLocalDraft(artifactId: string): Promise<void> {
  await deleteArtifactBlob(artifactId);
  await deleteArtifactRecord(artifactId);
}

export async function loadServerArtifacts(
  config: KivaConfig,
): Promise<{ ok: true; rows: ServerArtifactRow[] } | { ok: false; message: string }> {
  return fetchServerArtifacts(config);
}

export async function setServerArtifactVisibility(
  config: KivaConfig,
  artifactId: string,
  visibility: 'private' | 'community',
): Promise<{ ok: true } | { ok: false; message: string }> {
  return patchArtifactVisibility(config, artifactId, visibility);
}

export async function removeServerArtifact(
  config: KivaConfig,
  row: ServerArtifactRow,
): Promise<{ ok: true } | { ok: false; message: string }> {
  return deleteServerArtifact(config, row.storagePath, row.id);
}

export async function downloadServerArtifactFile(
  config: KivaConfig,
  row: ServerArtifactRow,
): Promise<{ ok: true; fileName: string } | { ok: false; message: string }> {
  if (!row.storagePath) {
    return { ok: false, message: 'No file on server.' };
  }
  const result = await downloadServerArtifact(config, row.storagePath);
  if (!result.ok) return result;
  triggerBrowserDownload(result.blob, row.fileName);
  return { ok: true, fileName: row.fileName };
}

function triggerBrowserDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function mapStorageSetupError(message: string): string {
  if (/bucket not found/i.test(message)) {
    return (
      'Storage bucket "artifacts" is missing. Run supabase/kiva/setup.sql in Supabase.'
    );
  }
  return message;
}

async function hashFileSha256(file: Blob): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
