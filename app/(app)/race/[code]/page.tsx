"use client";

import { useState, useCallback, useMemo, use } from "react";
import { useRouter } from "next/navigation";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useViewer } from "@/lib/hooks/useViewer";
import { useTimer } from "@/lib/hooks/useTimer";
import { useSettings } from "@/lib/context/settings";
import { useRaceChannel } from "@/lib/race/use-race-channel";
import { useRaceState } from "@/lib/race/use-race-state";
import { ParticipantPanel } from "@/lib/components/race/participant-panel";
import { CubeLoader } from "@/lib/components/cube-loader";
import { formatTime, formatSolveTime } from "@/lib/cubing/format";
import { EVENT_MAP, type CubeEvent } from "@/lib/cubing/events";
import type { RaceBroadcastEvent, RacePresence } from "@/lib/race/types";
import type { Penalty } from "@/app/generated/prisma/client";
import { ArrowLeft, Send } from "lucide-react";
import { PostFromRaceModal } from "./post-modal";

export default function RaceRoomPage({
  params: paramsPromise,
}: {
  params: Promise<{ code: string }>;
}) {
  const params = use(paramsPromise);
  const code = params.code.toUpperCase();
  const router = useRouter();
  const trpc = useTRPC();
  const { viewer } = useViewer();
  const { timerSettings, accent } = useSettings();

  const [postModalOpen, setPostModalOpen] = useState(false);
  const [awaitingPenalty, setAwaitingPenalty] = useState(false);
  const [pendingTime, setPendingTime] = useState<number | null>(null);

  // Fetch room data
  const roomQuery = useQuery(trpc.race.getRoom.queryOptions({ code }));
  const room = roomQuery.data;

  const leaveMutation = useMutation(trpc.race.leaveRoom.mutationOptions());

  // Race state (solves, stats, scrambles)
  const raceState = useRaceState({
    eventName: room?.eventName ?? "333",
    scrambles: room?.scrambles ?? [],
    userId: viewer.id,
    broadcast: (event: RaceBroadcastEvent) => broadcast(event),
    updatePresence: (data: Partial<RacePresence>) => updatePresence(data),
  });

  // Handle broadcast events
  const onBroadcast = useCallback(
    (event: RaceBroadcastEvent) => {
      const activeCount = peers.size;
      raceState.handleBroadcast(event, activeCount);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [raceState.handleBroadcast]
  );

  // Supabase Realtime channel
  const { peers, updatePresence, broadcast } = useRaceChannel({
    code,
    userId: viewer.id,
    initialPresence: {
      username: viewer.username,
      firstName: viewer.firstName,
      lastName: viewer.lastName,
      profilePictureUrl: viewer.profilePictureUrl,
      status: "idle" as const,
      currentScrambleIndex: 0,
      solveCount: 0,
      latestTimeMs: null,
      currentAo5: null,
      bestSingle: null,
      bestAo5: null,
    },
    onBroadcast,
  });

  // Timer integration
  const timer = useTimer({
    holdDelayMs: timerSettings.holdDelayMs,
    useInspection: timerSettings.useInspection,
    inspectionDurationMs: timerSettings.inspectionDurationMs,
    showTimerWhileRunning: timerSettings.showTimerWhileRunning,
    enabled: !postModalOpen && !awaitingPenalty && !!room,
    onSolveComplete: (timeMs: number) => {
      setPendingTime(timeMs);
      setAwaitingPenalty(true);
    },
  });

  // Update presence when timer state changes
  const timerStatus = timer.state === "running" ? "solving" : timer.isInspecting ? "inspecting" : "idle";
  useMemo(() => {
    if (room) {
      updatePresence({ status: timerStatus as RacePresence["status"] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timerStatus]);

  const handleConfirmPenalty = useCallback(
    (penalty: Penalty | null) => {
      if (pendingTime === null) return;
      raceState.recordSolve(pendingTime, penalty);
      setPendingTime(null);
      setAwaitingPenalty(false);
      timer.reset();
    },
    [pendingTime, raceState, timer]
  );

  const handleLeave = useCallback(async () => {
    await leaveMutation.mutateAsync({
      code,
      results: raceState.solves.map((s) => ({
        scrambleIndex: s.scrambleIndex,
        timeMs: s.timeMs,
        penalty: s.penalty,
      })),
    });
    router.push("/race");
  }, [code, leaveMutation, raceState.solves, router]);

  if (roomQuery.isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <CubeLoader />
      </div>
    );
  }

  if (!room) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-muted-foreground">Room not found</p>
      </div>
    );
  }

  const eventConfig = EVENT_MAP[room.eventName as CubeEvent];
  const eventName = eventConfig?.name ?? room.eventName;

  return (
    <div className="flex flex-1 flex-col lg:flex-row">
      {/* Main timer area */}
      <div className="flex flex-1 flex-col min-h-0">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-3">
            <button
              onClick={handleLeave}
              className="p-1.5 rounded hover:bg-muted transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm">{code}</span>
                <span className="text-muted-foreground text-xs">|</span>
                <span className="text-sm font-semibold">{eventName}</span>
              </div>
              <span className="text-xs text-muted-foreground">
                Scramble #{raceState.currentScrambleIndex + 1}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPostModalOpen(true)}
              disabled={raceState.solves.length === 0}
              className={`flex items-center gap-1.5 text-xs font-bold py-1.5 px-3 rounded transition-colors disabled:opacity-30 ${accent.bg} text-white ${accent.hover} ${accent.shadow}`}
            >
              <Send className="w-3 h-3" />
              Post
            </button>
          </div>
        </div>

        {/* Timer area */}
        <div className="flex flex-col flex-1 items-center justify-center gap-6 px-4">
          {/* Scramble */}
          {!awaitingPenalty && raceState.currentScramble && (
            <p className="font-mono text-center text-lg max-w-xl min-h-[1.75rem]">
              {raceState.currentScramble}
            </p>
          )}

          {/* Timer display */}
          {!awaitingPenalty && (
            <p
              className={`font-mono tabular-nums transition-colors ${
                timer.state === "holding"
                  ? "text-red-500"
                  : timer.state === "ready"
                    ? "text-green-500"
                    : timer.isInspecting
                      ? "text-yellow-500"
                      : ""
              }`}
              style={{ fontSize: "clamp(3rem, 15vw, 8rem)" }}
            >
              {timer.isInspecting
                ? Math.max(
                    0,
                    Math.ceil(
                      (timer.inspectionDurationMs - timer.inspectionTime) / 1000
                    )
                  )
                : timer.state === "running" && !timer.showTimerWhileRunning
                  ? "Solve!"
                  : formatTime(timer.elapsed)}
            </p>
          )}

          {/* Penalty selector */}
          {awaitingPenalty && pendingTime !== null && (
            <div className="flex flex-col items-center gap-6">
              <p
                className="font-mono tabular-nums"
                style={{ fontSize: "clamp(2rem, 10vw, 5rem)" }}
              >
                {formatTime(pendingTime)}
              </p>
              <p className="text-muted-foreground text-sm">Confirm your result</p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleConfirmPenalty(null)}
                  className={`px-8 py-3 rounded-xl ${accent.bg} ${accent.hover} text-white font-bold text-lg transition-colors ${accent.shadow}`}
                >
                  OK
                </button>
                <button
                  onClick={() => handleConfirmPenalty("plus_two")}
                  className="px-6 py-3 rounded-xl bg-muted hover:bg-muted/80 text-foreground font-bold text-lg transition-colors shadow-[0_3px_0_0_#1a1a1a]"
                >
                  +2
                </button>
                <button
                  onClick={() => handleConfirmPenalty("dnf")}
                  className="px-6 py-3 rounded-xl bg-muted hover:bg-muted/80 text-foreground font-bold text-lg transition-colors shadow-[0_3px_0_0_#1a1a1a]"
                >
                  DNF
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Bottom: recent solves */}
        {raceState.solves.length > 0 && (
          <div className="px-4 py-3 border-t border-border">
            <div className="flex items-center gap-4 justify-center font-mono tabular-nums text-sm flex-wrap">
              {raceState.solves.slice(-12).map((s, i) => (
                <span key={i} className="text-muted-foreground">
                  {formatSolveTime({
                    timeMs: s.timeMs,
                    penalty: s.penalty,
                  })}
                </span>
              ))}
            </div>
            {raceState.stats && (
              <div className="flex items-center gap-4 justify-center text-xs text-muted-foreground mt-1.5">
                {raceState.stats.bestSingle !== null && (
                  <span>
                    Best: <span className="font-mono">{formatTime(raceState.stats.bestSingle)}</span>
                  </span>
                )}
                {raceState.stats.currentAo5 !== null && (
                  <span>
                    Ao5: <span className="font-mono">{formatTime(raceState.stats.currentAo5)}</span>
                  </span>
                )}
                {raceState.stats.currentAo12 !== null && (
                  <span>
                    Ao12: <span className="font-mono">{formatTime(raceState.stats.currentAo12)}</span>
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Participant panel (right side on desktop, bottom on mobile) */}
      <div className="w-full lg:w-72 xl:w-80 border-t lg:border-t-0 lg:border-l border-border p-4 overflow-y-auto">
        <ParticipantPanel
          peers={peers}
          hostId={room.hostId}
          viewerId={viewer.id}
          onVoteSkip={raceState.voteToSkip}
        />
      </div>

      {/* Post modal */}
      {postModalOpen && room && (
        <PostFromRaceModal
          open={postModalOpen}
          onOpenChange={setPostModalOpen}
          eventName={room.eventName}
          scrambleSetId={room.scrambleSetId}
          solves={raceState.solves}
          stats={raceState.stats}
          scrambles={room.scrambles}
        />
      )}
    </div>
  );
}
