import type { User } from "@/app/generated/prisma/client";

export interface IUser {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  wcaId: string | null;
  profilePictureUrl: string | null;
  country: string | null;
}

export function userToIUser(user: User): IUser {
  return {
    id: user.id,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    wcaId: user.wcaId,
    profilePictureUrl: user.profilePictureUrl,
    country: user.country,
  };
}
