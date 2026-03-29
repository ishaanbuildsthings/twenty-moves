"use client";

import { type IPracticePost } from "@/lib/transforms/post";
import { EVENT_MAP, type CubeEvent } from "@/lib/cubing/events";
import { EventIcon } from "@/lib/components/event-icon";
import { DNF_SENTINEL } from "@/lib/cubing/stats";
import { Heart, MessageCircle } from "lucide-react";

function formatTime(ms: number): string {
  if (ms >= DNF_SENTINEL) return "DNF";
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const centiseconds = Math.floor((ms % 1000) / 10);
  if (minutes > 0) {
    return `${minutes}:${String(seconds).padStart(2, "0")}.${String(centiseconds).padStart(2, "0")}`;
  }
  return `${seconds}.${String(centiseconds).padStart(2, "0")}`;
}

function timeAgo(date: Date): string {
  const now = Date.now();
  const diff = now - new Date(date).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(date).toLocaleDateString();
}

interface PracticePostCardProps {
  post: IPracticePost;
}

export function PracticePostCard({ post }: PracticePostCardProps) {
  const eventConfig = EVENT_MAP[post.eventName as CubeEvent];

  const highlights: { label: string; value: number }[] = [];
  if (post.bestSingle !== null) highlights.push({ label: "Single", value: post.bestSingle });
  if (post.bestAo5 !== null) highlights.push({ label: "Ao5", value: post.bestAo5 });
  if (post.bestAo12 !== null) highlights.push({ label: "Ao12", value: post.bestAo12 });
  if (post.bestAo100 !== null) highlights.push({ label: "Ao100", value: post.bestAo100 });
  if (post.sessionMean !== null) highlights.push({ label: "Mean", value: post.sessionMean });

  return (
    <div className="border border-border rounded-xl bg-card overflow-hidden">
      {/* Header — user + event + timestamp */}
      <div className="flex items-center gap-3 px-5 py-4">
        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm font-bold shrink-0">
          {post.user.profilePictureUrl ? (
            <img
              src={post.user.profilePictureUrl}
              alt={post.user.username}
              className="w-10 h-10 rounded-full object-cover"
            />
          ) : (
            post.user.firstName[0]
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold truncate">{post.user.username}</span>
            <span className="text-muted-foreground text-xs shrink-0">{timeAgo(post.createdAt)}</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            {eventConfig && <EventIcon event={eventConfig} size={16} />}
            <span>{eventConfig?.name ?? post.eventName}</span>
            <span className="text-muted-foreground/50">·</span>
            <span>{post.numSolves} solve{post.numSolves !== 1 ? "s" : ""}</span>
          </div>
        </div>
      </div>

      {/* Stat highlights */}
      {highlights.length > 0 && (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(0,1fr))] gap-px bg-border mx-5 mb-4 rounded-lg overflow-hidden">
          {highlights.map((h) => (
            <div
              key={h.label}
              className="flex flex-col items-center gap-1 bg-muted/50 px-3 py-3"
            >
              <span className="font-mono tabular-nums text-base font-bold">
                {formatTime(h.value)}
              </span>
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                {h.label}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Caption */}
      {post.caption && (
        <div className="px-5 pb-4">
          <p className="text-sm leading-relaxed">{post.caption}</p>
        </div>
      )}

      {/* Footer — like + comment buttons */}
      <div className="flex items-center gap-1 px-3 py-2 border-t border-border">
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
          <Heart className="w-4 h-4" />
          <span>{post.numLikes}</span>
        </button>
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
          <MessageCircle className="w-4 h-4" />
          <span>{post.numComments}</span>
        </button>
      </div>
    </div>
  );
}
