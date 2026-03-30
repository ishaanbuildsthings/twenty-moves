"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { useViewer } from "@/lib/hooks/useViewer";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery, useInfiniteQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { publicEnv } from "@/lib/env";
import { toast } from "sonner";
import { useSettings } from "@/lib/context/settings";

import { ExternalLink, Puzzle } from "lucide-react";
import Link from "next/link";
import { UserAvatar } from "@/lib/components/user-avatar";
import { EventIcon } from "@/lib/components/event-icon";
import { PracticePostCard } from "@/lib/components/practice-post-card";
import { type IUser } from "@/lib/transforms/user";
import { countryCodeToFlag } from "@/lib/countries";
import { CubeEvent, EVENT_MAP } from "@/lib/cubing/events";
import { CubeLoader } from "@/lib/components/cube-loader";

type ProfileTab = "overview" | "collection" | "clubs";

// Mock data for placeholder UI
const MOCK_PBS = [
  { event: CubeEvent.THREE, single: "8.42", ao5: "10.15" },
  { event: CubeEvent.TWO, single: "2.31", ao5: "3.44" },
  { event: CubeEvent.FOUR, single: "38.72", ao5: "42.10" },
  { event: CubeEvent.OH, single: "14.55", ao5: "17.82" },
];

const WCA_AUTHORIZE_URL = "https://www.worldcubeassociation.org/oauth/authorize";
const WCA_STATE_COOKIE = "wca_oauth_state";

function startWcaOAuth() {
  const state = crypto.randomUUID();
  // Store state in a cookie for CSRF validation in the callback.
  document.cookie = `${WCA_STATE_COOKIE}=${state}; path=/; max-age=600; SameSite=Lax`;

  const params = new URLSearchParams({
    client_id: publicEnv().NEXT_PUBLIC_WCA_CLIENT_ID,
    redirect_uri: `${window.location.origin}/api/wca/callback`,
    response_type: "code",
    scope: "public",
    state,
  });

  window.location.href = `${WCA_AUTHORIZE_URL}?${params}`;
}

const WCA_FLASH_MESSAGES: Record<string, { message: string; type: "success" | "error" }> = {
  linked: { message: "WCA account linked successfully!", type: "success" },
  already_linked: { message: "This WCA account is already linked to another user.", type: "error" },
  no_wca_id: { message: "Your WCA account doesn't have an assigned WCA ID.", type: "error" },
  invalid_state: { message: "WCA linking failed — please try again.", type: "error" },
  unknown: { message: "Something went wrong linking your WCA account.", type: "error" },
};

function FollowButton({ userId, username }: { userId: string; username: string }) {
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

  return (
    <button
      className={`px-4 py-2 text-sm font-bold rounded transition-all ${
        isFollowing
          ? "bg-neutral-600 text-foreground hover:bg-neutral-500 shadow-[0_2px_0_0_#1a1a1a]"
          : `${accent.bg} text-white ${accent.hover} ${accent.shadow}`
      }`}
      disabled={isPending || isFollowingQuery.isLoading}
      onClick={() => isFollowing ? unfollow.mutate({ userId }) : follow.mutate({ userId })}
    >
      {isFollowing ? "Following" : "Follow"}
    </button>
  );
}

