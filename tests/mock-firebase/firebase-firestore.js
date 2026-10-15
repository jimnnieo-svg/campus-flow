import { store, listeners, publish, Timestamp } from './state.js';
let nextId = 1;
export { Timestamp };
const now = () => new Timestamp(Math.floor(Date.now() / 1000), 0);
export function serverTimestamp() { return now(); }
export function getFirestore() { return { store }; }
export function collection(db, root, uid, name) {
  if (root !== 'users' || name !== 'todos') throw new Error('Unexpected mock collection');
  return { uid };
}
export function doc(parent, id = `mock-new-${nextId++}`) { return { uid: parent.uid, id }; }
function docs(uid) {
  return [...(store.get(uid) || new Map())].map(([id, data]) => ({ id, data: () => data }));
}
export function onSnapshot(ref, options, onNext) {
  const uid = ref.uid;
  const notify = () => onNext({ docs: docs(uid), metadata: { hasPendingWrites: false, fromCache: false } });
  const list = listeners.get(uid) || new Set(); list.add(notify); listeners.set(uid, list);
  queueMicrotask(notify);
  return () => list.delete(notify);
}
export async function runTransaction(db, callback) {
  const writes = [];
  const transaction = {
    get: async ref => {
      const data = store.get(ref.uid)?.get(ref.id);
      return { exists: () => Boolean(data), data: () => data };
    },
    set: (ref, data) => writes.push(['set', ref, data]),
    update: (ref, data) => writes.push(['update', ref, data]),
    delete: ref => writes.push(['delete', ref])
  };
  const result = await callback(transaction);
  if (writes.some(([, , data]) => data?.title === 'MOCK_FAIL')) {
    throw Object.assign(new Error('Simulated network failure'), { code: 'unavailable' });
  }
  const changed = new Set();
  for (const [action, ref, data] of writes) {
    if (!store.has(ref.uid)) store.set(ref.uid, new Map());
    const items = store.get(ref.uid);
    if (action === 'delete') items.delete(ref.id);
    else items.set(ref.id, action === 'update' ? { ...items.get(ref.id), ...data } : data);
    changed.add(ref.uid);
  }
  for (const uid of changed) publish(uid);
  return result;
}
