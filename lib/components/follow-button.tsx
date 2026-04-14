"use client";

import { useState, useEffect } from "react";
import { useTRPC } from "@/lib/trpc/client";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { useSettings } from "@/lib/context/settings";
import { Check } from "lucide-react";
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
  const [state, setState] = useState<"idle" | "pending" | "confirmed" | "hidden">("idle");

  const follow = useMutation(trpc.user.follow.mutationOptions({
    onMutate: () => setState("pending"),
    onSuccess: () => {
      setState("confirmed");
      // Surgically clear isSuggested on ALL posts by this user in the cache
      // so their other posts in the feed also lose the Follow button.
      // No full refetch = no flash.
      queryClient.setQueriesData<{ pages: { posts: { user: { id: string }; isSuggested?: boolean }[] }[] }>(
        { queryKey: [["post", "getFeed"]] },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              posts: page.posts.map((p) =>
                p.user.id === userId ? { ...p, isSuggested: false } : p
              ),
            })),
          };
        }
      );
    },
    onError: () => setState("idle"),
  }));

  // After showing "Followed" confirmation, fade out after 1.2s
  useEffect(() => {
    if (state !== "confirmed") return;
    const t = setTimeout(() => setState("hidden"), 1200);
    return () => clearTimeout(t);
  }, [state]);

  if (state === "hidden") return null;

  return (
    <button
      className={`min-w-[4.5rem] px-2.5 py-1 text-xs font-bold rounded transition-all duration-300 ${
        state === "confirmed"
          ? "bg-neutral-600 text-foreground shadow-[0_2px_0_0_#1a1a1a] opacity-60"
          : `${accent.bg} text-white ${accent.hover} ${accent.shadow}`
      }`}
      disabled={state !== "idle"}
      onClick={() => follow.mutate({ userId })}
    >
      {state === "pending" && (
        <span className="inline-flex items-center gap-1">
          <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          Follow
        </span>
      )}
      {state === "confirmed" && (
        <span className="inline-flex items-center gap-1">
          <Check className="w-3 h-3" />
          Followed
        </span>
      )}
      {state === "idle" && "Follow"}
    </button>
  );
}
