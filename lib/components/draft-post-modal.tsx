"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { type EventStats, DNF_SENTINEL } from "@/lib/cubing/stats";
import { formatTime } from "@/lib/cubing/format";
import { type EventConfig, EVENT_MAP, getEnabledStats } from "@/lib/cubing/events";
import { type Solve } from "@/app/(app)/idb";
import { useTRPC } from "@/lib/trpc/client";
import { useMutation } from "@tanstack/react-query";

interface DraftPostModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventConfig: EventConfig;
  stats: EventStats;
  solves: Solve[];
}

export function DraftPostModal({
  open,
  onOpenChange,
  eventConfig,
  stats,
  solves,
}: DraftPostModalProps) {
  const [caption, setCaption] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const trpc = useTRPC();

  const createPost = useMutation(
    trpc.post.createPracticeSessionPost.mutationOptions()
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createPost.mutateAsync({
      event: eventConfig.id,
      solves: solves.map((s) => ({
        timeMs: s.timeMs,
        penalty: s.penalty ?? undefined,
        scramble: s.scramble,
      })),
      caption,
      youtubeUrl: youtubeUrl || undefined,
    });
    setCaption("");
    setYoutubeUrl("");
    onOpenChange(false);
  };

  const highlights: { label: string; value: number | null }[] = [
    { label: "Best single", value: stats.bestSingle },
    ...(getEnabledStats(eventConfig.id).includes("ao5") ? [{ label: "Ao5", value: stats.currentAo5 }] : []),
    ...(getEnabledStats(eventConfig.id).includes("ao12") ? [{ label: "Ao12", value: stats.currentAo12 }] : []),
    ...(getEnabledStats(eventConfig.id).includes("ao100") ? [{ label: "Ao100", value: stats.currentAo100 }] : []),
  ].filter((h) => h.value !== null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share practice session ⏱</DialogTitle>
          <DialogDescription>
            {eventConfig.name} · {solves.length} solve{solves.length !== 1 ? "s" : ""}
          </DialogDescription>
        </DialogHeader>

        {highlights.length > 0 && (
          <div className="flex gap-3 py-1">
            {highlights.map((h) => (
              <div key={h.label} className="flex flex-col items-center gap-0.5 rounded-lg border border-border px-3 py-2">
                <span className="font-mono tabular-nums text-sm font-bold">
                  {formatTime(h.value!)}
                </span>
                <span className="text-[10px] uppercase tracking-wider opacity-80">
                  {h.label}
                </span>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="post-caption" className="block text-sm font-medium mb-1">
              Caption
            </label>
            <textarea
              id="post-caption"
              rows={3}
              maxLength={500}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="How did the session go?"
              className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div>
            <label htmlFor="post-youtube" className="block text-sm font-medium mb-1">
              YouTube URL
            </label>
            <input
              id="post-youtube"
              type="url"
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              placeholder="https://youtube.com/watch?v=..."
              className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          {createPost.error && (
            <p className="text-sm text-red-500">{createPost.error.message}</p>
          )}
          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={createPost.isPending}
              className="px-4 py-2 text-sm font-semibold rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {createPost.isPending ? "Posting..." : "Post"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
