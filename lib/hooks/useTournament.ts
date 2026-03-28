"use client";

import { useTRPC } from "@/lib/trpc/client";
import { useQuery } from "@tanstack/react-query";

// Fetches the viewer's status across all events for a contest.
// If no contest number is provided, fetches the current contest.
export function useContestStatus(contestNumber?: number) {
  const trpc = useTRPC();
  return useQuery(
    trpc.tournament.getContestStatus.queryOptions({
      number: contestNumber,
    })
  );
}

// Fetches the leaderboard overview (top 3 + viewer) for all events.
// If no tournament number is provided, fetches the current tournament.
export function useLeaderboardOverview(tournamentNumber?: number) {
  const trpc = useTRPC();
  return useQuery(
    trpc.tournament.getLeaderboardOverview.queryOptions({
      tournamentNumber,
    })
  );
}

// Fetches the leaderboard for a specific event in a contest.
export function useLeaderboard(
  tournamentNumber: number,
  eventId: string,
  page: number = 1,
  pageSize: number = 25
) {
  const trpc = useTRPC();
  return useQuery(
    trpc.tournament.getLeaderboard.queryOptions({
      tournamentNumber,
      eventId,
      page,
      pageSize,
    })
  );
}
