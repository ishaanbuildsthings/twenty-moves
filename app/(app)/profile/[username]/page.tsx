"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useViewer } from "@/lib/hooks/useViewer";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Trophy, Users, Puzzle, MessageSquare, Lock } from "lucide-react";
import Link from "next/link";
import { UserAvatar } from "@/lib/components/user-avatar";
import { countryCodeToFlag } from "@/lib/countries";

type ProfileTab = "overview" | "collection" | "clubs";

// Mock data for placeholder UI
const MOCK_RATINGS = [
  { event: "3x3", icon: "event-333", rating: 1420 },
  { event: "2x2", icon: "event-222", rating: 1180 },
  { event: "4x4", icon: "event-444", rating: 980 },
  { event: "OH", icon: "event-333oh", rating: 1050 },
];

const MOCK_PBS = [
  { event: "3x3", icon: "event-333", single: "8.42", ao5: "10.15" },
  { event: "2x2", icon: "event-222", single: "2.31", ao5: "3.44" },
  { event: "4x4", icon: "event-444", single: "38.72", ao5: "42.10" },
  { event: "OH", icon: "event-333oh", single: "14.55", ao5: "17.82" },
];

const MOCK_POSTS = [
  { id: 1, text: "New PB! 🎉 8.42s on 3x3", time: "2h ago", likes: 12 },
  { id: 2, text: "Finally sub-10 ao5! Feels amazing", time: "1d ago", likes: 24 },
  { id: 3, text: "Learning F2L... it's a journey 😅", time: "3d ago", likes: 8 },
];

export default function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  const { viewer } = useViewer();
  const trpc = useTRPC();
  const [activeTab, setActiveTab] = useState<ProfileTab>("overview");

  const profileQuery = useQuery(
    trpc.user.getByUsername.queryOptions({ username })
  );

  if (profileQuery.status === "pending") {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
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

  const tabs: { key: ProfileTab; label: string; icon: React.ReactNode; comingSoon?: boolean }[] = [
    { key: "overview", label: "Overview", icon: <Trophy className="w-4 h-4" /> },
    { key: "collection", label: "Collection", icon: <Puzzle className="w-4 h-4" /> },
    { key: "clubs", label: "Clubs", icon: <Users className="w-4 h-4" />, comingSoon: true },
  ];

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      {/* Profile header */}
      <div className="px-8 pt-8 pb-4">
        <div className="flex items-start justify-between max-w-3xl mx-auto">
          <div className="flex items-center gap-5">
            <UserAvatar user={user} size="lg" rounded="xl" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-extrabold">
                  {user.username}
                  {user.country && (
                    <span className="ml-2" title={user.country}>
                      {countryCodeToFlag(user.country)}
                    </span>
                  )}
                </h1>
                {user.wcaId && (
                  <a
                    href={`https://www.worldcubeassociation.org/persons/${user.wcaId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
              <p className="text-muted-foreground">
                {user.firstName} {user.lastName}
              </p>
              <div className="flex items-center gap-4 mt-2 text-sm">
                <span><strong className="text-foreground font-extrabold">12</strong> <span className="text-muted-foreground text-xs">Followers</span></span>
                <span><strong className="text-foreground font-extrabold">8</strong> <span className="text-muted-foreground text-xs">Following</span></span>
              </div>
            </div>
          </div>

          {isOwnProfile && (
            <Link
              href="/settings"
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-muted hover:bg-muted/80 transition-colors"
            >
              Edit Profile
            </Link>
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
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              } ${tab.comingSoon ? "opacity-40 cursor-not-allowed" : ""}`}
              onClick={() => !tab.comingSoon && setActiveTab(tab.key)}
              disabled={tab.comingSoon}
            >
              {tab.icon}
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
            {/* Ratings grid */}
            <section>
              <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">
                Ratings
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {MOCK_RATINGS.map((r) => (
                  <div
                    key={r.event}
                    className="bg-card rounded-xl p-4 border border-border hover:border-primary/30 transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`cubing-icon ${r.icon} text-lg`} />
                      <span className="text-xs font-semibold text-muted-foreground">{r.event}</span>
                    </div>
                    <p className="text-2xl font-extrabold text-foreground">{r.rating}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Personal Bests */}
            <section>
              <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">
                🏆 Personal Bests
              </h2>
              <div className="bg-card rounded-xl border border-border overflow-hidden">
                <div className="grid grid-cols-[1fr_5rem_5rem] gap-2 px-4 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider border-b border-border">
                  <span>Event</span>
                  <span className="text-right">Single</span>
                  <span className="text-right">Ao5</span>
                </div>
                {MOCK_PBS.map((pb) => (
                  <div
                    key={pb.event}
                    className="grid grid-cols-[1fr_5rem_5rem] gap-2 px-4 py-3 border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`cubing-icon ${pb.icon} text-base`} />
                      <span className="text-sm font-semibold">{pb.event}</span>
                    </div>
                    <span className="text-base font-mono tabular-nums text-right font-extrabold text-foreground">
                      {pb.single}
                    </span>
                    <span className="text-base font-mono tabular-nums text-right font-extrabold text-foreground">
                      {pb.ao5}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            {/* Recent Posts */}
            <section>
              <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">
                <MessageSquare className="w-4 h-4 inline mr-1.5" />
                Recent Posts
              </h2>
              <div className="space-y-3">
                {MOCK_POSTS.map((post) => (
                  <div
                    key={post.id}
                    className="bg-card rounded-xl border border-border p-4 hover:border-primary/30 transition-colors"
                  >
                    <p className="text-sm mb-2">{post.text}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{post.time}</span>
                      <span>❤️ {post.likes}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
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
