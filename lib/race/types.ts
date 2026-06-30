import type { Penalty } from "@/app/generated/prisma/client";

// Presence metadata synced via Supabase Realtime
export interface RacePresence {
  userId: string;
  username: string;
  firstName: string;
  lastName: string;
  profilePictureUrl: string | null;
  status: "idle" | "inspecting" | "solving";
  currentScrambleIndex: number;
  solveCount: number;
  latestTimeMs: number | null;
  currentAo5: number | null;
  bestSingle: number | null;
  bestAo5: number | null;
}

// A single solve recorded during a race
export interface RaceSolve {
  scrambleIndex: number;
  timeMs: number;
  penalty: Penalty | null;
}

// Broadcast event types
export interface SolveCompletedEvent {
  type: "solve_completed";
  userId: string;
  scrambleIndex: number;
  timeMs: number;
  penalty: Penalty | null;
}

export interface VoteSkipEvent {
  type: "vote_skip";
  voterId: string;
  targetUserId: string;
  scrambleIndex: number;
}

export interface SkipAppliedEvent {
  type: "skip_applied";
  targetUserId: string;
  scrambleIndex: number;
}

export type RaceBroadcastEvent =
  | SolveCompletedEvent
  | VoteSkipEvent
  | SkipAppliedEvent;
