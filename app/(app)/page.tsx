"use client";

import confetti from "canvas-confetti";
import { useCallback, useEffect, useRef, useState } from "react";
import { getScramble } from "./actions";
import {
  addSolve,
  clearSolves,
  getRecentSolves,
  getStats,
  type Solve,
} from "./db";
import { CubeEvent, EVENTS_LIST, EVENT_MAP } from "@/lib/cubing/events";
import { effectiveTime, type EventStats } from "@/lib/cubing/stats";

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
  const [selectedEvent, setSelectedEvent] = useState<CubeEvent>(CubeEvent["3x3"]);
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

  const eventMeta = EVENT_MAP[selectedEvent];

  return (
    <div className="flex flex-1 overflow-hidden select-none">
      {/* Timer area */}
      <div className="flex flex-col flex-1 items-center justify-center gap-6">
        {/* Event selector */}
        <div className="flex flex-wrap justify-center gap-1 px-4">
          {EVENTS_LIST.map((meta) => (
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

        {/* Stats display */}
        {stats && (
          <div className="flex gap-4 text-xs text-muted-foreground">
            {eventMeta.useMo3 ? (
              <>
                <span>mo3: {stats.currentMo3 !== null ? formatTime(stats.currentMo3) : "-"}</span>
                <span>best: {stats.bestSingle !== null ? formatTime(stats.bestSingle) : "-"}</span>
                <span>best mo3: {stats.bestMo3 !== null ? formatTime(stats.bestMo3) : "-"}</span>
              </>
            ) : (
              <>
                <span>ao5: {stats.currentAo5 !== null ? formatTime(stats.currentAo5) : "-"}</span>
                <span>ao12: {stats.currentAo12 !== null ? formatTime(stats.currentAo12) : "-"}</span>
                <span>ao100: {stats.currentAo100 !== null ? formatTime(stats.currentAo100) : "-"}</span>
                <span>best: {stats.bestSingle !== null ? formatTime(stats.bestSingle) : "-"}</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Right panel — solves list */}
      <aside className="w-48 shrink-0 border-l border-zinc-200 dark:border-zinc-800 flex flex-col">
        <p className="px-3 py-2 text-xs font-semibold text-zinc-400 uppercase tracking-wider border-b border-zinc-200 dark:border-zinc-800">
          Solves
        </p>
        <ul className="flex-1 overflow-y-auto min-h-0">
          {solves.map((solve, i) => (
            <li
              key={solve.id}
              className="flex items-center justify-between px-3 py-1.5 text-sm border-b border-zinc-100 dark:border-zinc-800/60"
            >
              <span className="text-zinc-400 tabular-nums w-6 shrink-0">
                {solves.length - i}
              </span>
              <span className="font-mono tabular-nums">
                {formatSolveTime(solve)}
              </span>
            </li>
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
