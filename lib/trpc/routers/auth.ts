import { z } from "zod/v4";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, baseProcedure, authedProcedure } from "../init";
import { userToIUser } from "@/lib/transforms/user";
import { publicEnv } from "@/lib/env";

export const authRouter = createTRPCRouter({
  // Creates a profile for a user who has signed in with Supabase but
  // doesn't have a User row yet. Uses baseProcedure (not authedProcedure)
  // because the viewer is null until the User row exists.
  createProfile: baseProcedure
    .input(
      z.object({
        username: z.string().min(3).max(30),
        firstName: z.string().min(1).max(50),
        lastName: z.string().min(1).max(50),
        profilePictureUrl: z.string().refine(
          (url) => url.startsWith(`${publicEnv().NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/`),
          { message: "Invalid profile picture URL" }
        ).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const {
        data: { user: supabaseUser },
      } = await ctx.supabase.auth.getUser();

      if (!supabaseUser) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }

      const existing = await ctx.prisma.user.findUnique({
        where: { supabaseId: supabaseUser.id },
      });
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Profile already exists",
        });
      }

      const user = await ctx.prisma.user.create({
        data: {
          supabaseId: supabaseUser.id,
          username: input.username,
          firstName: input.firstName,
          lastName: input.lastName,
          profilePictureUrl: input.profilePictureUrl,
        },
      });

      return userToIUser(user);
    }),

  // Returns the current viewer's auth state without throwing. Used by
  // (app)/layout.tsx to determine where to redirect.
  whoAmI: baseProcedure.query(async ({ ctx }) => {
    const {
      data: { user: supabaseUser },
    } = await ctx.supabase.auth.getUser();

    if (!supabaseUser) {
      return { state: "unauthenticated" as const };
    }

    const user = await ctx.prisma.user.findUnique({
      where: { supabaseId: supabaseUser.id },
    });

    if (!user) {
      return { state: "needs-profile" as const };
    }

    return { state: "ready" as const, user: userToIUser(user) };
  }),
});
