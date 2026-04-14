// Shared formatting utilities for cubing times.
// Used by practice timer, tournament pages, leaderboards, etc.

import { DNF_SENTINEL, effectiveTime, type SolveForStats } from "@/lib/cubing/stats";

// Format milliseconds to a human-readable time string.
// Examples: 9230 → "9.23", 62100 → "1:02.10", DNF_SENTINEL → "DNF"
export function formatTime(ms: number): string {
  if (ms >= DNF_SENTINEL) return "DNF";
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const centiseconds = Math.floor((ms % 1000) / 10);

  if (minutes > 0) {
    return `${minutes}:${String(seconds).padStart(2, "0")}.${String(centiseconds).padStart(2, "0")}`;
  }
  return `${seconds}.${String(centiseconds).padStart(2, "0")}`;
}

// Format a solve's time accounting for penalties.
// plus_two: adds 2s and appends "+", dnf: returns "DNF"
export function formatSolveTime(solve: { timeMs: number; penalty: string | null }): string {
  if (solve.penalty === "dnf") return "DNF";
  const time = formatTime(
    solve.penalty === "plus_two" ? solve.timeMs + 2000 : solve.timeMs
  );
  return solve.penalty === "plus_two" ? `${time}+` : time;
}

// Format a Date as a relative time string (e.g. "2h ago", "3d ago").
export function timeAgo(date: Date): string {
  const now = Date.now();
  const diff = now - new Date(date).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo`;
  return new Date(date).toLocaleDateString();
}

export const ONE_DAY = 1;
export const ONE_WEEK_IN_DAYS = 7;

// Returns the epoch timestamp for N days ago.
export function daysAgo(n: number): number {
  return Date.now() - n * 24 * 60 * 60 * 1000;
}

// Find the indices of the best and worst solves in an average.
// Used to determine which times get parenthesized in display.
export function getBestAndWorst(solves: SolveForStats[]): { bestIdx: number; worstIdx: number } {
  if (solves.length < 2) return { bestIdx: -1, worstIdx: -1 };
  const times = solves.map((s) => effectiveTime(s));
  let bestIdx = 0, worstIdx = 0;
  times.forEach((t, i) => {
    if (t < times[bestIdx]) bestIdx = i;
    // Use >= for worst so ties pick the last occurrence,
    // ensuring bestIdx and worstIdx are different when possible.
    if (t >= times[worstIdx] && i !== bestIdx) worstIdx = i;
  });
  // If all times are identical, just pick indices 0 and 4.
  if (bestIdx === worstIdx && times.length > 1) {
    worstIdx = times.length - 1;
    if (worstIdx === bestIdx) bestIdx = 0;
  }
  return { bestIdx, worstIdx };
}
