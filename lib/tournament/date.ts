// Tournament day rollover: 2 AM Eastern Time = 7 AM UTC.
// Everything before 7 AM UTC belongs to the previous tournament day.
const ROLLOVER_HOUR_UTC = 7;

// Grace window: users who started before rollover get this long to finish.
const GRACE_WINDOW_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Returns the current tournament date as a "YYYY-MM-DD" string.
 * The tournament day rolls over at 2 AM ET (7 AM UTC), so
 * 6:59 AM UTC on March 27 → tournament date is "2026-03-26".
 * 7:00 AM UTC on March 27 → tournament date is "2026-03-27".
 */
export function getTournamentDate(now: Date = new Date()): string {
  const adjusted = new Date(now);

  // If we're before the rollover hour, this is still yesterday's tournament.
  if (adjusted.getUTCHours() < ROLLOVER_HOUR_UTC) {
    adjusted.setUTCDate(adjusted.getUTCDate() - 1);
  }

  return adjusted.toISOString().slice(0, 10);
}

/**
 * Returns the Date object for the next rollover (when the current
 * tournament day ends and the next one begins).
 */
export function getNextRollover(now: Date = new Date()): Date {
  const next = new Date(now);
  next.setUTCMinutes(0, 0, 0);

  if (now.getUTCHours() >= ROLLOVER_HOUR_UTC) {
    // Rollover is tomorrow at 7 AM UTC.
    next.setUTCDate(next.getUTCDate() + 1);
  }

  next.setUTCHours(ROLLOVER_HOUR_UTC);
  return next;
}

/**
 * Checks if a tournament entry that started at `startedAt` is still
 * within the grace window for the given tournament date.
 */
export function isWithinGraceWindow(
  startedAt: Date,
  tournamentDate: string,
  now: Date = new Date()
): boolean {
  const currentDate = getTournamentDate(now);

  // Still the same tournament day — always valid.
  if (currentDate === tournamentDate) return true;

  // The day has rolled over. Check if we're within the grace window.
  const rollover = getNextRollover(startedAt);
  const msSinceRollover = now.getTime() - rollover.getTime();
  return msSinceRollover <= GRACE_WINDOW_MS;
}
