import type { CubeEvent } from "@/lib/cubing/events";
import { getEventMeta } from "@/lib/cubing/events";
import { recomputeStats, type EventStats } from "@/lib/cubing/stats";

const DB_NAME = "cubing-timer";
const DB_VERSION = 1;
const SOLVES_STORE = "solves"; // IDB table for individual solves
const STATS_STORE = "stats"; // IDB table for precomputed per-event averages

export type Penalty = "+2" | "dnf" | null;

export interface Solve {
  id: number;
  event: CubeEvent;
  timeMs: number;
  scramble: string;
  date: number; // epoch ms
  penalty: Penalty;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    // Only fires on first visit (database doesn't exist yet) or when
    // DB_VERSION is bumped. Existing data is preserved on upgrades —
    // this is where we define/modify the schema, not wipe anything.
    req.onupgradeneeded = () => {
      const db = req.result;
      const solvesStore = db.createObjectStore(SOLVES_STORE, {
        keyPath: "id",
        autoIncrement: true,
      });
      solvesStore.createIndex("by-event-date", ["event", "date"]);
      db.createObjectStore(STATS_STORE, { keyPath: "event" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// Fetch recent solves for an event, newest first.
// Uses the [event, date] index with a cursor for efficient access.
export async function getRecentSolves(
  event: CubeEvent,
  limit = 100
): Promise<Solve[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SOLVES_STORE, "readonly");
    const index = tx.objectStore(SOLVES_STORE).index("by-event-date");

    // Range: all entries where event matches, any date.
    const range = IDBKeyRange.bound([event, 0], [event, Infinity]);
    const results: Solve[] = [];

    // Open cursor in reverse (newest first).
    const cursorReq = index.openCursor(range, "prev");
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (cursor && results.length < limit) {
        const solve = cursor.value as Solve;
        results.push(solve);
        cursor.continue();
      } else {
        resolve(results);
      }
    };
    cursorReq.onerror = () => reject(cursorReq.error);
  });
}

// Fetch ALL solves for an event (needed for best-ever stats).
// Only used internally for stats recomputation.
async function getAllSolvesForEvent(
  tx: IDBTransaction,
  event: CubeEvent
): Promise<Solve[]> {
  return new Promise((resolve, reject) => {
    const index = tx.objectStore(SOLVES_STORE).index("by-event-date");
    const range = IDBKeyRange.bound([event, 0], [event, Infinity]);
    const results: Solve[] = [];

    const cursorReq = index.openCursor(range, "prev");
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (cursor) {
        const solve = cursor.value as Solve;
        if (!solve.event) solve.event = "333" as CubeEvent;
        if (solve.penalty === undefined) solve.penalty = null;
        results.push(solve);
        cursor.continue();
      } else {
        resolve(results);
      }
    };
    cursorReq.onerror = () => reject(cursorReq.error);
  });
}

// Recompute and write stats for an event within an existing transaction.
async function updateStatsInTx(
  tx: IDBTransaction,
  event: CubeEvent
): Promise<EventStats> {
  const solves = await getAllSolvesForEvent(tx, event);
  const meta = getEventMeta(event);
  const stats = recomputeStats(event, solves, meta.useMo3);
  const statsStore = tx.objectStore(STATS_STORE);
  statsStore.put(stats);
  return stats;
}

export async function addSolve(
  event: CubeEvent,
  timeMs: number,
  scramble: string,
  penalty: Penalty = null
): Promise<{ solve: Solve; stats: EventStats }> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([SOLVES_STORE, STATS_STORE], "readwrite");
    const store = tx.objectStore(SOLVES_STORE);
    const solve: Omit<Solve, "id"> = {
      event,
      timeMs,
      scramble,
      date: Date.now(),
      penalty,
    };
    const req = store.add(solve);

    req.onsuccess = async () => {
      try {
        const stats = await updateStatsInTx(tx, event);
        resolve({
          solve: { ...solve, id: req.result as number },
          stats,
        });
      } catch (err) {
        reject(err);
      }
    };
    req.onerror = () => reject(req.error);
  });
}

export async function updateSolve(
  id: number,
  updates: { penalty?: Penalty }
): Promise<{ solve: Solve; stats: EventStats }> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([SOLVES_STORE, STATS_STORE], "readwrite");
    const store = tx.objectStore(SOLVES_STORE);
    const getReq = store.get(id);

    getReq.onsuccess = async () => {
      const solve = getReq.result as Solve;
      if (!solve) {
        reject(new Error(`Solve ${id} not found`));
        return;
      }

      if (updates.penalty !== undefined) solve.penalty = updates.penalty;
      store.put(solve);

      try {
        const event = solve.event;
        const stats = await updateStatsInTx(tx, event);
        resolve({ solve, stats });
      } catch (err) {
        reject(err);
      }
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

export async function deleteSolve(
  id: number
): Promise<{ event: CubeEvent; stats: EventStats }> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([SOLVES_STORE, STATS_STORE], "readwrite");
    const store = tx.objectStore(SOLVES_STORE);
    const getReq = store.get(id);

    getReq.onsuccess = async () => {
      const solve = getReq.result as Solve;
      if (!solve) {
        reject(new Error(`Solve ${id} not found`));
        return;
      }

      const event = solve.event;
      store.delete(id);

      try {
        const stats = await updateStatsInTx(tx, event);
        resolve({ event, stats });
      } catch (err) {
        reject(err);
      }
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

export async function clearSolves(event: CubeEvent): Promise<EventStats> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([SOLVES_STORE, STATS_STORE], "readwrite");
    const index = tx.objectStore(SOLVES_STORE).index("by-event-date");
    const statsStore = tx.objectStore(STATS_STORE);

    // Delete all solves for this event using a cursor.
    const range = IDBKeyRange.bound([event, 0], [event, Infinity]);
    const cursorReq = index.openCursor(range);
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      } else {
        // All solves deleted, reset stats.
        const emptyStats: EventStats = {
          event,
          bestSingle: null,
          bestAo5: null,
          bestAo12: null,
          bestAo100: null,
          bestMo3: null,
          currentAo5: null,
          currentAo12: null,
          currentAo100: null,
          currentMo3: null,
        };
        statsStore.put(emptyStats);
        resolve(emptyStats);
      }
    };
    cursorReq.onerror = () => reject(cursorReq.error);
  });
}

export async function getStats(event: CubeEvent): Promise<EventStats> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STATS_STORE, "readonly");
    const req = tx.objectStore(STATS_STORE).get(event);
    req.onsuccess = () => {
      resolve(
        (req.result as EventStats) ?? {
          event,
          bestSingle: null,
          bestAo5: null,
          bestAo12: null,
          bestAo100: null,
          bestMo3: null,
          currentAo5: null,
          currentAo12: null,
          currentAo100: null,
          currentMo3: null,
        }
      );
    };
    req.onerror = () => reject(req.error);
  });
}
