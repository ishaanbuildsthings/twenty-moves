// Timer settings — stored in localStorage per device.
// When adding new settings, just add them here with a default.
// Existing users won't have them in their stored JSON, so they
// get the default via the spread in loadTimerSettings().

export interface TimerSettings {
  /** How long (ms) the spacebar must be held before the timer is ready. */
  holdDelay: number;
  /** Whether to show WCA 15s inspection countdown before timing. */
  useInspection: boolean;
  /** Duration (ms) of inspection if enabled. */
  inspectionDuration: number;
  /** Whether to show the running time while timing (false = hide until stop). */
  showTimerWhileRunning: boolean;
}

export const DEFAULT_TIMER_SETTINGS: TimerSettings = {
  holdDelay: 300,
  useInspection: false,
  inspectionDuration: 15000,
  showTimerWhileRunning: true,
};

const STORAGE_KEY = "timerSettings";

/** Load settings from localStorage, merging with defaults for any missing keys. */
export function loadTimerSettings(): TimerSettings {
  if (typeof window === "undefined") return DEFAULT_TIMER_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_TIMER_SETTINGS;
    return { ...DEFAULT_TIMER_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_TIMER_SETTINGS;
  }
}

/** Save settings to localStorage. */
export function saveTimerSettings(settings: TimerSettings): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}
