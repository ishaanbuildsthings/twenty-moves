import { createTRPCRouter } from "../init";
import { authRouter } from "./auth";
import { userRouter } from "./user";
import { tournamentRouter } from "./tournament";
import { postRouter } from "./post";
import { notificationRouter } from "./notification";

export const appRouter = createTRPCRouter({
  auth: authRouter,
  user: userRouter,
  tournament: tournamentRouter,
  post: postRouter,
  notification: notificationRouter,
});

export type AppRouter = typeof appRouter;
