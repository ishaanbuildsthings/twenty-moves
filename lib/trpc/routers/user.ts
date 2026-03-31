import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { PrismaClientKnownRequestError } from "@prisma/client-runtime-utils";
import { createTRPCRouter, authedProcedure } from "../init";
import { userService } from "@/lib/services/user";
import { NotFoundError } from "@/lib/errors";
import { userToIUser } from "@/lib/transforms/user";
import { publicEnv } from "@/lib/env";

// Shared validation schemas
const usernameSchema = z.string().min(3).max(30).regex(
  /^[a-zA-Z0-9_]+$/,
  "Username can only contain letters, numbers, and underscores"
);
const cuidSchema = z.string().min(1).max(50);

export const userRouter = createTRPCRouter({
  search: authedProcedure
    .input(z.object({ query: z.string().min(1).max(50) }))
    .query(async ({ ctx, input }) => {
      const users = await ctx.prisma.user.findMany({
        where: {
          OR: [
            { username: { contains: input.query, mode: "insensitive" } },
            { firstName: { contains: input.query, mode: "insensitive" } },
            { lastName: { contains: input.query, mode: "insensitive" } },
          ],
        },
        take: 10,
      });
      return users.map((u) => ({
        id: u.id,
        username: u.username,
        firstName: u.firstName,
        lastName: u.lastName,
        profilePictureUrl: u.profilePictureUrl,
        country: u.country,
      }));
    }),

  // Fetch a user by username. Always returns the same public shape.
  // The client determines if it's the viewer's own profile by
  // comparing IDs, and conditionally shows edit controls.
  getByUsername: authedProcedure
    .input(z.object({ username: usernameSchema }))
    .query(async ({ ctx, input }) => {
      let user;
      try {
        user = await userService(ctx).getByUsername(input.username);
      } catch (e) {
        if (e instanceof NotFoundError) {
          throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
        }
        throw e;
      }
      const [medalRows, followerCount, followingCount, pbRows] = await Promise.all([
        ctx.prisma.medal.groupBy({
          by: ["type"],
          where: { userId: user.id },
          _count: true,
        }),
        ctx.prisma.follow.count({ where: { followeeId: user.id } }),
        ctx.prisma.follow.count({ where: { followerId: user.id } }),
        ctx.prisma.personalBest.findMany({
          where: { userId: user.id },
          select: { type: true, time: true, event: { select: { name: true } } },
        }),
      ]);
      return userToIUser(user, medalRows, { followers: followerCount, following: followingCount }, pbRows);
    }),

  // Check if a username is available. Returns { available: boolean }.
  checkUsername: authedProcedure
    .input(z.object({ username: usernameSchema }))
    .query(async ({ ctx, input }) => {
      const existing = await ctx.prisma.user.findUnique({
        where: { username: input.username },
        select: { id: true },
      });
      // Available if no user has it, or if it belongs to the viewer (their current username).
      const available = !existing || existing.id === ctx.viewer.userId;
      return { available };
    }),

  // Check if the viewer is following a user.
  isFollowing: authedProcedure
    .input(z.object({ userId: cuidSchema }))
    .query(async ({ ctx, input }) => {
      const follow = await ctx.prisma.follow.findUnique({
        where: {
          followerId_followeeId: {
            followerId: ctx.viewer.userId,
            followeeId: input.userId,
          },
        },
        select: { id: true },
      });
      return { following: !!follow };
    }),

  // Follow a user.
  follow: authedProcedure
    .input(z.object({ userId: cuidSchema }))
    .mutation(async ({ ctx, input }) => {
      if (input.userId === ctx.viewer.userId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot follow yourself" });
      }
      await ctx.prisma.follow.create({
        data: {
          followerId: ctx.viewer.userId,
          followeeId: input.userId,
        },
      });
      return { success: true };
    }),

  // Unfollow a user.
  unfollow: authedProcedure
    .input(z.object({ userId: cuidSchema }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.follow.deleteMany({
        where: {
          followerId: ctx.viewer.userId,
          followeeId: input.userId,
        },
      });
      return { success: true };
    }),

  // List a user's followers (people who follow them).
  getFollowers: authedProcedure
    .input(z.object({ userId: cuidSchema }))
    .query(async ({ ctx, input }) => {
      const follows = await ctx.prisma.follow.findMany({
        where: { followeeId: input.userId },
        select: {
          follower: {
            select: { id: true, username: true, firstName: true, lastName: true, profilePictureUrl: true, country: true },
          },
        },
        orderBy: { createdAt: "desc" },
      });
      return follows.map((f) => f.follower);
    }),

  // List users that a user is following.
  getFollowing: authedProcedure
    .input(z.object({ userId: cuidSchema }))
    .query(async ({ ctx, input }) => {
      const follows = await ctx.prisma.follow.findMany({
        where: { followerId: input.userId },
        select: {
          followee: {
            select: { id: true, username: true, firstName: true, lastName: true, profilePictureUrl: true, country: true },
          },
        },
        orderBy: { createdAt: "desc" },
      });
      return follows.map((f) => f.followee);
    }),

  // Unlink the viewer's WCA account by clearing their wcaId.
  unlinkWca: authedProcedure
    .mutation(async ({ ctx }) => {
      const user = await userService(ctx).update(ctx.viewer.userId, { wcaId: null });
      return userToIUser(user);
    }),

  // Update the current user's profile.
  updateProfile: authedProcedure
    .input(z.object({
      username: usernameSchema.optional(),
      firstName: z.string().min(1).max(50).optional(),
      lastName: z.string().min(1).max(50).optional(),
      profilePictureUrl: z.string().refine(
        (url) => url.startsWith(`${publicEnv().NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/`),
        { message: "Invalid profile picture URL" }
      ).nullable().optional(),
      country: z.string().length(2).nullable().optional(),
      bio: z.string().max(100).optional(),
      youtubeChannelUrl: z.string().max(200).url().refine(
        (url) => /^https?:\/\/(www\.)?youtube\.com\/(c\/|channel\/|@)/.test(url),
        { message: "Must be a YouTube channel URL" }
      ).nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const user = await userService(ctx).update(ctx.viewer.userId, input);
        return userToIUser(user);
      } catch (e) {
        if (e instanceof PrismaClientKnownRequestError && e.code === "P2002") {
          throw new TRPCError({ code: "CONFLICT", message: "Username already taken" });
        }
        throw e;
      }
    }),

});
