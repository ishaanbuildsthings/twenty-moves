import type { PrismaClient } from "@/app/generated/prisma/client";
import type { ServiceContext } from "./user";

type CreatePracticeSessionInput = {
  eventId: string;
  caption: string;
  youtubeUrl?: string;
  bestSingle: number | null;
  bestAo5: number | null;
  bestAo12: number | null;
  bestAo100: number | null;
  bestMo3: number | null;
  displaySolves: number[];
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

        return tx.practicePost.create({
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
            displaySolves: input.displaySolves,
            numSolves: input.numSolves,
            numLikes: 0,
            numComments: 0,
          },
        });
      }),
  };
}
