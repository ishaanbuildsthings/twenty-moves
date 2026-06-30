"use client";

import { useCallback, useRef, useState } from "react";
import type { Penalty } from "@/app/generated/prisma/client";
import type { RaceSolve, RacePresence, RaceBroadcastEvent } from "./types";
import {
  recomputeStats,
  type SolveForStats,
  type EventStats,
} from "@/lib/cubing/stats";
import { CubeEvent, getEnabledStats } from "@/lib/cubing/events";

export interface UseRaceStateOptions {
  eventName: string;
  scrambles: string[];
  userId: string;
  broadcast: (event: RaceBroadcastEvent) => void;
  updatePresence: (data: Partial<RacePresence>) => Promise<void>;
}

export function useRaceState({
  eventName,
  scrambles,
  userId,
  broadcast,
  updatePresence,
}: UseRaceStateOptions) {
  const [currentScrambleIndex, setCurrentScrambleIndex] = useState(0);
  const [solves, setSolves] = useState<RaceSolve[]>([]);
  const [stats, setStats] = useState<EventStats | null>(null);
  // Track skip votes: targetUserId -> Set of voterIds
  const [skipVotes, setSkipVotes] = useState<Map<string, Set<string>>>(new Map());

  const solvesRef = useRef(solves);
  solvesRef.current = solves;

  const recordSolve = useCallback(
    (timeMs: number, penalty: Penalty | null = null) => {
      const solve: RaceSolve = {
        scrambleIndex: currentScrambleIndex,
        timeMs,
        penalty,
      };

      const nextSolves = [...solvesRef.current, solve];
      setSolves(nextSolves);

      // Recompute stats (newest first for the stat functions)
      const solvesForStats: SolveForStats[] = nextSolves
        .slice()
        .reverse()
        .map((s) => ({
          timeMs: s.timeMs,
          penalty: s.penalty,
        }));

      const enabledStats = getEnabledStats(eventName as CubeEvent);
      const newStats = recomputeStats(eventName, solvesForStats, enabledStats);
      setStats(newStats);

      // Broadcast solve
      broadcast({
        type: "solve_completed",
        userId,
        scrambleIndex: currentScrambleIndex,
        timeMs,
        penalty,
      });

      // Update presence
      const nextIndex = currentScrambleIndex + 1;
      updatePresence({
        status: "idle",
        currentScrambleIndex: nextIndex,
        solveCount: nextSolves.length,
        latestTimeMs: timeMs,
        currentAo5: newStats.currentAo5,
        bestSingle: newStats.bestSingle,
        bestAo5: newStats.bestAo5,
      });

      setCurrentScrambleIndex(nextIndex);

      return { solve, stats: newStats };
    },
    [currentScrambleIndex, eventName, userId, broadcast, updatePresence]
  );

  const updateStatus = useCallback(
    (status: RacePresence["status"]) => {
      updatePresence({ status });
    },
    [updatePresence]
  );

  const voteToSkip = useCallback(
    (targetUserId: string) => {
      broadcast({
        type: "vote_skip",
        voterId: userId,
        targetUserId,
        scrambleIndex: currentScrambleIndex,
      });
    },
    [userId, currentScrambleIndex, broadcast]
  );

  const handleBroadcast = useCallback(
    (event: RaceBroadcastEvent, activeCount: number) => {
      if (event.type === "vote_skip") {
        setSkipVotes((prev) => {
          const next = new Map(prev);
          const key = `${event.targetUserId}:${event.scrambleIndex}`;
          const voters = new Set(next.get(key) ?? []);
          voters.add(event.voterId);
          next.set(key, voters);

          // Check threshold
          const threshold = Math.ceil(activeCount / 2);
          if (voters.size >= threshold) {
            // Broadcast skip applied
            broadcast({
              type: "skip_applied",
              targetUserId: event.targetUserId,
              scrambleIndex: event.scrambleIndex,
            });
          }

          return next;
        });
      }

      if (event.type === "skip_applied" && event.targetUserId === userId) {
        // We got skipped — record DNF and advance
        const dnfSolve: RaceSolve = {
          scrambleIndex: event.scrambleIndex,
          timeMs: 999_999_999,
          penalty: "dnf",
        };
        setSolves((prev) => [...prev, dnfSolve]);
        setCurrentScrambleIndex((prev) => Math.max(prev, event.scrambleIndex + 1));
      }
    },
    [userId, broadcast]
  );

  const currentScramble =
    currentScrambleIndex < scrambles.length
      ? scrambles[currentScrambleIndex]
      : null;

  return {
    currentScrambleIndex,
    currentScramble,
    solves,
    stats,
    skipVotes,
    recordSolve,
    updateStatus,
    voteToSkip,
    handleBroadcast,
  };
}
