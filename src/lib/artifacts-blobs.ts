import { openKivaDb } from './local-db';

const BLOB_STORE = 'artifact_blobs';

export interface ArtifactBlobRecord {
  id: string;
  blob: Blob;
}

export async function putArtifactBlob(id: string, blob: Blob): Promise<void> {
  const db = await openKivaDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(BLOB_STORE, 'readwrite');
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
    tx.objectStore(BLOB_STORE).put({ id, blob });
  });
}

export async function getArtifactBlob(id: string): Promise<Blob | undefined> {
  const db = await openKivaDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BLOB_STORE, 'readonly');
    tx.onerror = () => reject(tx.error);
    const req = tx.objectStore(BLOB_STORE).get(id);
    req.onsuccess = () => {
      db.close();
      const row = req.result as ArtifactBlobRecord | undefined;
      resolve(row?.blob);
    };
    req.onerror = () => reject(req.error);
  });
}
