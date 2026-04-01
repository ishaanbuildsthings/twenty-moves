// Display settings — stored in localStorage per device.
// Controls visual preferences like icon style.

export type AccentColor = "orange" | "red" | "green" | "blue" | "yellow";

export const ACCENT_COLORS: { id: AccentColor; label: string; swatch: string }[] = [
  { id: "orange", label: "Orange", swatch: "bg-amber-500" },
  { id: "red",    label: "Red",    swatch: "bg-red-500" },
  { id: "green",  label: "Green",  swatch: "bg-emerald-500" },
  { id: "blue",   label: "Blue",   swatch: "bg-blue-500" },
  { id: "yellow", label: "Yellow", swatch: "bg-yellow-300" },
];

export const ACCENT_STYLES: Record<AccentColor, {
  bg: string;
  hover: string;
  shadow: string;
  text: string;
  bgSubtle: string;
  hoverSubtle: string;
  toggle: string;
  border: string;
  /** Very faint background for highlighted rows (e.g. viewer row on leaderboard). */
  bgRow: string;
  /** Subtle left-border for highlighted rows. */
  borderRow: string;
  /** Subtle bottom-border for highlighted rows. */
  borderRowBottom: string;
}> = {
  orange: { bg: "bg-amber-600",    hover: "hover:bg-amber-500",    shadow: "shadow-[0_2px_0_0_theme(colors.amber.800)]",    text: "text-amber-500",    bgSubtle: "bg-amber-500/20", hoverSubtle: "hover:bg-amber-500/20",   toggle: "bg-amber-600",    border: "border-amber-500",   bgRow: "bg-amber-500/[0.03]",    borderRow: "border-l-amber-500/40",    borderRowBottom: "border-b-amber-500/10" },
  red:    { bg: "bg-red-600",      hover: "hover:bg-red-500",      shadow: "shadow-[0_2px_0_0_theme(colors.red.800)]",      text: "text-red-500",      bgSubtle: "bg-red-500/20",   hoverSubtle: "hover:bg-red-500/20",     toggle: "bg-red-600",      border: "border-red-500",     bgRow: "bg-red-500/[0.03]",      borderRow: "border-l-red-500/40",      borderRowBottom: "border-b-red-500/10" },
  green:  { bg: "bg-emerald-600",  hover: "hover:bg-emerald-500",  shadow: "shadow-[0_2px_0_0_theme(colors.emerald.800)]",  text: "text-emerald-500",  bgSubtle: "bg-emerald-500/20", hoverSubtle: "hover:bg-emerald-500/20", toggle: "bg-emerald-600", border: "border-emerald-500", bgRow: "bg-emerald-500/[0.03]",  borderRow: "border-l-emerald-500/40",  borderRowBottom: "border-b-emerald-500/10" },
  blue:   { bg: "bg-blue-600",     hover: "hover:bg-blue-500",     shadow: "shadow-[0_2px_0_0_theme(colors.blue.800)]",     text: "text-blue-500",     bgSubtle: "bg-blue-500/20",  hoverSubtle: "hover:bg-blue-500/20",    toggle: "bg-blue-600",     border: "border-blue-500",    bgRow: "bg-blue-500/[0.03]",     borderRow: "border-l-blue-500/40",     borderRowBottom: "border-b-blue-500/10" },
  yellow: { bg: "bg-yellow-500",   hover: "hover:bg-yellow-400",   shadow: "shadow-[0_2px_0_0_theme(colors.yellow.700)]",   text: "text-yellow-400",   bgSubtle: "bg-yellow-400/20", hoverSubtle: "hover:bg-yellow-400/20", toggle: "bg-yellow-500",  border: "border-yellow-400",  bgRow: "bg-yellow-400/[0.03]",   borderRow: "border-l-yellow-400/40",   borderRowBottom: "border-b-yellow-400/10" },
};

export interface DisplaySettings {
  /** Use 3D SVG icons instead of flat cubing-icons font. */
  use3dIcons: boolean;
  /** Accent color for buttons, toggles, and highlights. */
  accentColor: AccentColor;
}

export const DEFAULT_DISPLAY_SETTINGS: DisplaySettings = {
  use3dIcons: false,
  accentColor: "orange",
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
