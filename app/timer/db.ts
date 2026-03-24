const DB_NAME = "cubing-timer";
const DB_VERSION = 1;
const STORE = "solves";

import type { PenaltyType } from "./types";
export type { PenaltyType };

export interface Solve {
  id: number;
  timeMs: number;
  scramble: string;
  date: number; // epoch ms
  penaltyType: PenaltyType;
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

export async function addSolve(timeMs: number, scramble: string): Promise<Solve> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const solve = { timeMs, scramble, date: Date.now(), penaltyType: null as PenaltyType };
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

export async function updateSolvePenalty(id: number, penaltyType: PenaltyType): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const solve = getReq.result as Solve;
      const putReq = store.put({ ...solve, penaltyType });
      putReq.onsuccess = () => resolve();
      putReq.onerror = () => reject(putReq.error);
    };
    getReq.onerror = () => reject(getReq.error);
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
