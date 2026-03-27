"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { CubeEvent, EVENT_CONFIGS, EVENT_MAP } from "@/lib/cubing/events";
import { EventIcon } from "@/lib/components/event-icon";
import { UserAvatar } from "@/lib/components/user-avatar";
import { ChevronDown, ChevronLeft, ChevronRight, Play, ArrowLeft } from "lucide-react";
import { countryCodeToFlag } from "@/lib/countries";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getNextRollover, getTournamentDate } from "@/lib/tournament/date";

type Tab = "compete" | "leaderboard";

// Mock entry data for the compete tab.
interface MockEntry {
  status: "not-started" | "in-progress" | "completed";
  solves: { timeMs: number; penalty: string | null }[];
  average: string | null;
  totalSolves: number;
}

const MOCK_ENTRIES: Partial<Record<CubeEvent, MockEntry>> = {
  [CubeEvent.THREE]: {
    status: "completed",
    solves: [
      { timeMs: 9230, penalty: null },
      { timeMs: 8410, penalty: null },
      { timeMs: 11540, penalty: null },
      { timeMs: 7890, penalty: null },
      { timeMs: 10120, penalty: null },
    ],
    average: "9.26",
    totalSolves: 5,
  },
  [CubeEvent.TWO]: {
    status: "in-progress",
    solves: [
      { timeMs: 3210, penalty: null },
      { timeMs: 4560, penalty: "+2" },
    ],
    average: null,
    totalSolves: 5,
  },
};

// Mock leaderboard entry.
interface MockLeaderboardEntry {
  rank: number;
  username: string;
  firstName: string;
  lastName: string;
  country: string;
  profilePictureUrl: string | null;
  average: string;
  isSelf: boolean;
  solves: { timeMs: number; penalty: string | null }[];
}

const RESULTS_PER_PAGE = 25;

// Generate 60 mock leaderboard entries.
const MOCK_NAMES = [
  ["Max", "Chen", "US"], ["Yuki", "Tanaka", "JP"], ["ishaan", "agrawal", "US"],
  ["Lena", "Schmidt", "DE"], ["Carlos", "Rivera", "MX"], ["Emma", "Lee", "KR"],
  ["Ollie", "Brown", "GB"], ["Sophie", "Martin", "FR"], ["Raj", "Patel", "IN"],
  ["Mia", "Kim", "CA"], ["Noah", "Müller", "DE"], ["Ava", "Li", "CN"],
  ["Liam", "Wilson", "AU"], ["Chloe", "Yamada", "JP"], ["Ethan", "Rossi", "IT"],
  ["Sakura", "Ito", "JP"], ["Felix", "Svensson", "SE"], ["Zara", "Ali", "PK"],
  ["Leo", "Santos", "BR"], ["Luna", "Park", "KR"], ["Oscar", "Berg", "NO"],
  ["Aria", "Singh", "IN"], ["Hugo", "Dubois", "FR"], ["Isla", "Murphy", "IE"],
  ["Kai", "Nakamura", "JP"], ["Maya", "Johansson", "SE"], ["Ravi", "Kumar", "IN"],
  ["Nora", "Andersen", "DK"], ["Amir", "Hassan", "EG"], ["Ivy", "Zhang", "CN"],
  ["Finn", "O'Brien", "IE"], ["Suki", "Watanabe", "JP"], ["Marco", "Bianchi", "IT"],
  ["Elena", "Petrova", "RU"], ["Tao", "Wang", "CN"], ["Hana", "Choi", "KR"],
  ["Lars", "Nielsen", "DK"], ["Amara", "Okafor", "NG"], ["Soren", "Larsen", "DK"],
  ["Mei", "Huang", "TW"], ["Diego", "Lopez", "AR"], ["Freya", "Olsen", "NO"],
  ["Yuto", "Sato", "JP"], ["Clara", "Fischer", "DE"], ["Omar", "Khoury", "LB"],
  ["Ines", "Silva", "PT"], ["Anton", "Novak", "CZ"], ["Priya", "Sharma", "IN"],
  ["Mateo", "Garcia", "ES"], ["Lily", "Thompson", "NZ"], ["Axel", "Eriksson", "SE"],
  ["Nadia", "Kovacs", "HU"], ["Jin", "Park", "KR"], ["Rosa", "Fernandez", "CL"],
  ["Erik", "Holm", "FI"], ["Yuna", "Takahashi", "JP"], ["Sam", "Baker", "US"],
  ["Tina", "Bauer", "AT"], ["Aiden", "Moore", "US"], ["Kira", "Suzuki", "JP"],
] as const;

