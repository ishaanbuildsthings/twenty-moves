import { createTRPCRouter, baseProcedure } from "../init";
import { userService } from "@/lib/services/user";
import { userToIUser } from "@/lib/transforms/user";

export const userRouter = createTRPCRouter({
  list: baseProcedure.query(async ({ ctx }) => {
    const users = await userService(ctx.prisma).list();
    return users.map(userToIUser);
  }),
});
