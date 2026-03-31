"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { CubeEvent, EVENT_CONFIGS, EVENT_MAP } from "@/lib/cubing/events";
import { EventIcon } from "@/lib/components/event-icon";
import { UserAvatar } from "@/lib/components/user-avatar";
import { ChevronDown, ChevronLeft, ChevronRight, Play, ArrowLeft } from "lucide-react";
import { CubeLoader } from "@/lib/components/cube-loader";
import { countryCodeToFlag } from "@/lib/countries";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getNextRollover } from "@/lib/tournament/date";
import { useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { useContestStatus, useLeaderboard, useLeaderboardOverview, useStartEvent, useSubmitSolve } from "@/lib/hooks/useTournament";
import { useTimer } from "@/lib/hooks/useTimer";
import { useSettings } from "@/lib/context/settings";
import { Settings } from "lucide-react";
import { TimerSettingsDialog } from "@/lib/components/timer-settings-dialog";
import { computeAo5, computeMo3, computeBestSingle, effectiveTime, DNF_SENTINEL, type SolveForStats } from "@/lib/cubing/stats";
import { formatTime, formatSolveTime, getBestAndWorst } from "@/lib/cubing/format";

type Tab = "compete" | "leaderboard";
const RESULTS_PER_PAGE = 25;

// --- Helpers ---

function formatCountdown(ms: number): string {
  if (ms <= 0) return "00:00:00";
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}


function formatAo5Times(solves: SolveForStats[]): string {
  if (solves.length !== 5) return solves.map(formatSolveTime).join("  ");
  const { bestIdx, worstIdx } = getBestAndWorst(solves);
  return solves
    .map((s, i) => {
      const formatted = formatSolveTime(s);
      return (i === bestIdx || i === worstIdx) ? `(${formatted})` : formatted;
    })
    .join("  ");
}

const rankDisplay = (rank: number) => {
  if (rank === 1) return <span className="text-xl" suppressHydrationWarning>🥇</span>;
  if (rank === 2) return <span className="text-xl" suppressHydrationWarning>🥈</span>;
  if (rank === 3) return <span className="text-xl" suppressHydrationWarning>🥉</span>;
  return <span className="text-sm font-bold text-muted-foreground">{rank}</span>;
};

// Get the tournament format label for an event (shown on cards/badges).
function getFormatLabel(config: typeof EVENT_CONFIGS[number]): string {
  if (config.tournamentRankBy === "single") {
    return `Bo${config.tournamentSolveCount}`;
  }
  return config.tournamentSolveCount === 5 ? "Ao5" : "Mo3";
}

// Get the stat column label for the leaderboard table.
function getStatColumnLabel(config: typeof EVENT_CONFIGS[number]): string {
  return config.tournamentSolveCount === 5 ? "Ao5" : "Mo3";
}

// Compute display values (single, average/mean) from solves based on event config.
// Uses the shared compute functions so display is always correct.
function computeDisplayStats(solves: SolveForStats[], config: typeof EVENT_CONFIGS[number]) {
  const single = computeBestSingle(solves);
  const singleStr = single === null ? "—" : formatTime(single);

  let avg: number | null = null;
  if (config.tournamentSolveCount === 5) {
    avg = computeAo5(solves);
  } else if (config.tournamentSolveCount === 3) {
    avg = computeMo3(solves);
  }
  const avgStr = avg === null ? "—" : formatTime(avg);

  // The ranking result — what determines your position on the leaderboard.
  // For BLD events ranked by single, this is the best single.
  // For everything else, this is the average/mean.
  const rankingResult = config.tournamentRankBy === "single" ? singleStr : avgStr;

  return { singleStr, avgStr, rankingResult };
}

// --- Tournament Solve View ---
// Full-screen timer UI for competing in a tournament event.

function TournamentSolveView({
  eventConfig,
  entryId,
  scrambles,
  initialSolves,
  tournamentNumber,
  onComplete,
  onExit,
}: {
  eventConfig: typeof EVENT_CONFIGS[number];
  entryId: string;
  scrambles: string[];
  initialSolves: SolveForStats[];
  tournamentNumber: number;
  onComplete: () => void;
  onExit: () => void;
}) {
  const { timerSettings, updateTimerSettings, accent } = useSettings();
  const submitSolve = useSubmitSolve();
  const [solves, setSolves] = useState<SolveForStats[]>(initialSolves);
  const [pendingTime, setPendingTime] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const currentIndex = solves.length;
  const expectedSolves = eventConfig.tournamentSolveCount;
  const isFinished = currentIndex >= expectedSolves;
  const currentScramble = scrambles[currentIndex] ?? "";
  const awaitingPenalty = pendingTime !== null;

  const timer = useTimer({
    holdDelayMs: timerSettings.holdDelayMs,
    useInspection: timerSettings.useInspection,
    inspectionDurationMs: timerSettings.inspectionDurationMs,
    showTimerWhileRunning: timerSettings.showTimerWhileRunning,
    enabled: !awaitingPenalty && !isFinished && !settingsOpen,
    onSolveComplete: (timeMs: number) => {
      setPendingTime(timeMs);
    },
  });

  const handleConfirmPenalty = async (penalty: "plus_two" | "dnf" | null) => {
    if (pendingTime === null) return;
    setSubmitting(true);
    setError(null);

    try {
      const result = await submitSolve.mutateAsync({
        entryId,
        scrambleSetIndex: currentIndex,
        timeMs: pendingTime,
        penalty,
      });

      // If that was the last solve, complete immediately
      // before updating local state (avoids flash of finished UI).
      if (result.totalSolves >= expectedSolves) {
        onComplete();
        return;
      }

      // Server confirmed — update local state from response.
      setSolves(result.solves);
      setPendingTime(null);
      timer.reset();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to submit solve");
    } finally {
      setSubmitting(false);
    }
  };

  // Compute current display stats from submitted solves.
  const displayStats = solves.length > 0 ? computeDisplayStats(solves, eventConfig) : null;

  return (
    <div className="flex flex-col flex-1 overflow-hidden select-none">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        <div className="flex items-center gap-3">
          <button
            onClick={onExit}
            className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground"
            title="Back to compete"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <EventIcon event={eventConfig} size={28} />
          <span className="font-extrabold text-lg">{eventConfig.name}</span>
          <span className="text-sm text-muted-foreground font-semibold">
            {getFormatLabel(eventConfig)}
          </span>
          <span className="text-sm text-muted-foreground">
            Solve {Math.min(currentIndex + 1, expectedSolves)}/{expectedSolves}
          </span>
        </div>
        <button
          onClick={() => setSettingsOpen(true)}
          className="flex items-center gap-1.5 text-xs font-bold py-1.5 px-3 rounded bg-neutral-600 text-foreground hover:bg-neutral-500 transition-colors shadow-[0_3px_0_0_#1a1a1a]"
          title="Timer settings"
        >
          <Settings className="w-3.5 h-3.5" />
          Timer
        </button>
      </div>

      {/* Timer area */}
      <div className="flex flex-col flex-1 items-center justify-center gap-6 px-4">
        {/* Scramble */}
        {!awaitingPenalty && !isFinished && (
          <p className="font-mono text-center text-lg max-w-xl min-h-[1.75rem]">
            {currentScramble}
          </p>
        )}

        {/* Timer display */}
        {!awaitingPenalty && !isFinished && (
          <p
            className={`font-mono tabular-nums transition-colors ${
              timer.state === "holding" ? "text-red-500" :
              timer.state === "ready" ? "text-green-500" :
              timer.state === "inspecting" ? "text-yellow-500" : ""
            }`}
            style={{ fontSize: "clamp(3rem, 15vw, 8rem)" }}
          >
            {timer.isInspecting
              ? Math.max(0, Math.ceil((timer.inspectionDurationMs - timer.inspectionTime) / 1000))
              : timer.state === "running" && !timer.showTimerWhileRunning
                ? "Solve!"
                : formatTime(timer.elapsed)}
          </p>
        )}

        {/* Penalty selector — shown after timer stops */}
        {awaitingPenalty && (
          <div className="flex flex-col items-center gap-6">
            <p className="font-mono tabular-nums" style={{ fontSize: "clamp(2rem, 10vw, 5rem)" }}>
              {formatTime(pendingTime!)}
            </p>
            <p className="text-muted-foreground text-sm">Confirm your result</p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => handleConfirmPenalty(null)}
                disabled={submitting}
                className={`px-8 py-3 rounded-xl ${accent.bg} ${accent.hover} text-white font-bold text-lg transition-colors disabled:opacity-50 ${accent.shadow}`}
              >
                OK
              </button>
              <button
                onClick={() => handleConfirmPenalty("plus_two")}
                disabled={submitting}
                className="px-6 py-3 rounded-xl bg-muted hover:bg-muted/80 text-foreground font-bold text-lg transition-colors disabled:opacity-50 shadow-[0_3px_0_0_#1a1a1a]"
              >
                +2
              </button>
              <button
                onClick={() => handleConfirmPenalty("dnf")}
                disabled={submitting}
                className="px-6 py-3 rounded-xl bg-muted hover:bg-muted/80 text-foreground font-bold text-lg transition-colors disabled:opacity-50 shadow-[0_3px_0_0_#1a1a1a]"
              >
                DNF
              </button>
            </div>
            {submitting && <p className="text-sm text-muted-foreground">Saving...</p>}
            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>
        )}

        {/* Finished — show result */}
        {isFinished && (
          <div className="flex flex-col items-center gap-4">
            <p className="text-2xl font-extrabold">Complete!</p>
            {displayStats && (
              <p className="font-mono tabular-nums font-extrabold text-4xl">
                {displayStats.rankingResult}
              </p>
            )}
            <p className="text-muted-foreground text-sm">Redirecting to leaderboard...</p>
          </div>
        )}
      </div>

      {/* Bottom: completed solves */}
      {solves.length > 0 && (
        <div className="px-4 py-3 border-t border-border">
          <div className="flex items-center gap-4 justify-center font-mono tabular-nums text-sm">
            {solves.map((s, i) => (
              <span key={i} className="text-muted-foreground">
                {formatSolveTime(s)}
              </span>
            ))}
            {Array(expectedSolves - solves.length).fill(null).map((_, i) => (
              <span key={`p-${i}`} className="text-muted-foreground/30">–.––</span>
            ))}
          </div>
        </div>
      )}

      {/* Timer settings dialog */}
      <TimerSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        description="Configure your timer for this session."
      />
    </div>
  );
}