const MOCK_LEADERBOARD: MockLeaderboardEntry[] = MOCK_NAMES.map(([firstName, lastName, country], i) => {
  const baseTime = 6500 + i * 400 + Math.floor(Math.random() * 200);
  const solves = Array.from({ length: 5 }, () => ({
    timeMs: baseTime + Math.floor(Math.random() * 3000 - 1000),
    penalty: Math.random() < 0.03 ? "dnf" as const : Math.random() < 0.05 ? "+2" as const : null,
  }));
  const validTimes = solves
    .map((s) => s.penalty === "dnf" ? Infinity : s.penalty === "+2" ? s.timeMs + 2000 : s.timeMs)
    .sort((a, b) => a - b);
  const avg = validTimes.length >= 5
    ? (validTimes[1] + validTimes[2] + validTimes[3]) / 3
    : validTimes.reduce((a, b) => a + b, 0) / validTimes.length;
  return {
    rank: i + 1,
    username: `${firstName.toLowerCase()}${lastName.toLowerCase().slice(0, 3)}`,
    firstName: firstName as string,
    lastName: lastName as string,
    country: country as string,
    profilePictureUrl: null,
    average: formatTime(Math.round(avg)),
    isSelf: i === 27, // Put "you" at rank 28
    solves,
  };
});

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
  const centiseconds = Math.floor((ms % 1000) / 10);
  return `${totalSeconds}.${String(centiseconds).padStart(2, "0")}`;
}

function formatSolveTime(solve: { timeMs: number; penalty: string | null }): string {
  if (solve.penalty === "dnf") return "DNF";
  const time = formatTime(solve.penalty === "+2" ? solve.timeMs + 2000 : solve.timeMs);
  return solve.penalty === "+2" ? `${time}+` : time;
}

function getBestSingle(solves: { timeMs: number; penalty: string | null }[]): string {
  const times = solves.map((s) =>
    s.penalty === "dnf" ? Infinity : s.penalty === "+2" ? s.timeMs + 2000 : s.timeMs
  );
  const best = Math.min(...times);
  return best === Infinity ? "DNF" : formatTime(best);
}

