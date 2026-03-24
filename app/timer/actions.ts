"use server";

import { randomScrambleForEvent } from "cubing/scramble";

export async function getScramble(): Promise<string> {
  const alg = await randomScrambleForEvent("333");
  return alg.toString();
}
