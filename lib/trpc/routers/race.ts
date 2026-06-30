import { z } from "zod/v4";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, authedProcedure } from "../init";
import { generateRoomCode } from "@/lib/race/room-code";
import { generateScramble } from "@/lib/cubing/scramble";
import { CubeEvent } from "@/lib/cubing/events";
import { eventService } from "@/lib/services/event";

const SCRAMBLE_COUNT = 200;

export const raceRouter = createTRPCRouter({
  createRoom: authedProcedure
    .input(z.object({ eventName: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const event = await eventService(ctx).getByName(input.eventName);
      if (!event) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Event not found" });
      }

      const scrambles = Array.from({ length: SCRAMBLE_COUNT }, () =>
        generateScramble(input.eventName as CubeEvent)
      );

      // Retry code generation on collision (extremely unlikely)
      let code: string;
      let attempts = 0;
      do {
        code = generateRoomCode();
        const existing = await ctx.prisma.raceRoom.findUnique({ where: { code } });
        if (!existing) break;
        attempts++;
      } while (attempts < 5);

      const scrambleSet = await ctx.prisma.scrambleSet.create({
        data: { eventId: event.id, scrambles },
      });

      const room = await ctx.prisma.raceRoom.create({
        data: {
          code,
          hostId: ctx.viewer.userId,
          eventId: event.id,
          scrambleSetId: scrambleSet.id,
        },
      });

      // Host auto-joins
      await ctx.prisma.raceParticipant.create({
        data: { roomId: room.id, userId: ctx.viewer.userId },
      });

      return { code: room.code, roomId: room.id };
    }),

  joinRoom: authedProcedure
    .input(z.object({ code: z.string().length(5) }))
    .mutation(async ({ ctx, input }) => {
      const code = input.code.toUpperCase();
      const room = await ctx.prisma.raceRoom.findUnique({
        where: { code },
        include: {
          event: true,
          scrambleSet: true,
          participants: { include: { user: true } },
        },
      });

      if (!room || room.status !== "open") {
        throw new TRPCError({ code: "NOT_FOUND", message: "Room not found or closed" });
      }

      // WCA average gating for public rooms
      if (room.maxTimeMs !== null) {
        const user = await ctx.prisma.user.findUniqueOrThrow({
          where: { id: ctx.viewer.userId },
        });

        if (!user.wcaId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Link your WCA account to join this room",
          });
        }

        const checkEvent = room.maxTimeEvent ?? room.event.name;
        const res = await fetch(
          `https://www.worldcubeassociation.org/api/v0/persons/${user.wcaId}`
        );

        if (!res.ok) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Could not verify WCA records",
          });
        }

        const data = await res.json();
        const records = data?.personal_records?.[checkEvent];
        const officialAvg = records?.average?.best as number | undefined;

        if (!officialAvg || officialAvg > room.maxTimeMs) {
          const limitSec = (room.maxTimeMs / 100).toFixed(2);
          throw new TRPCError({
            code: "FORBIDDEN",
            message: `Requires official ${checkEvent} average under ${limitSec}s`,
          });
        }
      }

      // Upsert participant (rejoin if previously left)
      await ctx.prisma.raceParticipant.upsert({
        where: { roomId_userId: { roomId: room.id, userId: ctx.viewer.userId } },
        create: { roomId: room.id, userId: ctx.viewer.userId },
        update: { leftAt: null },
      });

      return {
        roomId: room.id,
        code: room.code,
        hostId: room.hostId,
        eventName: room.event.name,
        scrambles: room.scrambleSet.scrambles as string[],
        participants: room.participants.map((p) => ({
          userId: p.userId,
          username: p.user.username,
          firstName: p.user.firstName,
          lastName: p.user.lastName,
          profilePictureUrl: p.user.profilePictureUrl,
          joinedAt: p.joinedAt,
          leftAt: p.leftAt,
        })),
      };
    }),

  getRoom: authedProcedure
    .input(z.object({ code: z.string().length(5) }))
    .query(async ({ ctx, input }) => {
      const code = input.code.toUpperCase();
      const room = await ctx.prisma.raceRoom.findUnique({
        where: { code },
        include: {
          event: true,
          scrambleSet: true,
          participants: { include: { user: true } },
        },
      });

      if (!room) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Room not found" });
      }

      return {
        roomId: room.id,
        code: room.code,
        hostId: room.hostId,
        eventName: room.event.name,
        status: room.status,
        public: room.public,
        name: room.name,
        maxTimeMs: room.maxTimeMs,
        scrambles: room.scrambleSet.scrambles as string[],
        scrambleSetId: room.scrambleSet.id,
        participants: room.participants.map((p) => ({
          userId: p.userId,
          username: p.user.username,
          firstName: p.user.firstName,
          lastName: p.user.lastName,
          profilePictureUrl: p.user.profilePictureUrl,
          joinedAt: p.joinedAt,
          leftAt: p.leftAt,
        })),
      };
    }),

  leaveRoom: authedProcedure
    .input(
      z.object({
        code: z.string().length(5),
        results: z
          .array(
            z.object({
              scrambleIndex: z.number().int().min(0),
              timeMs: z.number().int().positive(),
              penalty: z.enum(["plus_two", "dnf"]).nullable(),
            })
          )
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const code = input.code.toUpperCase();
      const room = await ctx.prisma.raceRoom.findUnique({ where: { code } });
      if (!room) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Room not found" });
      }

      await ctx.prisma.raceParticipant.update({
        where: { roomId_userId: { roomId: room.id, userId: ctx.viewer.userId } },
        data: {
          leftAt: new Date(),
          results: input.results ?? undefined,
        },
      });

      return { success: true };
    }),

  listPublicRooms: authedProcedure.query(async ({ ctx }) => {
    const rooms = await ctx.prisma.raceRoom.findMany({
      where: { public: true, status: "open" },
      include: {
        event: true,
        _count: { select: { participants: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    return rooms.map((r) => ({
      code: r.code,
      name: r.name,
      description: r.description,
      eventName: r.event.name,
      maxTimeMs: r.maxTimeMs,
      participantCount: r._count.participants,
    }));
  }),

  closeRoom: authedProcedure
    .input(z.object({ code: z.string().length(5) }))
    .mutation(async ({ ctx, input }) => {
      const code = input.code.toUpperCase();
      const room = await ctx.prisma.raceRoom.findUnique({ where: { code } });
      if (!room) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Room not found" });
      }
      if (room.hostId !== ctx.viewer.userId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only the host can close the room" });
      }

      await ctx.prisma.raceRoom.update({
        where: { id: room.id },
        data: { status: "closed", closedAt: new Date() },
      });

      return { success: true };
    }),
});
