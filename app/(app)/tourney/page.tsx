"use client";

import { useState, useEffect } from "react";
import { CubeEvent, EVENT_CONFIGS, EVENT_MAP } from "@/lib/cubing/events";
import { EventIcon } from "@/lib/components/event-icon";
import { ChevronDown, Play } from "lucide-react";
import { countryCodeToFlag } from "@/lib/countries";
import { getNextRollover } from "@/lib/tournament/date";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Tab = "compete" | "leaderboard";

// Mock entry data — will be replaced with real API data.
interface MockEntry {
  status: "not-started" | "in-progress" | "completed";
  solves: { timeMs: number; penalty: string | null }[];
  average: string | null;
  totalSolves: number;
}

// Mock different states for demo purposes.
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

const MOCK_LEADERBOARD = [
  { rank: 1, username: "cubegod99", firstName: "Max", lastName: "Chen", country: "US", profilePictureUrl: null, average: "7.23", isSelf: false, solves: [{ timeMs: 6890, penalty: null }, { timeMs: 7450, penalty: null }, { timeMs: 7120, penalty: null }, { timeMs: 8010, penalty: null }, { timeMs: 7110, penalty: null }] },
  { rank: 2, username: "speedyfingers", firstName: "Yuki", lastName: "Tanaka", country: "JP", profilePictureUrl: null, average: "8.41", isSelf: false, solves: [{ timeMs: 8120, penalty: null }, { timeMs: 9230, penalty: null }, { timeMs: 7890, penalty: null }, { timeMs: 8540, penalty: null }, { timeMs: 8560, penalty: null }] },
  { rank: 3, username: "713dream", firstName: "ishaan", lastName: "agrawal", country: "US", profilePictureUrl: null, average: "9.87", isSelf: true, solves: [{ timeMs: 9230, penalty: null }, { timeMs: 8410, penalty: null }, { timeMs: 11540, penalty: null }, { timeMs: 7890, penalty: null }, { timeMs: 10120, penalty: null }] },
  { rank: 4, username: "cubemaster", firstName: "Lena", lastName: "Schmidt", country: "DE", profilePictureUrl: null, average: "10.12", isSelf: false, solves: [{ timeMs: 10340, penalty: null }, { timeMs: 9870, penalty: null }, { timeMs: 10150, penalty: null }, { timeMs: 11230, penalty: null }, { timeMs: 8920, penalty: null }] },
  { rank: 5, username: "rubiksfan", firstName: "Carlos", lastName: "Rivera", country: "MX", profilePictureUrl: null, average: "11.54", isSelf: false, solves: [{ timeMs: 12340, penalty: null }, { timeMs: 10890, penalty: null }, { timeMs: 11420, penalty: null }, { timeMs: 13010, penalty: null }, { timeMs: 10560, penalty: "+2" }] },
  { rank: 6, username: "puzzle_pro", firstName: "Emma", lastName: "Lee", country: "KR", profilePictureUrl: null, average: "12.03", isSelf: false, solves: [{ timeMs: 11560, penalty: null }, { timeMs: 12340, penalty: null }, { timeMs: 12190, penalty: null }, { timeMs: 13450, penalty: null }, { timeMs: 10230, penalty: null }] },
  { rank: 7, username: "twistandturn", firstName: "Ollie", lastName: "Brown", country: "GB", profilePictureUrl: null, average: "12.89", isSelf: false, solves: [{ timeMs: 12340, penalty: null }, { timeMs: 13560, penalty: null }, { timeMs: 12780, penalty: null }, { timeMs: 11230, penalty: null }, { timeMs: 0, penalty: "dnf" }] },
  { rank: 8, username: "algmaster", firstName: "Sophie", lastName: "Martin", country: "FR", profilePictureUrl: null, average: "13.21", isSelf: false, solves: [{ timeMs: 13450, penalty: null }, { timeMs: 12890, penalty: null }, { timeMs: 13320, penalty: null }, { timeMs: 14560, penalty: null }, { timeMs: 12120, penalty: null }] },
];

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

