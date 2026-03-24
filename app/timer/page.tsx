"use client";

import confetti from "canvas-confetti";
import { useCallback, useEffect, useRef, useState } from "react";
import { formatSolveTime, formatTime } from "./timer-utils";
import { getScramble } from "./actions";
import { addSolve, clearSolves, getAllSolves, updateSolvePenalty, type Solve } from "./db";
import type { PenaltyType } from "./types";

type TimerState = "idle" | "ready" | "running" | "stopped";

export default function TimerPage() {
  const [state, setState] = useState<TimerState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [scramble, setScramble] = useState<string | null>(null);
  const [solves, setSolves] = useState<Solve[]>([]);
  const [lastSolveId, setLastSolveId] = useState<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const scrambleRef = useRef<string | null>(null);
  const solvesRef = useRef<Solve[]>([]);

  useEffect(() => {
    getScramble().then(setScramble);
    getAllSolves().then(setSolves);
  }, []);

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
    const finalTime = startTimeRef.current !== null
      ? Date.now() - startTimeRef.current
      : elapsed;
    if (startTimeRef.current !== null) {
      setElapsed(finalTime);
      startTimeRef.current = null;
    }
    setState("stopped");
    getScramble().then(setScramble);

    const prevBest = solvesRef.current.length > 0
      ? Math.min(...solvesRef.current.map((s) => s.timeMs))
      : Infinity;
    if (finalTime < prevBest) {
      confetti({ particleCount: 120, spread: 80, origin: { y: 0.5 } });
    }

    const usedScramble = scrambleRef.current ?? "";
    addSolve(finalTime, usedScramble).then((solve) => {
      setSolves((prev) => [solve, ...prev]);
      setLastSolveId(solve.id);
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

  const applyPenalty = useCallback((penaltyType: PenaltyType) => {
    if (lastSolveId === null) return;
    const current = solvesRef.current.find((s) => s.id === lastSolveId);
    const next: PenaltyType = current?.penaltyType === penaltyType ? null : penaltyType;
    updateSolvePenalty(lastSolveId, next).then(() => {
      setSolves((prev) =>
        prev.map((s) => s.id === lastSolveId ? { ...s, penaltyType: next } : s)
      );
    });
  }, [lastSolveId]);

  const hint =
    state === "running"
      ? "Press spacebar to stop"
      : "Release spacebar to start";

  return (
    <div className="flex flex-1 overflow-hidden select-none">
      {/* Left panel */}
      <aside className="w-48 shrink-0 border-r border-zinc-200 dark:border-zinc-800 flex flex-col">
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
              <span className="font-mono tabular-nums">{formatSolveTime(solve)}</span>
            </li>
          ))}
        </ul>
        <div className="p-2 border-t border-zinc-200 dark:border-zinc-800">
          <button
            className="w-full text-xs text-zinc-400 hover:text-red-500 py-1 transition-colors"
            onClick={() => clearSolves().then(() => setSolves([]))}
          >
            Reset
          </button>
        </div>
      </aside>

      {/* Timer area */}
      <div className="flex flex-col flex-1 items-center justify-center gap-6">
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
        {state === "stopped" && (() => {
          const penalty = solves.find((s) => s.id === lastSolveId)?.penaltyType ?? null;
          return (
            <div className="flex gap-2">
              <button
                className={`px-3 py-1 text-sm rounded border transition-colors ${penalty === "plustwo" ? "border-yellow-400 text-yellow-500" : "border-zinc-300 dark:border-zinc-700 hover:border-yellow-400 hover:text-yellow-500"}`}
                onClick={() => applyPenalty("plustwo")}
              >
                +2
              </button>
              <button
                className={`px-3 py-1 text-sm rounded border transition-colors ${penalty === "dnf" ? "border-red-400 text-red-500" : "border-zinc-300 dark:border-zinc-700 hover:border-red-400 hover:text-red-500"}`}
                onClick={() => applyPenalty("dnf")}
              >
                DNF
              </button>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
