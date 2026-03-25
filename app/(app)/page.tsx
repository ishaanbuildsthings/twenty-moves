"use client";

import confetti from "canvas-confetti";
import { useCallback, useEffect, useRef, useState } from "react";
import { getScramble } from "./actions";
import {
  addSolve,
  clearSolves,
  deleteSolve,
  getRecentSolves,
  getStats,
  updateSolve,
  type Solve,
  type Penalty,
} from "./db";
import { CubeEvent, EVENT_CONFIGS, EVENT_MAP, type EventConfig } from "@/lib/cubing/events";
import { effectiveTime, type EventStats } from "@/lib/cubing/stats";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { X, Copy, Trash2 } from "lucide-react";

type TimerState = "idle" | "ready" | "running" | "stopped";

function formatTime(ms: number): string {
  if (ms === Infinity) return "DNF";
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const centiseconds = Math.floor((ms % 1000) / 10);

  if (minutes > 0) {
    return `${minutes}:${String(seconds).padStart(2, "0")}.${String(centiseconds).padStart(2, "0")}`;
  }
  return `${seconds}.${String(centiseconds).padStart(2, "0")}`;
}

function formatSolveTime(solve: Solve): string {
  if (solve.penalty === "dnf") return "DNF";
  const time = formatTime(
    solve.penalty === "+2" ? solve.timeMs + 2000 : solve.timeMs
  );
  return solve.penalty === "+2" ? `${time}+` : time;
}

