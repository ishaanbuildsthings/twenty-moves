import type { ServiceContext } from "./user";
import { NotFoundError } from "@/lib/errors";
import { getCurrentWeekStartUTC } from "@/lib/tournament/date";
import { DNF_SENTINEL } from "@/lib/cubing/stats";

const memberSelect = {
  id: true,
  username: true,
  firstName: true,
  lastName: true,
  profilePictureUrl: true,
  country: true,
} as const;

export function clubService(ctx: ServiceContext) {
  const { prisma, viewer } = ctx;
  return {
    // All clubs, most members first then newest. Includes whether the viewer
    // is a member so the client can render Join/Joined state in one query.
    list: async () => {
      const clubs = await prisma.club.findMany({
        orderBy: [{ memberCount: "desc" }, { createdAt: "desc" }],
        include: {
          members: { where: { userId: viewer.userId }, select: { id: true } },
        },
      });
      return clubs.map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        memberCount: c.memberCount,
        isMember: c.members.length > 0,
      }));
    },

    // Clubs the viewer (or another user) belongs to.
    listForUser: async (userId: string) => {
      const memberships = await prisma.clubMembership.findMany({
        where: { userId },
        orderBy: { joinedAt: "desc" },
        select: {
          role: true,
          club: {
            select: { id: true, name: true, description: true, memberCount: true },
          },
        },
      });
      return memberships.map((m) => ({ ...m.club, role: m.role }));
    },

    getById: async (id: string) => {
      const club = await prisma.club.findUnique({
        where: { id },
        include: {
          owner: { select: memberSelect },
          members: {
            orderBy: { joinedAt: "asc" },
            select: { role: true, joinedAt: true, user: { select: memberSelect } },
          },
        },
      });
      if (!club) throw new NotFoundError("Club not found");
      return {
        id: club.id,
        name: club.name,
        description: club.description,
        memberCount: club.memberCount,
        createdAt: club.createdAt,
        owner: club.owner,
        isMember: club.members.some((m) => m.user.id === viewer.userId),
        isOwner: club.ownerId === viewer.userId,
        members: club.members.map((m) => ({
          role: m.role,
          joinedAt: m.joinedAt,
          user: m.user,
        })),
      };
    },

    // Create a club and make the creator its owner-member in one transaction.
    create: (input: { name: string; description: string }) =>
      prisma.club.create({
        data: {
          name: input.name,
          description: input.description,
          ownerId: viewer.userId,
          memberCount: 1,
          members: {
            create: { userId: viewer.userId, role: "owner" },
          },
        },
        select: { id: true },
      }),

    // Per-event leaderboard for the current Mon–Sun PST week, built from the
    // member's PRACTICE POSTS for the event this week (tournament solves are
    // excluded by design). For each member:
    //   - numSolves: total solves across this week's posts
    //   - average:   solve-count-weighted mean of each post's sessionMean
    //   - bestAo5/Ao12/Ao100: best (lowest) of the precomputed per-post bests
    // Average/best fields are null when no post supplies the value.
    // eventName is a CubeEvent id (e.g. "333"), which equals Event.name.
    weeklyLeaderboard: async (clubId: string, eventName: string) => {
      const memberships = await prisma.clubMembership.findMany({
        where: { clubId },
        select: { user: { select: memberSelect } },
      });
      const members = memberships.map((m) => m.user);
      if (members.length === 0) return [];

      const event = await prisma.event.findUnique({
        where: { name: eventName },
        select: { id: true },
      });

      const empty = members.map((user) => ({
        user,
        numSolves: 0,
        average: null,
        bestAo5: null,
        bestAo12: null,
        bestAo100: null,
      }));
      if (!event) return empty;

      const posts = await prisma.practicePost.findMany({
        where: {
          eventId: event.id,
          userId: { in: members.map((m) => m.id) },
          createdAt: { gte: getCurrentWeekStartUTC() },
        },
        select: {
          userId: true,
          numSolves: true,
          sessionMean: true,
          bestAo5: true,
          bestAo12: true,
          bestAo100: true,
        },
      });

      // Lower-is-better min that ignores nulls.
      const lower = (a: number | null, b: number | null) =>
        a === null ? b : b === null ? a : Math.min(a, b);

      type Acc = {
        numSolves: number;
        meanSum: number; // Σ sessionMean·numSolves over posts with a real mean
        meanWeight: number; // Σ numSolves over those same posts
        bestAo5: number | null;
        bestAo12: number | null;
        bestAo100: number | null;
      };
      const byUser = new Map<string, Acc>();
      for (const p of posts) {
        const acc = byUser.get(p.userId) ?? {
          numSolves: 0,
          meanSum: 0,
          meanWeight: 0,
          bestAo5: null,
          bestAo12: null,
          bestAo100: null,
        };
        acc.numSolves += p.numSolves;
        if (p.sessionMean !== null && p.sessionMean < DNF_SENTINEL) {
          acc.meanSum += p.sessionMean * p.numSolves;
          acc.meanWeight += p.numSolves;
        }
        acc.bestAo5 = lower(acc.bestAo5, p.bestAo5);
        acc.bestAo12 = lower(acc.bestAo12, p.bestAo12);
        acc.bestAo100 = lower(acc.bestAo100, p.bestAo100);
        byUser.set(p.userId, acc);
      }

      return members.map((user) => {
        const acc = byUser.get(user.id);
        return {
          user,
          numSolves: acc?.numSolves ?? 0,
          average:
            acc && acc.meanWeight > 0
              ? Math.round(acc.meanSum / acc.meanWeight)
              : null,
          bestAo5: acc?.bestAo5 ?? null,
          bestAo12: acc?.bestAo12 ?? null,
          bestAo100: acc?.bestAo100 ?? null,
        };
      });
    },

    // Owner-only: update the club's description.
    updateDescription: async (clubId: string, description: string) => {
      const club = await prisma.club.findUnique({
        where: { id: clubId },
        select: { ownerId: true },
      });
      if (!club) throw new NotFoundError("Club not found");
      if (club.ownerId !== viewer.userId) throw new Error("NOT_OWNER");
      return prisma.club.update({
        where: { id: clubId },
        data: { description },
        select: { id: true },
      });
    },

    // Owner-only: delete the club. Memberships cascade (see schema).
    remove: async (clubId: string) => {
      const club = await prisma.club.findUnique({
        where: { id: clubId },
        select: { ownerId: true },
      });
      if (!club) throw new NotFoundError("Club not found");
      if (club.ownerId !== viewer.userId) throw new Error("NOT_OWNER");
      await prisma.club.delete({ where: { id: clubId } });
      return { success: true };
    },

    // Join a club. Idempotent — a no-op if already a member.
    join: (clubId: string) =>
      prisma.$transaction(async (tx) => {
        const existing = await tx.clubMembership.findUnique({
          where: { clubId_userId: { clubId, userId: viewer.userId } },
          select: { id: true },
        });
        if (existing) return { success: true };
        await tx.clubMembership.create({
          data: { clubId, userId: viewer.userId, role: "member" },
        });
        await tx.club.update({
          where: { id: clubId },
          data: { memberCount: { increment: 1 } },
        });
        return { success: true };
      }),

    // Leave a club. The owner cannot leave their own club.
    leave: (clubId: string) =>
      prisma.$transaction(async (tx) => {
        const membership = await tx.clubMembership.findUnique({
          where: { clubId_userId: { clubId, userId: viewer.userId } },
          select: { role: true },
        });
        if (!membership) return { success: true };
        if (membership.role === "owner") {
          throw new Error("OWNER_CANNOT_LEAVE");
        }
        await tx.clubMembership.delete({
          where: { clubId_userId: { clubId, userId: viewer.userId } },
        });
        await tx.club.update({
          where: { id: clubId },
          data: { memberCount: { decrement: 1 } },
        });
        return { success: true };
      }),
  };
}
