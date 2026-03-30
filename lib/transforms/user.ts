import type { User, MedalType } from "@/app/generated/prisma/client";

export interface MedalCounts {
  gold: number;
  silver: number;
  bronze: number;
}

export interface IUser {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  wcaId: string | null;
  profilePictureUrl: string | null;
  country: string | null;
  bio: string;
  youtubeChannelUrl: string | null;
  medals: MedalCounts;
  followerCount: number;
  followingCount: number;
}

export function userToIUser(
  user: User,
  medalRows?: { type: MedalType; _count: number }[],
  counts?: { followers: number; following: number },
): IUser {
  const medals: MedalCounts = { gold: 0, silver: 0, bronze: 0 };
  if (medalRows) {
    for (const m of medalRows) {
      if (m.type === "GOLD") medals.gold = m._count;
      else if (m.type === "SILVER") medals.silver = m._count;
      else if (m.type === "BRONZE") medals.bronze = m._count;
    }
  }
  return {
    id: user.id,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    wcaId: user.wcaId,
    profilePictureUrl: user.profilePictureUrl,
    country: user.country,
    bio: user.bio,
    youtubeChannelUrl: user.youtubeChannelUrl,
    medals,
    followerCount: counts?.followers ?? 0,
    followingCount: counts?.following ?? 0,
  };
}
