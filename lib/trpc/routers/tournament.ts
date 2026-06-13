import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, authedProcedure } from "../init";
import { tournamentService } from "@/lib/services/tournament";
import { getCurrentTournamentDatePST } from "@/lib/tournament/date";
import { CubeEvent } from "@/lib/cubing/events";
import { DNF_SENTINEL } from "@/lib/cubing/stats";

const contestNumberSchema = z.number().int().positive().max(100000);
const cuidSchema = z.string().min(1).max(50);

export const tournamentRouter = createTRPCRouter({
  // Get the viewer's status across all events for a given contest.
  getContestStatus: authedProcedure
    .input(
      z.object({
        number: contestNumberSchema.optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const service = tournamentService(ctx);
      const tournament = await service.getTournament(input.number);
      if (!tournament) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Tournament not found" });
      }

      const [events, viewerUser] = await Promise.all([
        service.getContestStatus(tournament.id),
        ctx.prisma.user.findUnique({
          where: { id: ctx.viewer.userId },
          select: { wcaId: true },
        }),
      ]);

      return {
        tournament: {
          id: tournament.id,
          number: tournament.number,
          name: tournament.name,
          datePST: tournament.datePST,
        },
        events,
        viewerHasWca: !!viewerUser?.wcaId,
      };
    }),

  // Leaderboard overview — top 3 + viewer's entry for all events.
  getLeaderboardOverview: authedProcedure
    .input(
      z.object({
        tournamentNumber: contestNumberSchema.optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const service = tournamentService(ctx);
      const tournament = await service.getTournament(input.tournamentNumber);
      if (!tournament) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Tournament not found" });
      }

      const [overview, viewerUser] = await Promise.all([
        service.getLeaderboardOverview(tournament.id),
        ctx.prisma.user.findUnique({
          where: { id: ctx.viewer.userId },
          select: { wcaId: true },
        }),
      ]);

      return {
        tournament: {
          id: tournament.id,
          number: tournament.number,
          name: tournament.name,
          datePST: tournament.datePST,
        },
        events: overview,
        viewerHasWca: !!viewerUser?.wcaId,
      };
    }),

  // Get the full paginated leaderboard for a specific event.
  getLeaderboard: authedProcedure
    .input(
      z.object({
        tournamentNumber: contestNumberSchema,
        eventId: z.nativeEnum(CubeEvent),
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

      const [leaderboard, viewerUser] = await Promise.all([
        service.getLeaderboard(
          tournament.id,
          input.eventId,
          input.page,
          input.pageSize
        ),
        ctx.prisma.user.findUnique({
          where: { id: ctx.viewer.userId },
          select: { wcaId: true },
        }),
      ]);

      return {
        tournament: {
          id: tournament.id,
          number: tournament.number,
          name: tournament.name,
          datePST: tournament.datePST,
        },
        ...leaderboard,
        viewerHasWca: !!viewerUser?.wcaId,
      };
    }),

  // Paginated tournament history for a user, most recent first.
  // Ranks are computed against WCA-linked competitors only (matches the public
  // leaderboard). Entries include medals where applicable.
  getUserHistory: authedProcedure
    .input(
      z.object({
        userId: cuidSchema,
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(50).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const tournamentWhere = {
        entries: { some: { userId: input.userId, result: { not: null } } },
      };

      const [pagedTournaments, totalCount] = await Promise.all([
        ctx.prisma.tournament.findMany({
          where: tournamentWhere,
          orderBy: { number: "desc" },
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
          select: { id: true, number: true, name: true, datePST: true },
        }),
        ctx.prisma.tournament.count({ where: tournamentWhere }),
      ]);

      const totalPages = Math.max(1, Math.ceil(totalCount / input.pageSize));

      if (pagedTournaments.length === 0) {
        return { tournaments: [], page: input.page, pageSize: input.pageSize, totalCount, totalPages };
      }

      const tournamentIds = pagedTournaments.map((t) => t.id);
      const entries = await ctx.prisma.tournamentEntry.findMany({
        where: {
          userId: input.userId,
          result: { not: null },
          tournamentId: { in: tournamentIds },
        },
        include: {
          tournament: { select: { id: true, number: true, name: true, datePST: true } },
          event: { select: { name: true } },
        },
        orderBy: [{ tournament: { number: "desc" } }, { event: { name: "asc" } }],
      });

      // Pull this user's solves for every scramble set on the page in one query,
      // then group by scrambleSetId for O(1) attachment to each entry.
      const scrambleSetIds = entries.map((e) => e.scrambleSetId);
      const solves = scrambleSetIds.length === 0
        ? []
        : await ctx.prisma.solve.findMany({
            where: {
              userId: input.userId,
              scrambleSetId: { in: scrambleSetIds },
            },
            orderBy: { scrambleSetIndex: "asc" },
            select: { scrambleSetId: true, time: true, penalty: true },
          });
      const solvesBySet = new Map<string, Array<{ time: number; penalty: "plus_two" | "dnf" | null }>>();
      for (const s of solves) {
        const arr = solvesBySet.get(s.scrambleSetId) ?? [];
        arr.push({ time: s.time, penalty: s.penalty });
        solvesBySet.set(s.scrambleSetId, arr);
      }

      // Compute rank + total competitors per entry in parallel.
      const enriched = await Promise.all(
        entries.map(async (e) => {
          const [betterCount, totalCompetitors] = await Promise.all([
            e.result !== null && e.result < DNF_SENTINEL
              ? ctx.prisma.tournamentEntry.count({
                  where: {
                    tournamentId: e.tournamentId,
                    eventId: e.eventId,
                    result: { lt: e.result, not: null },
                    user: { wcaId: { not: null } },
                  },
                })
              : Promise.resolve(0),
            ctx.prisma.tournamentEntry.count({
              where: {
                tournamentId: e.tournamentId,
                eventId: e.eventId,
                result: { not: null, lt: DNF_SENTINEL },
                user: { wcaId: { not: null } },
              },
            }),
          ]);
          return {
            ...e,
            rank: e.result !== null && e.result < DNF_SENTINEL ? betterCount + 1 : null,
            totalCompetitors,
          };
        })
      );

      const medals = await ctx.prisma.medal.findMany({
        where: { userId: input.userId, tournamentId: { in: tournamentIds } },
        select: { tournamentId: true, eventId: true, type: true },
      });
      const medalKey = (t: string, e: string) => `${t}:${e}`;
      const medalMap = new Map(medals.map((m) => [medalKey(m.tournamentId, m.eventId), m.type]));

      const byTournament = new Map<string, {
        id: string;
        number: number;
        name: string | null;
        datePST: string;
        entries: Array<{
          eventName: string;
          result: number | null;
          rank: number | null;
          totalCompetitors: number;
          medal: "GOLD" | "SILVER" | "BRONZE" | null;
          solves: Array<{ time: number; penalty: "plus_two" | "dnf" | null }>;
        }>;
      }>();

      for (const e of enriched) {
        if (!byTournament.has(e.tournamentId)) {
          byTournament.set(e.tournamentId, {
            id: e.tournament.id,
            number: e.tournament.number,
            name: e.tournament.name,
            datePST: e.tournament.datePST,
            entries: [],
          });
        }
        byTournament.get(e.tournamentId)!.entries.push({
          eventName: e.event.name,
          result: e.result,
          rank: e.rank,
          totalCompetitors: e.totalCompetitors,
          medal: medalMap.get(medalKey(e.tournamentId, e.eventId)) ?? null,
          solves: solvesBySet.get(e.scrambleSetId) ?? [],
        });
      }

      return {
        tournaments: Array.from(byTournament.values()),
        page: input.page,
        pageSize: input.pageSize,
        totalCount,
        totalPages,
      };
    }),

  // Start competing in a tournament event. Creates entry if needed.
  start: authedProcedure
    .input(
      z.object({
        tournamentNumber: contestNumberSchema,
        eventId: z.nativeEnum(CubeEvent), // CubeEvent name, e.g. "333"
      })
    )
    .mutation(async ({ ctx, input }) => {
      const service = tournamentService(ctx);
      const tournament = await service.getTournament(input.tournamentNumber);
      if (!tournament) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Tournament not found" });
      }
      if (tournament.datePST !== getCurrentTournamentDatePST()) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This contest has ended" });
      }
      return service.startEvent(tournament.id, input.eventId);
    }),

  // Submit a single solve for a tournament event.
  submitSolve: authedProcedure
    .input(
      z.object({
        entryId: cuidSchema,
        scrambleSetIndex: z.number().int().min(0).max(20),
        timeMs: z.number().int().positive(),
        penalty: z.enum(["plus_two", "dnf"]).nullable().default(null),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const entry = await ctx.prisma.tournamentEntry.findUnique({
        where: { id: input.entryId },
        include: { tournament: true },
      });
      if (!entry) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Tournament entry not found" });
      }
      if (entry.tournament.datePST !== getCurrentTournamentDatePST()) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This contest has ended" });
      }
      const service = tournamentService(ctx);
      return service.submitSolve(input);
    }),
});
