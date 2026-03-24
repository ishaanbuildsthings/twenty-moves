import type { PrismaClient } from "@/app/generated/prisma/client";

export function userService(prisma: PrismaClient) {
  return {
    list: () => prisma.user.findMany({ orderBy: { createdAt: "desc" } }),

    getById: (id: string) =>
      prisma.user.findUniqueOrThrow({ where: { id } }),

    getByUsername: (username: string) =>
      prisma.user.findUniqueOrThrow({ where: { username } }),

    create: (data: { email: string; username: string; firstName: string; lastName: string }) =>
      prisma.user.create({ data }),

    update: (id: string, data: { username?: string; firstName?: string; lastName?: string; wcaId?: string | null }) =>
      prisma.user.update({ where: { id }, data }),

    delete: (id: string) => prisma.user.delete({ where: { id } }),
  };
}
