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
      return userToIUser(user);
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
