import { getApp } from 'firebase/app';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  setDoc
} from 'firebase/firestore';
import { deleteObject, getDownloadURL, getStorage, ref, uploadBytes } from 'firebase/storage';
import { CredicelDashAttachment, CredicelDashDoc } from '../types';
import { cleanForFirestore, db } from './firebase';
import {
  dashDocForCloud,
  deleteDashFile,
  fileToDataUrl,
  MAX_INLINE_BLOB_BYTES,
  normalizeDashDoc,
  putDashFile
} from './credicelDashboard';

export const CREDICEL_DASH_COLLECTION = 'credicelDashboardDocs';
export const CREDICEL_DASH_BLOBS = 'credicelDashboardBlobs';

function storageOrNull() {
  try {
    return getStorage(getApp());
  } catch {
    return null;
  }
}

export function subscribeToCredicelDashDocs(
  onUpdate: (docs: CredicelDashDoc[]) => void,
  onError?: (err: unknown) => void
) {
  const col = collection(db, CREDICEL_DASH_COLLECTION);
  return onSnapshot(
    col,
    (snapshot) => {
      const loaded = snapshot.docs
        .map((d) => normalizeDashDoc({ ...(d.data() as CredicelDashDoc), id: d.id }))
        .filter((row): row is CredicelDashDoc => Boolean(row));
      loaded.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
      onUpdate(loaded);
    },
    (err) => {
      console.error('[Firestore] CREDICEL Dashboard:', err);
      if (onError) onError(err);
    }
  );
}

export async function saveCredicelDashDocToCloud(docRow: CredicelDashDoc): Promise<void> {
  const payload = dashDocForCloud(docRow);
  await setDoc(doc(db, CREDICEL_DASH_COLLECTION, payload.id), cleanForFirestore(payload), { merge: true });
}

export async function deleteCredicelDashDocFromCloud(docId: string, attachments: CredicelDashAttachment[] = []) {
  await deleteDoc(doc(db, CREDICEL_DASH_COLLECTION, docId));
  await Promise.all(
    attachments.map(async (att) => {
      await deleteDashFile(att.id);
      try {
        await deleteDoc(doc(db, CREDICEL_DASH_BLOBS, att.id));
      } catch {
        // ignore
      }
      if (att.storagePath) {
        try {
          const storage = storageOrNull();
          if (storage) await deleteObject(ref(storage, att.storagePath));
        } catch {
          // ignore
        }
      }
    })
  );
}

export async function persistDashAttachmentFile(
  att: CredicelDashAttachment,
  file: Blob
): Promise<CredicelDashAttachment> {
  await putDashFile(att.id, file);
  const next: CredicelDashAttachment = { ...att, hasLocal: true };

  const storage = storageOrNull();
  if (storage) {
    try {
      const path = `credicel-dashboard/${att.id}/${att.fileName || 'archivo'}`;
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, file, { contentType: att.mimeType });
      next.storagePath = path;
      next.downloadUrl = await getDownloadURL(storageRef);
      return next;
    } catch (err) {
      console.warn('[Storage] CREDICEL Dashboard, se guarda en este equipo / nube ligera:', err);
    }
  }

  if (file.size <= MAX_INLINE_BLOB_BYTES) {
    try {
      const dataUrl = await fileToDataUrl(file);
      await setDoc(
        doc(db, CREDICEL_DASH_BLOBS, att.id),
        cleanForFirestore({
          id: att.id,
          mimeType: att.mimeType,
          fileName: att.fileName,
          dataUrl,
          updatedAt: new Date().toISOString()
        })
      );
      next.hasCloudBlob = true;
    } catch (err) {
      console.warn('[Firestore] No se pudo copiar el archivo a la nube:', err);
    }
  }

  return next;
}

export async function fetchDashBlobDataUrl(attId: string): Promise<string | null> {
  try {
    const snap = await getDoc(doc(db, CREDICEL_DASH_BLOBS, attId));
    const dataUrl = snap.data()?.dataUrl;
    return typeof dataUrl === 'string' && dataUrl.startsWith('data:') ? dataUrl : null;
  } catch {
    return null;
  }
}