// --- Main Page ---

export default function TourneyPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const trpc = useTRPC();
  const { accent } = useSettings();

  // Read state from URL params.
  const tab: Tab = searchParams.get("tab") === "leaderboard" ? "leaderboard" : "compete";
  const contestParam = Number(searchParams.get("contest")) || undefined;
  const selectedLeaderboardEvent = (searchParams.get("event") as CubeEvent) || null;
  const validEvent = selectedLeaderboardEvent && EVENT_MAP[selectedLeaderboardEvent]
    ? selectedLeaderboardEvent
    : null;
  const page = Math.max(1, Number(searchParams.get("page")) || 1);

  // Always fetch the latest contest number (React Query deduplicates
  // if contestParam is undefined — both queries hit the same key).
  const latestContestQuery = useContestStatus(undefined);
  const latestNumber = latestContestQuery.data?.tournament?.number;

  // Fetch the contest we're actually viewing.
  const contestStatusQuery = useContestStatus(contestParam);

  const activeContestData = contestStatusQuery.data;
  const activeContestLoading = contestStatusQuery.isLoading || latestContestQuery.isLoading;
  const viewingContest = activeContestData?.tournament?.number;

  const [countdown, setCountdown] = useState("");

  // Tournament compete state — when set, shows the solve view instead of the main page.
  const [solvingEvent, setSolvingEvent] = useState<{
    eventId: CubeEvent;
    entryId: string;
    scrambles: string[];
    solves: SolveForStats[];
  } | null>(null);

  const startEvent = useStartEvent();

  const handleStartEvent = async (eventId: CubeEvent) => {
    if (!viewingContest) return;
    try {
      const result = await startEvent.mutateAsync({
        tournamentNumber: viewingContest,
        eventId,
      });
      setSolvingEvent({
        eventId,
        entryId: result.entryId,
        scrambles: result.scrambles,
        solves: result.solves.map((s) => ({ timeMs: s.timeMs, penalty: s.penalty })),
      });
    } catch (e) {
      console.error("Failed to start event:", e);
    }
  };

  const isCurrent = viewingContest === latestNumber;

  // Format the PST date string directly — no Date object needed.
  const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const contestDateStr = (() => {
    const raw = activeContestData?.tournament?.datePST;
    if (!raw) return "";
    const dateStr = typeof raw === "string" ? raw : new Date(raw).toISOString().split("T")[0];
    const [y, m, d] = dateStr.split("-");
    return `${MONTH_NAMES[parseInt(m, 10) - 1]} ${parseInt(d, 10)}, ${y} PST`;
  })();

  // Update URL params without full navigation.
  const updateParams = useCallback((updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value === null) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }
    router.replace(`/tourney?${params.toString()}`, { scroll: false });
  }, [searchParams, router]);

  const setTab = (t: Tab) => {
    if (t === "compete") {
      updateParams({ tab: null, event: null });
    } else {
      updateParams({ tab: "leaderboard" });
    }
  };

  const setSelectedEvent = (event: CubeEvent | null) => {
    updateParams({ event: event, page: null });
  };

  const setPage = (p: number) => {
    updateParams({ page: p === 1 ? null : String(p) });
  };

  const navigateContest = (direction: "prev" | "next") => {
    if (!viewingContest) return;
    const next = viewingContest + (direction === "prev" ? -1 : 1);
    updateParams({ contest: String(next), event: null, page: null });
  };

  useEffect(() => {
    const update = () => {
      const remaining = getNextRollover().getTime() - Date.now();
      setCountdown(formatCountdown(remaining));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  // Show loading state while we don't even know the tournament number yet.
  if (contestStatusQuery.isLoading) {
    return (
      <div className="flex flex-col flex-1 overflow-y-auto">
        <CubeLoader message="Loading tournament..." />
      </div>
    );
  }

  if (!viewingContest) {
    return (
      <div className="flex flex-col flex-1 overflow-y-auto items-center justify-center py-16">
        <p className="text-muted-foreground">No tournament found.</p>
      </div>
    );
  }

  // If competing in an event, show the solve view instead of the main page.
  if (solvingEvent) {
    const eventConfig = EVENT_MAP[solvingEvent.eventId];
    return (
      <TournamentSolveView
        eventConfig={eventConfig}
        entryId={solvingEvent.entryId}
        scrambles={solvingEvent.scrambles}
        initialSolves={solvingEvent.solves}
        tournamentNumber={viewingContest}
        onComplete={() => {
          setSolvingEvent(null);
          // Invalidate all tournament queries so compete tab and leaderboard
          // reflect the new results (contest status, overview, full leaderboard).
          queryClient.invalidateQueries({ queryKey: trpc.tournament.getContestStatus.queryKey() });
          queryClient.invalidateQueries({ queryKey: trpc.tournament.getLeaderboardOverview.queryKey() });
          queryClient.invalidateQueries({ queryKey: trpc.tournament.getLeaderboard.queryKey() });
          // Switch to leaderboard for this event.
          updateParams({ tab: "leaderboard", event: solvingEvent.eventId });
        }}
        onExit={() => setSolvingEvent(null)}
      />
    );
  }

  return (
    <div className="flex flex-col flex-1 overflow-y-auto">
      {/* Header */}
      <div className="px-6 pt-6 pb-0">
        <div className="max-w-5xl mx-auto w-full">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-extrabold">Daily Contest {viewingContest}</h1>
            <div className="flex items-center gap-1">
              <button
                onClick={() => navigateContest("prev")}
                disabled={!viewingContest || viewingContest <= 1}
                className="p-1 rounded-md hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={() => navigateContest("next")}
                disabled={!viewingContest || !latestNumber || viewingContest >= latestNumber}
                className="p-1 rounded-md hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {isCurrent ? (
              <><span className="font-mono font-bold">{countdown}</span> remaining</>
            ) : (
              <>{contestDateStr} · Ended</>
            )}
          </p>

          {/* Tabs */}
          <div className="flex gap-1 mt-4 border-b border-border">
            <button
              className={`px-4 py-2 text-sm font-bold transition-colors relative ${
                tab === "compete" ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setTab("compete")}
            >
              Compete
              {tab === "compete" && <div className={`absolute bottom-0 left-0 right-0 h-0.5 ${accent.bg}`} />}
            </button>
            <button
              className={`px-4 py-2 text-sm font-bold transition-colors relative ${
                tab === "leaderboard" ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setTab("leaderboard")}
            >
              Leaderboard
              {tab === "leaderboard" && <div className={`absolute bottom-0 left-0 right-0 h-0.5 ${accent.bg}`} />}
            </button>
          </div>
        </div>
      </div>

      {/* Tab content */}
      <div className="px-6 pt-2 pb-6 flex-1">
        <div className="max-w-5xl mx-auto w-full">
          {tab === "compete" ? (
            <CompeteTab
              contestData={activeContestData}
              isLoading={activeContestLoading}
              isCurrent={isCurrent}
              viewerHasWca={activeContestData?.viewerHasWca ?? false}
              onViewEvent={(eventId) => {
                updateParams({ tab: "leaderboard" });
                setTimeout(() => {
                  document.getElementById(`event-${eventId}`)?.scrollIntoView({ behavior: "smooth" });
                }, 100);
              }}
              onStartEvent={handleStartEvent}
            />
          ) : validEvent && viewingContest ? (
            <EventLeaderboardDetail
              event={validEvent}
              tournamentNumber={viewingContest}
              onBack={() => setSelectedEvent(null)}
              onChangeEvent={setSelectedEvent}
              page={page}
              onPageChange={setPage}
            />
          ) : (
            <LeaderboardOverview
              tournamentNumber={viewingContest}
              isCurrent={isCurrent}
              onSelectEvent={setSelectedEvent}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// --- Compete Tab ---

type ContestStatusData = {
  tournament: { id: string; number: number; name: string | null; datePST: string };
  events: {
    enteredEvents: {
      eventId: string;
      eventName: string;
      entryId: string;
      scrambleSetId: string;
      scrambles: string[];
      result: number | null;
      solves: (SolveForStats & { id: string; scrambleSetIndex: number })[];
      rank: number | null;
      totalCompetitors: number;
    }[];
    unenteredEvents: {
      eventId: string;
      eventName: string;
      totalCompetitors: number;
    }[];
  };
};

function CompeteTab({
  contestData,
  isLoading,
  isCurrent,
  onViewEvent,
  onStartEvent,
  viewerHasWca,
}: {
  contestData: ContestStatusData | undefined;
  isLoading: boolean;
  isCurrent: boolean;
  onViewEvent: (eventId: string) => void;
  onStartEvent: (eventId: CubeEvent) => void;
  viewerHasWca: boolean;
}) {
  if (isLoading) {
    return <CubeLoader message="Loading events..." />;
  }

  const enteredMap = new Map(
    (contestData?.events.enteredEvents ?? []).map((e) => [e.eventName, e])
  );
  const unenteredMap = new Map(
    (contestData?.events.unenteredEvents ?? []).map((e) => [e.eventName, e])
  );

  return (
    <div>
      {EVENT_CONFIGS.map((config) => {
        const entered = enteredMap.get(config.id);
        const unentered = unenteredMap.get(config.id);
        return (
          <EventCard
            key={config.id}
            config={config}
            enteredEvent={entered}
            totalCompetitors={entered?.totalCompetitors ?? unentered?.totalCompetitors ?? 0}
            isCurrent={isCurrent}
            onView={() => onViewEvent(config.id)}
            onStart={() => onStartEvent(config.id)}
          />
        );
      })}
    </div>
  );
}

// --- Compete Tab: Event Card ---

function EventCard({
  config,
  enteredEvent,
  totalCompetitors,
  isCurrent,
  onView,
  onStart,
}: {
  config: typeof EVENT_CONFIGS[number];
  enteredEvent?: ContestStatusData["events"]["enteredEvents"][number];
  totalCompetitors: number;
  isCurrent: boolean;
  onView: () => void;
  onStart: () => void;
}) {
  const { accent } = useSettings();
  const totalSolves = config.tournamentSolveCount;
  const formatLabel = getFormatLabel(config);

  // Determine status from entry existence, not solve count.
  // If a TournamentEntry exists, the user started (even if 0 solves).
  let status: "not-started" | "in-progress" | "completed";
  if (!enteredEvent) {
    status = "not-started";
  } else if (enteredEvent.solves.length >= totalSolves) {
    status = "completed";
  } else {
    status = "in-progress";
  }

  const completedSolves = enteredEvent?.solves.length ?? 0;

  // Compute display result from solves using shared compute functions.
  const displayStats = enteredEvent
    ? computeDisplayStats(enteredEvent.solves, config)
    : null;

  return (
    <button
      onClick={() => {
        if (!isCurrent || status === "completed") { onView(); }
        else { onStart(); }
      }}
      className="flex items-center w-full px-4 py-3 hover:bg-muted/60 transition-colors text-left border-b border-border cursor-pointer"
    >
      {/* Left: event info (two lines) */}
      <div className="flex-1 min-w-0">
        {/* Header line: icon + name + format + result */}
        <div className="flex items-center gap-3">
          <EventIcon event={config} size={24} />
          <span className="font-extrabold">{config.name}</span>
          <span className="font-extrabold">{formatLabel}</span>
          {status === "completed" && displayStats && (
            <>
              <span className="font-mono tabular-nums font-extrabold">{displayStats.rankingResult}</span>
              {enteredEvent?.rank && (
                <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                  rank {enteredEvent.rank}/{totalCompetitors}
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block animate-pulse" />
                </span>
              )}
            </>
          )}
          {status !== "completed" && isCurrent && totalCompetitors > 0 && (
            <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              {totalCompetitors} competing
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block animate-pulse" />
            </span>
          )}
          {status !== "completed" && !isCurrent && (
            <span className="text-xs font-semibold text-muted-foreground">
              {totalCompetitors} competed
            </span>
          )}
        </div>
        {/* Detail line: solve times + placeholders */}
        <div className="mt-1 ml-9 font-mono tabular-nums text-sm text-muted-foreground">
          {(() => {
            const solves = enteredEvent?.solves ?? [];
            const total = config.tournamentSolveCount;
            const remaining = total - solves.length;
            if (status === "completed" && total === 5 && config.tournamentRankBy === "average" && solves.length === 5) {
              return formatAo5Times(solves);
            }
            const solveStrs = solves.map(formatSolveTime);
            const placeholders = Array(remaining).fill("–.––");
            return [...solveStrs, ...placeholders].join("  ");
          })()}
        </div>
      </div>

      {/* Right: action button (vertically centered across both lines) */}
      <div className="shrink-0 ml-4">
        {(!isCurrent || status === "completed") && (
          <div
            onClick={(e) => { e.stopPropagation(); onView(); }}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded bg-neutral-600 text-white hover:bg-neutral-500 font-bold text-sm transition-all shadow-[0_2px_0_0_#1a1a1a] cursor-pointer"
          >
            Results
          </div>
        )}
        {status === "not-started" && isCurrent && (
          <div
            onClick={(e) => { e.stopPropagation(); onStart(); }}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded bg-neutral-600 text-white hover:bg-neutral-500 font-bold text-sm transition-all shadow-[0_2px_0_0_#1a1a1a] cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            Start
          </div>
        )}
        {status === "in-progress" && isCurrent && (
          <div
            onClick={(e) => { e.stopPropagation(); onStart(); }}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded bg-neutral-600 text-white hover:bg-neutral-500 font-bold text-sm transition-all shadow-[0_2px_0_0_#1a1a1a] cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            Continue ({completedSolves}/{totalSolves})
          </div>
        )}
      </div>
    </button>
  );
}

// --- Leaderboard Tab: Overview (top 3 + viewer for all events) ---

function LeaderboardOverview({
  tournamentNumber,
  isCurrent,
  onSelectEvent,
}: {
  tournamentNumber: number | undefined;
  isCurrent: boolean;
  onSelectEvent: (event: CubeEvent) => void;
}) {
  const overviewQuery = useLeaderboardOverview(tournamentNumber);

  if (overviewQuery.isLoading) {
    return <CubeLoader message="Loading leaderboard..." />;
  }

  if (!overviewQuery.data || overviewQuery.data.events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <p className="text-muted-foreground">No leaderboard data yet.</p>
      </div>
    );
  }

  const viewerHasWca = overviewQuery.data.viewerHasWca;
  const eventDataMap = new Map(
    overviewQuery.data.events.map((e) => [e.eventName, e])
  );

  return (
    <div className="space-y-6">
      {!viewerHasWca && !overviewQuery.isFetching && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-yellow-500/20 bg-yellow-500/5 px-4 py-3">
          <p className="text-sm text-yellow-200/80">
            Your results are hidden from other competitors. Link your WCA account to appear on the leaderboard and earn medals.
          </p>
          <a
            href="/settings"
            className="shrink-0 text-sm font-semibold text-yellow-400 hover:text-yellow-300 transition-colors"
          >
            Link WCA →
          </a>
        </div>
      )}
      <div className="space-y-6">
        {EVENT_CONFIGS.map((config) => {
          const eventData = eventDataMap.get(config.id);
          if (!eventData || eventData.top3.length === 0) return null;

          const solveCount = config.tournamentSolveCount;

          return (
            <div key={config.id} id={`event-${config.id}`}>
              {/* Event header */}
              <div className="flex items-center gap-3 mb-2">
                <EventIcon event={config} size={24} />
                <span className="font-extrabold text-base">{config.name}</span>
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  {isCurrent && <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />}
                  {eventData.totalCompetitors} {isCurrent ? "competing" : "competed"}
                </span>
                <span className="flex-1" />
                <button
                  onClick={() => onSelectEvent(config.id)}
                  className="text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                >
                  View all <ChevronRight className="w-3 h-3" />
                </button>
              </div>

              <div className="rounded-lg bg-card border border-border overflow-x-auto">
                <table className="w-full text-sm min-w-[600px]">
                  <thead>
                    <tr className="text-xs font-bold text-muted-foreground uppercase tracking-wider border-b border-border">
                      <th className="px-4 py-2 text-left w-10">#</th>
                      <th className="py-2 text-left">Player</th>
                      <th className="pl-8 pr-4 py-2 text-right">Single</th>
                      <th className="pl-6 pr-4 py-2 text-right">{getStatColumnLabel(config)}</th>
                      <th className="w-4" />
                      {Array.from({ length: solveCount }).map((_, i) => (
                        <th key={i} className="px-2 py-2 text-right">{i + 1}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {/* Viewer row pinned at top */}
                    {eventData.viewerEntry && (() => {
                      const viewer = eventData.viewerEntry;
                      const { bestIdx, worstIdx } = getBestAndWorst(viewer.solves);
                      const { singleStr, avgStr } = computeDisplayStats(viewer.solves, config);
                      return (
                        <tr className="bg-orange-500/[0.03] border-l-2 border-l-orange-500/40 border-b border-b-orange-500/10">
                          <td className="px-4 py-2.5 w-10 text-center text-sm font-bold text-orange-400">
                            {viewer.rank ?? "—"}
                          </td>
                          <td className="py-2.5">
                            <span className="font-semibold text-orange-400">You</span>
                          </td>
                          <td className="pl-8 pr-4 py-2.5 text-right font-mono tabular-nums font-bold">
                            {singleStr}
                          </td>
                          <td className="pl-6 pr-4 py-2.5 text-right font-mono tabular-nums font-bold">
                            {avgStr}
                          </td>
                          <td />
                          {viewer.solves.map((solve, i) => {
                            const isBestOrWorst = solveCount === 5 && (i === bestIdx || i === worstIdx);
                            const display = formatSolveTime(solve);
                            return (
                              <td key={i} className="px-2 py-2.5 text-right font-mono tabular-nums font-bold">
                                {isBestOrWorst ? `(${display})` : display}
                              </td>
                            );
                          })}
                          {/* Fill empty solve columns if viewer has fewer solves */}
                          {Array.from({ length: solveCount - viewer.solves.length }).map((_, i) => (
                            <td key={`empty-${i}`} className="px-2 py-2.5 text-right font-mono tabular-nums text-muted-foreground">
                              —
                            </td>
                          ))}
                        </tr>
                      );
                    })()}

                    {/* Top 3 */}
                    {eventData.top3.map((entry, rowIdx) => {
                      const { bestIdx, worstIdx } = getBestAndWorst(entry.solves);
                      const { singleStr, avgStr } = computeDisplayStats(entry.solves, config);
                      return (
                        <tr
                          key={entry.rank}
                          className="border-b border-border/40 last:border-0"
                        >
                          <td className="px-4 py-2.5 w-10 text-center">
                            {rankDisplay(entry.rank)}
                          </td>
                          <td className="py-2.5">
                            <Link href={`/profile/${entry.user.username}`} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                              <UserAvatar
                                user={{
                                  username: entry.user.username,
                                  firstName: entry.user.firstName,
                                  lastName: entry.user.lastName,
                                  profilePictureUrl: entry.user.profilePictureUrl,
                                }}
                                size="sm"
                                rounded="full"
                              />
                              <span className="font-semibold">{entry.user.username}</span>
                              {entry.user.country && (
                                <span className="text-sm" suppressHydrationWarning>{countryCodeToFlag(entry.user.country)}</span>
                              )}
                            </Link>
                          </td>
                          <td className="pl-8 pr-4 py-2.5 text-right font-mono tabular-nums font-bold">
                            {singleStr}
                          </td>
                          <td className="pl-6 pr-4 py-2.5 text-right font-mono tabular-nums font-bold">
                            {avgStr}
                          </td>
                          <td />
                          {entry.solves.map((solve, i) => {
                            const isBestOrWorst = solveCount === 5 && (i === bestIdx || i === worstIdx);
                            const display = formatSolveTime(solve);
                            return (
                              <td key={i} className="px-2 py-2.5 text-right font-mono tabular-nums font-bold">
                                {isBestOrWorst ? `(${display})` : display}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- Leaderboard Tab: Full table for one event ---

function EventLeaderboardDetail({
  event, tournamentNumber, onBack, onChangeEvent, page, onPageChange,
}: {
  event: CubeEvent;
  tournamentNumber: number;
  onBack: () => void;
  onChangeEvent: (event: CubeEvent) => void;
  page: number;
  onPageChange: (page: number) => void;
}) {
  const eventConfig = EVENT_MAP[event];
  const solveCount = eventConfig.tournamentSolveCount;

  const leaderboardQuery = useLeaderboard(tournamentNumber, event, page, RESULTS_PER_PAGE);

  const totalPages = leaderboardQuery.data
    ? Math.ceil(leaderboardQuery.data.total / RESULTS_PER_PAGE)
    : 0;
  const currentPage = Math.min(page, Math.max(1, totalPages));

  return (
    <div className="space-y-4">
      {/* Back button + event name */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-1.5 rounded-md hover:bg-muted transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-muted transition-colors">
              <EventIcon event={eventConfig} size={24} />
              <span className="font-extrabold text-lg">{eventConfig.name}</span>
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              {EVENT_CONFIGS.map((config) => (
                <DropdownMenuItem
                  key={config.id}
                  onClick={() => onChangeEvent(config.id)}
                  className={event === config.id ? "bg-accent" : ""}
                >
                  <EventIcon event={config} size={16} />
                  <span>{config.name}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <span className="-ml-1 text-lg font-extrabold text-foreground">{getFormatLabel(eventConfig)}</span>
        </div>
        {leaderboardQuery.data && leaderboardQuery.data.total > 0 && (
          <span className="text-sm text-muted-foreground">
            Showing {(currentPage - 1) * RESULTS_PER_PAGE + 1}–{Math.min(currentPage * RESULTS_PER_PAGE, leaderboardQuery.data.total)} of {leaderboardQuery.data.total}
          </span>
        )}
      </div>

      {leaderboardQuery.isLoading ? (
        <CubeLoader message="Loading results..." />
      ) : !leaderboardQuery.data || leaderboardQuery.data.entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <p className="text-muted-foreground">No entries yet for this event.</p>
        </div>
      ) : (
        <>
          {!leaderboardQuery.data.viewerHasWca && !leaderboardQuery.isFetching && (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-yellow-500/20 bg-yellow-500/5 px-4 py-3 mb-4">
              <p className="text-sm text-yellow-200/80">
                Your results are hidden from other competitors. Link your WCA account to appear on the leaderboard and earn medals.
              </p>
              <a
                href="/settings"
                className="shrink-0 text-sm font-semibold text-yellow-400 hover:text-yellow-300 transition-colors"
              >
                Link WCA →
              </a>
            </div>
          )}
          {/* Full results table */}
          <div className="rounded-lg bg-card border border-border overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="border-b border-border text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  <th className="px-4 py-2 text-left w-10">#</th>
                  <th className="px-3 py-2 text-left">Player</th>
                  <th className="pl-8 pr-4 py-2 text-right">Single</th>
                  <th className="pl-6 pr-4 py-2 text-right">{getStatColumnLabel(eventConfig)}</th>
                  <th className="w-4" />
                  {Array.from({ length: solveCount }).map((_, i) => (
                    <th key={i} className="px-2 py-2 text-right">{i + 1}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Viewer row pinned at top */}
                {(() => {
                  const viewer = leaderboardQuery.data!.viewerEntry;
                  if (!viewer) return null;
                  const { bestIdx, worstIdx } = getBestAndWorst(viewer.solves);
                  const { singleStr, avgStr } = computeDisplayStats(viewer.solves, eventConfig);
                  return (
                    <tr className="bg-orange-500/[0.03] border-l-2 border-l-orange-500/40 border-b border-b-orange-500/10">
                      <td className="px-4 py-3 text-center text-sm font-bold text-orange-400">
                        {viewer.rank ?? "—"}
                      </td>
                      <td className="px-3 py-3">
                        <span className="font-semibold text-orange-400">You</span>
                      </td>
                      <td className="pl-8 pr-4 py-3 text-right font-mono tabular-nums font-bold">
                        {singleStr}
                      </td>
                      <td className="pl-6 pr-4 py-3 text-right font-mono tabular-nums font-bold">
                        {avgStr}
                      </td>
                      <td />
                      {viewer.solves.map((solve, i) => {
                        const isBW = solveCount === 5 && (i === bestIdx || i === worstIdx);
                        return (
                          <td key={i} className="px-2 py-3 text-right font-mono tabular-nums font-bold">
                            {isBW ? `(${formatSolveTime(solve)})` : formatSolveTime(solve)}
                          </td>
                        );
                      })}
                      {Array.from({ length: solveCount - viewer.solves.length }).map((_, i) => (
                        <td key={`empty-${i}`} className="px-2 py-3 text-right font-mono tabular-nums text-muted-foreground">
                          —
                        </td>
                      ))}
                    </tr>
                  );
                })()}

                {leaderboardQuery.data!.entries.map((entry, rowIdx) => {
                  const { bestIdx, worstIdx } = getBestAndWorst(entry.solves);
                  const { singleStr, avgStr } = computeDisplayStats(entry.solves, eventConfig);
                  return (
                    <tr
                      key={entry.rank}
                      className={rowIdx % 2 === 1 ? "bg-muted/60" : ""}
                    >
                      <td className="px-4 py-3 text-center">
                        {rankDisplay(entry.rank)}
                      </td>
                      <td className="px-3 py-3">
                        <Link href={`/profile/${entry.user.username}`} className="flex items-center gap-2 min-w-0 hover:opacity-80 transition-opacity">
                          <UserAvatar
                            user={{
                              username: entry.user.username,
                              firstName: entry.user.firstName,
                              lastName: entry.user.lastName,
                              profilePictureUrl: entry.user.profilePictureUrl,
                            }}
                            size="sm"
                            rounded="full"
                          />
                          <span className="font-semibold truncate">
                            {entry.user.username}
                          </span>
                          {entry.user.country && (
                            <span className="text-sm" suppressHydrationWarning>{countryCodeToFlag(entry.user.country)}</span>
                          )}
                        </Link>
                      </td>
                      <td className="pl-8 pr-4 py-3 text-right font-mono tabular-nums font-bold">
                        {singleStr}
                      </td>
                      <td className="pl-6 pr-4 py-3 text-right font-mono tabular-nums font-bold">
                        {avgStr}
                      </td>
                      <td />
                      {entry.solves.map((solve, i) => {
                        const isBestOrWorst = solveCount === 5 && (i === bestIdx || i === worstIdx);
                        const display = formatSolveTime(solve);
                        return (
                          <td key={i} className="px-2 py-3 text-right font-mono tabular-nums font-bold">
                            {isBestOrWorst ? `(${display})` : display}
                          </td>
                        );
                      })}
                      {Array.from({ length: solveCount - entry.solves.length }).map((_, i) => (
                        <td key={`empty-${i}`} className="px-2 py-3 text-right font-mono tabular-nums text-muted-foreground">
                          —
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <button
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage <= 1}
                className="px-3 py-1.5 text-sm font-semibold rounded-md hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                ← Prev
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => onPageChange(p)}
                  className={`w-8 h-8 text-sm rounded-md transition-colors ${
                    p === currentPage
                      ? "bg-primary text-primary-foreground font-bold"
                      : "hover:bg-muted"
                  }`}
                >
                  {p}
                </button>
              ))}
              <button
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage >= totalPages}
                className="px-3 py-1.5 text-sm font-semibold rounded-md hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
