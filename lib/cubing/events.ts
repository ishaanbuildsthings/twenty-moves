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

export interface EventMeta {
  id: CubeEvent;
  name: string;
  stats: StatType[];
}

const STANDARD_STATS: StatType[] = ["single", "mo3", "ao5", "ao12", "ao100"];
const BLD_STATS: StatType[] = ["single", "mo3", "ao5", "ao12"];

export const EVENTS_LIST: EventMeta[] = [
  { id: CubeEvent.TWO, name: "2x2", stats: STANDARD_STATS },
  { id: CubeEvent.THREE, name: "3x3", stats: STANDARD_STATS },
  { id: CubeEvent.FOUR, name: "4x4", stats: STANDARD_STATS },
  { id: CubeEvent.FIVE, name: "5x5", stats: STANDARD_STATS },
  { id: CubeEvent.SIX, name: "6x6", stats: STANDARD_STATS },
  { id: CubeEvent.SEVEN, name: "7x7", stats: STANDARD_STATS },
  { id: CubeEvent.THREE_BLD, name: "3BLD", stats: BLD_STATS },
  { id: CubeEvent.FOUR_BLD, name: "4BLD", stats: BLD_STATS },
  { id: CubeEvent.FIVE_BLD, name: "5BLD", stats: BLD_STATS },
  { id: CubeEvent.OH, name: "OH", stats: STANDARD_STATS },
  { id: CubeEvent.PYRA, name: "Pyra", stats: STANDARD_STATS },
  { id: CubeEvent.MEGA, name: "Mega", stats: STANDARD_STATS },
  { id: CubeEvent.SKEWB, name: "Skewb", stats: STANDARD_STATS },
  { id: CubeEvent.SQ1, name: "SQ-1", stats: STANDARD_STATS },
  { id: CubeEvent.CLOCK, name: "Clock", stats: STANDARD_STATS },
];

export const EVENT_MAP: Record<CubeEvent, EventMeta> = Object.fromEntries(
  EVENTS_LIST.map((e) => [e.id, e])
) as Record<CubeEvent, EventMeta>;

export function getEventMeta(event: CubeEvent): EventMeta {
  return EVENT_MAP[event];
}