export default function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  const { viewer } = useViewer();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { accent } = useSettings();
  const [activeTab, setActiveTab] = useState<ProfileTab>("overview");

  // Show toast for WCA OAuth result and clean the URL.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const wcaStatus = params.get("wca");
    if (wcaStatus) {
      const reason = params.get("reason") ?? wcaStatus;
      const flash = WCA_FLASH_MESSAGES[reason] ?? WCA_FLASH_MESSAGES[wcaStatus];
      if (flash) {
        if (flash.type === "success") toast.success(flash.message);
        else toast.error(flash.message);
      }
      const clean = new URL(window.location.href);
      clean.searchParams.delete("wca");
      clean.searchParams.delete("reason");
      window.history.replaceState({}, "", clean.toString());
      if (wcaStatus === "linked") {
        queryClient.invalidateQueries({ queryKey: trpc.user.getByUsername.queryKey({ username }) });
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const profileQuery = useQuery(
    trpc.user.getByUsername.queryOptions({ username })
  );

  if (profileQuery.status === "pending") {
    return (
      <div className="flex flex-1 items-center justify-center">
        <CubeLoader message="Loading profile..." />
      </div>
    );
  }

  if (profileQuery.status === "error") {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-red-500">User not found</p>
      </div>
    );
  }

  const user = profileQuery.data;
  const isOwnProfile = viewer.id === user.id;

  const tabs: { key: ProfileTab; label: string; comingSoon?: boolean }[] = [
    { key: "overview", label: "Overview" },
    { key: "collection", label: "Collection", comingSoon: true },
    { key: "clubs", label: "Clubs", comingSoon: true },
  ];

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      {/* Profile header */}
      <div className="pt-8 pb-4 px-8 max-w-3xl mx-auto w-full">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-5">
            <UserAvatar user={user} size="lg" rounded="xl" />
            <div>
              <h1 className="text-2xl font-extrabold">
                {user.username}
                {user.country && (
                  <span className="ml-2" title={user.country}>
                    {countryCodeToFlag(user.country)}
                  </span>
                )}
              </h1>
              <p className="text-muted-foreground">
                {user.firstName} {user.lastName}
              </p>
              <div className="flex items-center gap-4 mt-2 text-sm flex-wrap">
                <span><strong className="text-foreground font-extrabold">{user.followerCount}</strong> <span className="text-muted-foreground text-xs">Followers</span></span>
                <span><strong className="text-foreground font-extrabold">{user.followingCount}</strong> <span className="text-muted-foreground text-xs">Following</span></span>
                {user.wcaId && (
                  <a
                    href={`https://www.worldcubeassociation.org/persons/${user.wcaId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-white hover:underline"
                  >
                    {user.wcaId}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                {isOwnProfile && !user.wcaId && (
                  <button
                    onClick={startWcaOAuth}
                    className="text-xs px-2.5 py-1 rounded bg-neutral-600 hover:bg-neutral-500 text-white font-bold shadow-[0_2px_0_0_#1a1a1a] transition-colors"
                  >
                    Link WCA
                  </button>
                )}
              </div>
              {user.bio && (
                <p className="text-sm text-muted-foreground mt-2">{user.bio}</p>
              )}
            </div>
          </div>

          {isOwnProfile ? (
            <Link
              href="/settings"
              className={`shrink-0 self-start whitespace-nowrap px-4 py-2 text-sm font-bold rounded ${accent.bg} text-white ${accent.hover} transition-colors ${accent.shadow}`}
            >
              Edit Profile
            </Link>
          ) : (
            <FollowButton userId={user.id} username={user.username} />
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-border px-8">
        <div className="flex gap-1 max-w-3xl mx-auto">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === tab.key
                  ? `${accent.border} text-foreground`
                  : "border-transparent text-muted-foreground hover:text-foreground"
              } ${tab.comingSoon ? "opacity-40 cursor-not-allowed" : ""}`}
              onClick={() => !tab.comingSoon && setActiveTab(tab.key)}
              disabled={tab.comingSoon}
            >
              {tab.label}
              {tab.comingSoon && (
                <span className="text-[10px] uppercase tracking-wide ml-1">Soon</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="px-8 py-6 max-w-3xl mx-auto w-full">
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Medal Showcase */}
            <section>
              <h2 className="text-sm font-bold text-foreground uppercase tracking-wider mb-3">
                🎖️ Medal Showcase
              </h2>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-1.5">
                  <span className="text-xl">🥇</span>
                  <span className="text-lg font-extrabold tabular-nums">{user.medals.gold}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xl">🥈</span>
                  <span className="text-lg font-extrabold tabular-nums">{user.medals.silver}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xl">🥉</span>
                  <span className="text-lg font-extrabold tabular-nums">{user.medals.bronze}</span>
                </div>
              </div>
            </section>

            {/* Personal Bests */}
            <section>
              <h2 className="text-sm font-bold text-foreground uppercase tracking-wider mb-3">
                🏆 Personal Bests
              </h2>
              <div className="bg-card rounded-xl border border-border overflow-hidden">
                <div className="grid grid-cols-[1fr_5rem_5rem] gap-2 px-4 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider border-b border-border">
                  <span>Event</span>
                  <span className="text-right">Single</span>
                  <span className="text-right">Ao5</span>
                </div>
                {MOCK_PBS.map((pb) => {
                  const config = EVENT_MAP[pb.event];
                  return (
                  <div
                    key={pb.event}
                    className="grid grid-cols-[1fr_5rem_5rem] gap-2 px-4 py-3 border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <EventIcon event={config} size={18} />
                      <span className="text-sm font-semibold">{config.name}</span>
                    </div>
                    <span className="text-base font-mono tabular-nums text-right font-extrabold text-foreground">
                      {pb.single}
                    </span>
                    <span className="text-base font-mono tabular-nums text-right font-extrabold text-foreground">
                      {pb.ao5}
                    </span>
                  </div>
                  );
                })}
              </div>
            </section>

            {/* Posts */}
            <ProfilePosts userId={user.id} />
          </div>
        )}

        {activeTab === "collection" && (
          <div className="text-center py-12">
            <Puzzle className="w-12 h-12 mx-auto mb-3 text-muted-foreground/40" />
            <p className="text-muted-foreground font-semibold">Puzzle Collection</p>
            <p className="text-sm text-muted-foreground/60 mt-1">
              {isOwnProfile ? "Add puzzles to your collection" : `${user.firstName}'s puzzles will appear here`}
            </p>
          </div>
        )}

      </div>
    </div>
  );
}

function ProfilePosts({ userId }: { userId: string }) {
  const trpc = useTRPC();
  const sentinelRef = useRef<HTMLDivElement>(null);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useInfiniteQuery(
      trpc.post.getUserPosts.infiniteQueryOptions(
        { userId },
        { getNextPageParam: (lastPage) => lastPage.nextCursor }
      )
    );

  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    },
    [fetchNextPage, hasNextPage, isFetchingNextPage]
  );

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(handleObserver, { threshold: 0 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [handleObserver]);

  const posts = data?.pages.flatMap((page) => page.posts) ?? [];

  if (isLoading) {
    return <CubeLoader message="Loading posts..." />;
  }

  if (posts.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        No posts yet.
      </p>
    );
  }

  return (
    <section>
      <div className="space-y-4">
        {posts.map((post) => (
          <PracticePostCard key={post.id} post={post} />
        ))}
        <div ref={sentinelRef} className="h-1" />
        {isFetchingNextPage && (
          <p className="text-center text-sm text-muted-foreground py-2">
            Loading more...
          </p>
        )}
      </div>
    </section>
  );
}
