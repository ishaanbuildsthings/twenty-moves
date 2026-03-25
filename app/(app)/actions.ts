"use server";

import { randomScrambleForEvent } from "cubing/scramble";
import type { CubeEvent } from "@/lib/cubing/events";

export async function getScramble(event: CubeEvent): Promise<string> {
  const alg = await randomScrambleForEvent(event);
  return alg.toString();
}
