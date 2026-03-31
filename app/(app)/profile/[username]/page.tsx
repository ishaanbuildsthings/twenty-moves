"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { useViewer } from "@/lib/hooks/useViewer";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery, useInfiniteQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { publicEnv } from "@/lib/env";
import { toast } from "sonner";
import { useSettings } from "@/lib/context/settings";

import { ExternalLink, Puzzle, Trophy } from "lucide-react";
import { InfoTooltip } from "@/lib/components/info-tooltip";
import Link from "next/link";
import { UserAvatar } from "@/lib/components/user-avatar";
import { PracticePostCard } from "@/lib/components/practice-post-card";
import { EventIcon } from "@/lib/components/event-icon";
import { type IUser, type IPersonalBest } from "@/lib/transforms/user";
import { countryCodeToFlag } from "@/lib/countries";
import { CubeLoader } from "@/lib/components/cube-loader";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { EVENT_MAP, EVENT_CONFIGS, type CubeEvent } from "@/lib/cubing/events";
import { formatTime } from "@/lib/cubing/format";
import type { PbType } from "@/app/generated/prisma/client";

type ProfileTab = "overview" | "achievements" | "collection" | "clubs";

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

type FollowListType = "followers" | "following";

function FollowListModal({
  userId,
  type,
  open,
  onOpenChange,
}: {
  userId: string;
  type: FollowListType;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const trpc = useTRPC();
  const query = useQuery(
    type === "followers"
      ? trpc.user.getFollowers.queryOptions({ userId }, { enabled: open })
      : trpc.user.getFollowing.queryOptions({ userId }, { enabled: open })
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm h-[50vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{type === "followers" ? "Followers" : "Following"}</DialogTitle>
          <DialogDescription>
            {query.data ? `${query.data.length} user${query.data.length !== 1 ? "s" : ""}` : "Loading..."}
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto min-h-0 -mx-4 px-4">
          {query.isLoading && (
            <div className="flex justify-center py-8">
              <CubeLoader message="" />
            </div>
          )}
          {query.data?.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              {type === "followers" ? "No followers yet." : "Not following anyone yet."}
            </p>
          )}
          {query.data && query.data.length > 0 && (
            <div className="space-y-1">
              {query.data.map((user) => (
                <Link
                  key={user.id}
                  href={`/profile/${user.username}`}
                  onClick={() => onOpenChange(false)}
                  className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-muted transition-colors"
                >
                  <UserAvatar user={user} size="sm" rounded="full" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{user.username}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {user.firstName} {user.lastName}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  const { viewer } = useViewer();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { accent } = useSettings();
  const [activeTab, setActiveTab] = useState<ProfileTab>("overview");
  const [followListOpen, setFollowListOpen] = useState<FollowListType | null>(null);

  // Show toast for WCA OAuth result and clean the URL.
  // Delay slightly to ensure the Toaster component is hydrated after navigation.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const wcaStatus = params.get("wca");
    if (!wcaStatus) return;

    const reason = params.get("reason") ?? wcaStatus;
    const flash = WCA_FLASH_MESSAGES[reason] ?? WCA_FLASH_MESSAGES[wcaStatus];

    // Clean URL immediately so a refresh doesn't re-trigger
    const clean = new URL(window.location.href);
    clean.searchParams.delete("wca");
    clean.searchParams.delete("reason");
    window.history.replaceState({}, "", clean.toString());

    if (wcaStatus === "linked") {
      queryClient.invalidateQueries({ queryKey: trpc.user.getByUsername.queryKey({ username }) });
    }

    const timer = setTimeout(() => {
      if (flash) {
        if (flash.type === "success") toast.success(flash.message);
        else toast.error(flash.message);
      }
    }, 300);

    return () => clearTimeout(timer);
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
    { key: "achievements", label: "Achievements" },
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
                <button onClick={() => setFollowListOpen("followers")} className="hover:underline decoration-muted-foreground/40"><strong className="text-foreground font-extrabold">{user.followerCount}</strong> <span className="text-muted-foreground text-xs">Followers</span></button>
                <button onClick={() => setFollowListOpen("following")} className="hover:underline decoration-muted-foreground/40"><strong className="text-foreground font-extrabold">{user.followingCount}</strong> <span className="text-muted-foreground text-xs">Following</span></button>
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
                {user.youtubeChannelUrl && (
                  <a
                    href={user.youtubeChannelUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-white hover:underline"
                  >
                    YouTube
                    <ExternalLink className="w-3 h-3" />
                  </a>
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
          <ProfilePosts userId={user.id} />
        )}

        {activeTab === "achievements" && (
          <AchievementsTab user={user} />
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

      {/* Follow list modal */}
      <FollowListModal
        userId={user.id}
        type={followListOpen ?? "followers"}
        open={followListOpen !== null}
        onOpenChange={(open) => { if (!open) setFollowListOpen(null); }}
      />
    </div>
  );
}

const PB_TYPE_LABELS: Record<PbType, string> = {
  single: "Single",
  mo3: "Mo3",
  avg5: "Ao5",
  avg12: "Ao12",
  avg100: "Ao100",
};

const PB_TYPE_ORDER: PbType[] = ["single", "mo3", "avg5", "avg12", "avg100"];

function AchievementsTab({ user }: { user: IUser }) {
  // Group PBs by event, ordered by EVENT_CONFIGS order
  const pbsByEvent = new Map<string, IPersonalBest[]>();
  for (const pb of user.personalBests) {
    if (!pbsByEvent.has(pb.eventId)) pbsByEvent.set(pb.eventId, []);
    pbsByEvent.get(pb.eventId)!.push(pb);
  }

  // Sort events by their position in EVENT_CONFIGS
  const eventOrder = EVENT_CONFIGS.map((e) => e.id as string);
  const sortedEvents = [...pbsByEvent.entries()].sort(
    (a, b) => eventOrder.indexOf(a[0]) - eventOrder.indexOf(b[0])
  );

  return (
    <div className="space-y-8">
      {/* Medal Table */}
      <section>
        <h2 className="text-sm font-bold text-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
          <Trophy className="w-4 h-4" />
          Medals
          <InfoTooltip>Compete in the daily tournament to collect medals.</InfoTooltip>
        </h2>
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🥇</span>
            <div>
              <span className="text-xl font-extrabold tabular-nums">{user.medals.gold}</span>
              <p className="text-xs text-muted-foreground">Gold</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">🥈</span>
            <div>
              <span className="text-xl font-extrabold tabular-nums">{user.medals.silver}</span>
              <p className="text-xs text-muted-foreground">Silver</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">🥉</span>
            <div>
              <span className="text-xl font-extrabold tabular-nums">{user.medals.bronze}</span>
              <p className="text-xs text-muted-foreground">Bronze</p>
            </div>
          </div>
        </div>
      </section>

      {/* Personal Bests Table */}
      <section>
        <h2 className="text-sm font-bold text-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
          <Trophy className="w-4 h-4" />
          Personal Bests
          <InfoTooltip>Personal bests are only logged when you make a post.</InfoTooltip>
        </h2>
        {sortedEvents.length === 0 ? (
          <p className="text-sm text-muted-foreground">No PBs recorded. PBs are only logged when you make a post.</p>
        ) : (
          <div className="border border-border rounded-lg overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-[2.5rem_5rem_1fr] items-center gap-x-3 px-4 py-2 bg-muted/50 border-b border-border">
              <span />
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Event</span>
              <div className="flex gap-4">
                {PB_TYPE_ORDER.map((type) => (
                  <span key={type} className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest w-16 text-right">
                    {PB_TYPE_LABELS[type]}
                  </span>
                ))}
              </div>
            </div>
            {/* Table rows */}
            {sortedEvents.map(([eventId, pbs]) => {
              const config = EVENT_MAP[eventId as CubeEvent];
              if (!config) return null;
              const pbMap = new Map(pbs.map((pb) => [pb.type, pb.time]));
              return (
                <div
                  key={eventId}
                  className="grid grid-cols-[2.5rem_5rem_1fr] items-center gap-x-3 px-4 py-2.5 border-b border-border/50 last:border-b-0 hover:bg-muted/30 transition-colors"
                >
                  <EventIcon event={config} size={18} />
                  <span className="text-sm font-semibold">{config.name}</span>
                  <div className="flex gap-4">
                    {PB_TYPE_ORDER.map((type) => (
                      <span key={type} className="font-mono tabular-nums text-sm w-16 text-right">
                        {pbMap.has(type) ? formatTime(pbMap.get(type)!) : <span className="text-muted-foreground/30">-</span>}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
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
