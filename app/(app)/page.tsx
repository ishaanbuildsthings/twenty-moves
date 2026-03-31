"use client";

import confetti from "canvas-confetti";
import { useCallback, useEffect, useRef, useState } from "react";
import { generateScramble } from "@/lib/cubing/scramble";
import {
  addSolve,
  clearSolves,
  countSolvesForEvent,
  deleteSolve,
  getRecentSolves,
  getStats,
  loadMoreSolves,
  updateSolve,
  type Solve,
  type Penalty,
} from "./idb";
import { useVirtualizer } from "@tanstack/react-virtual";
import { CubeEvent, EVENT_CONFIGS, EVENT_MAP } from "@/lib/cubing/events";
import { EventIcon } from "@/lib/components/event-icon";
import { effectiveTime, DNF_SENTINEL, type EventStats, type StatType, computeAo5, computeAo12, computeAo100, computeMo3, findBestAverageIndex } from "@/lib/cubing/stats";
import { formatTime, formatSolveTime } from "@/lib/cubing/format";
import { getPracticeStats } from "./idb";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { X, Copy, Check, Trash2, ChevronDown, Settings, PanelRightClose, PanelRightOpen, FilePen, BarChart3 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useSettings } from "@/lib/context/settings";
import { TimerSettingsDialog } from "@/lib/components/timer-settings-dialog";
import { SCRAMBLE_SIZE_CLASSES } from "@/lib/settings/timer";
import { DraftPostModal } from "@/lib/components/draft-post-modal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Window sizes for each average type.
const WINDOW_SIZES: Record<string, number> = { ao5: 5, ao12: 12, ao100: 100, mo3: 3 };

// Compute functions by stat type (for finding best window index).
const COMPUTE_FNS: Record<string, (s: import("@/lib/cubing/stats").SolveForStats[]) => number | null> = {
  ao5: computeAo5,
  ao12: computeAo12,
  ao100: computeAo100,
  mo3: computeMo3,
};

// Get the solves that make up a given stat.
function getSolvesForStat(
  solves: import("./idb").Solve[],
  stat: StatType,
  variant: "current" | "best"
): import("./idb").Solve[] {
  if (stat === "mean") {
    return [...solves];
  }

  if (stat === "single") {
    if (variant === "current") return solves.length > 0 ? [solves[0]] : [];
    // Best single — find the solve with the minimum effective time
    if (solves.length === 0) return [];
    let bestIdx = 0;
    let bestTime = effectiveTime(solves[0]);
    for (let i = 1; i < solves.length; i++) {
      const t = effectiveTime(solves[i]);
      if (t < bestTime) { bestTime = t; bestIdx = i; }
    }
    return [solves[bestIdx]];
  }

  const windowSize = WINDOW_SIZES[stat];
  if (!windowSize) return [];

  if (variant === "current") {
    return solves.slice(0, windowSize);
  }

  // Best — use findBestAverageIndex to locate the window
  const computeFn = COMPUTE_FNS[stat];
  if (!computeFn) return [];
  const startIdx = findBestAverageIndex(solves, computeFn);
  if (startIdx < 0) return [];
  return solves.slice(startIdx, startIdx + windowSize);
}

