// All supported WCA events (excluding FMC and MBLD).
// Event IDs match cubing.js's randomScrambleForEvent() parameter.
export const EVENTS = [
  "222",
  "333",
  "444",
  "555",
  "666",
  "777",
  "333bf",
  "444bf",
  "555bf",
  "333oh",
  "pyram",
  "mega",
  "skewb",
  "sq1",
  "clock",
] as const;

export type CubeEvent = (typeof EVENTS)[number];

export interface EventMeta {
  id: CubeEvent;
  name: string;
  // BLD events use mean-of-3 instead of averages (DNFs are too common
  // for trimmed averages to make sense).
  useMo3: boolean;
}

const EVENTS_LIST: EventMeta[] = [
  { id: "222", name: "2x2", useMo3: false },
  { id: "333", name: "3x3", useMo3: false },
  { id: "444", name: "4x4", useMo3: false },
  { id: "555", name: "5x5", useMo3: false },
  { id: "666", name: "6x6", useMo3: false },
  { id: "777", name: "7x7", useMo3: false },
  { id: "333bf", name: "3BLD", useMo3: true },
  { id: "444bf", name: "4BLD", useMo3: true },
  { id: "555bf", name: "5BLD", useMo3: true },
  { id: "333oh", name: "OH", useMo3: false },
  { id: "pyram", name: "Pyra", useMo3: false },
  { id: "mega", name: "Mega", useMo3: false },
  { id: "skewb", name: "Skewb", useMo3: false },
  { id: "sq1", name: "SQ-1", useMo3: false },
  { id: "clock", name: "Clock", useMo3: false },
];

export const EVENT_MAP: Record<CubeEvent, EventMeta> = Object.fromEntries(
  EVENTS_LIST.map((e) => [e.id, e])
) as Record<CubeEvent, EventMeta>;

export function getEventMeta(event: CubeEvent): EventMeta {
  return EVENT_MAP[event];
}
