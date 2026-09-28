import type { KivaConfig } from '../config';
import {
  downloadInstructionBlob,
  fetchPublishedInstructions,
  fileNameFromStoragePath,
} from './instructions-remote';
import {
  getInstructionBlob,
  listLocalInstructions,
  mergeRemoteCatalog,
  saveInstructionBlob,
} from './instructions-local';
import type { InstructionListItem } from './instructions-types';

export type SyncResult =
  | { ok: true; items: InstructionListItem[] }
  | { ok: false; message: string; items: InstructionListItem[] };

export async function loadInstructionsView(config: KivaConfig): Promise<InstructionListItem[]> {
  const local = await listLocalInstructions();
  if (!navigator.onLine) {
    return local;
  }

  const remote = await fetchPublishedInstructions(config);
  if (!remote.ok) {
    return local;
  }

  await mergeRemoteCatalog(remote.rows);
  return listLocalInstructions();
}

export async function syncInstructionsFromRemote(config: KivaConfig): Promise<SyncResult> {
  const local = await listLocalInstructions();

  if (!navigator.onLine) {
    return { ok: false, message: 'No network connection.', items: local };
  }

  const remote = await fetchPublishedInstructions(config);
  if (!remote.ok) {
    return { ok: false, message: remote.message, items: local };
  }

  await mergeRemoteCatalog(remote.rows);
  const items = await listLocalInstructions();
  return { ok: true, items };
}

export async function cacheInstructionFile(
  config: KivaConfig,
  instructionId: string,
  storagePath: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const result = await downloadInstructionBlob(config, storagePath);
  if (!result.ok) return result;

  const fileName = fileNameFromStoragePath(storagePath);
  const contentType = result.blob.type || guessContentType(fileName);

  try {
    await saveInstructionBlob(instructionId, result.blob, fileName, contentType);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Local cache failed.';
    return { ok: false, message };
  }

  return { ok: true };
}

export async function openCachedInstruction(
  instructionId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const record = await getInstructionBlob(instructionId);
  if (!record) {
    return {
      ok: false,
      message: 'Download the instruction first, then tap Open file.',
    };
  }

  const url = URL.createObjectURL(record.blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = record.fileName;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);

  return { ok: true };
}

function guessContentType(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.zip')) return 'application/zip';
  if (lower.endsWith('.json')) return 'application/json';
  if (lower.endsWith('.md')) return 'text/markdown';
  if (lower.endsWith('.txt')) return 'text/plain';
  return 'application/octet-stream';
}
