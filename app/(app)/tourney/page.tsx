"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { CubeEvent, EVENT_CONFIGS, EVENT_MAP } from "@/lib/cubing/events";
import { EventIcon } from "@/lib/components/event-icon";
import { UserAvatar } from "@/lib/components/user-avatar";
import { ChevronDown, ChevronLeft, ChevronRight, Play, ArrowLeft, Loader2 } from "lucide-react";
import { countryCodeToFlag } from "@/lib/countries";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getNextRollover } from "@/lib/tournament/date";
import { useContestStatus, useLeaderboard, useLeaderboardOverview } from "@/lib/hooks/useTournament";
import { computeAo5, computeMo3, computeBestSingle, type SolveForStats } from "@/lib/cubing/stats";

type Tab = "compete" | "leaderboard";

const DNF_RESULT = 999_999_999;
const RESULTS_PER_PAGE = 25;

// --- Helpers ---

function formatCountdown(ms: number): string {
  if (ms <= 0) return "00:00:00";
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const centiseconds = Math.floor((ms % 1000) / 10);
  if (minutes > 0) {
    return `${minutes}:${String(seconds).padStart(2, "0")}.${String(centiseconds).padStart(2, "0")}`;
  }
  return `${seconds}.${String(centiseconds).padStart(2, "0")}`;
}

function formatSolveTime(solve: { timeMs: number; penalty: string | null }): string {
  if (solve.penalty === "dnf") return "DNF";
  const time = formatTime(solve.penalty === "plus_two" ? solve.timeMs + 2000 : solve.timeMs);
  return solve.penalty === "plus_two" ? `${time}+` : time;
}

function formatResultTime(resultMs: number): string {
  if (resultMs === DNF_RESULT) return "DNF";
  return formatTime(resultMs);
}

function getBestSingle(solves: { timeMs: number; penalty: string | null }[]): string {
  const times = solves.map((s) =>
    s.penalty === "dnf" ? Infinity : s.penalty === "plus_two" ? s.timeMs + 2000 : s.timeMs
  );
  const best = Math.min(...times);
  return best === Infinity ? "DNF" : formatTime(best);
}

