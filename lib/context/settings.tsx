"use client";

import { createContext, useContext, useState, useCallback } from "react";
import {
  loadTimerSettings,
  saveTimerSettings,
  type TimerSettings,
} from "@/lib/settings/timer";

interface SettingsContextValue {
  timerSettings: TimerSettings;
  updateTimerSettings: (updates: Partial<TimerSettings>) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  // Load from localStorage on first render. Synchronous, no loading state.
  const [timerSettings, setTimerSettings] = useState(loadTimerSettings);

  const updateTimerSettings = useCallback(
    (updates: Partial<TimerSettings>) => {
      setTimerSettings((prev) => {
        const merged = { ...prev, ...updates };
        saveTimerSettings(merged);
        return merged;
      });
    },
    []
  );

  return (
    <SettingsContext.Provider value={{ timerSettings, updateTimerSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error("useSettings must be used within SettingsProvider");
  }
  return ctx;
}
