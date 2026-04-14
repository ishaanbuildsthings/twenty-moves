import type { PracticePost, User, Event } from "@/app/generated/prisma/client";
import { userToIUser, type IUser } from "./user";
import type { StatSolve } from "@/lib/cubing/stats";

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
  isPbSingle: boolean;
  isPbAo5: boolean;
  isPbAo12: boolean;
  isPbAo100: boolean;
  isPbMo3: boolean;
  singleSolves: StatSolve[] | null;
  ao5Solves: StatSolve[] | null;
  ao12Solves: StatSolve[] | null;
  ao100Solves: StatSolve[] | null;
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
    isPbSingle: post.isPbSingle,
    isPbAo5: post.isPbAo5,
    isPbAo12: post.isPbAo12,
    isPbAo100: post.isPbAo100,
    isPbMo3: post.isPbMo3,
    singleSolves: post.singleSolves as StatSolve[] | null,
    ao5Solves: post.ao5Solves as StatSolve[] | null,
    ao12Solves: post.ao12Solves as StatSolve[] | null,
    ao100Solves: post.ao100Solves as StatSolve[] | null,
    numSolves: post.numSolves,
    numLikes: post.numLikes,
    numComments: post.numComments,
    youtubeUrl: post.youtubeUrl,
    createdAt: post.createdAt,
  };
}
