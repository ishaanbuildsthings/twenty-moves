import { z } from "zod/v4";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, authedProcedure } from "../init";
import { recomputeStats, extractStatSolves } from "@/lib/cubing/stats";
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
          comments: {
            include: { user: { select: { id: true, username: true, profilePictureUrl: true, firstName: true, lastName: true } } },
            orderBy: { createdAt: "desc" },
          },
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
          comments: p.comments.map((c) => ({
            id: c.id,
            user: c.user,
            body: c.body,
            createdAt: c.createdAt,
          })),
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
          comments: {
            include: { user: { select: { id: true, username: true, profilePictureUrl: true, firstName: true, lastName: true } } },
            orderBy: { createdAt: "desc" },
          },
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
          comments: p.comments.map((c) => ({
            id: c.id,
            user: c.user,
            body: c.body,
            createdAt: c.createdAt,
          })),
        })),
        nextCursor,
      };
    }),

  getPost: authedProcedure
    .input(z.object({ postId: z.string().min(1).max(50) }))
    .query(async ({ ctx, input }) => {
      const post = await ctx.prisma.practicePost.findUnique({
        where: { id: input.postId },
        include: {
          user: true,
          event: true,
          likes: { where: { userId: ctx.viewer.userId }, select: { id: true } },
          comments: {
            include: { user: { select: { id: true, username: true, profilePictureUrl: true, firstName: true, lastName: true } } },
            orderBy: { createdAt: "desc" },
          },
        },
      });

      if (!post) throw new TRPCError({ code: "NOT_FOUND", message: "Post not found" });

      return {
        ...practicePostToIPracticePost(post),
        liked: post.likes.length > 0,
        comments: post.comments.map((c) => ({
          id: c.id,
          user: c.user,
          body: c.body,
          createdAt: c.createdAt,
        })),
      };
    }),

  getPostLikes: authedProcedure
    .input(z.object({ postId: z.string().min(1).max(50) }))
    .query(async ({ ctx, input }) => {
      const likes = await ctx.prisma.postLike.findMany({
        where: { postId: input.postId },
        include: {
          user: {
            select: { id: true, username: true, firstName: true, lastName: true, profilePictureUrl: true },
          },
        },
        orderBy: { createdAt: "desc" },
      });
      return likes.map((l) => l.user);
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

  addComment: authedProcedure
    .input(z.object({ postId: z.string(), body: z.string().min(1).max(200) }))
    .mutation(async ({ ctx, input }) => {
      const comment = await ctx.prisma.$transaction(async (tx) => {
        const c = await tx.postComment.create({
          data: { userId: ctx.viewer.userId, postId: input.postId, body: input.body },
          include: { user: { select: { id: true, username: true, profilePictureUrl: true, firstName: true, lastName: true } } },
        });
        await tx.practicePost.update({
          where: { id: input.postId },
          data: { numComments: { increment: 1 } },
        });
        return c;
      });
      return {
        id: comment.id,
        user: comment.user,
        body: comment.body,
        createdAt: comment.createdAt,
      };
    }),

  deleteComment: authedProcedure
    .input(z.object({ commentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.$transaction(async (tx) => {
        const comment = await tx.postComment.findUnique({
          where: { id: input.commentId },
        });
        if (!comment || comment.userId !== ctx.viewer.userId) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Cannot delete this comment" });
        }
        await tx.postComment.delete({ where: { id: input.commentId } });
        await tx.practicePost.update({
          where: { id: comment.postId },
          data: { numComments: { decrement: 1 } },
        });
      });
      return { success: true };
    }),

  deletePost: authedProcedure
    .input(z.object({ postId: z.string().min(1).max(50) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.$transaction(async (tx) => {
        const post = await tx.practicePost.findUnique({ where: { id: input.postId } });
        if (!post || post.userId !== ctx.viewer.userId) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Cannot delete this post" });
        }

        // Delete related records
        await tx.postLike.deleteMany({ where: { postId: post.id } });
        await tx.postComment.deleteMany({ where: { postId: post.id } });
        await tx.solve.deleteMany({ where: { scrambleSetId: post.scrambleSetId } });
        await tx.practicePost.delete({ where: { id: post.id } });

        // Recompute PBs for this user+event from remaining posts
        const PB_FIELDS: { type: "single" | "mo3" | "avg5" | "avg12" | "avg100"; field: "bestSingle" | "bestMo3" | "bestAo5" | "bestAo12" | "bestAo100" }[] = [
          { type: "single", field: "bestSingle" },
          { type: "mo3", field: "bestMo3" },
          { type: "avg5", field: "bestAo5" },
          { type: "avg12", field: "bestAo12" },
          { type: "avg100", field: "bestAo100" },
        ];

        for (const { type, field } of PB_FIELDS) {
          // Find the best value across all remaining posts for this user+event
          const best = await tx.practicePost.aggregate({
            where: { userId: post.userId, eventId: post.eventId, [field]: { not: null } },
            _min: { [field]: true },
          });

          const bestTime = (best._min as Record<string, number | null>)[field];

          if (bestTime !== null) {
            await tx.personalBest.upsert({
              where: { userId_eventId_type: { userId: post.userId, eventId: post.eventId, type } },
              create: { userId: post.userId, eventId: post.eventId, type, time: bestTime },
              update: { time: bestTime },
            });
          } else {
            // No remaining posts have this stat — delete the PB
            await tx.personalBest.deleteMany({
              where: { userId: post.userId, eventId: post.eventId, type },
            });
          }
        }
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
      const solvesForStats = input.solves.map((s) => ({ timeMs: s.timeMs, penalty: s.penalty ?? null }));
      const solveWindows = extractStatSolves(solvesForStats, input.solves, enabledStats);

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
        singleSolves: solveWindows.singleSolves,
        ao5Solves: solveWindows.ao5Solves,
        ao12Solves: solveWindows.ao12Solves,
        ao100Solves: solveWindows.ao100Solves,
        numSolves: input.solves.length,
        solves: input.solves,
      });
    }),
});
