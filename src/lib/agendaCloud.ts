import { collection, deleteDoc, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { AgendaTask } from '../types';
import { cleanForFirestore, db } from './firebase';
import { normalizeAgendaTask } from './agenda';

export const AGENDA_COLLECTION = 'agendaTasks';

export function subscribeToAgendaTasks(
  onUpdate: (tasks: AgendaTask[]) => void,
  onError?: (err: unknown) => void
) {
  const col = collection(db, AGENDA_COLLECTION);
  return onSnapshot(
    col,
    (snapshot) => {
      const loaded = snapshot.docs
        .map((d) => normalizeAgendaTask({ ...(d.data() as AgendaTask), id: d.id }))
        .filter((row): row is AgendaTask => Boolean(row))
        .sort((a, b) => a.dateKey.localeCompare(b.dateKey) || a.createdAt.localeCompare(b.createdAt));
      onUpdate(loaded);
    },
    (err) => {
      console.error('[Firestore] agendaTasks:', err);
      if (onError) onError(err);
    }
  );
}

export async function saveAgendaTaskToCloud(task: AgendaTask): Promise<void> {
  const normalized = normalizeAgendaTask(task);
  if (!normalized) throw new Error('La tarea de agenda no se pudo guardar.');
  await setDoc(doc(db, AGENDA_COLLECTION, normalized.id), cleanForFirestore(normalized), { merge: true });
}

export async function deleteAgendaTaskFromCloud(taskId: string): Promise<void> {
  await deleteDoc(doc(db, AGENDA_COLLECTION, taskId));
}
