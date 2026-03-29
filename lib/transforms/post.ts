import type { PracticePost, User, Event } from "@/app/generated/prisma/client";
import { userToIUser, type IUser } from "./user";

export interface IPracticePost {
  id: string;
  user: IUser;
  eventName: string;
  caption: string;
  bestSingle: number | null;
  bestAo5: number | null;
  bestAo12: number | null;
  bestAo100: number | null;
  bestMo3: number | null;
  sessionMean: number | null;
  displaySolves: number[];
  numSolves: number;
  numLikes: number;
  numComments: number;
  youtubeUrl: string | null;
  createdAt: Date;
}

export function practicePostToIPracticePost(
  post: PracticePost & { user: User; event: Event }
): IPracticePost {
  return {
    id: post.id,
    user: userToIUser(post.user),
    eventName: post.event.name,
    caption: post.caption,
    bestSingle: post.bestSingle,
    bestAo5: post.bestAo5,
    bestAo12: post.bestAo12,
    bestAo100: post.bestAo100,
    bestMo3: post.bestMo3,
    sessionMean: post.sessionMean,
    displaySolves: post.displaySolves,
    numSolves: post.numSolves,
    numLikes: post.numLikes,
    numComments: post.numComments,
    youtubeUrl: post.youtubeUrl,
    createdAt: post.createdAt,
  };
}
