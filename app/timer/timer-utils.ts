import type { Solve } from "./db";

export function formatSolveTime(solve: Solve): string {
  if (solve.penaltyType === "dnf") return "DNF";
  if (solve.penaltyType === "plustwo") return formatTime(solve.timeMs + 2000) + "+";
  return formatTime(solve.timeMs);
}

export function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const centiseconds = Math.floor((ms % 1000) / 10);

  if (minutes > 0) {
    return `${minutes}:${String(seconds).padStart(2, "0")}.${String(centiseconds).padStart(2, "0")}`;
  }
  return `${seconds}.${String(centiseconds).padStart(2, "0")}`;
}
