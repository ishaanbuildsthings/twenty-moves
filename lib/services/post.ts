import type { PbType } from "@/app/generated/prisma/client";
import type { ServiceContext } from "./user";
import { DNF_SENTINEL } from "@/lib/cubing/stats";

type CreatePracticeSessionInput = {
  eventId: string;
  caption: string;
  youtubeUrl?: string;
  bestSingle: number | null;
  bestAo5: number | null;
  bestAo12: number | null;
  bestAo100: number | null;
  bestMo3: number | null;
  sessionMean: number | null;
  singleSolves: { time: number; penalty: string | null; scramble: string }[] | null;
  ao5Solves: { time: number; penalty: string | null; scramble: string }[] | null;
  ao12Solves: { time: number; penalty: string | null; scramble: string }[] | null;
  ao100Solves: { time: number; penalty: string | null; scramble: string }[] | null;
  numSolves: number;
  solves: {
    timeMs: number;
    penalty?: "plus_two" | "dnf";
    scramble: string;
  }[];
};

export function postService(ctx: ServiceContext) {
  const { prisma, viewer } = ctx;
  return {
    createPracticeSession: (input: CreatePracticeSessionInput) =>
      prisma.$transaction(async (tx) => {
        const scrambleSet = await tx.scrambleSet.create({
          data: {
            eventId: input.eventId,
            scrambles: input.solves.map((s) => s.scramble),
          },
        });

        await tx.solve.createMany({
          data: input.solves.map((s, i) => ({
            userId: viewer.userId,
            eventId: input.eventId,
            scrambleSetId: scrambleSet.id,
            scrambleSetIndex: i,
            time: s.timeMs,
            penalty: s.penalty ?? undefined,
          })),
        });

        const post = await tx.practicePost.create({
          data: {
            userId: viewer.userId,
            eventId: input.eventId,
            scrambleSetId: scrambleSet.id,
            caption: input.caption,
            youtubeUrl: input.youtubeUrl,
            bestSingle: input.bestSingle,
            bestAo5: input.bestAo5,
            bestAo12: input.bestAo12,
            bestAo100: input.bestAo100,
            bestMo3: input.bestMo3,
            sessionMean: input.sessionMean,
            singleSolves: input.singleSolves ?? undefined,
            ao5Solves: input.ao5Solves ?? undefined,
            ao12Solves: input.ao12Solves ?? undefined,
            ao100Solves: input.ao100Solves ?? undefined,
            numSolves: input.numSolves,
            numLikes: 0,
            numComments: 0,
          },
        });

        // Upsert personal bests — only if faster than existing.
        // Track which stats are new PBs so we can flag them on the post.
        const candidates: { type: PbType; time: number | null; pbField: string }[] = [
          { type: "single", time: input.bestSingle, pbField: "isPbSingle" },
          { type: "mo3", time: input.bestMo3, pbField: "isPbMo3" },
          { type: "avg5", time: input.bestAo5, pbField: "isPbAo5" },
          { type: "avg12", time: input.bestAo12, pbField: "isPbAo12" },
          { type: "avg100", time: input.bestAo100, pbField: "isPbAo100" },
        ];

        const pbFlags: Record<string, boolean> = {};

        for (const { type, time, pbField } of candidates) {
          if (time === null || time >= DNF_SENTINEL) continue;
          const existing = await tx.personalBest.findUnique({
            where: { userId_eventId_type: { userId: viewer.userId, eventId: input.eventId, type } },
          });
          if (!existing || time <= existing.time) {
            await tx.personalBest.upsert({
              where: { userId_eventId_type: { userId: viewer.userId, eventId: input.eventId, type } },
              create: { userId: viewer.userId, eventId: input.eventId, type, time },
              update: { time },
            });
            pbFlags[pbField] = true;
          }
        }

        // Update post with PB flags if any were set
        if (Object.keys(pbFlags).length > 0) {
          return tx.practicePost.update({
            where: { id: post.id },
            data: pbFlags,
          });
        }

        return post;
      }),
  };
}
