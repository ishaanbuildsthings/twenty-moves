import { initTRPC } from "@trpc/server";
import superjson from "superjson";
import { getPrisma } from "@/lib/prisma";

// Runs server-side only — called on every request either by the HTTP route
// handler (app/api/trpc/[trpc]/route.ts) or the server component caller
// (lib/trpc/server.ts). Prisma is passed via context (rather than imported
// directly in services) so we can swap it for a mock in tests.
export const createTRPCContext = async () => {
  return { prisma: getPrisma() };
};

const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
});

export const createTRPCRouter = t.router;
export const baseProcedure = t.procedure;
export const createCallerFactory = t.createCallerFactory;
