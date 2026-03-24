import "server-only";

import { createTRPCContext } from "./init";
import { createCallerFactory } from "./init";
import { appRouter } from "./routers/_app";

// Lets server components call tRPC procedures directly as functions,
// bypassing HTTP. Same router, context, and middleware as the HTTP path.
const createCaller = createCallerFactory(appRouter);

export async function caller() {
  const ctx = await createTRPCContext();
  return createCaller(ctx);
}
