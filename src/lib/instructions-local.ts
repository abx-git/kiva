import { createLocalDb } from './local-db';
import type {
  CachedInstructionMeta,
  InstructionBlobRecord,
  InstructionListItem,
  InstructionRow,
} from './instructions-types';
import { fileNameFromStoragePath } from './instructions-remote';

const db = createLocalDb();

const META_STORE = 'instructions';
const BLOB_STORE = 'instruction_blobs';

function rowToMeta(row: InstructionRow, existing?: CachedInstructionMeta): CachedInstructionMeta {
  const fileName = fileNameFromStoragePath(row.storage_path);
  const remoteChanged =
    existing != null && existing.remoteUpdatedAt !== row.updated_at;
  const keepCache =
    existing != null && !remoteChanged && existing.cachedAt != null;

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    version: row.version,
    description: row.description,
    storagePath: row.storage_path,
    remoteUpdatedAt: row.updated_at,
    fileName,
    cachedAt: keepCache ? existing.cachedAt : null,
    sizeBytes: keepCache ? existing.sizeBytes : null,
    contentType: keepCache ? existing.contentType : null,
  };
}

export async function mergeRemoteCatalog(rows: InstructionRow[]): Promise<void> {
  for (const row of rows) {
    const existing = await db.get<CachedInstructionMeta>(META_STORE, row.id);
    const remoteChanged =
      existing != null && existing.remoteUpdatedAt !== row.updated_at;
    if (remoteChanged && existing?.cachedAt) {
      await db.delete(BLOB_STORE, row.id);
    }
    const meta = rowToMeta(row, existing);
    await db.put(META_STORE, meta);
  }
}

export async function saveInstructionBlob(
  instructionId: string,
  blob: Blob,
  fileName: string,
  contentType: string,
): Promise<void> {
  const meta = await db.get<CachedInstructionMeta>(META_STORE, instructionId);
  if (!meta) {
    throw new Error('Instruction not in local catalog.');
  }

  const record: InstructionBlobRecord = {
    id: instructionId,
    blob,
    contentType,
    fileName,
  };
  await db.put(BLOB_STORE, record);

  const updated: CachedInstructionMeta = {
    ...meta,
    cachedAt: new Date().toISOString(),
    sizeBytes: blob.size,
    contentType,
  };
  await db.put(META_STORE, updated);
}

export async function listLocalInstructions(): Promise<InstructionListItem[]> {
  const all = await db.getAll<CachedInstructionMeta>(META_STORE);
  return all
    .map((m) => ({
      ...m,
      isCached: m.cachedAt != null,
      isStale: false,
    }))
    .sort((a, b) => a.title.localeCompare(b.title, 'en'));
}

export async function getInstructionBlob(
  instructionId: string,
): Promise<InstructionBlobRecord | undefined> {
  return db.get<InstructionBlobRecord>(BLOB_STORE, instructionId);
}
