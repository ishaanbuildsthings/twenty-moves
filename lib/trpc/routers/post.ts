import { z } from "zod/v4";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, authedProcedure } from "../init";
import { recomputeStats } from "@/lib/cubing/stats";
import { EVENT_MAP } from "@/lib/cubing/events";
import { eventService } from "@/lib/services/event";
import { postService } from "@/lib/services/post";

const DNF_SENTINEL = 999_999_999;

// Infinity (all-DNF average) can't be stored as Int — use sentinel value.
function finiteOrDnf(n: number | null): number | null {
  if (n === null) return null;
  if (!isFinite(n)) return DNF_SENTINEL;
  return n;
}

const solveSchema = z.object({
  timeMs: z.number().int().positive(),
  penalty: z.enum(["plus_two", "dnf"]).optional(),
  scramble: z.string().min(1),
});

export const postRouter = createTRPCRouter({
  createPracticeSessionPost: authedProcedure
    .input(
      z.object({
        event: z.string(),
        solves: z.array(solveSchema).min(1).max(1000),
        caption: z.string().max(500).default(""),
        youtubeUrl: z.string().url().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const eventConfig = EVENT_MAP[input.event as keyof typeof EVENT_MAP];
      if (!eventConfig) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Unknown event" });
      }

      const dbEvent = await eventService(ctx).getByName(input.event);
      if (!dbEvent) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Event not found" });
      }

      const stats = recomputeStats(
        input.event,
        input.solves.map((s) => ({ timeMs: s.timeMs, penalty: s.penalty ?? null })),
        eventConfig.stats
      );

      const displayCount = eventConfig.stats.includes("ao5") ? 5
        : eventConfig.stats.includes("mo3") ? 3
        : 1;

      return postService(ctx).createPracticeSession({
        userId: ctx.viewer.userId,
        eventId: dbEvent.id,
        caption: input.caption,
        youtubeUrl: input.youtubeUrl,
        bestSingle: finiteOrDnf(stats.bestSingle),
        bestAo5: finiteOrDnf(stats.bestAo5),
        bestAo12: finiteOrDnf(stats.bestAo12),
        bestAo100: finiteOrDnf(stats.bestAo100),
        bestMo3: finiteOrDnf(stats.bestMo3),
        displaySolves: input.solves.slice(0, displayCount).map((s) => s.timeMs),
        numSolves: input.solves.length,
        solves: input.solves,
      });
    }),
});
