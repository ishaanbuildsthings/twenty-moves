import { createTRPCRouter } from "../init";
import { authRouter } from "./auth";
import { userRouter } from "./user";
import { tournamentRouter } from "./tournament";
import { postRouter } from "./post";
import { clubRouter } from "./club";

export const appRouter = createTRPCRouter({
  auth: authRouter,
  user: userRouter,
  tournament: tournamentRouter,
  post: postRouter,
  club: clubRouter,
});

export type AppRouter = typeof appRouter;
