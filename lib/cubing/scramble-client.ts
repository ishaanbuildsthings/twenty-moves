"use client";

import { randomScrambleForEvent } from "cubing/scramble";
import { CubeEvent } from "./events";
import { generateScramble as generateScrambleFallback } from "./scramble";

// cubing.js uses `minx` for megaminx; our enum uses `mega`. Map when needed.
const CUBING_JS_EVENT_ID: Partial<Record<CubeEvent, string>> = {
  [CubeEvent.MEGA]: "minx",
};

export async function generateScrambleAsync(event: CubeEvent): Promise<string> {
  const eventId = CUBING_JS_EVENT_ID[event] ?? event;
  try {
    const alg = await randomScrambleForEvent(eventId);
    return alg.toString();
  } catch {
    // Fall back to the simple random-move scrambler if cubing.js fails
    // (e.g. WASM not yet loaded, unsupported event, network issue).
    return generateScrambleFallback(event);
  }
}