function StatDetailModal({
  detail,
  onClose,
  solves,
  accent,
}: {
  detail: { stat: StatType; variant: "current" | "best" };
  onClose: () => void;
  solves: import("./idb").Solve[];
  accent: ReturnType<typeof import("@/lib/context/settings").useSettings>["accent"];
}) {
  const windowSolves = getSolvesForStat(solves, detail.stat, detail.variant);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  const statLabels: Record<StatType, string> = {
    single: "Single",
    mo3: "Mo3",
    ao5: "Ao5",
    ao12: "Ao12",
    ao100: "Ao100",
    mean: "Mean",
  };

  const title = `${detail.variant === "best" ? "Best" : "Current"} ${statLabels[detail.stat]}`;

  // Determine which solves are trimmed (excluded from the average).
  // ao5/ao12: 1 best + 1 worst; ao100: 5 best + 5 worst; mo3: none (straight mean).
  const trimmedIndices = new Set<number>();
  const windowSize = WINDOW_SIZES[detail.stat];
  if (windowSize && detail.stat !== "mo3" && windowSolves.length >= windowSize) {
    const trimCount = detail.stat === "ao100" ? 5 : 1;
    const indexed = windowSolves.map((s, i) => ({ i, t: effectiveTime(s) }));
    const sorted = [...indexed].sort((a, b) => a.t - b.t);
    for (let j = 0; j < trimCount; j++) trimmedIndices.add(sorted[j].i);
    for (let j = sorted.length - trimCount; j < sorted.length; j++) trimmedIndices.add(sorted[j].i);
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {windowSolves.length} solve{windowSolves.length !== 1 ? "s" : ""}
          </DialogDescription>
          {windowSolves.length > 0 && (
            <button
              className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded transition-colors w-fit ${
                copiedAll
                  ? `${accent.bgSubtle} ${accent.text}`
                  : `bg-muted hover:bg-muted/80 text-muted-foreground`
              }`}
              onClick={() => {
                const text = windowSolves
                  .map((s, i) => `${i + 1}. ${formatSolveTime(s)}   ${s.scramble}`)
                  .join("\n");
                navigator.clipboard.writeText(`${title}\n\n${text}`);
                setCopiedAll(true);
                setTimeout(() => setCopiedAll(false), 1500);
              }}
            >
              {copiedAll ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {copiedAll ? "Copied" : "Copy all"}
            </button>
          )}
        </DialogHeader>
        {windowSolves.length === 0 ? (
          <p className="text-sm text-muted-foreground">Not enough solves.</p>
        ) : (
          <div className="space-y-1">
            {windowSolves.map((solve, i) => {
              const trimmed = trimmedIndices.has(i);
              return (
                <div
                  key={solve.id}
                  className="flex items-start gap-3 px-3 py-2 rounded-md"
                >
                  <span className="text-xs text-muted-foreground tabular-nums w-5 shrink-0 pt-0.5">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono tabular-nums text-sm font-bold">
                        {trimmed ? `(${formatSolveTime(solve)})` : formatSolveTime(solve)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <p className="font-mono text-[11px] text-muted-foreground/70 leading-relaxed truncate">
                        {solve.scramble}
                      </p>
                      <button
                        className={`p-0.5 rounded transition-colors shrink-0 ${
                          copiedId === solve.id
                            ? accent.text
                            : "text-muted-foreground/50 hover:text-foreground"
                        }`}
                        onClick={() => {
                          navigator.clipboard.writeText(solve.scramble);
                          setCopiedId(solve.id);
                          setTimeout(() => setCopiedId(null), 1500);
                        }}
                        title="Copy scramble"
                      >
                        {copiedId === solve.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Timer states:
// idle       — waiting for spacebar press, shows last time or 0.00
// inspecting — inspection countdown (if enabled)
// holding    — spacebar held, waiting for hold delay to pass
// ready      — hold delay met, release to start
// running    — timer is running
type TimerState = "idle" | "inspecting" | "holding" | "ready" | "running";


export default function TimerPage() {
  const { timerSettings, updateTimerSettings, accent } = useSettings();
  const [selectedEvent, setSelectedEvent] = useState<CubeEvent>(CubeEvent.THREE);
  const [state, setState] = useState<TimerState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [inspectionTime, setInspectionTime] = useState(0);
  const [scramble, setScramble] = useState<string | null>(null);
  const [solves, setSolves] = useState<Solve[]>([]);
  const [totalSolveCount, setTotalSolveCount] = useState(0);
  const [stats, setStats] = useState<EventStats | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mobileStatsOpen, setMobileStatsOpen] = useState(false);
  const [postOpen, setPostOpen] = useState(false);
  const [statDetail, setStatDetail] = useState<{ stat: StatType; variant: "current" | "best" } | null>(null);
  // Whether there are more solves in IDB beyond what's currently loaded.
  // False once a batch returns fewer results than requested.
  const [hasMore, setHasMore] = useState(true);
  // True while fetching the next batch of solves (prevents duplicate requests).
  const [loadingMore, setLoadingMore] = useState(false);
  // Ref to the scrollable <ul> container — needed by the virtualizer to
  // measure scroll position and determine which rows are visible.
  const scrollParentRef = useRef<HTMLUListElement>(null);
  const startTimeRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const holdStartRef = useRef<number | null>(null);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inspectionStartRef = useRef<number | null>(null);
  const inspectionRafRef = useRef<number | null>(null);
  const scrambleRef = useRef<string | null>(null);
  const solvesRef = useRef<Solve[]>([]);
  const selectedEventRef = useRef<CubeEvent>(selectedEvent);
  const stateRef = useRef<TimerState>(state);
  const settingsRef = useRef(timerSettings);

  // Keep refs in sync with state.
  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { settingsRef.current = timerSettings; }, [timerSettings]);

  // Load solves and scramble when event changes.
  // Clear state synchronously first to avoid stale data flash.
  useEffect(() => {
    selectedEventRef.current = selectedEvent;
    setConfirmClear(false);
    setSolves([]);
    setStats(null);
    setTotalSolveCount(0);
    setScramble(generateScramble(selectedEvent));
    setHasMore(true);
    const INITIAL_SOLVES_LOADED = 100;
    getRecentSolves(selectedEvent, INITIAL_SOLVES_LOADED).then((loaded) => {
      setSolves(loaded);
      setHasMore(loaded.length === INITIAL_SOLVES_LOADED);
    });
    countSolvesForEvent(selectedEvent).then(setTotalSolveCount);
    getStats(selectedEvent).then(setStats);
  }, [selectedEvent]);

  useEffect(() => { scrambleRef.current = scramble; }, [scramble]);
  useEffect(() => { solvesRef.current = solves; }, [solves]);

  // Animation frame tick for the running timer.
  const tick = useCallback(() => {
    if (startTimeRef.current !== null) {
      setElapsed(Date.now() - startTimeRef.current);
      rafRef.current = requestAnimationFrame(tick);
    }
  }, []);

  // Animation frame tick for inspection countdown.
  const inspectionTick = useCallback(() => {
    if (inspectionStartRef.current !== null) {
      const elapsed = Date.now() - inspectionStartRef.current;
      setInspectionTime(elapsed);
      inspectionRafRef.current = requestAnimationFrame(inspectionTick);
    }
  }, []);

  const startInspection = useCallback(() => {
    inspectionStartRef.current = Date.now();
    setInspectionTime(0);
    setState("inspecting");
    inspectionRafRef.current = requestAnimationFrame(inspectionTick);
  }, [inspectionTick]);

  const stopInspection = useCallback(() => {
    if (inspectionRafRef.current !== null) {
      cancelAnimationFrame(inspectionRafRef.current);
      inspectionRafRef.current = null;
    }
    inspectionStartRef.current = null;
  }, []);

  const startTimer = useCallback(() => {
    stopInspection();
    startTimeRef.current = Date.now();
    setElapsed(0);
    setState("running");
    rafRef.current = requestAnimationFrame(tick);
  }, [tick, stopInspection]);

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
    setState("idle");

    const event = selectedEventRef.current;
    setScramble(generateScramble(event));

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
      setTotalSolveCount((c) => c + 1);
      setStats(newStats);
    });
  }, [elapsed]);

  // Begin hold sequence — start hold timer for delay.
  const beginHold = useCallback(() => {
    const delay = settingsRef.current.holdDelayMs;
    holdStartRef.current = Date.now();

    if (delay === 0) {
      // No hold delay — go straight to ready.
      setState("ready");
    } else {
      setState("holding");
      holdTimerRef.current = setTimeout(() => {
        setState("ready");
      }, delay);
    }
  }, []);

  // Cancel hold if spacebar released too early.
  const cancelHold = useCallback(() => {
    if (holdTimerRef.current !== null) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    holdStartRef.current = null;
  }, []);

  const handlePenalty = async (id: number, penalty: Penalty) => {
    const { solve, stats: newStats } = await updateSolve(id, { penalty });
    setSolves((prev) => prev.map((s) => (s.id === id ? solve : s)));
    setStats(newStats);
  };

  const handleDelete = async (id: number) => {
    const { stats: newStats } = await deleteSolve(id);
    setSolves((prev) => prev.filter((s) => s.id !== id));
    setTotalSolveCount((c) => c - 1);
    setStats(newStats);
  };

  // Infinite scroll — load more solves when scrolling near bottom.
  const handleLoadMore = useCallback(async () => {
    if (loadingMore || !hasMore || solves.length === 0) return;
    setLoadingMore(true);
    const oldestSolve = solves[solves.length - 1];
    const BATCH_SIZE = 50;
    const more = await loadMoreSolves(selectedEvent, oldestSolve.date, BATCH_SIZE);
    setSolves((prev) => [...prev, ...more]);
    setHasMore(more.length === BATCH_SIZE);
    setLoadingMore(false);
  }, [loadingMore, hasMore, solves, selectedEvent]);

  // Virtualizer for the solves list.
  const virtualizer = useVirtualizer({
    count: solves.length,
    getScrollElement: () => scrollParentRef.current,
    estimateSize: () => 36,
    overscan: 10,
  });

  // Trigger load more when scrolled near bottom.
  useEffect(() => {
    const lastItem = virtualizer.getVirtualItems().at(-1);
    if (!lastItem) return;
    if (lastItem.index >= solves.length - 10 && hasMore && !loadingMore) {
      handleLoadMore();
    }
  }, [virtualizer.getVirtualItems(), solves.length, hasMore, loadingMore, handleLoadMore]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      e.preventDefault();

      const s = stateRef.current;

      if (s === "running") {
        stopTimer();
      } else if (s === "idle") {
        if (settingsRef.current.useInspection) {
          startInspection();
        } else {
          beginHold();
        }
      } else if (s === "inspecting") {
        beginHold();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      e.preventDefault();

      const s = stateRef.current;

      if (s === "ready") {
        cancelHold();
        startTimer();
      } else if (s === "holding") {
        // Released before hold delay met — go back.
        cancelHold();
        if (settingsRef.current.useInspection && inspectionStartRef.current !== null) {
          setState("inspecting");
        } else {
          setState("idle");
        }
      }
    };

    const handleTouchStart = (e: TouchEvent) => {
      // Ignore touches on interactive elements (buttons, inputs, links, etc.)
      const target = e.target as HTMLElement;
      if (target.closest("button, a, input, select, textarea, [role='button'], dialog")) return;

      const s = stateRef.current;
      if (s === "running") {
        stopTimer();
      } else if (s === "idle") {
        if (settingsRef.current.useInspection) {
          startInspection();
        } else {
          beginHold();
        }
      } else if (s === "inspecting") {
        beginHold();
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("button, a, input, select, textarea, [role='button'], dialog")) return;

      const s = stateRef.current;
      if (s === "ready") {
        cancelHold();
        startTimer();
      } else if (s === "holding") {
        cancelHold();
        if (settingsRef.current.useInspection && inspectionStartRef.current !== null) {
          setState("inspecting");
        } else {
          setState("idle");
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchend", handleTouchEnd);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [startTimer, stopTimer, startInspection, beginHold, cancelHold]);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (inspectionRafRef.current !== null) cancelAnimationFrame(inspectionRafRef.current);
      if (holdTimerRef.current !== null) clearTimeout(holdTimerRef.current);
    };
  }, []);

  const eventConfig = EVENT_MAP[selectedEvent];

  return (
    <div className="flex flex-col flex-1 overflow-hidden select-none">
      {/* Event selector — top bar */}
      <div className="flex items-center px-4 py-2 border-b border-border">
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-muted transition-colors">
            <EventIcon event={eventConfig} size={22} />
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
                <EventIcon event={meta} size={20} />
                <span>{meta.name}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="ml-auto flex items-center gap-2">
          {stats && (
            <button
              className={`flex items-center gap-1.5 text-xs font-bold py-1.5 px-3 rounded ${accent.bg} text-white ${accent.hover} transition-colors ${accent.shadow} ${solves.length === 0 ? "opacity-50 cursor-not-allowed" : ""}`}
              onClick={() => solves.length > 0 && setPostOpen(true)}
              disabled={solves.length === 0}
            >
              <FilePen className="w-3.5 h-3.5" />
              Post
            </button>
          )}
          <button
            className="flex md:hidden items-center gap-1.5 text-xs font-bold py-1.5 px-3 rounded bg-neutral-600 text-foreground hover:bg-neutral-500 transition-colors shadow-[0_3px_0_0_#1a1a1a]"
            onClick={() => setMobileStatsOpen(true)}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            Stats
          </button>
          <button
            className="flex items-center gap-1.5 text-xs font-bold py-1.5 px-3 rounded bg-neutral-600 text-foreground hover:bg-neutral-500 transition-colors shadow-[0_3px_0_0_#1a1a1a]"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings className="w-3.5 h-3.5" />
            Timer
          </button>
        </div>

        <TimerSettingsDialog
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          description="Configure your practice session."
        />

        {/* Mobile stats dialog */}
        <Dialog open={mobileStatsOpen} onOpenChange={setMobileStatsOpen}>
          <DialogContent className="max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Session Stats</DialogTitle>
              <DialogDescription>
                {solves.length} solve{solves.length !== 1 ? "s" : ""} this session
              </DialogDescription>
            </DialogHeader>
            {stats && (
              <div className="space-y-3">
                <div className="grid grid-cols-[1fr_4rem_4rem] gap-x-3 px-1">
                  <span />
                  <span className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-widest text-right">Current</span>
                  <span className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-widest text-right">Best</span>
                </div>
                {getPracticeStats(selectedEvent).includes("single") && (
                  <div className="grid grid-cols-[1fr_4rem_4rem] gap-x-3 items-center px-1">
                    <span className="text-sm font-semibold text-muted-foreground">Single</span>
                    <button className={`font-mono tabular-nums text-sm font-bold text-right rounded px-1 -mx-1 transition-colors ${accent.hoverSubtle}`} onClick={() => solves.length > 0 && setStatDetail({ stat: "single", variant: "current" })}>
                      {solves.length > 0 ? formatSolveTime(solves[0]) : "-"}
                    </button>
                    <button className={`font-mono tabular-nums text-sm font-bold text-right rounded px-1 -mx-1 transition-colors ${accent.hoverSubtle}`} onClick={() => stats.bestSingle !== null && setStatDetail({ stat: "single", variant: "best" })}>
                      {stats.bestSingle !== null ? formatTime(stats.bestSingle) : "-"}
                    </button>
                  </div>
                )}
                {getPracticeStats(selectedEvent).includes("mo3") && (
                  <div className="grid grid-cols-[1fr_4rem_4rem] gap-x-3 items-center px-1">
                    <span className="text-sm font-semibold text-muted-foreground">Mo3</span>
                    <button className={`font-mono tabular-nums text-sm font-bold text-right rounded px-1 -mx-1 transition-colors ${accent.hoverSubtle}`} onClick={() => stats.currentMo3 !== null && setStatDetail({ stat: "mo3", variant: "current" })}>
                      {stats.currentMo3 !== null ? formatTime(stats.currentMo3) : "-"}
                    </button>
                    <button className={`font-mono tabular-nums text-sm font-bold text-right rounded px-1 -mx-1 transition-colors ${accent.hoverSubtle}`} onClick={() => stats.bestMo3 !== null && setStatDetail({ stat: "mo3", variant: "best" })}>
                      {stats.bestMo3 !== null ? formatTime(stats.bestMo3) : "-"}
                    </button>
                  </div>
                )}
                {getPracticeStats(selectedEvent).includes("ao5") && (
                  <div className="grid grid-cols-[1fr_4rem_4rem] gap-x-3 items-center px-1">
                    <span className="text-sm font-semibold text-muted-foreground">Ao5</span>
                    <button className={`font-mono tabular-nums text-sm font-bold text-right rounded px-1 -mx-1 transition-colors ${accent.hoverSubtle}`} onClick={() => stats.currentAo5 !== null && setStatDetail({ stat: "ao5", variant: "current" })}>
                      {stats.currentAo5 !== null ? formatTime(stats.currentAo5) : "-"}
                    </button>
                    <button className={`font-mono tabular-nums text-sm font-bold text-right rounded px-1 -mx-1 transition-colors ${accent.hoverSubtle}`} onClick={() => stats.bestAo5 !== null && setStatDetail({ stat: "ao5", variant: "best" })}>
                      {stats.bestAo5 !== null ? formatTime(stats.bestAo5) : "-"}
                    </button>
                  </div>
                )}
                {getPracticeStats(selectedEvent).includes("ao12") && (
                  <div className="grid grid-cols-[1fr_4rem_4rem] gap-x-3 items-center px-1">
                    <span className="text-sm font-semibold text-muted-foreground">Ao12</span>
                    <button className={`font-mono tabular-nums text-sm font-bold text-right rounded px-1 -mx-1 transition-colors ${accent.hoverSubtle}`} onClick={() => stats.currentAo12 !== null && setStatDetail({ stat: "ao12", variant: "current" })}>
                      {stats.currentAo12 !== null ? formatTime(stats.currentAo12) : "-"}
                    </button>
                    <button className={`font-mono tabular-nums text-sm font-bold text-right rounded px-1 -mx-1 transition-colors ${accent.hoverSubtle}`} onClick={() => stats.bestAo12 !== null && setStatDetail({ stat: "ao12", variant: "best" })}>
                      {stats.bestAo12 !== null ? formatTime(stats.bestAo12) : "-"}
                    </button>
                  </div>
                )}
                {getPracticeStats(selectedEvent).includes("ao100") && (
                  <div className="grid grid-cols-[1fr_4rem_4rem] gap-x-3 items-center px-1">
                    <span className="text-sm font-semibold text-muted-foreground">Ao100</span>
                    <button className={`font-mono tabular-nums text-sm font-bold text-right rounded px-1 -mx-1 transition-colors ${accent.hoverSubtle}`} onClick={() => stats.currentAo100 !== null && setStatDetail({ stat: "ao100", variant: "current" })}>
                      {stats.currentAo100 !== null ? formatTime(stats.currentAo100) : "-"}
                    </button>
                    <button className={`font-mono tabular-nums text-sm font-bold text-right rounded px-1 -mx-1 transition-colors ${accent.hoverSubtle}`} onClick={() => stats.bestAo100 !== null && setStatDetail({ stat: "ao100", variant: "best" })}>
                      {stats.bestAo100 !== null ? formatTime(stats.bestAo100) : "-"}
                    </button>
                  </div>
                )}
                <div className="grid grid-cols-[1fr_4rem_4rem] gap-x-3 items-center px-1">
                  <span className="text-sm font-semibold text-muted-foreground">Mean</span>
                  <button className={`font-mono tabular-nums text-sm font-bold text-right rounded px-1 -mx-1 transition-colors ${accent.hoverSubtle}`} onClick={() => stats.sessionMean !== null && setStatDetail({ stat: "mean", variant: "current" })}>
                    {stats.sessionMean !== null ? formatTime(stats.sessionMean) : "-"}
                  </button>
                  <span />
                </div>
              </div>
            )}
            {solves.length > 0 && (
              <div className="mt-4 border-t border-border pt-3">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Solves</p>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {solves.map((solve, i) => (
                    <div key={solve.id} className="flex items-center justify-between px-1 py-1 text-sm">
                      <span className="text-muted-foreground">{solves.length - i}</span>
                      <span className="font-mono tabular-nums font-bold">{formatSolveTime(solve)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* Timer area */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex flex-col flex-1 items-center justify-center gap-6">
        <p className={`font-mono text-center ${SCRAMBLE_SIZE_CLASSES[timerSettings.scrambleSize]} max-w-xl px-4 min-h-[1.75rem] whitespace-pre-line`}>
          {state === "running" ? "" : (scramble ?? "")}
        </p>
        <p
          className={`font-mono tabular-nums transition-colors ${
            state === "holding" ? "text-red-500" :
            state === "ready" ? "text-green-500" :
            state === "inspecting" ? "text-yellow-500" :
            ""
          }`}
          style={{ fontSize: "clamp(3rem, 15vw, 8rem)" }}
        >
          {state === "inspecting" || ((state === "holding" || state === "ready") && inspectionStartRef.current !== null)
            ? Math.max(0, Math.ceil((timerSettings.inspectionDurationMs - inspectionTime) / 1000))
            : state === "running" && !timerSettings.showTimerWhileRunning
              ? "Solve!"
              : formatTime(elapsed)}
        </p>
        </div>

      {/* Right panel — stats + solves list */}
      <aside className={`shrink-0 border-l border-border hidden md:flex flex-col bg-card transition-all ${rightPanelOpen ? "w-56" : "w-10"}`}>
        {/* Collapse toggle */}
        <button
          className="flex items-center px-3 py-2 hover:bg-muted transition-colors"
          onClick={() => setRightPanelOpen(!rightPanelOpen)}
          title={rightPanelOpen ? "Collapse panel" : "Expand panel"}
        >
          {rightPanelOpen ? <PanelRightClose className="w-4 h-4 text-foreground" /> : <PanelRightOpen className="w-4 h-4 text-foreground" />}
        </button>
        {rightPanelOpen && <>
        {/* Stats table — current & best */}
        {stats && (
          <div className="border-b border-border">
            <p className="px-3 pt-2 pb-2 text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5" suppressHydrationWarning>
              <span className="text-base leading-none">📈</span> Stats
            </p>
            {/* Column headers */}
            <div className="grid grid-cols-[1fr_3.5rem_3.5rem] gap-x-3 px-3 pb-1.5">
              <span />
              <span className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-widest text-right">Current</span>
              <span className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-widest text-right">Best</span>
            </div>
            {/* Stat rows */}
            <div className="space-y-1.5 px-3 pb-3">
              {getPracticeStats(selectedEvent).includes("single") && (
                <div className="grid grid-cols-[1fr_3.5rem_3.5rem] gap-x-3 items-center">
                  <span className="text-xs font-semibold text-muted-foreground">Single</span>
                  <button className={`font-mono tabular-nums text-sm font-bold text-right rounded px-1 -mx-1 transition-colors ${accent.hoverSubtle}`} onClick={() => solves.length > 0 && setStatDetail({ stat: "single", variant: "current" })}>
                    {solves.length > 0 ? formatSolveTime(solves[0]) : "-"}
                  </button>
                  <button className={`font-mono tabular-nums text-sm font-bold text-right rounded px-1 -mx-1 transition-colors ${accent.hoverSubtle}`} onClick={() => stats.bestSingle !== null && setStatDetail({ stat: "single", variant: "best" })}>
                    {stats.bestSingle !== null ? formatTime(stats.bestSingle) : "-"}
                  </button>
                </div>
              )}
              {getPracticeStats(selectedEvent).includes("mo3") && (
                <div className="grid grid-cols-[1fr_3.5rem_3.5rem] gap-x-3 items-center">
                  <span className="text-xs font-semibold text-muted-foreground">Mo3</span>
                  <button className={`font-mono tabular-nums text-sm font-bold text-right rounded px-1 -mx-1 transition-colors ${accent.hoverSubtle}`} onClick={() => stats.currentMo3 !== null && setStatDetail({ stat: "mo3", variant: "current" })}>
                    {stats.currentMo3 !== null ? formatTime(stats.currentMo3) : "-"}
                  </button>
                  <button className={`font-mono tabular-nums text-sm font-bold text-right rounded px-1 -mx-1 transition-colors ${accent.hoverSubtle}`} onClick={() => stats.bestMo3 !== null && setStatDetail({ stat: "mo3", variant: "best" })}>
                    {stats.bestMo3 !== null ? formatTime(stats.bestMo3) : "-"}
                  </button>
                </div>
              )}
              {getPracticeStats(selectedEvent).includes("ao5") && (
                <div className="grid grid-cols-[1fr_3.5rem_3.5rem] gap-x-3 items-center">
                  <span className="text-xs font-semibold text-muted-foreground">Ao5</span>
                  <button className={`font-mono tabular-nums text-sm font-bold text-right rounded px-1 -mx-1 transition-colors ${accent.hoverSubtle}`} onClick={() => stats.currentAo5 !== null && setStatDetail({ stat: "ao5", variant: "current" })}>
                    {stats.currentAo5 !== null ? formatTime(stats.currentAo5) : "-"}
                  </button>
                  <button className={`font-mono tabular-nums text-sm font-bold text-right rounded px-1 -mx-1 transition-colors ${accent.hoverSubtle}`} onClick={() => stats.bestAo5 !== null && setStatDetail({ stat: "ao5", variant: "best" })}>
                    {stats.bestAo5 !== null ? formatTime(stats.bestAo5) : "-"}
                  </button>
                </div>
              )}
              {getPracticeStats(selectedEvent).includes("ao12") && (
                <div className="grid grid-cols-[1fr_3.5rem_3.5rem] gap-x-3 items-center">
                  <span className="text-xs font-semibold text-muted-foreground">Ao12</span>
                  <button className={`font-mono tabular-nums text-sm font-bold text-right rounded px-1 -mx-1 transition-colors ${accent.hoverSubtle}`} onClick={() => stats.currentAo12 !== null && setStatDetail({ stat: "ao12", variant: "current" })}>
                    {stats.currentAo12 !== null ? formatTime(stats.currentAo12) : "-"}
                  </button>
                  <button className={`font-mono tabular-nums text-sm font-bold text-right rounded px-1 -mx-1 transition-colors ${accent.hoverSubtle}`} onClick={() => stats.bestAo12 !== null && setStatDetail({ stat: "ao12", variant: "best" })}>
                    {stats.bestAo12 !== null ? formatTime(stats.bestAo12) : "-"}
                  </button>
                </div>
              )}
              {getPracticeStats(selectedEvent).includes("ao100") && (
                <div className="grid grid-cols-[1fr_3.5rem_3.5rem] gap-x-3 items-center">
                  <span className="text-xs font-semibold text-muted-foreground">Ao100</span>
                  <button className={`font-mono tabular-nums text-sm font-bold text-right rounded px-1 -mx-1 transition-colors ${accent.hoverSubtle}`} onClick={() => stats.currentAo100 !== null && setStatDetail({ stat: "ao100", variant: "current" })}>
                    {stats.currentAo100 !== null ? formatTime(stats.currentAo100) : "-"}
                  </button>
                  <button className={`font-mono tabular-nums text-sm font-bold text-right rounded px-1 -mx-1 transition-colors ${accent.hoverSubtle}`} onClick={() => stats.bestAo100 !== null && setStatDetail({ stat: "ao100", variant: "best" })}>
                    {stats.bestAo100 !== null ? formatTime(stats.bestAo100) : "-"}
                  </button>
                </div>
              )}
              <div className="grid grid-cols-[1fr_3.5rem_3.5rem] gap-x-3 items-center">
                <span className="text-xs font-semibold text-muted-foreground">Mean</span>
                <button className={`font-mono tabular-nums text-sm font-bold text-right rounded px-1 -mx-1 transition-colors ${accent.hoverSubtle}`} onClick={() => stats.sessionMean !== null && setStatDetail({ stat: "mean", variant: "current" })}>
                  {stats.sessionMean !== null ? formatTime(stats.sessionMean) : "-"}
                </button>
                <span />
              </div>
            </div>
          </div>
        )}
        <p className="px-3 py-2 text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest border-y border-border flex items-center gap-1.5" suppressHydrationWarning>
          <span className="text-base leading-none">⏱️</span> Solves
        </p>
        <ul ref={scrollParentRef} className="flex-1 overflow-y-auto min-h-0">
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: "100%",
              position: "relative",
            }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const solve = solves[virtualRow.index];
              const i = virtualRow.index;
              return (
                <div
                  key={solve.id}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <Popover>
                    <PopoverTrigger render={<li />} nativeButton={false} className="flex items-center justify-between px-3 py-2 text-sm border-b border-border/40 cursor-pointer hover:bg-muted transition-colors w-full h-full">
                        <span className="text-muted-foreground tabular-nums text-xs w-6 shrink-0">
                          {totalSolveCount - i}
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
                        <p className="font-mono text-xs text-muted-foreground leading-relaxed whitespace-pre-line">
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
                        {([null, "plus_two", "dnf"] as const).map((p) => (
                          <button
                            key={p ?? "ok"}
                            className={`flex-1 text-xs font-semibold py-1.5 rounded-md transition-colors ${
                              solve.penalty === p
                                ? `${accent.bg} text-white shadow-sm`
                                : "text-muted-foreground hover:text-foreground"
                            }`}
                            onClick={() => handlePenalty(solve.id, p)}
                          >
                            {p === null ? "None" : p === "plus_two" ? "+2" : "DNF"}
                          </button>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              );
            })}
          </div>
        </ul>
        {stats && (
          <DraftPostModal
            open={postOpen}
            onOpenChange={setPostOpen}
            eventConfig={eventConfig}
            stats={stats}
            solves={solves}
          />
        )}
        {statDetail && (
          <StatDetailModal
            detail={statDetail}
            onClose={() => setStatDetail(null)}
            solves={solves}
            accent={accent}
          />
        )}
        <div className="p-2 border-t border-border flex flex-col items-center gap-1">
          {confirmClear ? (
            <div className="flex items-center gap-2">
              <button
                className="text-xs text-red-500 font-semibold py-1 px-3 rounded-md bg-red-500/10 hover:bg-red-500/20 transition-colors"
                onClick={() => {
                  clearSolves(selectedEvent).then((newStats) => {
                    setSolves([]);
                    setTotalSolveCount(0);
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
        </>}
      </aside>
      </div>
    </div>
  );
}
