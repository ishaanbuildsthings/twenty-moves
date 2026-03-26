import { z } from "zod";
import { createTRPCRouter, authedProcedure } from "../init";
import { userService } from "@/lib/services/user";
import { userToIUser, userToIPrivateUser } from "@/lib/transforms/user";

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

  // Fetch a user by username. Returns private data if the viewer is
  // looking at their own profile.
  getByUsername: authedProcedure
    .input(z.object({ username: z.string() }))
    .query(async ({ ctx, input }) => {
      const user = await userService(ctx).getByUsername(input.username);
      const isOwn = user.id === ctx.viewer.userId;
      return {
        user: isOwn ? userToIPrivateUser(user) : userToIUser(user),
        isOwnProfile: isOwn,
      };
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
