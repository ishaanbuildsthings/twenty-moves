"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type TimerState = "idle" | "inspecting" | "holding" | "ready" | "running";

export interface TimerConfig {
  holdDelayMs: number;
  useInspection: boolean;
  inspectionDurationMs: number;
  showTimerWhileRunning: boolean;
  onSolveComplete: (timeMs: number) => void;
  // If true, keyboard listeners are active. Set to false to disable
  // (e.g., when a modal is open or the timer isn't visible).
  enabled?: boolean;
}

export function useTimer(config: TimerConfig) {
  const [state, setState] = useState<TimerState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [inspectionTime, setInspectionTime] = useState(0);

  const startTimeRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const holdStartRef = useRef<number | null>(null);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inspectionStartRef = useRef<number | null>(null);
  const inspectionRafRef = useRef<number | null>(null);
  const stateRef = useRef<TimerState>(state);
  const configRef = useRef(config);

  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { configRef.current = config; }, [config]);

  const tick = useCallback(() => {
    if (startTimeRef.current !== null) {
      setElapsed(Date.now() - startTimeRef.current);
      rafRef.current = requestAnimationFrame(tick);
    }
  }, []);

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
    configRef.current.onSolveComplete(finalTime);
  }, [elapsed]);

  const beginHold = useCallback(() => {
    const delay = configRef.current.holdDelayMs;
    holdStartRef.current = Date.now();

    if (delay === 0) {
      setState("ready");
    } else {
      setState("holding");
      holdTimerRef.current = setTimeout(() => {
        setState("ready");
      }, delay);
    }
  }, []);

  const cancelHold = useCallback(() => {
    if (holdTimerRef.current !== null) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    holdStartRef.current = null;
  }, []);

  // Keyboard listeners.
  useEffect(() => {
    if (config.enabled === false) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat) return;
      e.preventDefault();

      const s = stateRef.current;
      if (s === "running") {
        stopTimer();
      } else if (s === "idle") {
        if (configRef.current.useInspection) {
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
      e.preventDefault();

      const s = stateRef.current;
      if (s === "ready") {
        cancelHold();
        startTimer();
      } else if (s === "holding") {
        cancelHold();
        if (configRef.current.useInspection && inspectionStartRef.current !== null) {
          setState("inspecting");
        } else {
          setState("idle");
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [config.enabled, startTimer, stopTimer, startInspection, beginHold, cancelHold]);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (inspectionRafRef.current !== null) cancelAnimationFrame(inspectionRafRef.current);
      if (holdTimerRef.current !== null) clearTimeout(holdTimerRef.current);
    };
  }, []);

  // Reset timer state (e.g., when moving to next scramble).
  const reset = useCallback(() => {
    setState("idle");
    setElapsed(0);
    setInspectionTime(0);
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    if (inspectionRafRef.current !== null) cancelAnimationFrame(inspectionRafRef.current);
    if (holdTimerRef.current !== null) clearTimeout(holdTimerRef.current);
    startTimeRef.current = null;
    inspectionStartRef.current = null;
    holdStartRef.current = null;
  }, []);

  return {
    state,
    elapsed,
    inspectionTime,
    inspectionDurationMs: config.inspectionDurationMs,
    showTimerWhileRunning: config.showTimerWhileRunning,
    isInspecting: state === "inspecting" || ((state === "holding" || state === "ready") && inspectionStartRef.current !== null),
    reset,
  };
}
