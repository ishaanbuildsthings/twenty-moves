"use client";

import { type IPracticePost } from "@/lib/transforms/post";
import { EVENT_MAP, type CubeEvent } from "@/lib/cubing/events";
import { EventIcon } from "@/lib/components/event-icon";
import { DNF_SENTINEL } from "@/lib/cubing/stats";

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
    <div className="border border-border rounded-lg bg-card">
      {/* Header — user + event + timestamp */}
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-bold shrink-0">
          {post.user.profilePictureUrl ? (
            <img
              src={post.user.profilePictureUrl}
              alt={post.user.username}
              className="w-8 h-8 rounded-full object-cover"
            />
          ) : (
            post.user.firstName[0]
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold truncate">{post.user.username}</span>
            <span className="text-muted-foreground text-xs">·</span>
            <span className="text-muted-foreground text-xs shrink-0">{timeAgo(post.createdAt)}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {eventConfig && <EventIcon event={eventConfig} size={14} />}
            <span>{eventConfig?.name ?? post.eventName}</span>
            <span>· {post.numSolves} solve{post.numSolves !== 1 ? "s" : ""}</span>
          </div>
        </div>
      </div>

      {/* Stat highlights */}
      {highlights.length > 0 && (
        <div className="flex gap-2 px-4 pb-3 flex-wrap">
          {highlights.map((h) => (
            <div
              key={h.label}
              className="flex flex-col items-center gap-0.5 rounded-lg border border-border px-3 py-2"
            >
              <span className="font-mono tabular-nums text-sm font-bold">
                {formatTime(h.value)}
              </span>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {h.label}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Caption */}
      {post.caption && (
        <div className="px-4 pb-3">
          <p className="text-sm">{post.caption}</p>
        </div>
      )}

      {/* Footer — likes + comments */}
      <div className="flex items-center gap-4 px-4 py-2 border-t border-border text-xs text-muted-foreground">
        <span>{post.numLikes} like{post.numLikes !== 1 ? "s" : ""}</span>
        <span>{post.numComments} comment{post.numComments !== 1 ? "s" : ""}</span>
      </div>
    </div>
  );
}
