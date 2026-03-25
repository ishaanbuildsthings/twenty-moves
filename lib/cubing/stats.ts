import type { Penalty } from "@/app/(app)/db";

// DNF is represented as Infinity so it naturally sorts to the end.
const DNF = Infinity;

interface SolveForStats {
  timeMs: number;
  penalty: Penalty;
}

// Returns the effective solve time accounting for penalties.
// +2 adds 2000ms. DNF returns Infinity.
export function effectiveTime(solve: SolveForStats): number {
  if (solve.penalty === "dnf") return DNF;
  if (solve.penalty === "+2") return solve.timeMs + 2000;
  return solve.timeMs;
}

// Compute a trimmed average-of-N.
// Removes 1 best and 1 worst (for ao5/ao12), then averages the rest.
// If more than 1 solve is DNF, the whole average is DNF.
// Returns null if not enough solves.
function computeAo5or12(solves: SolveForStats[], n: 5 | 12): number | null {
  if (solves.length < n) return null;
  const recent = solves.slice(0, n);
  const times = recent.map(effectiveTime);

  const dnfCount = times.filter((t) => t === DNF).length;
  if (dnfCount > 1) return DNF;

  const sorted = [...times].sort((a, b) => a - b);
  // Remove best and worst
  const trimmed = sorted.slice(1, -1);
  const sum = trimmed.reduce((a, b) => a + b, 0);
  return Math.round(sum / trimmed.length);
}

// Compute average-of-100.
// Removes 5 best and 5 worst, averages middle 90.
// If more than 5 solves are DNF, the whole average is DNF.
// Returns null if not enough solves.
function computeAo100(solves: SolveForStats[]): number | null {
  if (solves.length < 100) return null;
  const recent = solves.slice(0, 100);
  const times = recent.map(effectiveTime);

  const dnfCount = times.filter((t) => t === DNF).length;
  if (dnfCount > 5) return DNF;

  const sorted = [...times].sort((a, b) => a - b);
  const trimmed = sorted.slice(5, -5);
  const sum = trimmed.reduce((a, b) => a + b, 0);
  return Math.round(sum / trimmed.length);
}

// Compute mean-of-3 (used for BLD events).
// Straight mean of 3 solves. Any DNF makes the whole mean DNF.
// Returns null if not enough solves.
function computeMo3(solves: SolveForStats[]): number | null {
  if (solves.length < 3) return null;
  const recent = solves.slice(0, 3);
  const times = recent.map(effectiveTime);

  if (times.some((t) => t === DNF)) return DNF;

  const sum = times.reduce((a, b) => a + b, 0);
  return Math.round(sum / 3);
}

// Find the best single from all solves (excluding DNF).
// Returns null if no valid solves.
function computeBestSingle(solves: SolveForStats[]): number | null {
  let best: number | null = null;
  for (const solve of solves) {
    const t = effectiveTime(solve);
    if (t !== DNF && (best === null || t < best)) {
      best = t;
    }
  }
  return best;
}

// Scan all solves to find the best ever ao5/ao12/ao100/mo3.
// Checks every possible window position, not just the current one.
function findBestAverage(
  solves: SolveForStats[],
  computeFn: (s: SolveForStats[]) => number | null
): number | null {
  let best: number | null = null;
  for (let i = 0; i < solves.length; i++) {
    const val = computeFn(solves.slice(i));
    if (val !== null && val !== DNF && (best === null || val < best)) {
      best = val;
    }
  }
  return best;
}

export interface EventStats {
  event: string;
  bestSingle: number | null;
  bestAo5: number | null;
  bestAo12: number | null;
  bestAo100: number | null;
  bestMo3: number | null;
  currentAo5: number | null;
  currentAo12: number | null;
  currentAo100: number | null;
  currentMo3: number | null;
}

// Recompute all stats from an array of solves (newest first).
// Pass useMo3=true for BLD events.
export function recomputeStats(
  event: string,
  solves: SolveForStats[],
  useMo3: boolean
): EventStats {
  const bestSingle = computeBestSingle(solves);

  if (useMo3) {
    const currentMo3 = computeMo3(solves);
    const bestMo3 = findBestAverage(solves, (s) => computeMo3(s));
    return {
      event,
      bestSingle,
      bestAo5: null,
      bestAo12: null,
      bestAo100: null,
      bestMo3,
      currentAo5: null,
      currentAo12: null,
      currentAo100: null,
      currentMo3,
    };
  }

  const currentAo5 = computeAo5or12(solves, 5);
  const currentAo12 = computeAo5or12(solves, 12);
  const currentAo100 = computeAo100(solves);

  const bestAo5 = findBestAverage(solves, (s) => computeAo5or12(s, 5));
  const bestAo12 = findBestAverage(solves, (s) => computeAo5or12(s, 12));
  const bestAo100 = findBestAverage(solves, (s) => computeAo100(s));

  return {
    event,
    bestSingle,
    bestAo5,
    bestAo12,
    bestAo100,
    bestMo3: null,
    currentAo5,
    currentAo12,
    currentAo100,
    currentMo3: null,
  };
}
