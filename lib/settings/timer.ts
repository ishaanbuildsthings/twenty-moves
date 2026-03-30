// Timer settings — stored in localStorage per device.
// When adding new settings, just add them here with a default.
// Existing users won't have them in their stored JSON, so they
// get the default via the spread in loadTimerSettings().

export type ScrambleSize = "small" | "medium" | "large";

export interface TimerSettings {
  /** How long (ms) the spacebar must be held before the timer is ready. */
  holdDelayMs: number;
  /** Whether to show WCA 15s inspection countdown before timing. */
  useInspection: boolean;
  /** Duration (ms) of inspection if enabled. */
  inspectionDurationMs: number;
  /** Whether to show the running time while timing (false = hide until stop). */
  showTimerWhileRunning: boolean;
  /** Font size for scramble text. */
  scrambleSize: ScrambleSize;
}

export const SCRAMBLE_SIZE_CLASSES: Record<ScrambleSize, string> = {
  small: "text-2xl",
  medium: "text-3xl",
  large: "text-4xl",
};

export const DEFAULT_TIMER_SETTINGS: TimerSettings = {
  holdDelayMs: 550,
  useInspection: false,
  inspectionDurationMs: 15000,
  showTimerWhileRunning: true,
  scrambleSize: "medium",
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
