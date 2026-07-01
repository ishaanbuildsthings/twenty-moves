import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, authedProcedure } from "../init";
import { clubService } from "@/lib/services/club";
import { NotFoundError } from "@/lib/errors";
import { CubeEvent } from "@/lib/cubing/events";

const cuidSchema = z.string().min(1).max(50);

// Maps service-layer errors to client-safe TRPCErrors. Always throws.
function throwClubError(e: unknown): never {
  if (e instanceof NotFoundError) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Club not found" });
  }
  if (e instanceof Error && e.message === "NOT_OWNER") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Only the club owner can do that" });
  }
  throw e;
}

export const clubRouter = createTRPCRouter({
  // All clubs, for the discover page.
  list: authedProcedure.query(async ({ ctx }) => {
    return clubService(ctx).list();
  }),

  // Clubs a given user belongs to (defaults to the viewer).
  listForUser: authedProcedure
    .input(z.object({ userId: cuidSchema }))
    .query(async ({ ctx, input }) => {
      return clubService(ctx).listForUser(input.userId);
    }),

  getById: authedProcedure
    .input(z.object({ clubId: cuidSchema }))
    .query(async ({ ctx, input }) => {
      try {
        return await clubService(ctx).getById(input.clubId);
      } catch (e) {
        if (e instanceof NotFoundError) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Club not found" });
        }
        throw e;
      }
    }),

  // Weekly (Mon–Sun PST) per-event leaderboard: solves + average per member.
  getLeaderboard: authedProcedure
    .input(z.object({ clubId: cuidSchema, event: z.nativeEnum(CubeEvent) }))
    .query(async ({ ctx, input }) => {
      return clubService(ctx).weeklyLeaderboard(input.clubId, input.event);
    }),

  create: authedProcedure
    .input(
      z.object({
        name: z.string().min(3).max(50),
        description: z.string().max(300).default(""),
        isPrivate: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return clubService(ctx).create(input);
    }),

  // Owner-only: pending join requests.
  getJoinRequests: authedProcedure
    .input(z.object({ clubId: cuidSchema }))
    .query(async ({ ctx, input }) => {
      try {
        return await clubService(ctx).listRequests(input.clubId);
      } catch (e) {
        throwClubError(e);
      }
    }),

  // Owner-only: approve a pending join request.
  approveRequest: authedProcedure
    .input(z.object({ clubId: cuidSchema, userId: cuidSchema }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await clubService(ctx).approveRequest(input.clubId, input.userId);
      } catch (e) {
        throwClubError(e);
      }
    }),

  // Owner-only: deny a pending join request.
  denyRequest: authedProcedure
    .input(z.object({ clubId: cuidSchema, userId: cuidSchema }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await clubService(ctx).denyRequest(input.clubId, input.userId);
      } catch (e) {
        throwClubError(e);
      }
    }),

  // Owner-only: edit the club description.
  updateDescription: authedProcedure
    .input(z.object({ clubId: cuidSchema, description: z.string().max(300) }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await clubService(ctx).updateDescription(input.clubId, input.description);
      } catch (e) {
        throwClubError(e);
      }
    }),

  // Owner-only: delete the club.
  delete: authedProcedure
    .input(z.object({ clubId: cuidSchema }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await clubService(ctx).remove(input.clubId);
      } catch (e) {
        throwClubError(e);
      }
    }),

  join: authedProcedure
    .input(z.object({ clubId: cuidSchema }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await clubService(ctx).join(input.clubId);
      } catch (e) {
        throwClubError(e);
      }
    }),

  leave: authedProcedure
    .input(z.object({ clubId: cuidSchema }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await clubService(ctx).leave(input.clubId);
      } catch (e) {
        if (e instanceof Error && e.message === "OWNER_CANNOT_LEAVE") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Club owners can't leave their own club",
          });
        }
        throw e;
      }
    }),
});
