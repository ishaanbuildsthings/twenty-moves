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
import { X, Copy, Check, Trash2, ChevronDown, Settings } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  const [confirmClear, setConfirmClear] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const startTimeRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const scrambleRef = useRef<string | null>(null);
  const solvesRef = useRef<Solve[]>([]);
  const selectedEventRef = useRef<CubeEvent>(selectedEvent);

  // Load solves and scramble when event changes.
  useEffect(() => {
    selectedEventRef.current = selectedEvent;
    setConfirmClear(false);
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
    <div className="flex flex-col flex-1 overflow-hidden select-none">
      {/* Event selector — top bar */}
      <div className="flex items-center px-4 py-2 border-b border-border">
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-muted transition-colors">
            <span className={`cubing-icon ${eventConfig.iconClass} text-lg`} />
            <span className="font-bold">{eventConfig.name}</span>
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            {EVENT_CONFIGS.map((meta) => (
              <DropdownMenuItem
                key={meta.id}
                onClick={() => setSelectedEvent(meta.id)}
                className={selectedEvent === meta.id ? "bg-accent" : ""}
              >
                <span className={`cubing-icon ${meta.iconClass} text-base`} />
                <span>{meta.name}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <button
          className="ml-auto p-2 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          title="Timer settings"
          onClick={() => setSettingsOpen(true)}
        >
          <Settings className="w-4 h-4" />
        </button>

        <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Timer Settings</DialogTitle>
              <DialogDescription>
                Configure your practice session.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 text-sm text-muted-foreground">
              No settings available yet.
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Timer area */}
      <div className="flex flex-1 overflow-hidden">
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
{/* hint removed */}
        </div>

      {/* Right panel — stats + solves list */}
      <aside className="w-56 shrink-0 border-l border-border flex flex-col bg-card">
        {/* Stats table — current & best */}
        {stats && (
          <div className="border-b border-border">
            <p className="px-3 pt-3 pb-1 text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
              <span className="text-base leading-none">📈</span> Stats
            </p>
            {/* Column headers */}
            <div className="grid grid-cols-[1fr_3.5rem_3.5rem] gap-x-3 px-3 pb-1">
              <span />
              <span className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-widest text-right">Current</span>
              <span className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-widest text-right">Best</span>
            </div>
            {/* Stat rows */}
            <div className="space-y-1.5 px-3 pb-3">
              {eventConfig.stats.includes("single") && (
                <div className="grid grid-cols-[1fr_3.5rem_3.5rem] gap-x-3 items-center">
                  <span className="text-xs font-semibold text-muted-foreground">Single</span>
                  <span className="font-mono tabular-nums text-sm font-bold text-right">
                    {solves.length > 0 ? formatSolveTime(solves[0]) : "-"}
                  </span>
                  <span className="font-mono tabular-nums text-sm font-bold text-right">
                    {stats.bestSingle !== null ? formatTime(stats.bestSingle) : "-"}
                  </span>
                </div>
              )}
              {eventConfig.stats.includes("mo3") && (
                <div className="grid grid-cols-[1fr_3.5rem_3.5rem] gap-x-3 items-center">
                  <span className="text-xs font-semibold text-muted-foreground">Mo3</span>
                  <span className="font-mono tabular-nums text-sm font-bold text-right">
                    {stats.currentMo3 !== null ? formatTime(stats.currentMo3) : "-"}
                  </span>
                  <span className="font-mono tabular-nums text-sm font-bold text-right">
                    {stats.bestMo3 !== null ? formatTime(stats.bestMo3) : "-"}
                  </span>
                </div>
              )}
              {eventConfig.stats.includes("ao5") && (
                <div className="grid grid-cols-[1fr_3.5rem_3.5rem] gap-x-3 items-center">
                  <span className="text-xs font-semibold text-muted-foreground">Ao5</span>
                  <span className="font-mono tabular-nums text-sm font-bold text-right">
                    {stats.currentAo5 !== null ? formatTime(stats.currentAo5) : "-"}
                  </span>
                  <span className="font-mono tabular-nums text-sm font-bold text-right">
                    {stats.bestAo5 !== null ? formatTime(stats.bestAo5) : "-"}
                  </span>
                </div>
              )}
              {eventConfig.stats.includes("ao12") && (
                <div className="grid grid-cols-[1fr_3.5rem_3.5rem] gap-x-3 items-center">
                  <span className="text-xs font-semibold text-muted-foreground">Ao12</span>
                  <span className="font-mono tabular-nums text-sm font-bold text-right">
                    {stats.currentAo12 !== null ? formatTime(stats.currentAo12) : "-"}
                  </span>
                  <span className="font-mono tabular-nums text-sm font-bold text-right">
                    {stats.bestAo12 !== null ? formatTime(stats.bestAo12) : "-"}
                  </span>
                </div>
              )}
              {eventConfig.stats.includes("ao100") && (
                <div className="grid grid-cols-[1fr_3.5rem_3.5rem] gap-x-3 items-center">
                  <span className="text-xs font-semibold text-muted-foreground">Ao100</span>
                  <span className="font-mono tabular-nums text-sm font-bold text-right">
                    {stats.currentAo100 !== null ? formatTime(stats.currentAo100) : "-"}
                  </span>
                  <span className="font-mono tabular-nums text-sm font-bold text-right">
                    {stats.bestAo100 !== null ? formatTime(stats.bestAo100) : "-"}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
        <p className="px-3 py-2 text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest border-b border-border flex items-center gap-1.5">
          <span className="text-base leading-none">⏱️</span> Solves
        </p>
        <ul className="flex-1 overflow-y-auto min-h-0">
          {solves.map((solve, i) => (
            <Popover key={solve.id}>
              <PopoverTrigger render={<li />} nativeButton={false} className="flex items-center justify-between px-3 py-2 text-sm border-b border-border/40 cursor-pointer hover:bg-muted transition-colors w-full">
                  <span className="text-muted-foreground tabular-nums text-xs w-6 shrink-0">
                    {solves.length - i}
                  </span>
                  <span className="font-mono tabular-nums font-semibold">
                    {formatSolveTime(solve)}
                  </span>
              </PopoverTrigger>
              <PopoverContent side="left" align="center" className="w-72 p-4 space-y-3">
                {/* Time + delete */}
                <div className="flex items-center justify-between">
                  <span className="font-mono tabular-nums text-lg font-bold">
                    {formatSolveTime(solve)}
                  </span>
                  <button
                    className="p-1.5 rounded-md hover:bg-red-500/10 transition-colors text-muted-foreground hover:text-red-400"
                    onClick={() => handleDelete(solve.id)}
                    title="Delete solve"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Scramble */}
                <div className="flex items-start justify-between gap-2">
                  <p className="font-mono text-xs text-muted-foreground leading-relaxed">
                    {solve.scramble}
                  </p>
                  <button
                    className={`p-1 rounded-md transition-colors shrink-0 ${
                      copiedId === solve.id
                        ? "text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                    onClick={() => {
                      navigator.clipboard.writeText(solve.scramble);
                      setCopiedId(solve.id);
                      setTimeout(() => setCopiedId(null), 1500);
                    }}
                    title="Copy scramble"
                  >
                    {copiedId === solve.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>

                {/* Penalty toggle */}
                <div className="flex items-center gap-1 rounded-lg bg-muted/50 p-1">
                  {([null, "+2", "dnf"] as const).map((p) => (
                    <button
                      key={p ?? "ok"}
                      className={`flex-1 text-xs font-semibold py-1.5 rounded-md transition-colors ${
                        solve.penalty === p
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                      onClick={() => handlePenalty(solve.id, p)}
                    >
                      {p === null ? "None" : p === "+2" ? "+2" : "DNF"}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          ))}
        </ul>
        <div className="p-2 border-t border-border flex justify-center">
          {confirmClear ? (
            <div className="flex items-center gap-2">
              <button
                className="text-xs text-red-500 font-semibold py-1 px-3 rounded-md bg-red-500/10 hover:bg-red-500/20 transition-colors"
                onClick={() => {
                  clearSolves(selectedEvent).then((newStats) => {
                    setSolves([]);
                    setStats(newStats);
                    setConfirmClear(false);
                  });
                }}
              >
                Confirm
              </button>
              <button
                className="text-xs text-muted-foreground py-1 px-3 rounded-md hover:bg-muted transition-colors"
                onClick={() => setConfirmClear(false)}
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-red-500 py-1 px-3 rounded-md hover:bg-red-500/10 transition-colors"
              onClick={() => setConfirmClear(true)}
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear session
            </button>
          )}
        </div>
      </aside>
      </div>
    </div>
  );
}
