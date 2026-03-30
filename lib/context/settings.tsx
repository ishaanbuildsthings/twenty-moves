"use client";

import { createContext, useContext, useState, useCallback, useEffect } from "react";
import {
  loadTimerSettings,
  saveTimerSettings,
  DEFAULT_TIMER_SETTINGS,
  type TimerSettings,
} from "@/lib/settings/timer";
import {
  loadDisplaySettings,
  saveDisplaySettings,
  DEFAULT_DISPLAY_SETTINGS,
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
  // Start with defaults to match SSR, then hydrate from localStorage.
  const [timerSettings, setTimerSettings] = useState<TimerSettings>(DEFAULT_TIMER_SETTINGS);
  const [displaySettings, setDisplaySettings] = useState<DisplaySettings>(DEFAULT_DISPLAY_SETTINGS);

  useEffect(() => {
    setTimerSettings(loadTimerSettings());
    setDisplaySettings(loadDisplaySettings());
  }, []);

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