function getBestWorst(solves: { timeMs: number; penalty: string | null }[]) {
  if (solves.length !== 5) return { bestIdx: -1, worstIdx: -1 };
  const times = solves.map((s) =>
    s.penalty === "dnf" ? Infinity : s.penalty === "+2" ? s.timeMs + 2000 : s.timeMs
  );
  let bestIdx = 0, worstIdx = 0;
  times.forEach((t, i) => {
    if (t < times[bestIdx]) bestIdx = i;
    if (t > times[worstIdx]) worstIdx = i;
  });
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

// Mock tournament number (will be computed from DB later).
const TOURNAMENT_NUMBER = 47;

// --- Main Page ---

export default function TourneyPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Read state from URL params, with defaults.
  const tab: Tab = searchParams.get("tab") === "leaderboard" ? "leaderboard" : "compete";
  const viewingContest = Number(searchParams.get("contest")) || TOURNAMENT_NUMBER;
  const selectedLeaderboardEvent = (searchParams.get("event") as CubeEvent) || null;
  // Validate the event param is a real event.
  const validEvent = selectedLeaderboardEvent && EVENT_MAP[selectedLeaderboardEvent]
    ? selectedLeaderboardEvent
    : null;
  const page = Math.max(1, Number(searchParams.get("page")) || 1);

  const [countdown, setCountdown] = useState("");
  const isCurrent = viewingContest === TOURNAMENT_NUMBER;

  // Compute the date for the viewed contest.
  // Current contest uses today's tournament date. Past contests offset by the difference.
  const todayTournamentDate = getTournamentDate();
  const dayOffset = TOURNAMENT_NUMBER - viewingContest;
  const contestDate = new Date(todayTournamentDate + "T12:00:00Z");
  contestDate.setUTCDate(contestDate.getUTCDate() - dayOffset);
  const contestDateStr = contestDate.toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });

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
    const next = viewingContest + (direction === "prev" ? -1 : 1);
    // Reset to overview when switching contests.
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
                disabled={viewingContest <= 1}
                className="p-1 rounded-md hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={() => navigateContest("next")}
                disabled={viewingContest >= TOURNAMENT_NUMBER}
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
            <div className="max-w-3xl space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {EVENT_CONFIGS.map((config) => (
                  <EventCard key={config.id} config={config} entry={MOCK_ENTRIES[config.id]} />
                ))}
              </div>
            </div>
          ) : validEvent ? (
            <EventLeaderboardDetail
              event={validEvent}
              onBack={() => setSelectedEvent(null)}
              onChangeEvent={setSelectedEvent}
              page={page}
              onPageChange={setPage}
            />
          ) : (
            <LeaderboardOverview
              onSelectEvent={setSelectedEvent}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// --- Compete Tab: Event Card ---

function EventCard({ config, entry }: { config: typeof EVENT_CONFIGS[number]; entry?: MockEntry }) {
  const status = entry?.status ?? "not-started";
  const completedSolves = entry?.solves.length ?? 0;
  const totalSolves = config.tournamentSolveCount;
  const isAo5 = totalSolves === 5;

  return (
    <button className="rounded-lg bg-card border border-border p-4 hover:bg-muted transition-colors text-left space-y-3">
      <div className="flex items-center gap-3">
        <EventIcon event={config} size={36} />
        <span className="font-extrabold text-lg flex-1">{config.name}</span>
        <span className="text-xs font-bold text-muted-foreground">
          {isAo5 ? "Ao5" : "Mo3"}
        </span>
      </div>

      {status === "not-started" && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Play className="w-3.5 h-3.5" />
          <span className="text-xs font-semibold">Start</span>
        </div>
      )}

      {status === "in-progress" && entry && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-yellow-500">
            <Play className="w-3.5 h-3.5" />
            <span className="text-xs font-semibold">Continue ({completedSolves}/{totalSolves})</span>
          </div>
          <p className="text-[11px] font-mono tabular-nums text-muted-foreground leading-relaxed">
            {entry.solves.map(formatSolveTime).join("  ")}
          </p>
        </div>
      )}

      {status === "completed" && entry && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-base font-mono tabular-nums font-extrabold">{entry.average}</span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Done</span>
          </div>
          <p className="text-[11px] font-mono tabular-nums text-muted-foreground leading-relaxed">
            {isAo5 ? formatAo5Times(entry.solves) : entry.solves.map(formatSolveTime).join("  ")}
          </p>
        </div>
      )}
    </button>
  );
}

// --- Leaderboard Tab: Overview (stubs for all events) ---

