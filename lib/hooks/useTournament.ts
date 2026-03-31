"use client";

import { useTRPC } from "@/lib/trpc/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { CubeEvent } from "@/lib/cubing/events";

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

// Start competing in a tournament event.
export function useStartEvent() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation(
    trpc.tournament.start.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.tournament.getContestStatus.queryKey() });
        queryClient.invalidateQueries({ queryKey: trpc.tournament.getLeaderboardOverview.queryKey() });
        queryClient.invalidateQueries({ queryKey: trpc.tournament.getLeaderboard.queryKey() });
      },
    })
  );
}

// Submit a single solve for a tournament event.
export function useSubmitSolve() {
  const trpc = useTRPC();
  return useMutation(
    trpc.tournament.submitSolve.mutationOptions()
  );
}

// Fetches the leaderboard for a specific event in a contest.
export function useLeaderboard(
  tournamentNumber: number,
  eventId: CubeEvent,
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
