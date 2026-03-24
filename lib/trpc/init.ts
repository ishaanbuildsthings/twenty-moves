import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { getPrisma } from "@/lib/prisma";
import type { ViewerContext } from "@/lib/viewer-context";

// Runs server-side only — called on every request either by the HTTP route
// handler (app/api/trpc/[trpc]/route.ts) or the server component caller
// (lib/trpc/server.ts). Prisma is passed via context (rather than imported
// directly in services) so we can swap it for a mock in tests.
export const createTRPCContext = async () => {
  // TODO: resolve viewer from session/token once auth is implemented
  const viewer: ViewerContext | null = null;
  return { prisma: getPrisma(), viewer };
};

const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
});

export const createTRPCRouter = t.router;
export const baseProcedure = t.procedure;
export const createCallerFactory = t.createCallerFactory;

// Procedure that requires an authenticated viewer. Narrows ctx.viewer
// from ViewerContext | null to ViewerContext.
export const authedProcedure = baseProcedure.use(({ ctx, next }) => {
  if (!ctx.viewer) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({ ctx: { ...ctx, viewer: ctx.viewer } });
});
