export interface InstructionRow {
  id: string;
  slug: string;
  title: string;
  version: string;
  description: string | null;
  storage_path: string;
  updated_at: string;
}

export interface CachedInstructionMeta {
  id: string;
  slug: string;
  title: string;
  version: string;
  description: string | null;
  storagePath: string;
  remoteUpdatedAt: string;
  fileName: string;
  cachedAt: string | null;
  sizeBytes: number | null;
  contentType: string | null;
}

export interface InstructionListItem extends CachedInstructionMeta {
  isCached: boolean;
  isStale: boolean;
}

export interface InstructionBlobRecord {
  id: string;
  blob: Blob;
  contentType: string;
  fileName: string;
}
