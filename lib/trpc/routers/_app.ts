import { createTRPCRouter } from "../init";
import { authRouter } from "./auth";
import { userRouter } from "./user";
import { tournamentRouter } from "./tournament";
import { postRouter } from "./post";
import { raceRouter } from "./race";

export const appRouter = createTRPCRouter({
  auth: authRouter,
  user: userRouter,
  tournament: tournamentRouter,
  post: postRouter,
  race: raceRouter,
});

export type AppRouter = typeof appRouter;
