import type { PrismaClient } from "@/app/generated/prisma/client";
import type { ViewerContext } from "@/lib/viewer-context";
export type ServiceContext = {
  prisma: PrismaClient;
  viewer: ViewerContext;
};

export function tournamentService(ctx: ServiceContext) {
  const { prisma, viewer } = ctx;

  return {
    // Find a tournament by number, or get the latest tournament.
    // When no number is provided, we simply fetch the most recent
    // tournament — no date computation needed, avoids timezone issues.
    getTournament: async (number?: number) => {
      if (number !== undefined) {
        return prisma.tournament.findUnique({ where: { number } });
      }
      return prisma.tournament.findFirst({
        orderBy: { number: "desc" },
      });
    },

    // Get the viewer's status across all events for a tournament.
    getContestStatus: async (tournamentId: string) => {
      // Get all of the viewer's entries for this tournament.
      const myEntries = await prisma.tournamentEntry.findMany({
        where: { tournamentId, userId: viewer.userId },
        include: { scrambleSet: true },
      });

      // Get the viewer's solves for all scramble sets they've entered.
      const scrambleSetIds = myEntries.map((e) => e.scrambleSetId);
      const mySolves = scrambleSetIds.length > 0
        ? await prisma.solve.findMany({
            where: {
              scrambleSetId: { in: scrambleSetIds },
              userId: viewer.userId,
            },
            orderBy: { scrambleSetIndex: "asc" },
          })
        : [];

      // Group solves by scrambleSetId.
      const solvesByScrambleSet = new Map<string, typeof mySolves>();
      for (const solve of mySolves) {
        const existing = solvesByScrambleSet.get(solve.scrambleSetId) ?? [];
        existing.push(solve);
        solvesByScrambleSet.set(solve.scrambleSetId, existing);
      }

      // Count competitors per event.
      const totalCounts = await prisma.tournamentEntry.groupBy({
        by: ["eventId"],
        where: { tournamentId },
        _count: true,
      });
      const totalCountMap = new Map(
        totalCounts.map((c) => [c.eventId, c._count])
      );

      // Compute rank per event (count entries with a better result).
      const rankMap = new Map<string, number>();
      for (const entry of myEntries) {
        if (entry.result !== null) {
          const betterCount = await prisma.tournamentEntry.count({
            where: {
              tournamentId,
              eventId: entry.eventId,
              result: { not: null, lt: entry.result },
            },
          });
          rankMap.set(entry.eventId, betterCount + 1);
        }
      }

      // Build per-event response for events the viewer has entered.
      const enteredEventIds = myEntries.map((e) => e.eventId);
      const enteredEvents = myEntries.map((entry) => {
        const solves = solvesByScrambleSet.get(entry.scrambleSetId) ?? [];
        return {
          eventId: entry.eventId,
          entryId: entry.id,
          scrambleSetId: entry.scrambleSetId,
          scrambles: entry.scrambleSet.scrambles as string[],
          result: entry.result,
          solves: solves.map((s) => ({
            id: s.id,
            scrambleSetIndex: s.scrambleSetIndex,
            timeMs: s.time,
            penalty: s.penalty,
          })),
          rank: rankMap.get(entry.eventId) ?? null,
          totalCompetitors: totalCountMap.get(entry.eventId) ?? 0,
        };
      });

      // Include competitor counts for events the viewer hasn't entered.
      const unenteredEvents = totalCounts
        .filter((c) => !enteredEventIds.includes(c.eventId))
        .map((c) => ({
          eventId: c.eventId,
          entryId: null,
          scrambleSetId: null,
          scrambles: null,
          result: null,
          solves: [] as { id: string; scrambleSetIndex: number; timeMs: number; penalty: string | null }[],
          rank: null,
          totalCompetitors: c._count,
        }));

      return [...enteredEvents, ...unenteredEvents];
    },

    // Get paginated leaderboard for a specific event in a tournament.
    getLeaderboard: async (
      tournamentId: string,
      eventId: string,
      page: number,
      pageSize: number
    ) => {
      const offset = (page - 1) * pageSize;

      // Total entries with results.
      const total = await prisma.tournamentEntry.count({
        where: { tournamentId, eventId, result: { not: null } },
      });

      // Paginated entries sorted by result.
      const entries = await prisma.tournamentEntry.findMany({
        where: { tournamentId, eventId, result: { not: null } },
        orderBy: { result: "asc" },
        skip: offset,
        take: pageSize,
        include: {
          user: {
            select: {
              id: true, username: true, firstName: true, lastName: true,
              profilePictureUrl: true, country: true,
            },
          },
          scrambleSet: true,
        },
      });

      // Get solves for all entries on this page.
      const scrambleSetIds = entries.map((e) => e.scrambleSetId);
      const userIds = entries.map((e) => e.userId);
      const solves = await prisma.solve.findMany({
        where: {
          scrambleSetId: { in: scrambleSetIds },
          userId: { in: userIds },
        },
        orderBy: { scrambleSetIndex: "asc" },
      });

      // Group solves by scrambleSetId:userId.
      const solvesMap = new Map<string, typeof solves>();
      for (const solve of solves) {
        const key = `${solve.scrambleSetId}:${solve.userId}`;
        const existing = solvesMap.get(key) ?? [];
        existing.push(solve);
        solvesMap.set(key, existing);
      }

      // Get viewer's entry and rank.
      const viewerEntry = await prisma.tournamentEntry.findFirst({
        where: { tournamentId, eventId, userId: viewer.userId },
      });

      let viewerRank: number | null = null;
      if (viewerEntry?.result != null) {
        const betterCount = await prisma.tournamentEntry.count({
          where: {
            tournamentId, eventId,
            result: { not: null, lt: viewerEntry.result },
          },
        });
        viewerRank = betterCount + 1;
      }

      // Get viewer's solves.
      let viewerSolves: typeof solves = [];
      if (viewerEntry) {
        viewerSolves = await prisma.solve.findMany({
          where: {
            scrambleSetId: viewerEntry.scrambleSetId,
            userId: viewer.userId,
          },
          orderBy: { scrambleSetIndex: "asc" },
        });
      }

      return {
        total,
        entries: entries.map((entry, i) => {
          const key = `${entry.scrambleSetId}:${entry.userId}`;
          const entrySolves = solvesMap.get(key) ?? [];
          return {
            rank: offset + i + 1,
            user: entry.user,
            result: entry.result,
            solves: entrySolves.map((s) => ({
              timeMs: s.time,
              penalty: s.penalty,
              scrambleSetIndex: s.scrambleSetIndex,
            })),
          };
        }),
        viewerEntry: viewerEntry
          ? {
              rank: viewerRank,
              result: viewerEntry.result,
              solves: viewerSolves.map((s) => ({
                timeMs: s.time,
                penalty: s.penalty,
                scrambleSetIndex: s.scrambleSetIndex,
              })),
            }
          : null,
      };
    },
  };
}
