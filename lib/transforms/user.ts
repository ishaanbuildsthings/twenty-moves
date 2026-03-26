import type { User } from "@/app/generated/prisma/client";

export interface IUser {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  profilePictureUrl: string | null;
}

export interface IPrivateUser extends IUser {
  wcaId: string | null;
  createdAt: Date;
}

export function userToIUser(user: User): IUser {
  return {
    id: user.id,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    profilePictureUrl: user.profilePictureUrl,
  };
}

export function userToIPrivateUser(user: User): IPrivateUser {
  return {
    ...userToIUser(user),
    wcaId: user.wcaId,
    createdAt: user.createdAt,
  };
}
