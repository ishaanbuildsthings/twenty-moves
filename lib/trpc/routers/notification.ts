import { z } from "zod/v4";
import { createTRPCRouter, authedProcedure } from "../init";

export const notificationRouter = createTRPCRouter({
  /** Paginated list of notifications for the current user, newest first. */
  list: authedProcedure
    .input(
      z.object({
        cursor: z.string().optional(),
        limit: z.number().int().min(1).max(50).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const notifications = await ctx.prisma.notification.findMany({
        where: { userId: ctx.viewer.userId },
        orderBy: { createdAt: "desc" },
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
        include: {
          actor: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
              profilePictureUrl: true,
            },
          },
        },
      });

      let nextCursor: string | undefined;
      if (notifications.length > input.limit) {
        const next = notifications.pop()!;
        nextCursor = next.id;
      }

      return { notifications, nextCursor };
    }),

  /** Count of unread notifications. */
  unreadCount: authedProcedure.query(async ({ ctx }) => {
    const count = await ctx.prisma.notification.count({
      where: { userId: ctx.viewer.userId, read: false },
    });
    return { count };
  }),

  /** Mark specific notifications as read. */
  markRead: authedProcedure
    .input(z.object({ ids: z.array(z.string()).min(1).max(100) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.notification.updateMany({
        where: {
          id: { in: input.ids },
          userId: ctx.viewer.userId,
        },
        data: { read: true },
      });
      return { success: true };
    }),

  /** Mark all notifications as read. */
  markAllRead: authedProcedure.mutation(async ({ ctx }) => {
    await ctx.prisma.notification.updateMany({
      where: { userId: ctx.viewer.userId, read: false },
      data: { read: true },
    });
    return { success: true };
  }),
});
