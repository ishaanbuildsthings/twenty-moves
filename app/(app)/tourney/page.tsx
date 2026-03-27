"use client";

import { useState, useEffect } from "react";
import { CubeEvent, EVENT_CONFIGS, EVENT_MAP } from "@/lib/cubing/events";
import { EventIcon } from "@/lib/components/event-icon";
import { UserAvatar } from "@/lib/components/user-avatar";
import { ChevronLeft, ChevronRight, Play, ArrowLeft } from "lucide-react";
import { countryCodeToFlag } from "@/lib/countries";
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

const MOCK_LEADERBOARD: MockLeaderboardEntry[] = [
  { rank: 1, username: "cubegod99", firstName: "Max", lastName: "Chen", country: "US", profilePictureUrl: null, average: "7.23", isSelf: false, solves: [{ timeMs: 6890, penalty: null }, { timeMs: 7450, penalty: null }, { timeMs: 7120, penalty: null }, { timeMs: 8010, penalty: null }, { timeMs: 7110, penalty: null }] },
  { rank: 2, username: "speedyfingers", firstName: "Yuki", lastName: "Tanaka", country: "JP", profilePictureUrl: null, average: "8.41", isSelf: false, solves: [{ timeMs: 8120, penalty: null }, { timeMs: 9230, penalty: null }, { timeMs: 7890, penalty: null }, { timeMs: 8540, penalty: null }, { timeMs: 8560, penalty: null }] },
  { rank: 3, username: "713dream", firstName: "ishaan", lastName: "agrawal", country: "US", profilePictureUrl: null, average: "9.87", isSelf: true, solves: [{ timeMs: 9230, penalty: null }, { timeMs: 8410, penalty: null }, { timeMs: 11540, penalty: null }, { timeMs: 7890, penalty: null }, { timeMs: 10120, penalty: null }] },
  { rank: 4, username: "cubemaster", firstName: "Lena", lastName: "Schmidt", country: "DE", profilePictureUrl: null, average: "10.12", isSelf: false, solves: [{ timeMs: 10340, penalty: null }, { timeMs: 9870, penalty: null }, { timeMs: 10150, penalty: null }, { timeMs: 11230, penalty: null }, { timeMs: 8920, penalty: null }] },
  { rank: 5, username: "rubiksfan", firstName: "Carlos", lastName: "Rivera", country: "MX", profilePictureUrl: null, average: "11.54", isSelf: false, solves: [{ timeMs: 12340, penalty: null }, { timeMs: 10890, penalty: null }, { timeMs: 11420, penalty: null }, { timeMs: 13010, penalty: null }, { timeMs: 10560, penalty: "+2" }] },
  { rank: 6, username: "puzzle_pro", firstName: "Emma", lastName: "Lee", country: "KR", profilePictureUrl: null, average: "12.03", isSelf: false, solves: [{ timeMs: 11560, penalty: null }, { timeMs: 12340, penalty: null }, { timeMs: 12190, penalty: null }, { timeMs: 13450, penalty: null }, { timeMs: 10230, penalty: null }] },
  { rank: 7, username: "twistandturn", firstName: "Ollie", lastName: "Brown", country: "GB", profilePictureUrl: null, average: "12.89", isSelf: false, solves: [{ timeMs: 12340, penalty: null }, { timeMs: 13560, penalty: null }, { timeMs: 12780, penalty: null }, { timeMs: 11230, penalty: null }, { timeMs: 0, penalty: "dnf" }] },
  { rank: 8, username: "algmaster", firstName: "Sophie", lastName: "Martin", country: "FR", profilePictureUrl: null, average: "13.21", isSelf: false, solves: [{ timeMs: 13450, penalty: null }, { timeMs: 12890, penalty: null }, { timeMs: 13320, penalty: null }, { timeMs: 14560, penalty: null }, { timeMs: 12120, penalty: null }] },
];

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
  if (rank === 1) return <span className="text-xl" suppressHydrationWarning>🥇</span>;
  if (rank === 2) return <span className="text-xl" suppressHydrationWarning>🥈</span>;
  if (rank === 3) return <span className="text-xl" suppressHydrationWarning>🥉</span>;
  return <span className="text-sm font-bold text-muted-foreground">{rank}</span>;
};

// Mock tournament number (will be computed from DB later).
const TOURNAMENT_NUMBER = 47;

// --- Main Page ---