export default function TimerPage() {
  const [selectedEvent, setSelectedEvent] = useState<CubeEvent>(CubeEvent.THREE);
  const [state, setState] = useState<TimerState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [scramble, setScramble] = useState<string | null>(null);
  const [solves, setSolves] = useState<Solve[]>([]);
  const [stats, setStats] = useState<EventStats | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const scrambleRef = useRef<string | null>(null);
  const solvesRef = useRef<Solve[]>([]);
  const selectedEventRef = useRef<CubeEvent>(selectedEvent);

  // Load solves and scramble when event changes.
  useEffect(() => {
    selectedEventRef.current = selectedEvent;
    getScramble(selectedEvent).then(setScramble);
    getRecentSolves(selectedEvent).then(setSolves);
    getStats(selectedEvent).then(setStats);
  }, [selectedEvent]);

  useEffect(() => {
    scrambleRef.current = scramble;
  }, [scramble]);

  useEffect(() => {
    solvesRef.current = solves;
  }, [solves]);

  const tick = useCallback(() => {
    if (startTimeRef.current !== null) {
      setElapsed(Date.now() - startTimeRef.current);
      rafRef.current = requestAnimationFrame(tick);
    }
  }, []);

  const startTimer = useCallback(() => {
    startTimeRef.current = Date.now();
    setElapsed(0);
    setState("running");
    rafRef.current = requestAnimationFrame(tick);
  }, [tick]);

  const stopTimer = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    const finalTime =
      startTimeRef.current !== null
        ? Date.now() - startTimeRef.current
        : elapsed;
    if (startTimeRef.current !== null) {
      setElapsed(finalTime);
      startTimeRef.current = null;
    }
    setState("stopped");

    const event = selectedEventRef.current;
    getScramble(event).then(setScramble);

    const prevBest =
      solvesRef.current.length > 0
        ? Math.min(...solvesRef.current.map((s) => effectiveTime(s)))
        : Infinity;
    if (finalTime < prevBest) {
      confetti({ particleCount: 120, spread: 80, origin: { y: 0.5 } });
    }

    const usedScramble = scrambleRef.current ?? "";
    addSolve(event, finalTime, usedScramble).then(({ solve, stats: newStats }) => {
      setSolves((prev) => [solve, ...prev]);
      setStats(newStats);
    });
  }, [elapsed]);

  const handlePenalty = async (id: number, penalty: Penalty) => {
    const { solve, stats: newStats } = await updateSolve(id, { penalty });
    setSolves((prev) => prev.map((s) => (s.id === id ? solve : s)));
    setStats(newStats);
  };

  const handleDelete = async (id: number) => {
    const { stats: newStats } = await deleteSolve(id);
    setSolves((prev) => prev.filter((s) => s.id !== id));
    setStats(newStats);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      e.preventDefault();
      if (state === "running") {
        stopTimer();
      } else if (state === "stopped") {
        setState("idle");
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      e.preventDefault();
      if (state === "idle") {
        startTimer();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [state, startTimer, stopTimer]);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const hint =
    state === "running"
      ? "Press spacebar to stop"
      : "Release spacebar to start";

  const eventConfig = EVENT_MAP[selectedEvent];

  return (
    <div className="flex flex-1 overflow-hidden select-none">
      {/* Timer area */}
      <div className="flex flex-col flex-1 items-center justify-center gap-6">
        {/* Event selector */}
        <div className="flex flex-wrap justify-center gap-1 px-4">
          {EVENT_CONFIGS.map((meta) => (
            <button
              key={meta.id}
              onClick={() => setSelectedEvent(meta.id)}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                selectedEvent === meta.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {meta.name}
            </button>
          ))}
        </div>

        <p className="font-mono text-center text-lg max-w-xl px-4 min-h-[1.75rem]">
          {scramble ?? ""}
        </p>
        <p
          className="font-mono tabular-nums"
          style={{ fontSize: "clamp(3rem, 15vw, 8rem)" }}
        >
          {formatTime(elapsed)}
        </p>
        <p className="text-zinc-500 text-sm">{hint}</p>
      </div>

      {/* Right panel — stats + solves list */}
      <aside className="w-56 shrink-0 border-l border-zinc-200 dark:border-zinc-800 flex flex-col">
        {/* Best stats */}
        {stats && (
          <div className="px-3 py-2 border-b border-zinc-200 dark:border-zinc-800 space-y-1">
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
              Best
            </p>
            {eventConfig.stats.includes("single") && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Single</span>
                <span className="font-mono tabular-nums">{stats.bestSingle !== null ? formatTime(stats.bestSingle) : "-"}</span>
              </div>
            )}
            {eventConfig.stats.includes("mo3") && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Mo3</span>
                <span className="font-mono tabular-nums">{stats.bestMo3 !== null ? formatTime(stats.bestMo3) : "-"}</span>
              </div>
            )}
            {eventConfig.stats.includes("ao5") && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Ao5</span>
                <span className="font-mono tabular-nums">{stats.bestAo5 !== null ? formatTime(stats.bestAo5) : "-"}</span>
              </div>
            )}
            {eventConfig.stats.includes("ao12") && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Ao12</span>
                <span className="font-mono tabular-nums">{stats.bestAo12 !== null ? formatTime(stats.bestAo12) : "-"}</span>
              </div>
            )}
            {eventConfig.stats.includes("ao100") && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Ao100</span>
                <span className="font-mono tabular-nums">{stats.bestAo100 !== null ? formatTime(stats.bestAo100) : "-"}</span>
              </div>
            )}
          </div>
        )}
        <p className="px-3 py-2 text-xs font-semibold text-zinc-400 uppercase tracking-wider border-b border-zinc-200 dark:border-zinc-800">
          Solves
        </p>
        <ul className="flex-1 overflow-y-auto min-h-0">
          {solves.map((solve, i) => (
            <Popover key={solve.id}>
              <PopoverTrigger render={<li />} nativeButton={false} className="flex items-center justify-between px-3 py-1.5 text-sm border-b border-zinc-100 dark:border-zinc-800/60 cursor-pointer hover:bg-muted transition-colors w-full">
                  <span className="text-zinc-400 tabular-nums w-6 shrink-0">
                    {solves.length - i}
                  </span>
                  <span className="font-mono tabular-nums">
                    {formatSolveTime(solve)}
                  </span>
              </PopoverTrigger>
              <PopoverContent side="left" align="start" className="w-64 p-3 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-mono text-xs text-muted-foreground break-all leading-relaxed flex-1">
                    {solve.scramble}
                  </p>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                      onClick={() => navigator.clipboard.writeText(solve.scramble)}
                      title="Copy scramble"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <PopoverTrigger render={<button />} className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground" title="Close">
                      <X className="w-3.5 h-3.5" />
                    </PopoverTrigger>
                  </div>
                </div>

                {/* Penalty toggle */}
                <div className="flex items-center gap-1">
                  <button
                    className={`flex-1 text-xs py-1.5 rounded transition-colors ${
                      solve.penalty === null
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted text-muted-foreground"
                    }`}
                    onClick={() => handlePenalty(solve.id, null)}
                  >
                    OK
                  </button>
                  <button
                    className={`flex-1 text-xs py-1.5 rounded transition-colors ${
                      solve.penalty === "+2"
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted text-muted-foreground"
                    }`}
                    onClick={() => handlePenalty(solve.id, "+2")}
                  >
                    +2
                  </button>
                  <button
                    className={`flex-1 text-xs py-1.5 rounded transition-colors ${
                      solve.penalty === "dnf"
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted text-muted-foreground"
                    }`}
                    onClick={() => handlePenalty(solve.id, "dnf")}
                  >
                    DNF
                  </button>
                </div>

                {/* Delete */}
                <button
                  className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-600 transition-colors"
                  onClick={() => handleDelete(solve.id)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete
                </button>
              </PopoverContent>
            </Popover>
          ))}
        </ul>
        <div className="p-2 border-t border-zinc-200 dark:border-zinc-800">
          <button
            className="w-full text-xs text-zinc-400 hover:text-red-500 py-1 transition-colors"
            onClick={() =>
              clearSolves(selectedEvent).then((newStats) => {
                setSolves([]);
                setStats(newStats);
              })
            }
          >
            Reset
          </button>
        </div>
      </aside>
    </div>
  );
}
