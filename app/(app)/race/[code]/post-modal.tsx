"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useTRPC } from "@/lib/trpc/client";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useSettings } from "@/lib/context/settings";
import { formatTime } from "@/lib/cubing/format";
import { EVENT_MAP, CubeEvent } from "@/lib/cubing/events";
import { DNF_SENTINEL, type EventStats } from "@/lib/cubing/stats";
import type { RaceSolve } from "@/lib/race/types";

interface PostFromRaceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventName: string;
  scrambleSetId: string;
  solves: RaceSolve[];
  stats: EventStats | null;
  scrambles: string[];
}

export function PostFromRaceModal({
  open,
  onOpenChange,
  eventName,
  solves,
  stats,
  scrambles,
}: PostFromRaceModalProps) {
  const { accent } = useSettings();
  const trpc = useTRPC();
  const [caption, setCaption] = useState("");

  const postMutation = useMutation(
    trpc.post.createPracticeSessionPost.mutationOptions({
      onSuccess: () => {
        toast.success("Posted!");
        onOpenChange(false);
      },
      onError: (err) => {
        toast.error(err.message);
      },
    })
  );

  const eventConfig = EVENT_MAP[eventName as CubeEvent];

  const handlePost = () => {
    const solveData = solves.map((s) => ({
      timeMs: s.timeMs,
      penalty: s.penalty ?? undefined,
      scramble: scrambles[s.scrambleIndex] ?? "",
    }));

    postMutation.mutate({
      event: eventName as CubeEvent,
      caption,
      solves: solveData,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Post Race Results</DialogTitle>
          <DialogDescription>
            Share your {eventConfig?.name ?? eventName} race session ({solves.length} solves)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Stats preview */}
          {stats && (
            <div className="grid grid-cols-2 gap-2 text-sm">
              {stats.bestSingle !== null && stats.bestSingle < DNF_SENTINEL && (
                <div className="bg-muted/50 rounded p-2">
                  <div className="text-[10px] text-muted-foreground uppercase font-bold">
                    Best Single
                  </div>
                  <div className="font-mono tabular-nums font-bold">
                    {formatTime(stats.bestSingle)}
                  </div>
                </div>
              )}
              {stats.bestAo5 !== null && stats.bestAo5 < DNF_SENTINEL && (
                <div className="bg-muted/50 rounded p-2">
                  <div className="text-[10px] text-muted-foreground uppercase font-bold">
                    Best Ao5
                  </div>
                  <div className="font-mono tabular-nums font-bold">
                    {formatTime(stats.bestAo5)}
                  </div>
                </div>
              )}
              {stats.bestAo12 !== null && stats.bestAo12 < DNF_SENTINEL && (
                <div className="bg-muted/50 rounded p-2">
                  <div className="text-[10px] text-muted-foreground uppercase font-bold">
                    Best Ao12
                  </div>
                  <div className="font-mono tabular-nums font-bold">
                    {formatTime(stats.bestAo12)}
                  </div>
                </div>
              )}
              {stats.sessionMean !== null && stats.sessionMean < DNF_SENTINEL && (
                <div className="bg-muted/50 rounded p-2">
                  <div className="text-[10px] text-muted-foreground uppercase font-bold">
                    Session Mean
                  </div>
                  <div className="font-mono tabular-nums font-bold">
                    {formatTime(stats.sessionMean)}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Caption */}
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Add a caption (optional)"
            className="w-full bg-muted/50 rounded-lg p-3 text-sm resize-none h-20 focus:outline-none focus:ring-1 focus:ring-border"
            maxLength={280}
          />

          <button
            onClick={handlePost}
            disabled={postMutation.isPending}
            className={`w-full py-2.5 rounded-lg font-bold text-sm text-white transition-colors disabled:opacity-50 ${accent.bg} ${accent.hover} ${accent.shadow}`}
          >
            {postMutation.isPending ? "Posting..." : "Post to Feed"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