function getBestWorst(solves: { timeMs: number; penalty: string | null }[]) {
  if (solves.length !== 5) return { bestIdx: -1, worstIdx: -1 };
  const times = solves.map((s) =>
    s.penalty === "dnf" ? Infinity : s.penalty === "plus_two" ? s.timeMs + 2000 : s.timeMs
  );
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

function formatAo5Times(solves: { timeMs: number; penalty: string | null }[]): string {
  if (solves.length !== 5) return solves.map(formatSolveTime).join("  ");
  const { bestIdx, worstIdx } = getBestWorst(solves);
  return solves
    .map((s, i) => {
      const formatted = formatSolveTime(s);
      return (i === bestIdx || i === worstIdx) ? `(${formatted})` : formatted;
    })
    .join("  ");
}

const rankDisplay = (rank: number) => {
  if (rank === 1) return <span className="text-xl" style={{ filter: "hue-rotate(0deg) saturate(1.5)" }} suppressHydrationWarning>🏆</span>;
  if (rank === 2) return <span className="text-xl grayscale brightness-150" suppressHydrationWarning>🏆</span>;
  if (rank === 3) return <span className="text-xl" style={{ filter: "hue-rotate(-20deg) saturate(0.6) brightness(0.8)" }} suppressHydrationWarning>🏆</span>;
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
function computeDisplayStats(solves: { timeMs: number; penalty: string | null }[], config: typeof EVENT_CONFIGS[number]) {
  const stats = solves as SolveForStats[];
  const single = computeBestSingle(stats);
  const singleStr = single === null ? "—" : single === Infinity ? "DNF" : formatTime(single);

  let avg: number | null = null;
  if (config.tournamentSolveCount === 5) {
    avg = computeAo5(stats);
  } else if (config.tournamentSolveCount === 3) {
    avg = computeMo3(stats);
  }
  const avgStr = avg === null ? "—" : avg === Infinity ? "DNF" : formatTime(avg);

  return { singleStr, avgStr };
}

// --- Loading Spinner ---

function LoadingSpinner({ message }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
      <Loader2 className="w-6 h-6 animate-spin" />
      {message && <p className="text-sm">{message}</p>}
    </div>
  );
}

// --- Main Page ---

export default function TourneyPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Fetch contest status (defaults to latest tournament when no number given).
  const contestStatusQuery = useContestStatus();

  const currentTournamentNumber = contestStatusQuery.data?.tournament?.number;

  // Read state from URL params, with defaults.
  const tab: Tab = searchParams.get("tab") === "leaderboard" ? "leaderboard" : "compete";
  const viewingContest = Number(searchParams.get("contest")) || currentTournamentNumber;
  const selectedLeaderboardEvent = (searchParams.get("event") as CubeEvent) || null;
  const validEvent = selectedLeaderboardEvent && EVENT_MAP[selectedLeaderboardEvent]
    ? selectedLeaderboardEvent
    : null;
  const page = Math.max(1, Number(searchParams.get("page")) || 1);

  // When viewing a specific (non-latest) contest, fetch that contest's status.
  const specificContestQuery = useContestStatus(
    viewingContest && viewingContest !== currentTournamentNumber ? viewingContest : undefined
  );

  // The active contest data — either the specific one or the latest.
  const activeContestData = viewingContest && viewingContest !== currentTournamentNumber
    ? specificContestQuery.data
    : contestStatusQuery.data;
  const activeContestLoading = viewingContest && viewingContest !== currentTournamentNumber
    ? specificContestQuery.isLoading
    : contestStatusQuery.isLoading;

  const [countdown, setCountdown] = useState("");
  const isCurrent = viewingContest === currentTournamentNumber;

  const contestDateStr = activeContestData?.tournament?.datePST
    ? new Date(activeContestData.tournament.datePST + "T12:00:00").toLocaleDateString("en-US", {
        month: "short", day: "numeric", year: "numeric",
      })
    : "";

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
      updateParams({ tab: null, event: null, contest: null });
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
        <LoadingSpinner message="Loading tournament..." />
      </div>
    );
  }

  if (!currentTournamentNumber) {
    return (
      <div className="flex flex-col flex-1 overflow-y-auto items-center justify-center py-16">
        <p className="text-muted-foreground">No tournament found.</p>
      </div>
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
                disabled={!viewingContest || viewingContest >= currentTournamentNumber}
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
              {tab === "compete" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
            </button>
            <button
              className={`px-4 py-2 text-sm font-bold transition-colors relative ${
                tab === "leaderboard" ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setTab("leaderboard")}
            >
              Leaderboard
              {tab === "leaderboard" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
            </button>
          </div>
        </div>
      </div>

      {/* Tab content */}
      <div className="px-6 py-6 flex-1">
        <div className="max-w-5xl mx-auto w-full space-y-6">
          {tab === "compete" ? (
            <CompeteTab
              contestData={activeContestData}
              isLoading={activeContestLoading}
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
      solves: { id: string; scrambleSetIndex: number; timeMs: number; penalty: string | null }[];
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
}: {
  contestData: ContestStatusData | undefined;
  isLoading: boolean;
}) {
  if (isLoading) {
    return <LoadingSpinner message="Loading events..." />;
  }

  const enteredMap = new Map(
    (contestData?.events.enteredEvents ?? []).map((e) => [e.eventName, e])
  );
  const unenteredMap = new Map(
    (contestData?.events.unenteredEvents ?? []).map((e) => [e.eventName, e])
  );

  return (
    <div className="max-w-3xl space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {EVENT_CONFIGS.map((config) => {
          const entered = enteredMap.get(config.id);
          const unentered = unenteredMap.get(config.id);
          return (
            <EventCard
              key={config.id}
              config={config}
              enteredEvent={entered}
              totalCompetitors={entered?.totalCompetitors ?? unentered?.totalCompetitors ?? 0}
            />
          );
        })}
      </div>
    </div>
  );
}

// --- Compete Tab: Event Card ---

function EventCard({
  config,
  enteredEvent,
  totalCompetitors,
}: {
  config: typeof EVENT_CONFIGS[number];
  enteredEvent?: ContestStatusData["events"]["enteredEvents"][number];
  totalCompetitors: number;
}) {
  const totalSolves = config.tournamentSolveCount;
  const formatLabel = getFormatLabel(config);

  // Determine status from real data.
  let status: "not-started" | "in-progress" | "completed";
  if (!enteredEvent) {
    status = "not-started";
  } else if (enteredEvent.result !== null) {
    status = "completed";
  } else {
    status = enteredEvent.solves.length > 0 ? "in-progress" : "not-started";
  }

  const completedSolves = enteredEvent?.solves.length ?? 0;

  // Compute display result from solves using shared compute functions.
  const { avgStr: resultDisplay } = enteredEvent
    ? computeDisplayStats(enteredEvent.solves, config)
    : { avgStr: null };

  return (
    <button className="rounded-lg bg-card border border-border p-4 hover:bg-muted transition-colors text-left space-y-3">
      <div className="flex items-center gap-3">
        <EventIcon event={config} size={36} />
        <span className="font-extrabold text-lg flex-1">{config.name}</span>
        <span className="text-xs font-bold text-muted-foreground">
          {formatLabel}
        </span>
      </div>

      {status === "not-started" && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Play className="w-3.5 h-3.5" />
            <span className="text-xs font-semibold">Start</span>
          </div>
          {totalCompetitors > 0 && (
            <span className="text-[10px] text-muted-foreground">{totalCompetitors} competing</span>
          )}
        </div>
      )}

      {status === "in-progress" && enteredEvent && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-yellow-500">
              <Play className="w-3.5 h-3.5" />
              <span className="text-xs font-semibold">Continue ({completedSolves}/{totalSolves})</span>
            </div>
            {totalCompetitors > 0 && (
              <span className="text-[10px] text-muted-foreground">{totalCompetitors} competing</span>
            )}
          </div>
          <p className="text-[11px] font-mono tabular-nums text-muted-foreground leading-relaxed">
            {enteredEvent.solves.map(formatSolveTime).join("  ")}
          </p>
        </div>
      )}

      {status === "completed" && enteredEvent && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-base font-mono tabular-nums font-extrabold">{resultDisplay}</span>
            {enteredEvent.rank && (
              <span className="text-[10px] font-bold text-primary">
                #{enteredEvent.rank} / {totalCompetitors}
              </span>
            )}
          </div>
          <p className="text-[11px] font-mono tabular-nums text-muted-foreground leading-relaxed">
            {config.tournamentSolveCount === 5 && config.tournamentRankBy === "average"
              ? formatAo5Times(enteredEvent.solves)
              : enteredEvent.solves.map(formatSolveTime).join("  ")}
          </p>
        </div>
      )}
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
    return <LoadingSpinner message="Loading leaderboard..." />;
  }

  if (!overviewQuery.data || overviewQuery.data.events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <p className="text-muted-foreground">No leaderboard data yet.</p>
      </div>
    );
  }

  const eventDataMap = new Map(
    overviewQuery.data.events.map((e) => [e.eventName, e])
  );

  return (
    <div className="space-y-6">
      <div className="space-y-6">
        {EVENT_CONFIGS.map((config) => {
          const eventData = eventDataMap.get(config.id);
          if (!eventData || eventData.top3.length === 0) return null;

          const solveCount = config.tournamentSolveCount;

          return (
            <div key={config.id}>
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

              <div className="rounded-lg bg-card border border-border overflow-hidden">
                <table className="w-full text-sm">
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
                      const { bestIdx, worstIdx } = getBestWorst(viewer.solves);
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
                      const { bestIdx, worstIdx } = getBestWorst(entry.solves);
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
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">{entry.user.username}</span>
                              {entry.user.country && (
                                <span className="text-sm" suppressHydrationWarning>{countryCodeToFlag(entry.user.country)}</span>
                              )}
                            </div>
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
              <span className="text-xs font-bold text-muted-foreground">{getFormatLabel(eventConfig)}</span>
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
          {leaderboardQuery.data && (
            <span className="text-sm text-muted-foreground">
              {leaderboardQuery.data.total} competitors
            </span>
          )}
        </div>
      </div>

      {leaderboardQuery.isLoading ? (
        <LoadingSpinner message="Loading results..." />
      ) : !leaderboardQuery.data || leaderboardQuery.data.entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <p className="text-muted-foreground">No entries yet for this event.</p>
        </div>
      ) : (
        <>
          {/* Full results table */}
          <div className="rounded-lg bg-card border border-border">
            <table className="w-full text-sm">
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
                  const { bestIdx, worstIdx } = getBestWorst(viewer.solves);
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
                  const { bestIdx, worstIdx } = getBestWorst(entry.solves);
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
                        <div className="flex items-center gap-2 min-w-0">
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
                        </div>
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
