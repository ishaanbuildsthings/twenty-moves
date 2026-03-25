const DB_NAME = "cubing-timer";
const DB_VERSION = 1;
const STORE = "solves";

export type Penalty = "+2" | "dnf" | null;

export interface Solve {
  id: number;
  timeMs: number;
  scramble: string;
  date: number; // epoch ms
  penalty: Penalty;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function addSolve(timeMs: number, scramble: string, penalty: Penalty = null): Promise<Solve> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const solve = { timeMs, scramble, date: Date.now(), penalty };
    const req = store.add(solve);
    req.onsuccess = () => resolve({ ...solve, id: req.result as number });
    req.onerror = () => reject(req.error);
  });
}

export async function getAllSolves(): Promise<Solve[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve((req.result as Solve[]).reverse());
    req.onerror = () => reject(req.error);
  });
}

export async function clearSolves(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const req = tx.objectStore(STORE).clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}
