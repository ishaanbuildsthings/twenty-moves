import { z } from "zod";
import { createTRPCRouter, authedProcedure } from "../init";
import { userService } from "@/lib/services/user";
import { userToIUser, userToIPrivateUser } from "@/lib/transforms/user";

export const userRouter = createTRPCRouter({
  // Fetch a user by username. Returns private data if the viewer is
  // looking at their own profile.
  getByUsername: authedProcedure
    .input(z.object({ username: z.string() }))
    .query(async ({ ctx, input }) => {
      const user = await userService(ctx).getByUsername(input.username);
      const isOwn = user.id === ctx.viewer.userId;
      return isOwn ? userToIPrivateUser(user) : userToIUser(user);
    }),

  // Update the current user's profile.
  updateProfile: authedProcedure
    .input(z.object({
      username: z.string().min(3).max(30).optional(),
      firstName: z.string().min(1).max(50).optional(),
      lastName: z.string().min(1).max(50).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const user = await userService(ctx).update(ctx.viewer.userId, input);
      return userToIPrivateUser(user);
    }),
});
