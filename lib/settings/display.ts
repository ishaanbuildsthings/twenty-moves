// Display settings — stored in localStorage per device.
// Controls visual preferences like icon style.

export interface DisplaySettings {
  /** Use 3D SVG icons instead of flat cubing-icons font. */
  use3dIcons: boolean;
}

export const DEFAULT_DISPLAY_SETTINGS: DisplaySettings = {
  use3dIcons: true,
};

const STORAGE_KEY = "displaySettings";

/** Load display settings from localStorage, merging with defaults. */
export function loadDisplaySettings(): DisplaySettings {
  if (typeof window === "undefined") return DEFAULT_DISPLAY_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_DISPLAY_SETTINGS;
    return { ...DEFAULT_DISPLAY_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_DISPLAY_SETTINGS;
  }
}

/** Save display settings to localStorage. */
export function saveDisplaySettings(settings: DisplaySettings): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}
