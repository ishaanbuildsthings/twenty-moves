import { createTRPCRouter, authedProcedure } from "../init";
import { userService } from "@/lib/services/user";
import { userToIUser } from "@/lib/transforms/user";

export const userRouter = createTRPCRouter({
  list: authedProcedure.query(async ({ ctx }) => {
    const users = await userService(ctx).list();
    return users.map(userToIUser);
  }),
});
