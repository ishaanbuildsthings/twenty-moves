// All supported WCA events (excluding FMC and MBLD).
// Enum values match cubing.js's randomScrambleForEvent() parameter.
export enum CubeEvent {
  TWO = "222",
  THREE = "333",
  FOUR = "444",
  FIVE = "555",
  SIX = "666",
  SEVEN = "777",
  THREE_BLD = "333bf",
  FOUR_BLD = "444bf",
  FIVE_BLD = "555bf",
  OH = "333oh",
  PYRA = "pyram",
  MEGA = "mega",
  SKEWB = "skewb",
  SQ1 = "sq1",
  CLOCK = "clock",
}

export type StatType = "single" | "ao5" | "ao12" | "ao100" | "mo3";

export interface EventConfig {
  id: CubeEvent;
  name: string;
  // CSS class for @cubing/icons (e.g. "event-333")
  iconClass: string;
  stats: StatType[];
}

const STANDARD_STATS: StatType[] = ["single", "mo3", "ao5", "ao12", "ao100"];
const BLD_STATS: StatType[] = ["single", "mo3", "ao5", "ao12"];

export const EVENT_CONFIGS: EventConfig[] = [
  { id: CubeEvent.TWO, name: "2x2", iconClass: "event-222", stats: STANDARD_STATS },
  { id: CubeEvent.THREE, name: "3x3", iconClass: "event-333", stats: STANDARD_STATS },
  { id: CubeEvent.FOUR, name: "4x4", iconClass: "event-444", stats: STANDARD_STATS },
  { id: CubeEvent.FIVE, name: "5x5", iconClass: "event-555", stats: STANDARD_STATS },
  { id: CubeEvent.SIX, name: "6x6", iconClass: "event-666", stats: STANDARD_STATS },
  { id: CubeEvent.SEVEN, name: "7x7", iconClass: "event-777", stats: STANDARD_STATS },
  { id: CubeEvent.THREE_BLD, name: "3BLD", iconClass: "event-333bf", stats: BLD_STATS },
  { id: CubeEvent.FOUR_BLD, name: "4BLD", iconClass: "event-444bf", stats: BLD_STATS },
  { id: CubeEvent.FIVE_BLD, name: "5BLD", iconClass: "event-555bf", stats: BLD_STATS },
  { id: CubeEvent.OH, name: "OH", iconClass: "event-333oh", stats: STANDARD_STATS },
  { id: CubeEvent.PYRA, name: "Pyra", iconClass: "event-pyram", stats: STANDARD_STATS },
  { id: CubeEvent.MEGA, name: "Mega", iconClass: "event-minx", stats: STANDARD_STATS },
  { id: CubeEvent.SKEWB, name: "Skewb", iconClass: "event-skewb", stats: STANDARD_STATS },
  { id: CubeEvent.SQ1, name: "SQ-1", iconClass: "event-sq1", stats: STANDARD_STATS },
  { id: CubeEvent.CLOCK, name: "Clock", iconClass: "event-clock", stats: STANDARD_STATS },
];

export const EVENT_MAP: Record<CubeEvent, EventConfig> = Object.fromEntries(
  EVENT_CONFIGS.map((e) => [e.id, e])
) as Record<CubeEvent, EventConfig>;

