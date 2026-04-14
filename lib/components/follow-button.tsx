"use client";

import { useState } from "react";
import { useTRPC } from "@/lib/trpc/client";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { useSettings } from "@/lib/context/settings";
import { type IUser } from "@/lib/transforms/user";

/** Full-size follow button used on profile pages. Fetches isFollowing state. */
export function FollowButton({ userId, username }: { userId: string; username: string }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { accent } = useSettings();

  const isFollowingQuery = useQuery(
    trpc.user.isFollowing.queryOptions({ userId })
  );

  const userQueryKey = trpc.user.getByUsername.queryKey({ username });
  type UserData = IUser;

  const follow = useMutation(trpc.user.follow.mutationOptions({
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: userQueryKey });
      queryClient.setQueryData<UserData>(userQueryKey, (old) =>
        old ? { ...old, followerCount: old.followerCount + 1 } : old
      );
      queryClient.setQueryData(trpc.user.isFollowing.queryKey({ userId }), { following: true });
    },
    onError: () => {
      queryClient.setQueryData<UserData>(userQueryKey, (old) =>
        old ? { ...old, followerCount: old.followerCount - 1 } : old
      );
      queryClient.setQueryData(trpc.user.isFollowing.queryKey({ userId }), { following: false });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: userQueryKey });
      queryClient.invalidateQueries({ queryKey: trpc.user.isFollowing.queryKey({ userId }) });
    },
  }));

  const unfollow = useMutation(trpc.user.unfollow.mutationOptions({
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: userQueryKey });
      queryClient.setQueryData<UserData>(userQueryKey, (old) =>
        old ? { ...old, followerCount: old.followerCount - 1 } : old
      );
      queryClient.setQueryData(trpc.user.isFollowing.queryKey({ userId }), { following: false });
    },
    onError: () => {
      queryClient.setQueryData<UserData>(userQueryKey, (old) =>
        old ? { ...old, followerCount: old.followerCount + 1 } : old
      );
      queryClient.setQueryData(trpc.user.isFollowing.queryKey({ userId }), { following: true });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: userQueryKey });
      queryClient.invalidateQueries({ queryKey: trpc.user.isFollowing.queryKey({ userId }) });
    },
  }));

  const isFollowing = isFollowingQuery.data?.following ?? false;
  const isPending = follow.isPending || unfollow.isPending;

  if (isFollowingQuery.isLoading) {
    return <div className="px-4 py-2 text-sm font-bold rounded bg-neutral-600/50 text-transparent select-none shadow-[0_2px_0_0_#1a1a1a]">Follow</div>;
  }

  return (
    <button
      className={`px-4 py-2 text-sm font-bold rounded transition-all ${
        isFollowing
          ? "bg-neutral-600 text-foreground hover:bg-neutral-500 shadow-[0_2px_0_0_#1a1a1a]"
          : `${accent.bg} text-white ${accent.hover} ${accent.shadow}`
      }`}
      disabled={isPending}
      onClick={() => isFollowing ? unfollow.mutate({ userId }) : follow.mutate({ userId })}
    >
      {isFollowing ? "Following" : "Follow"}
    </button>
  );
}

/** Compact follow button for suggested posts in the feed. No query needed — we already know. */
export function CompactFollowButton({ userId }: { userId: string }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { accent } = useSettings();
  const [hidden, setHidden] = useState(false);

  const follow = useMutation(trpc.user.follow.mutationOptions({
    onSuccess: () => {
      setHidden(true);
      // Invalidate feed so the post won't appear as suggested on next fetch
      queryClient.invalidateQueries({ queryKey: [["post", "getFeed"]] });
    },
  }));

  if (hidden) return null;

  return (
    <button
      className={`px-2.5 py-1 text-xs font-bold rounded transition-all ${accent.bg} text-white ${accent.hover} ${accent.shadow}`}
      disabled={follow.isPending}
      onClick={() => follow.mutate({ userId })}
    >
      {follow.isPending ? "..." : "Follow"}
    </button>
  );
}