function LeaderboardOverview({
  onSelectEvent,
}: {
  onSelectEvent: (event: CubeEvent) => void;
}) {
  return (
    <div className="space-y-6">

      {/* Event sections — vertically stacked */}
      <div className="space-y-6">
        {EVENT_CONFIGS.map((config) => {
          const top3 = MOCK_LEADERBOARD.slice(0, 3);
          const selfEntry = MOCK_LEADERBOARD.find((e) => e.isSelf);
          const isAo5 = config.tournamentSolveCount === 5;
          const solveCount = config.tournamentSolveCount;

          return (
            <div key={config.id}>
              {/* Event header — above the table */}
              <div className="flex items-center gap-3 mb-2">
                <EventIcon event={config} size={24} />
                <span className="font-extrabold text-base flex-1">{config.name}</span>
                <button
                  onClick={() => onSelectEvent(config.id)}
                  className="text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                >
                  View all <ChevronRight className="w-3 h-3" />
                </button>
              </div>

              <div className="rounded-lg bg-card border border-border overflow-hidden">

              {/* Mini table — top 3 with individual solves */}
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs font-bold text-muted-foreground uppercase tracking-wider border-b border-border">
                    <th className="px-4 py-2 text-left w-10">#</th>
                    <th className="py-2 text-left">Player</th>
                    <th className="pl-8 pr-4 py-2 text-right">Single</th>
                    <th className="pl-6 pr-4 py-2 text-right">{isAo5 ? "Avg" : "Mo3"}</th>
                    <th className="w-4" />
                    {Array.from({ length: solveCount }).map((_, i) => (
                      <th key={i} className="px-2 py-2 text-right">{i + 1}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* Your row pinned at top */}
                  {selfEntry && (() => {
                    const { bestIdx, worstIdx } = getBestWorst(selfEntry.solves);
                    return (
                      <tr className="bg-orange-500/[0.03] border-l-2 border-l-orange-500/40 border-b border-b-orange-500/10">
                        <td className="px-4 py-2.5 w-10 text-center text-sm font-bold text-orange-400">
                          {selfEntry.rank}
                        </td>
                        <td className="py-2.5">
                          <span className="font-semibold text-orange-400">{selfEntry.username}</span>
                        </td>
                        <td className="pl-8 pr-4 py-2.5 text-right font-mono tabular-nums font-bold">
                          {getBestSingle(selfEntry.solves)}
                        </td>
                        <td className="pl-6 pr-4 py-2.5 text-right font-mono tabular-nums font-bold">
                          {selfEntry.average}
                        </td>
                        <td />
                        {selfEntry.solves.map((solve, i) => {
                          const isBestOrWorst = isAo5 && (i === bestIdx || i === worstIdx);
                          const display = formatSolveTime(solve);
                          return (
                            <td key={i} className="px-2 py-2.5 text-right font-mono tabular-nums font-bold">
                              {isBestOrWorst ? `(${display})` : display}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })()}

                  {/* Top 3 (always shown, even if you're in top 3) */}
                  {top3.map((entry, rowIdx) => {
                    const { bestIdx, worstIdx } = getBestWorst(entry.solves);
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
                            <span className="font-semibold">{entry.username}</span>
                            {entry.country && (
                              <span className="text-sm" suppressHydrationWarning>{countryCodeToFlag(entry.country)}</span>
                            )}
                          </div>
                        </td>
                        <td className="pl-8 pr-4 py-2.5 text-right font-mono tabular-nums font-bold">
                          {getBestSingle(entry.solves)}
                        </td>
                        <td className="pl-6 pr-4 py-2.5 text-right font-mono tabular-nums font-bold">
                          {entry.average}
                        </td>
                        <td />
                        {entry.solves.map((solve, i) => {
                          const isBestOrWorst = isAo5 && (i === bestIdx || i === worstIdx);
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
  event, onBack, onChangeEvent, page, onPageChange,
}: {
  event: CubeEvent;
  onBack: () => void;
  onChangeEvent: (event: CubeEvent) => void;
  page: number;
  onPageChange: (page: number) => void;
}) {
  const eventConfig = EVENT_MAP[event];
  const solveCount = eventConfig.tournamentSolveCount;
  const isAo5 = solveCount === 5;

  const totalPages = Math.ceil(MOCK_LEADERBOARD.length / RESULTS_PER_PAGE);
  const currentPage = Math.min(page, totalPages);
  const pageEntries = MOCK_LEADERBOARD.slice(
    (currentPage - 1) * RESULTS_PER_PAGE,
    currentPage * RESULTS_PER_PAGE
  );
  const selfEntry = MOCK_LEADERBOARD.find((e) => e.isSelf);

  return (
    <div className="space-y-4">
      {/* Back button + event name + date nav */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-1.5 rounded-md hover:bg-muted transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-muted transition-colors">
              <EventIcon event={eventConfig} size={24} />
              <span className="font-extrabold text-lg">{eventConfig.name}</span>
              <span className="text-xs font-bold text-muted-foreground">{isAo5 ? "Ao5" : "Mo3"}</span>
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
        </div>
      </div>

      {/* Full results table */}
      <div className="rounded-lg bg-card border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-xs font-bold text-muted-foreground uppercase tracking-wider">
              <th className="px-4 py-2 text-left w-10">#</th>
              <th className="px-3 py-2 text-left">Player</th>
              <th className="pl-8 pr-4 py-2 text-right">Single</th>
              <th className="pl-6 pr-4 py-2 text-right">{isAo5 ? "Avg" : "Mo3"}</th>
              <th className="w-4" />
              {Array.from({ length: solveCount }).map((_, i) => (
                <th key={i} className="px-2 py-2 text-right">{i + 1}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Your row pinned at top */}
            {(() => {
              if (!selfEntry) return null;
              const { bestIdx, worstIdx } = getBestWorst(selfEntry.solves);
              return (
                <tr className="bg-orange-500/[0.03] border-l-2 border-l-orange-500/40 border-b border-b-orange-500/10">
                  <td className="px-4 py-3 text-center text-sm font-bold text-orange-400">
                    {selfEntry.rank}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <UserAvatar
                        user={{
                          username: selfEntry.username,
                          firstName: selfEntry.firstName,
                          lastName: selfEntry.lastName,
                          profilePictureUrl: selfEntry.profilePictureUrl,
                        }}
                        size="sm"
                        rounded="full"
                      />
                      <span className="font-semibold text-orange-400">{selfEntry.username}</span>
                      {selfEntry.country && (
                        <span className="text-sm" suppressHydrationWarning>{countryCodeToFlag(selfEntry.country)}</span>
                      )}
                    </div>
                  </td>
                  <td className="pl-8 pr-4 py-3 text-right font-mono tabular-nums font-bold">
                    {getBestSingle(selfEntry.solves)}
                  </td>
                  <td className="pl-6 pr-4 py-3 text-right font-mono tabular-nums font-bold">
                    {selfEntry.average}
                  </td>
                  <td />
                  {selfEntry.solves.map((solve, i) => {
                    const isBW = isAo5 && (i === bestIdx || i === worstIdx);
                    return (
                      <td key={i} className="px-2 py-3 text-right font-mono tabular-nums font-bold">
                        {isBW ? `(${formatSolveTime(solve)})` : formatSolveTime(solve)}
                      </td>
                    );
                  })}
                </tr>
              );
            })()}

            {pageEntries.map((entry, rowIdx) => {
              const { bestIdx, worstIdx } = getBestWorst(entry.solves);
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
                          username: entry.username,
                          firstName: entry.firstName,
                          lastName: entry.lastName,
                          profilePictureUrl: entry.profilePictureUrl,
                        }}
                        size="sm"
                        rounded="full"
                      />
                      <span className="font-semibold truncate">
                        {entry.username}
                      </span>
                      {entry.country && (
                        <span className="text-sm" suppressHydrationWarning>{countryCodeToFlag(entry.country)}</span>
                      )}
                    </div>
                  </td>
                  <td className="pl-8 pr-4 py-3 text-right font-mono tabular-nums font-bold">
                    {getBestSingle(entry.solves)}
                  </td>
                  <td className="pl-6 pr-4 py-3 text-right font-mono tabular-nums font-bold">
                    {entry.average}
                  </td>
                  <td />
                  {entry.solves.map((solve, i) => {
                    const isBestOrWorst = isAo5 && (i === bestIdx || i === worstIdx);
                    const display = formatSolveTime(solve);
                    return (
                      <td key={i} className="px-2 py-3 text-right font-mono tabular-nums font-bold">
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
    </div>
  );
}
