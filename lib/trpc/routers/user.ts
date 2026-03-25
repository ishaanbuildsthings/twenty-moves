import { z } from "zod";
import { createTRPCRouter, authedProcedure } from "../init";
import { userService } from "@/lib/services/user";
import { userToIUser } from "@/lib/transforms/user";

export const userRouter = createTRPCRouter({
  list: authedProcedure.query(async ({ ctx }) => {
    const users = await userService(ctx).list();
    return users.map(userToIUser);
  }),

  me: authedProcedure.query(async ({ ctx }) => {
    const user = await userService(ctx).getById(ctx.viewer.userId);
    return userToIUser(user);
  }),

  get: authedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const user = await userService(ctx).getById(input.id);
      return userToIUser(user);
    }),
});
