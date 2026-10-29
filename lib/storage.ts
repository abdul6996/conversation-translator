import { recoverSession, type Session } from './types';
let connection: Promise<IDBDatabase> | undefined;
function database() {
  connection ??= new Promise((resolve, reject) => {
    const req = indexedDB.open('conversation-translator', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('sessions', { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => { connection = undefined; reject(req.error); };
  });
  return connection;
}
export async function saveSession(session: Session) {
  const db = await database();
  return new Promise<void>((resolve,reject) => {
    const tx = db.transaction('sessions','readwrite');
    tx.objectStore('sessions').put(session);
    tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error);
  });
}
export async function listSessions(): Promise<Session[]> {
  const db = await database();
  return new Promise((resolve,reject) => {
    const request = db.transaction('sessions').objectStore('sessions').getAll();
    request.onsuccess = () => resolve((request.result as Session[]).map(recoverSession).sort((a,b) => b.updatedAt-a.updatedAt));
    request.onerror = () => reject(request.error);
  });
}
export async function deleteSession(id: string) {
  const db = await database();
  return new Promise<void>((resolve,reject) => {
    const tx = db.transaction('sessions','readwrite'); tx.objectStore('sessions').delete(id);
    tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error);
  });
}
