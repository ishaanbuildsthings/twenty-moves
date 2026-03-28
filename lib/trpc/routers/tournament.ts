import { z } from "zod";
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
        return { tournament: null, events: [] };
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

  // Get the leaderboard for a specific event in a contest.
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
        return {
          tournament: null,
          total: 0,
          entries: [],
          viewerEntry: null,
        };
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
});
