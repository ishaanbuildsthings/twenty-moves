import type { PrismaClient } from "@/app/generated/prisma/client";
import type { ViewerContext } from "@/lib/viewer-context";
import { getCurrentTournamentDatePST } from "@/lib/tournament/date";
import { generateScramble } from "@/lib/cubing/scramble";
import { EVENT_CONFIGS } from "@/lib/cubing/events";

export type ServiceContext = {
  prisma: PrismaClient;
  viewer: ViewerContext;
};

import { DNF_SENTINEL } from "@/lib/cubing/stats";

export function tournamentService(ctx: ServiceContext) {
  const { prisma, viewer } = ctx;

  return {
    // Find a tournament by number, or find/create today's tournament.
    // When no number is provided, checks if the latest tournament
    // matches today's PST date. If not, creates a new tournament
    // with scramble sets for all events.
    getTournament: async (number?: number) => {
      if (number !== undefined) {
        return prisma.tournament.findUnique({ where: { number } });
      }

      const todayPST = getCurrentTournamentDatePST();

      // Check if the latest tournament is for today.
      const latest = await prisma.tournament.findFirst({
        orderBy: { number: "desc" },
      });

      if (latest && latest.datePST === todayPST) {
        return latest;
      }

      // Need to create a new tournament for today.
      // Look up all Event records to map CubeEvent names → database UUIDs.
      const dbEvents = await prisma.event.findMany();
      const eventNameToId = new Map(dbEvents.map((e) => [e.name, e.id]));

      // Use a try/catch for the race condition — if another request
      // creates it first, the unique constraint on datePST catches it.
      try {
        return await prisma.$transaction(async (tx) => {
          const tournament = await tx.tournament.create({
            data: { datePST: todayPST },
          });

          // Create scramble sets for all events.
          for (const eventConfig of EVENT_CONFIGS) {
            const dbEventId = eventNameToId.get(eventConfig.id);
            if (!dbEventId) continue; // Skip if event not in DB

            const scrambles: string[] = [];
            for (let i = 0; i < eventConfig.tournamentSolveCount; i++) {
              scrambles.push(generateScramble(eventConfig.id));
            }

            await tx.scrambleSet.create({
              data: {
                eventId: dbEventId,
                tournamentId: tournament.id,
                scrambles,
              },
            });
          }

          return tournament;
        });
      } catch {
        // Another request created the tournament — read it.
        return prisma.tournament.findFirst({
          where: { datePST: todayPST },
        });
      }
    },

    // Get the viewer's status across all events for a tournament.
    getContestStatus: async (tournamentId: string) => {
      // Get all of the viewer's entries for this tournament.
      const myEntries = await prisma.tournamentEntry.findMany({
        where: { tournamentId, userId: viewer.userId },
        include: { scrambleSet: true, event: true },
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

      // Compute rank per event. If we have a result, count how many are
      // better. If no result yet (in-progress), rank after all finishers.
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
        } else {
          const finisherCount = await prisma.tournamentEntry.count({
            where: {
              tournamentId,
              eventId: entry.eventId,
              result: { not: null },
            },
          });
          rankMap.set(entry.eventId, finisherCount + 1);
        }
      }

      // Build per-event response for events the viewer has entered.
      const enteredEventIds = myEntries.map((e) => e.eventId);
      const enteredEvents = myEntries.map((entry) => {
        const solves = solvesByScrambleSet.get(entry.scrambleSetId) ?? [];
        return {
          eventId: entry.eventId,
          eventName: entry.event.name,
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

      // Competitor counts for events the viewer hasn't entered.
      // Look up event names for unentered events.
      const unenteredEventIds = totalCounts
        .filter((c) => !enteredEventIds.includes(c.eventId))
        .map((c) => c.eventId);
      const unenteredEventRecords = unenteredEventIds.length > 0
        ? await prisma.event.findMany({ where: { id: { in: unenteredEventIds } } })
        : [];
      const eventNameMap = new Map(unenteredEventRecords.map((e) => [e.id, e.name]));

      const unenteredEvents = totalCounts
        .filter((c) => !enteredEventIds.includes(c.eventId))
        .map((c) => ({
          eventId: c.eventId,
          eventName: eventNameMap.get(c.eventId) ?? c.eventId,
          totalCompetitors: c._count,
        }));

      return { enteredEvents, unenteredEvents };
    },

    // Leaderboard overview — top 3 + viewer's entry for ALL events.
    // Used on the leaderboard landing page (stubbed cards).
    getLeaderboardOverview: async (tournamentId: string) => {
      // Get all distinct events with ANY entries (including in-progress)
      // so the competitor count includes everyone.
      const allEventGroups = await prisma.tournamentEntry.groupBy({
        by: ["eventId"],
        where: { tournamentId },
        _count: true,
      });

      // Look up event names for all groups.
      const eventIds = allEventGroups.map((g) => g.eventId);
      const events = await prisma.event.findMany({ where: { id: { in: eventIds } } });
      const overviewEventNameMap = new Map(events.map((e) => [e.id, e.name]));

      const overviewByEvent = await Promise.all(
        allEventGroups.map(async (group) => {
          // Top 3 for this event — only entries with finished results.
          const top3 = await prisma.tournamentEntry.findMany({
            where: { tournamentId, eventId: group.eventId, result: { not: null } },
            orderBy: { result: "asc" },
            take: 3,
            include: {
              user: {
                select: {
                  id: true, username: true, firstName: true, lastName: true,
                  profilePictureUrl: true, country: true,
                },
              },
            },
          });

          // Get solves for top 3. All entries for the same event share one
          // scramble set, so we only need the single scrambleSetId + the user IDs.
          // top3 can be empty if all entries have null results (in-progress).
          const top3UserIds = top3.map((e) => e.userId);
          const top3Solves = top3.length > 0
            ? await prisma.solve.findMany({
                where: {
                  scrambleSetId: top3[0].scrambleSetId,
                  userId: { in: top3UserIds },
                },
                orderBy: { scrambleSetIndex: "asc" },
              })
            : [];

          // Group solves by userId (scrambleSetId is the same for all).
          const solvesMap = new Map<string, typeof top3Solves>();
          for (const solve of top3Solves) {
            const existing = solvesMap.get(solve.userId) ?? [];
            existing.push(solve);
            solvesMap.set(solve.userId, existing);
          }

          // Viewer's entry for this event.
          const viewerEntry = await prisma.tournamentEntry.findFirst({
            where: { tournamentId, eventId: group.eventId, userId: viewer.userId },
          });

          let viewerRank: number | null = null;
          let viewerSolves: typeof top3Solves = [];
          if (viewerEntry) {
            // Always fetch viewer's solves, even if result is null (partial progress).
            viewerSolves = await prisma.solve.findMany({
              where: {
                scrambleSetId: viewerEntry.scrambleSetId,
                userId: viewer.userId,
              },
              orderBy: { scrambleSetIndex: "asc" },
            });

            if (viewerEntry.result !== null) {
              // Has a result — rank among finishers with better results.
              const betterCount = await prisma.tournamentEntry.count({
                where: {
                  tournamentId, eventId: group.eventId,
                  result: { not: null, lt: viewerEntry.result },
                },
              });
              viewerRank = betterCount + 1;
            } else {
              // No result yet — rank after all finishers.
              const finisherCount = await prisma.tournamentEntry.count({
                where: {
                  tournamentId, eventId: group.eventId,
                  result: { not: null },
                },
              });
              viewerRank = finisherCount + 1;
            }
          }

          return {
            eventId: group.eventId,
            eventName: overviewEventNameMap.get(group.eventId) ?? group.eventId,
            totalCompetitors: group._count,
            top3: top3.map((entry, i) => {
              const entrySolves = solvesMap.get(entry.userId) ?? [];
              return {
                rank: i + 1,
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
        })
      );

      return overviewByEvent;
    },

    // Get paginated leaderboard for a specific event in a tournament.
    // eventName is the CubeEvent enum value (e.g., "333", "pyram"),
    // which we resolve to the database Event UUID.
    getLeaderboard: async (
      tournamentId: string,
      eventName: string,
      page: number,
      pageSize: number
    ) => {
      // Resolve event name to database ID.
      const event = await prisma.event.findFirst({ where: { name: eventName } });
      if (!event) return { total: 0, entries: [], viewerEntry: null };
      const eventId = event.id;

      const offset = (page - 1) * pageSize;

      // Total entries (all competitors, including in-progress).
      const total = await prisma.tournamentEntry.count({
        where: { tournamentId, eventId },
      });

      // Paginated entries — finished results first (ascending), then
      // in-progress (null) at the end.
      const entries = await prisma.tournamentEntry.findMany({
        where: { tournamentId, eventId },
        orderBy: { result: { sort: "asc", nulls: "last" } },
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

      // Get solves for all entries on this page. All entries share one
      // scramble set (same event, same tournament), so use one ID + all user IDs.
      const scrambleSetId = entries[0]?.scrambleSetId;
      const userIds = entries.map((e) => e.userId);
      const solves = scrambleSetId
        ? await prisma.solve.findMany({
            where: {
              scrambleSetId,
              userId: { in: userIds },
            },
            orderBy: { scrambleSetIndex: "asc" },
          })
        : [];

      // Group solves by userId (scrambleSetId is the same for all).
      const solvesMap = new Map<string, typeof solves>();
      for (const solve of solves) {
        const existing = solvesMap.get(solve.userId) ?? [];
        existing.push(solve);
        solvesMap.set(solve.userId, existing);
      }

      // Get viewer's entry and rank.
      const viewerEntry = await prisma.tournamentEntry.findFirst({
        where: { tournamentId, eventId, userId: viewer.userId },
      });

      let viewerRank: number | null = null;
      let viewerSolves: typeof solves = [];
      if (viewerEntry) {
        // Always fetch viewer's solves, even with null result (partial progress).
        viewerSolves = await prisma.solve.findMany({
          where: {
            scrambleSetId: viewerEntry.scrambleSetId,
            userId: viewer.userId,
          },
          orderBy: { scrambleSetIndex: "asc" },
        });

        if (viewerEntry.result !== null) {
          const betterCount = await prisma.tournamentEntry.count({
            where: {
              tournamentId, eventId,
              result: { not: null, lt: viewerEntry.result },
            },
          });
          viewerRank = betterCount + 1;
        } else {
          // No result yet — rank after all finishers.
          const finisherCount = await prisma.tournamentEntry.count({
            where: {
              tournamentId, eventId,
              result: { not: null },
            },
          });
          viewerRank = finisherCount + 1;
        }
      }

      return {
        total,
        entries: entries.map((entry, i) => {
          const entrySolves = solvesMap.get(entry.userId) ?? [];
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

    // Start competing in an event. Creates a TournamentEntry for the
    // viewer if one doesn't already exist. Returns the entry ID and
    // the scramble set for that event.
    startEvent: async (tournamentId: string, eventName: string) => {
      // Resolve event name to database ID.
      const event = await prisma.event.findFirst({ where: { name: eventName } });
      if (!event) throw new Error("Event not found");

      // Find the scramble set for this tournament + event.
      const scrambleSet = await prisma.scrambleSet.findFirst({
        where: { tournamentId, eventId: event.id },
      });
      if (!scrambleSet) throw new Error("Scramble set not found for this event");

      // Check if entry already exists (idempotent — clicking Start twice is safe).
      const existing = await prisma.tournamentEntry.findFirst({
        where: { tournamentId, userId: viewer.userId, eventId: event.id },
      });

      if (existing) {
        // Already started — return existing entry with current solves.
        const solves = await prisma.solve.findMany({
          where: { scrambleSetId: scrambleSet.id, userId: viewer.userId },
          orderBy: { scrambleSetIndex: "asc" },
        });
        return {
          entryId: existing.id,
          scrambleSetId: scrambleSet.id,
          scrambles: scrambleSet.scrambles as string[],
          solves: solves.map((s) => ({
            scrambleSetIndex: s.scrambleSetIndex,
            timeMs: s.time,
            penalty: s.penalty,
          })),
        };
      }

      // Create new entry.
      const entry = await prisma.tournamentEntry.create({
        data: {
          userId: viewer.userId,
          tournamentId,
          eventId: event.id,
          scrambleSetId: scrambleSet.id,
        },
      });

      return {
        entryId: entry.id,
        scrambleSetId: scrambleSet.id,
        scrambles: scrambleSet.scrambles as string[],
        solves: [],
      };
    },

    // Submit a single solve for a tournament event. Validates that the
    // solve index is sequential and the entry belongs to the viewer.
    // After submission, recomputes the entry's result if enough solves exist.
    submitSolve: async (input: {
      entryId: string;
      scrambleSetIndex: number;
      timeMs: number;
      penalty: "plus_two" | "dnf" | null;
    }) => {
      const entry = await prisma.tournamentEntry.findUniqueOrThrow({
        where: { id: input.entryId },
        include: { event: true, scrambleSet: true },
      });

      // Verify the entry belongs to the viewer.
      if (entry.userId !== viewer.userId) {
        throw new Error("Not your entry");
      }

      // Check how many solves already exist.
      const existingSolves = await prisma.solve.findMany({
        where: { scrambleSetId: entry.scrambleSetId, userId: viewer.userId },
        orderBy: { scrambleSetIndex: "asc" },
      });

      // Validate the solve index is the next expected one.
      if (input.scrambleSetIndex !== existingSolves.length) {
        throw new Error(`Expected solve index ${existingSolves.length}, got ${input.scrambleSetIndex}`);
      }

      // Determine the expected solve count from event config.
      const eventConfig = EVENT_CONFIGS.find((e) => e.id === entry.event.name);
      if (!eventConfig) throw new Error("Unknown event");
      const expectedSolves = eventConfig.tournamentSolveCount;

      // Don't allow more solves than expected.
      if (existingSolves.length >= expectedSolves) {
        throw new Error("All solves already submitted");
      }

      // Create the solve.
      await prisma.solve.create({
        data: {
          userId: viewer.userId,
          eventId: entry.eventId,
          scrambleSetId: entry.scrambleSetId,
          scrambleSetIndex: input.scrambleSetIndex,
          time: input.timeMs,
          penalty: input.penalty ?? undefined,
        },
      });

      // Recompute result with the new solve included.
      const allSolves = [...existingSolves, {
        time: input.timeMs,
        penalty: input.penalty,
        scrambleSetIndex: input.scrambleSetIndex,
      }];

      const { computeAo5, computeMo3, computeBestSingle } = await import("@/lib/cubing/stats");

      const solvesForStats = allSolves.map((s) => ({
        timeMs: s.time,
        penalty: s.penalty ?? null,
      }));

      let result: number | null = null;

      if (eventConfig.tournamentRankBy === "single") {
        // BLD events: result is best single, available from first solve.
        result = computeBestSingle(solvesForStats);
      } else if (solvesForStats.length >= 4 && expectedSolves === 5) {
        // Ao5: computable with 4+ solves (missing solves treated as DNF).
        result = computeAo5(solvesForStats);
      } else if (solvesForStats.length >= 3 && expectedSolves === 3) {
        // Mo3: computable when all 3 solves are in.
        result = computeMo3(solvesForStats);
      }

      // Update the entry's cached result.
      await prisma.tournamentEntry.update({
        where: { id: input.entryId },
        data: { result },
      });

      return {
        solveIndex: input.scrambleSetIndex,
        totalSolves: allSolves.length,
        expectedSolves,
        result,
        solves: allSolves.map((s) => ({
          scrambleSetIndex: s.scrambleSetIndex,
          timeMs: s.time,
          penalty: s.penalty ?? null,
        })),
      };
    },
  };
}
