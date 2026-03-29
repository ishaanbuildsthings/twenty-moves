import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, authedProcedure } from "../init";
import { tournamentService } from "@/lib/services/tournament";

export const tournamentRouter = createTRPCRouter({
  // Get the viewer's status across all events for a given contest.
  getContestStatus: authedProcedure
    .input(
      z.object({
        number: z.number().int().positive().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const service = tournamentService(ctx);
      const tournament = await service.getTournament(input.number);
      if (!tournament) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Tournament not found" });
      }

      const events = await service.getContestStatus(tournament.id);

      return {
        tournament: {
          id: tournament.id,
          number: tournament.number,
          name: tournament.name,
          datePST: tournament.datePST,
        },
        events,
      };
    }),

  // Leaderboard overview — top 3 + viewer's entry for all events.
  getLeaderboardOverview: authedProcedure
    .input(
      z.object({
        tournamentNumber: z.number().int().positive().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const service = tournamentService(ctx);
      const tournament = await service.getTournament(input.tournamentNumber);
      if (!tournament) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Tournament not found" });
      }

      const overview = await service.getLeaderboardOverview(tournament.id);

      return {
        tournament: {
          id: tournament.id,
          number: tournament.number,
          name: tournament.name,
          datePST: tournament.datePST,
        },
        events: overview,
      };
    }),

  // Get the full paginated leaderboard for a specific event.
  getLeaderboard: authedProcedure
    .input(
      z.object({
        tournamentNumber: z.number().int().positive(),
        eventId: z.string(),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(25),
      })
    )
    .query(async ({ ctx, input }) => {
      const service = tournamentService(ctx);
      const tournament = await service.getTournament(input.tournamentNumber);
      if (!tournament) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Tournament not found" });
      }

      const leaderboard = await service.getLeaderboard(
        tournament.id,
        input.eventId,
        input.page,
        input.pageSize
      );

      return {
        tournament: {
          id: tournament.id,
          number: tournament.number,
          name: tournament.name,
          datePST: tournament.datePST,
        },
        ...leaderboard,
      };
    }),

  // Start competing in a tournament event. Creates entry if needed.
  start: authedProcedure
    .input(
      z.object({
        tournamentNumber: z.number().int().positive(),
        eventId: z.string(), // CubeEvent name, e.g. "333"
      })
    )
    .mutation(async ({ ctx, input }) => {
      const service = tournamentService(ctx);
      const tournament = await service.getTournament(input.tournamentNumber);
      if (!tournament) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Tournament not found" });
      }
      return service.startEvent(tournament.id, input.eventId);
    }),

  // Submit a single solve for a tournament event.
  submitSolve: authedProcedure
    .input(
      z.object({
        entryId: z.string(),
        scrambleSetIndex: z.number().int().min(0),
        timeMs: z.number().int().positive(),
        penalty: z.enum(["plus_two", "dnf"]).nullable().default(null),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const service = tournamentService(ctx);
      return service.submitSolve(input);
    }),
});
