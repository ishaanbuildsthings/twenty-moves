// Tournament day rollover: midnight PST = 8 AM UTC.
// The tournament date equals the PST calendar date.
export const ROLLOVER_HOUR_UTC = 8;

/**
 * Returns the Date object for the next rollover (when the current
 * tournament day ends and the next one begins).
 */
/**
 * Returns today's tournament PST date as a "YYYY-MM-DD" string.
 * Before 8 AM UTC (midnight PST), it's still "yesterday" in PST.
 * At or after 8 AM UTC, it's "today" in PST.
 * Pure UTC arithmetic — no timezone libraries needed.
 */
export function getCurrentTournamentDatePST(now: Date = new Date()): string {
  const d = new Date(now);
  if (d.getUTCHours() < ROLLOVER_HOUR_UTC) {
    // Before 8 AM UTC = still yesterday in PST
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return d.toISOString().split("T")[0];
}

/**
 * Returns the start of the current Mon–Sun PST week as a UTC Date.
 * PST midnight = ROLLOVER_HOUR_UTC (8 AM UTC); we anchor to the current PST
 * calendar date at PST-midnight, then walk back to the most recent Monday.
 * Use as a lower bound: `createdAt >= getCurrentWeekStartUTC()`.
 */
export function getCurrentWeekStartUTC(now: Date = new Date()): Date {
  const datePST = getCurrentTournamentDatePST(now); // "YYYY-MM-DD" in PST
  const hh = String(ROLLOVER_HOUR_UTC).padStart(2, "0");
  // PST midnight of that date, expressed in UTC.
  const d = new Date(`${datePST}T${hh}:00:00.000Z`);
  // getUTCDay reflects the PST weekday here (0=Sun … 6=Sat).
  const daysBackToMonday = d.getUTCDay() === 0 ? 6 : d.getUTCDay() - 1;
  d.setUTCDate(d.getUTCDate() - daysBackToMonday);
  return d;
}

export function getNextRollover(now: Date = new Date()): Date {
  const next = new Date(now);
  next.setUTCMinutes(0, 0, 0);

  if (now.getUTCHours() >= ROLLOVER_HOUR_UTC) {
    // Rollover is tomorrow at 8 AM UTC.
    next.setUTCDate(next.getUTCDate() + 1);
  }

  next.setUTCHours(ROLLOVER_HOUR_UTC);
  return next;
}
