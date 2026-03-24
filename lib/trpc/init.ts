import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { getPrisma } from "@/lib/prisma";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { ViewerContext } from "@/lib/viewer-context";

// Runs server-side only — called on every request either by the HTTP route
// handler (app/api/trpc/[trpc]/route.ts) or the server component caller
// (lib/trpc/server.ts). Prisma is passed via context (rather than imported
// directly in services) so we can swap it for a mock in tests.
export const createTRPCContext = async () => {
  const prisma = getPrisma();
  const supabase = await createServerSupabaseClient();
  const { data: { user: supabaseUser } } = await supabase.auth.getUser();

  let viewer: ViewerContext | null = null;
  if (supabaseUser) {
    const user = await prisma.user.findUnique({
      where: { supabaseId: supabaseUser.id },
    });
    if (user) {
      viewer = { type: "authUser", userId: user.id };
    }
  }

  return { prisma, viewer, supabase };
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
