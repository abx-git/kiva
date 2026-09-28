export type ArtifactSyncStatus = 'local' | 'uploading' | 'published' | 'error';

export interface LocalArtifactRecord {
  id: string;
  instructionId: string;
  fileName: string;
  sha256: string;
  createdAt: string;
  syncStatus: ArtifactSyncStatus;
  visibility: 'private' | 'community';
  remoteId: string | null;
  errorMessage: string | null;
  sizeBytes: number;
}
