import { z } from "zod/v4";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, authedProcedure } from "../init";
import { recomputeStats } from "@/lib/cubing/stats";
import { CubeEvent, EVENT_MAP, getEnabledStats } from "@/lib/cubing/events";
import { eventService } from "@/lib/services/event";
import { postService } from "@/lib/services/post";
import { practicePostToIPracticePost } from "@/lib/transforms/post";


const solveSchema = z.object({
  timeMs: z.number().int().positive(),
  penalty: z.enum(["plus_two", "dnf"]).optional(),
  scramble: z.string().min(1).max(500),
});

const FEED_PAGE_SIZE = 20;

export const postRouter = createTRPCRouter({
  getUserPosts: authedProcedure
    .input(
      z.object({
        userId: z.string().min(1).max(50),
        cursor: z.string().max(50).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const posts = await ctx.prisma.practicePost.findMany({
        where: { userId: input.userId },
        include: {
          user: true,
          event: true,
          likes: { where: { userId: ctx.viewer.userId }, select: { id: true } },
        },
        orderBy: { createdAt: "desc" },
        take: FEED_PAGE_SIZE + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      });

      let nextCursor: string | undefined;
      if (posts.length > FEED_PAGE_SIZE) {
        nextCursor = posts.pop()!.id;
      }

      return {
        posts: posts.map((p) => ({
          ...practicePostToIPracticePost(p),
          liked: p.likes.length > 0,
        })),
        nextCursor,
      };
    }),

  getFeed: authedProcedure
    .input(
      z.object({
        cursor: z.string().max(50).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const followedUserIds = await ctx.prisma.follow
        .findMany({
          where: { followerId: ctx.viewer.userId },
          select: { followeeId: true },
        })
        .then((rows) => rows.map((r) => r.followeeId));

      // Include the current user's own posts in the feed
      const feedUserIds = [...followedUserIds, ctx.viewer.userId];

      const posts = await ctx.prisma.practicePost.findMany({
        where: { userId: { in: feedUserIds } },
        include: {
          user: true,
          event: true,
          likes: { where: { userId: ctx.viewer.userId }, select: { id: true } },
        },
        orderBy: { createdAt: "desc" },
        take: FEED_PAGE_SIZE + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      });

      let nextCursor: string | undefined;
      if (posts.length > FEED_PAGE_SIZE) {
        nextCursor = posts.pop()!.id;
      }

      return {
        posts: posts.map((p) => ({
          ...practicePostToIPracticePost(p),
          liked: p.likes.length > 0,
        })),
        nextCursor,
      };
    }),

  likePost: authedProcedure
    .input(z.object({ postId: z.string().min(1).max(50) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.$transaction(async (tx) => {
        const existing = await tx.postLike.findUnique({
          where: { userId_postId: { userId: ctx.viewer.userId, postId: input.postId } },
        });
        if (existing) return;
        await tx.postLike.create({
          data: { userId: ctx.viewer.userId, postId: input.postId },
        });
        await tx.practicePost.update({
          where: { id: input.postId },
          data: { numLikes: { increment: 1 } },
        });
      });
      return { success: true };
    }),

  unlikePost: authedProcedure
    .input(z.object({ postId: z.string().min(1).max(50) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.$transaction(async (tx) => {
        const existing = await tx.postLike.findUnique({
          where: { userId_postId: { userId: ctx.viewer.userId, postId: input.postId } },
        });
        if (!existing) return;
        await tx.postLike.delete({
          where: { id: existing.id },
        });
        await tx.practicePost.update({
          where: { id: input.postId },
          data: { numLikes: { decrement: 1 } },
        });
      });
      return { success: true };
    }),

  createPracticeSessionPost: authedProcedure
    .input(
      z.object({
        event: z.nativeEnum(CubeEvent),
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
