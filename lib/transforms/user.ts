import type { User, MedalType, PbType } from "@/app/generated/prisma/client";

export interface MedalCounts {
  gold: number;
  silver: number;
  bronze: number;
}

export interface IPersonalBest {
  eventId: string;
  type: PbType;
  time: number;
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
  personalBests: IPersonalBest[];
  followerCount: number;
  followingCount: number;
}

export function userToIUser(
  user: User,
  medalRows?: { type: MedalType; _count: number }[],
  counts?: { followers: number; following: number },
  pbRows?: { type: PbType; time: number; event: { name: string } }[],
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
    personalBests: pbRows?.map((pb) => ({ eventId: pb.event.name, type: pb.type, time: pb.time })) ?? [],
    followerCount: counts?.followers ?? 0,
    followingCount: counts?.following ?? 0,
  };
}
