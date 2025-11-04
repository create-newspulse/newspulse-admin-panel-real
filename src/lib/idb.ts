// Simple IndexedDB wrapper for chat history using idb
import { openDB, IDBPDatabase } from 'idb';

const DB_NAME = 'kiranos-db';
const STORE = 'sessions';

async function getDB(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, 1, {
    upgrade(db: IDBPDatabase) {
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    },
  });
}

export async function saveSession(key: string, data: any) {
  const db = await getDB();
  await db.put(STORE, data, key);
}

export async function loadSession(key: string) {
  const db = await getDB();
  return db.get(STORE, key);
}

export async function deleteSession(key: string) {
  const db = await getDB();
  return db.delete(STORE, key);
}

export async function listKeys() {
  const db = await getDB();
  return db.getAllKeys(STORE);
}
