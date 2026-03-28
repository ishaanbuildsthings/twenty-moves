import { z } from "zod/v4";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, authedProcedure } from "../init";
import { recomputeStats } from "@/lib/cubing/stats";
import { EVENT_MAP, getEnabledStats } from "@/lib/cubing/events";
import { eventService } from "@/lib/services/event";
import { postService } from "@/lib/services/post";


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
        getEnabledStats(eventConfig.id)
      );

      const enabledStats = getEnabledStats(eventConfig.id);
      const displayCount = enabledStats.includes("ao5") ? 5
        : enabledStats.includes("mo3") ? 3
        : 1;

      return postService(ctx).createPracticeSession({
        eventId: dbEvent.id,
        caption: input.caption,
        youtubeUrl: input.youtubeUrl,
        bestSingle: stats.bestSingle,
        bestAo5: stats.bestAo5,
        bestAo12: stats.bestAo12,
        bestAo100: stats.bestAo100,
        bestMo3: stats.bestMo3,
        sessionMean: stats.sessionMean,
        displaySolves: input.solves.slice(0, displayCount).map((s) => s.timeMs),
        numSolves: input.solves.length,
        solves: input.solves,
      });
    }),
});
