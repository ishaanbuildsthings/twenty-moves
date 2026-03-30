"use client";

import { createContext, useContext, useState, useCallback } from "react";
import {
  loadTimerSettings,
  saveTimerSettings,
  type TimerSettings,
} from "@/lib/settings/timer";
import {
  loadDisplaySettings,
  saveDisplaySettings,
  ACCENT_STYLES,
  type DisplaySettings,
} from "@/lib/settings/display";

interface SettingsContextValue {
  timerSettings: TimerSettings;
  updateTimerSettings: (updates: Partial<TimerSettings>) => void;
  displaySettings: DisplaySettings;
  updateDisplaySettings: (updates: Partial<DisplaySettings>) => void;
  accent: typeof ACCENT_STYLES[keyof typeof ACCENT_STYLES];
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  // Load from localStorage on first render. Synchronous, no loading state.
  const [timerSettings, setTimerSettings] = useState(loadTimerSettings);
  const [displaySettings, setDisplaySettings] = useState(loadDisplaySettings);

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

  const updateDisplaySettings = useCallback(
    (updates: Partial<DisplaySettings>) => {
      setDisplaySettings((prev) => {
        const merged = { ...prev, ...updates };
        saveDisplaySettings(merged);
        return merged;
      });
    },
    []
  );

  const accent = ACCENT_STYLES[displaySettings.accentColor];

  return (
    <SettingsContext.Provider value={{ timerSettings, updateTimerSettings, displaySettings, updateDisplaySettings, accent }}>
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
