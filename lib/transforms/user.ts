import type { User } from "@/app/generated/prisma/client";

export interface IUser {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  wcaId: string | null;
}

export interface IPrivateUser extends IUser {
  createdAt: Date;
}

export function userToIUser(user: User): IUser {
  return {
    id: user.id,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    wcaId: user.wcaId,
  };
}

export function userToIPrivateUser(user: User): IPrivateUser {
  return {
    ...userToIUser(user),
    createdAt: user.createdAt,
  };
}
