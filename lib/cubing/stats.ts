// General-purpose cubing stat computation functions.
// Used by practice (IDB), tournaments, races, etc.
// No IDB or practice-specific logic belongs here.

// DNF is represented as Infinity so it naturally sorts to the end.
const DNF = Infinity;

export interface SolveForStats {
  timeMs: number;
  penalty: "plus_two" | "dnf" | null;
}

// Returns the effective solve time accounting for penalties.
// plus_two adds 2000ms. DNF returns Infinity.
export function effectiveTime(solve: SolveForStats): number {
  if (solve.penalty === "dnf") return DNF;
  if (solve.penalty === "plus_two") return solve.timeMs + 2000;
  return solve.timeMs;
}

// Compute average-of-5.
// Removes 1 best and 1 worst, averages middle 3.
// If more than 1 solve is DNF, the whole average is DNF.
// Returns null if not enough solves.
export function computeAo5(solves: SolveForStats[]): number | null {
  if (solves.length < 5) return null;
  const times = solves.slice(0, 5).map(effectiveTime);

  const dnfCount = times.filter((t) => t === DNF).length;
  if (dnfCount > 1) return DNF;

  const sorted = [...times].sort((a, b) => a - b);
  const trimmed = sorted.slice(1, -1);
  const sum = trimmed.reduce((a, b) => a + b, 0);
  return Math.round(sum / trimmed.length);
}

// Compute average-of-12.
// Removes 1 best and 1 worst, averages middle 10.
// If more than 1 solve is DNF, the whole average is DNF.
// Returns null if not enough solves.
export function computeAo12(solves: SolveForStats[]): number | null {
  if (solves.length < 12) return null;
  const times = solves.slice(0, 12).map(effectiveTime);

  const dnfCount = times.filter((t) => t === DNF).length;
  if (dnfCount > 1) return DNF;

  const sorted = [...times].sort((a, b) => a - b);
  const trimmed = sorted.slice(1, -1);
  const sum = trimmed.reduce((a, b) => a + b, 0);
  return Math.round(sum / trimmed.length);
}

// Compute average-of-100.
// Removes 5 best and 5 worst, averages middle 90.
// If more than 5 solves are DNF, the whole average is DNF.
// Returns null if not enough solves.
export function computeAo100(solves: SolveForStats[]): number | null {
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
export function computeMo3(solves: SolveForStats[]): number | null {
  if (solves.length < 3) return null;
  const recent = solves.slice(0, 3);
  const times = recent.map(effectiveTime);

  if (times.some((t) => t === DNF)) return DNF;

  const sum = times.reduce((a, b) => a + b, 0);
  return Math.round(sum / 3);
}

// Find the best single from all solves.
// Returns null if no solves, DNF if all solves are DNF.
export function computeBestSingle(solves: SolveForStats[]): number | null {
  if (solves.length === 0) return null;
  let best: number = DNF;
  for (const solve of solves) {
    const t = effectiveTime(solve);
    if (t < best) {
      best = t;
    }
  }
  return best;
}

// Scan all solves to find the best ever average using the given compute function.
// Checks every possible window position, not just the current one.
// Returns null if not enough solves, DNF if all windows are DNF.
export function findBestAverage(
  solves: SolveForStats[],
  computeFn: (s: SolveForStats[]) => number | null
): number | null {
  let best: number | null = null;
  for (let i = 0; i < solves.length; i++) {
    const val = computeFn(solves.slice(i));
    if (val === null) continue;
    if (best === null || val < best) {
      best = val;
    }
  }
  return best;
}