export default function TourneyPage() {
  const [tab, setTab] = useState<Tab>("compete");
  const [leaderboardEvent, setLeaderboardEvent] = useState<CubeEvent>(CubeEvent.THREE);
  const [countdown, setCountdown] = useState("");

  // Live countdown to tournament end.
  useEffect(() => {
    const update = () => {
      const remaining = getNextRollover().getTime() - Date.now();
      setCountdown(formatCountdown(remaining));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  const eventConfig = EVENT_MAP[leaderboardEvent];

  return (
    <div className="flex flex-col flex-1 overflow-y-auto">
      {/* Header + tabs */}
      <div className="px-6 pt-6 pb-0">
        <div className="max-w-3xl mx-auto w-full">
          <h1 className="text-2xl font-extrabold">Daily Tournament</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Compete against everyone. Same scrambles, same day.
          </p>

          {/* Tabs — page-level navigation */}
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
        <div className="max-w-3xl mx-auto w-full space-y-6">
          {tab === "compete" ? (
            <>
              {/* Countdown */}
              <div className="rounded-lg bg-card border border-border p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Tournament ends in
                  </p>
                  <p className="text-2xl font-extrabold font-mono tabular-nums mt-1">
                    {countdown}
                  </p>
                </div>
                <span className="text-3xl" suppressHydrationWarning>🏆</span>
              </div>

              {/* Event grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {EVENT_CONFIGS.map((config) => {
                  const entry = MOCK_ENTRIES[config.id];
                  return (
                    <EventCard key={config.id} config={config} entry={entry} />
                  );
                })}
              </div>
            </>
          ) : (
            <div className="space-y-4">
              {/* Event selector */}
              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-2 px-3 py-2 rounded-md bg-card border border-border hover:bg-muted transition-colors">
                  <EventIcon event={eventConfig} size={20} />
                  <span className="font-bold text-sm">{eventConfig.name}</span>
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-48">
                  {EVENT_CONFIGS.map((config) => (
                    <DropdownMenuItem
                      key={config.id}
                      onClick={() => setLeaderboardEvent(config.id)}
                      className={leaderboardEvent === config.id ? "bg-accent" : ""}
                    >
                      <EventIcon event={config} size={16} />
                      <span>{config.name}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Leaderboard table */}
              {(() => {
                const solveCount = eventConfig.tournamentSolveCount;
                const isAo5 = solveCount === 5;

                // Identify best/worst indices for ao5 formatting.
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

                return (
                  <div className="rounded-lg bg-card border border-border overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-xs font-bold text-muted-foreground uppercase tracking-wider">
                          <th className="px-3 py-2 text-left w-10">#</th>
                          <th className="px-3 py-2 text-left">Player</th>
                          {Array.from({ length: solveCount }).map((_, i) => (
                            <th key={i} className="px-2 py-2 text-right w-16">S{i + 1}</th>
                          ))}
                          <th className="px-3 py-2 text-right w-16 border-l border-border">{isAo5 ? "Ao5" : "Mo3"}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {MOCK_LEADERBOARD.map((entry) => {
                          const { bestIdx, worstIdx } = getBestWorst(entry.solves);
                          return (
                            <tr
                              key={entry.rank}
                              className={`border-b border-border/40 last:border-0 ${
                                entry.isSelf ? "bg-primary/5" : ""
                              }`}
                            >
                              <td className={`px-3 py-3 font-bold ${
                                entry.rank === 1 ? "text-yellow-500" :
                                entry.rank === 2 ? "text-zinc-400" :
                                entry.rank === 3 ? "text-amber-700" :
                                "text-muted-foreground"
                              }`}>
                                {entry.rank}
                              </td>
                              <td className="px-3 py-3">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className={`font-semibold truncate ${entry.isSelf ? "text-primary" : ""}`}>
                                    {entry.username}
                                  </span>
                                  {entry.country && (
                                    <span className="text-sm">{countryCodeToFlag(entry.country)}</span>
                                  )}
                                </div>
                              </td>
                              {entry.solves.map((solve, i) => {
                                const isBestOrWorst = isAo5 && (i === bestIdx || i === worstIdx);
                                const display = formatSolveTime(solve);
                                return (
                                  <td key={i} className="px-2 py-3 text-right font-mono tabular-nums ">
                                    {isBestOrWorst ? `(${display})` : display}
                                  </td>
                                );
                              })}
                              <td className="px-3 py-3 text-right font-mono tabular-nums font-bold border-l border-border">
                                {entry.average}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Format a solve time, applying +2 penalty if needed.
function formatSolveTime(solve: { timeMs: number; penalty: string | null }): string {
  if (solve.penalty === "dnf") return "DNF";
  const time = formatTime(solve.penalty === "+2" ? solve.timeMs + 2000 : solve.timeMs);
  return solve.penalty === "+2" ? `${time}+` : time;
}

// For ao5: parenthesize the best and worst times (WCA convention).
function formatAo5Times(solves: { timeMs: number; penalty: string | null }[]): string {
  if (solves.length !== 5) return solves.map(formatSolveTime).join("  ");

  const effectiveTimes = solves.map((s) => {
    if (s.penalty === "dnf") return Infinity;
    return s.penalty === "+2" ? s.timeMs + 2000 : s.timeMs;
  });

  let bestIdx = 0;
  let worstIdx = 0;
  effectiveTimes.forEach((t, i) => {
    if (t < effectiveTimes[bestIdx]) bestIdx = i;
    if (t > effectiveTimes[worstIdx]) worstIdx = i;
  });

  return solves
    .map((s, i) => {
      const formatted = formatSolveTime(s);
      if (i === bestIdx || i === worstIdx) return `(${formatted})`;
      return formatted;
    })
    .join("  ");
}

function EventCard({ config, entry }: { config: typeof EVENT_CONFIGS[number]; entry?: MockEntry }) {
  const status = entry?.status ?? "not-started";
  const completedSolves = entry?.solves.length ?? 0;
  const totalSolves = config.tournamentSolveCount;
  const isAo5 = totalSolves === 5;

  return (
    <button className="rounded-lg bg-card border border-border p-4 hover:bg-muted transition-colors text-left space-y-3">
      {/* Top row: icon + event name */}
      <div className="flex items-center gap-3">
        <EventIcon event={config} size={36} />
        <span className="font-extrabold text-lg flex-1">{config.name}</span>
        <span className="text-xs font-bold text-muted-foreground">
          {isAo5 ? "Ao5" : "Mo3"}
        </span>
      </div>

      {/* Status area */}
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
          {/* Average */}
          <div className="flex items-center justify-between">
            <span className="text-base font-mono tabular-nums font-extrabold">{entry.average}</span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Done</span>
          </div>
          {/* Individual times with WCA formatting */}
          <p className="text-[11px] font-mono tabular-nums text-muted-foreground leading-relaxed">
            {isAo5 ? formatAo5Times(entry.solves) : entry.solves.map(formatSolveTime).join("  ")}
          </p>
        </div>
      )}
    </button>
  );
}
