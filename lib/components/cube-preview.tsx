"use client";

import { useEffect, useRef } from "react";
import { CubeEvent } from "@/lib/cubing/events";

// Map our CubeEvent to cubing.js PuzzleID. BLD and OH variants share the
// same physical puzzle as the standard event.
const PUZZLE_ID: Record<CubeEvent, string> = {
  [CubeEvent.TWO]: "2x2x2",
  [CubeEvent.THREE]: "3x3x3",
  [CubeEvent.FOUR]: "4x4x4",
  [CubeEvent.FIVE]: "5x5x5",
  [CubeEvent.SIX]: "6x6x6",
  [CubeEvent.SEVEN]: "7x7x7",
  [CubeEvent.THREE_BLD]: "3x3x3",
  [CubeEvent.FOUR_BLD]: "4x4x4",
  [CubeEvent.FIVE_BLD]: "5x5x5",
  [CubeEvent.OH]: "3x3x3",
  [CubeEvent.PYRA]: "pyraminx",
  [CubeEvent.MEGA]: "megaminx",
  [CubeEvent.SKEWB]: "skewb",
  [CubeEvent.SQ1]: "square1",
  [CubeEvent.CLOCK]: "clock",
};

type TwistyPlayerLike = HTMLElement & {
  alg?: string;
  puzzle?: string;
  visualization?: string;
  background?: string;
  controlPanel?: string;
  hintFacelets?: string;
};

export function CubePreview({
  event,
  scramble,
  size = 120,
}: {
  event: CubeEvent;
  scramble: string | null;
  size?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<TwistyPlayerLike | null>(null);

  // Lazy-load cubing/twisty once on mount (client only).
  useEffect(() => {
    let disposed = false;
    (async () => {
      const { TwistyPlayer } = await import("cubing/twisty");
      if (disposed || !containerRef.current) return;
      const player = new TwistyPlayer({
        puzzle: PUZZLE_ID[event] as never,
        alg: scramble ?? "",
        visualization: "2D",
        background: "none",
        controlPanel: "none",
        hintFacelets: "none",
      }) as unknown as TwistyPlayerLike;
      player.style.width = `${size}px`;
      player.style.height = `${size}px`;
      containerRef.current.replaceChildren(player);
      playerRef.current = player;
    })();
    return () => {
      disposed = true;
      playerRef.current = null;
      if (containerRef.current) containerRef.current.replaceChildren();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update puzzle/visualization when the event changes.
  useEffect(() => {
    const p = playerRef.current;
    if (!p) return;
    p.puzzle = PUZZLE_ID[event];
    p.visualization = "2D";
  }, [event]);

  // Update the scramble alg whenever it changes.
  useEffect(() => {
    const p = playerRef.current;
    if (!p) return;
    p.alg = scramble ?? "";
  }, [scramble]);

  return <div ref={containerRef} style={{ width: size, height: size }} />;
}