export default function TourneyPage() {
  const [tab, setTab] = useState<Tab>("compete");
  const [leaderboardDate, setLeaderboardDate] = useState(() => getTournamentDate());
  // null = overview, CubeEvent = drilling into that event's full table
  const [selectedLeaderboardEvent, setSelectedLeaderboardEvent] = useState<CubeEvent | null>(null);
  const [countdown, setCountdown] = useState("");

  const todayDate = getTournamentDate();
  const isToday = leaderboardDate === todayDate;

  const navigateDate = (direction: "prev" | "next") => {
    const d = new Date(leaderboardDate + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() + (direction === "prev" ? -1 : 1));
    setLeaderboardDate(d.toISOString().slice(0, 10));
    setSelectedLeaderboardEvent(null); // go back to overview on date change
  };

  const displayDate = new Date(leaderboardDate + "T12:00:00Z").toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });

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
          <h1 className="text-3xl font-extrabold">Daily Contest {TOURNAMENT_NUMBER}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            <span className="font-mono font-bold">{countdown}</span> remaining
          </p>

          {/* Tabs */}
          <div className="flex gap-1 mt-4 border-b border-border">
            <button
              className={`px-4 py-2 text-sm font-bold transition-colors relative ${
                tab === "compete" ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => { setTab("compete"); setSelectedLeaderboardEvent(null); }}
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
          ) : selectedLeaderboardEvent ? (
            <EventLeaderboardDetail
              event={selectedLeaderboardEvent}
              displayDate={displayDate}
              isToday={isToday}
              onBack={() => setSelectedLeaderboardEvent(null)}
              navigateDate={navigateDate}
              leaderboardDate={leaderboardDate}
              todayDate={todayDate}
            />
          ) : (
            <LeaderboardOverview
              displayDate={displayDate}
              isToday={isToday}
              navigateDate={navigateDate}
              leaderboardDate={leaderboardDate}
              todayDate={todayDate}
              onSelectEvent={setSelectedLeaderboardEvent}
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

      {status === "in-progress" && (
        <div className="flex items-center gap-2 text-yellow-500">
          <Play className="w-3.5 h-3.5" />
          <span className="text-xs font-semibold">Continue ({completedSolves}/{totalSolves})</span>
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
  displayDate, isToday, navigateDate, leaderboardDate, todayDate, onSelectEvent,
}: {
  displayDate: string;
  isToday: boolean;
  navigateDate: (dir: "prev" | "next") => void;
  leaderboardDate: string;
  todayDate: string;
  onSelectEvent: (event: CubeEvent) => void;
}) {
  return (
    <div className="space-y-6">
      {/* Date navigation */}
      <div className="flex items-center justify-end gap-2">
        <button onClick={() => navigateDate("prev")} className="p-1 rounded-md hover:bg-muted transition-colors">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-semibold min-w-[10rem] text-center">
          {isToday ? `Today — ${displayDate}` : displayDate}
        </span>
        <button
          onClick={() => navigateDate("next")}
          disabled={leaderboardDate >= todayDate}
          className="p-1 rounded-md hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

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
                      <tr className="bg-yellow-500/10 border-b-2 border-yellow-500/30">
                        <td className="px-4 py-2.5 w-10 text-center text-sm font-bold text-yellow-500">
                          {selfEntry.rank}
                        </td>
                        <td className="py-2.5">
                          <span className="font-bold text-yellow-500">You</span>
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
                        className={rowIdx % 2 === 1 ? "bg-muted/20" : ""}
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
  event, onBack, displayDate, isToday, navigateDate, leaderboardDate, todayDate,
}: {
  event: CubeEvent;
  onBack: () => void;
  displayDate: string;
  isToday: boolean;
  navigateDate: (dir: "prev" | "next") => void;
  leaderboardDate: string;
  todayDate: string;
}) {
  const eventConfig = EVENT_MAP[event];
  const solveCount = eventConfig.tournamentSolveCount;
  const isAo5 = solveCount === 5;

  return (
    <div className="space-y-4">
      {/* Back button + event name + date nav */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-1.5 rounded-md hover:bg-muted transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <EventIcon event={eventConfig} size={24} />
          <span className="font-extrabold text-lg">{eventConfig.name}</span>
          <span className="text-xs font-bold text-muted-foreground">
            {isAo5 ? "Ao5" : "Mo3"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => navigateDate("prev")} className="p-1 rounded-md hover:bg-muted transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-semibold min-w-[10rem] text-center">
            {isToday ? `Today — ${displayDate}` : displayDate}
          </span>
          <button
            onClick={() => navigateDate("next")}
            disabled={leaderboardDate >= todayDate}
            className="p-1 rounded-md hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
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
              const selfEntry = MOCK_LEADERBOARD.find((e) => e.isSelf);
              if (!selfEntry) return null;
              const { bestIdx, worstIdx } = getBestWorst(selfEntry.solves);
              return (
                <tr className="bg-yellow-500/10 border-b-2 border-yellow-500/30">
                  <td className="px-4 py-3 text-center text-sm font-bold text-yellow-500">
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
                      <span className="font-bold text-yellow-500">You</span>
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

            {MOCK_LEADERBOARD.map((entry, rowIdx) => {
              const { bestIdx, worstIdx } = getBestWorst(entry.solves);
              return (
                <tr
                  key={entry.rank}
                  className={rowIdx % 2 === 1 ? "bg-muted/20" : ""}
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
    </div>
  );
}
