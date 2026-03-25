import type { User } from "@/app/generated/prisma/client";

export interface IUser {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
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
  };
}

export function userToIPrivateUser(user: User): IPrivateUser {
  return {
    ...userToIUser(user),
    wcaId: user.wcaId,
    createdAt: user.createdAt,
  };
}
