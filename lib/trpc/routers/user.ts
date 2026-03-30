import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { PrismaClientKnownRequestError } from "@prisma/client-runtime-utils";
import { createTRPCRouter, authedProcedure } from "../init";
import { userService } from "@/lib/services/user";
import { userToIUser } from "@/lib/transforms/user";
import { publicEnv } from "@/lib/env";

export const userRouter = createTRPCRouter({
  // Fetch a user by username. Always returns the same public shape.
  // The client determines if it's the viewer's own profile by
  // comparing IDs, and conditionally shows edit controls.
  getByUsername: authedProcedure
    .input(z.object({ username: z.string() }))
    .query(async ({ ctx, input }) => {
      const user = await userService(ctx).getByUsername(input.username);
      const medalRows = await ctx.prisma.medal.groupBy({
        by: ["type"],
        where: { userId: user.id },
        _count: true,
      });
      return userToIUser(user, medalRows);
    }),

  // Check if a username is available. Returns { available: boolean }.
  checkUsername: authedProcedure
    .input(z.object({ username: z.string().min(3).max(30) }))
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
    .input(z.object({ userId: z.string() }))
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
    .input(z.object({ userId: z.string() }))
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
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.follow.deleteMany({
        where: {
          followerId: ctx.viewer.userId,
          followeeId: input.userId,
        },
      });
      return { success: true };
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
      username: z.string().min(3).max(30).optional(),
      firstName: z.string().min(1).max(50).optional(),
      lastName: z.string().min(1).max(50).optional(),
      profilePictureUrl: z.string().refine(
        (url) => url.startsWith(`${publicEnv().NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/`),
        { message: "Invalid profile picture URL" }
      ).nullable().optional(),
      country: z.string().length(2).nullable().optional(),
      bio: z.string().max(100).optional(),
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
