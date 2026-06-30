import type { ServiceContext } from "./user";
import { NotFoundError } from "@/lib/errors";

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
