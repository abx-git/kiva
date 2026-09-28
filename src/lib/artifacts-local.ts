import { createLocalDb } from './local-db';
import type { LocalArtifactRecord } from './artifacts-types';

const db = createLocalDb();
const STORE = 'artifacts';

export async function listArtifactsForInstruction(
  instructionId: string,
): Promise<LocalArtifactRecord[]> {
  const all = await db.getAll<LocalArtifactRecord>(STORE);
  return all
    .filter((a) => a.instructionId === instructionId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function listAllArtifacts(): Promise<LocalArtifactRecord[]> {
  const all = await db.getAll<LocalArtifactRecord>(STORE);
  return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getArtifact(id: string): Promise<LocalArtifactRecord | undefined> {
  return db.get<LocalArtifactRecord>(STORE, id);
}

export async function saveArtifact(record: LocalArtifactRecord): Promise<void> {
  await db.put(STORE, record);
}

export async function deleteArtifactRecord(id: string): Promise<void> {
  await db.delete(STORE, id);
}
