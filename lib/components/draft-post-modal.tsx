"use client";

import { useState, useMemo, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { type EventStats, DNF_SENTINEL, recomputeStats, findBestAverageIndex, computeAo5, computeAo12, computeAo100 } from "@/lib/cubing/stats";
import { formatTime, daysAgo, ONE_DAY, ONE_WEEK_IN_DAYS } from "@/lib/cubing/format";
import { type EventConfig, getEnabledStats } from "@/lib/cubing/events";
import { EventIcon } from "@/lib/components/event-icon";
import { type Solve } from "@/app/(app)/idb";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTRPC } from "@/lib/trpc/client";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

interface DraftPostModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventConfig: EventConfig;
  stats: EventStats;
  solves: Solve[];
}

interface QuickOption {
  label: string;
  start: number;
  end: number;
}

function buildQuickOptions(solves: { timeMs: number; penalty: "plus_two" | "dnf" | null; date: number }[]): QuickOption[] {
  const n = solves.length;
  const options: QuickOption[] = [];

  options.push({ label: `All (${n})`, start: 0, end: n - 1 });

  // Time-based
  const lastDayIdx = solves.findLastIndex((s) => s.date >= daysAgo(ONE_DAY));
  const lastWeekIdx = solves.findLastIndex((s) => s.date >= daysAgo(ONE_WEEK_IN_DAYS));

  // Interleave Best and Last for each size, smallest first
  const avgConfigs: { size: number; aoLabel: string; fn: typeof computeAo5 }[] = [
    { size: 5, aoLabel: "Ao5", fn: computeAo5 },
    { size: 12, aoLabel: "Ao12", fn: computeAo12 },
    { size: 100, aoLabel: "Ao100", fn: computeAo100 },
  ];
  for (const { size, aoLabel, fn } of avgConfigs) {
    if (n >= size) {
      const idx = findBestAverageIndex(solves, fn);
      if (idx >= 0) {
        options.push({ label: `Best ${aoLabel}`, start: idx, end: idx + size - 1 });
      }
      options.push({ label: `Last ${size}`, start: 0, end: size - 1 });
    }
  }

  if (lastDayIdx > 0) {
    options.push({ label: `Last day (${lastDayIdx + 1} solves)`, start: 0, end: lastDayIdx });
  }
  if (lastWeekIdx > 0 && lastWeekIdx !== lastDayIdx) {
    options.push({ label: "Last week", start: 0, end: lastWeekIdx });
  }

  // Deduplicate options with identical ranges (keep first)
  const seen = new Set<string>();
  return options.filter((opt) => {
    const key = `${opt.start}-${opt.end}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function DraftPostModal({
  open,
  onOpenChange,
  eventConfig,
  stats: _sessionStats,
  solves,
}: DraftPostModalProps) {
  const [caption, setCaption] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [rangeStart, setRangeStart] = useState(0);
  const [rangeEnd, setRangeEnd] = useState(0);
  const [isCustom, setIsCustom] = useState(false);
  const trpc = useTRPC();

  // Reset range when modal opens or solves change
  useEffect(() => {
    if (open) {
      setRangeStart(0);
      setRangeEnd(solves.length - 1);
      setIsCustom(false);
    }
  }, [open, solves.length]);

  const createPost = useMutation(
    trpc.post.createPracticeSessionPost.mutationOptions()
  );

  // Solves are newest-first; selected slice
  const selectedSolves = useMemo(
    () => solves.slice(rangeStart, rangeEnd + 1),
    [solves, rangeStart, rangeEnd]
  );

  const selectedStats = useMemo(
    () =>
      recomputeStats(
        eventConfig.id,
        selectedSolves.map((s) => ({ timeMs: s.timeMs, penalty: s.penalty ?? null })),
        getEnabledStats(eventConfig.id)
      ),
    [selectedSolves, eventConfig.id]
  );

  const quickOptions = useMemo(
    () => buildQuickOptions(solves.map((s) => ({ timeMs: s.timeMs, penalty: s.penalty ?? null, date: s.date }))),
    [solves]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createPost.mutateAsync({
      event: eventConfig.id,
      solves: selectedSolves.map((s) => ({
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
    toast.success("Session posted!");
  };

  const handleReset = () => {
    setRangeStart(0);
    setRangeEnd(solves.length - 1);
  };

  const enabledStats = getEnabledStats(eventConfig.id);
  const highlights: { label: string; value: number | null }[] = [
    { label: "Best single", value: selectedStats.bestSingle },
    ...(enabledStats.includes("ao5") ? [{ label: "Ao5", value: selectedStats.bestAo5 }] : []),
    ...(enabledStats.includes("ao12") ? [{ label: "Ao12", value: selectedStats.bestAo12 }] : []),
    ...(enabledStats.includes("ao100") ? [{ label: "Ao100", value: selectedStats.bestAo100 }] : []),
  ].filter((h) => h.value !== null);

  const isAllSelected = rangeStart === 0 && rangeEnd === solves.length - 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Share practice session ⏱</DialogTitle>
          <DialogDescription>
            <span className="inline-flex items-center gap-1.5">
              <EventIcon event={eventConfig} size={16} />
              {selectedSolves.length} of {solves.length} solve{solves.length !== 1 ? "s" : ""} selected
            </span>
          </DialogDescription>
        </DialogHeader>

        {/* Solve selection */}
        <div>
          <label className="block text-sm font-medium mb-1">
            Solves to include
          </label>
          <Select
            value={isCustom ? "custom" : `${rangeStart}-${rangeEnd}`}
            onValueChange={(val) => {
              if (!val) return;
              if (val === "custom") {
                setIsCustom(true);
                return;
              }
              setIsCustom(false);
              const [s, end] = val.split("-").map(Number);
              setRangeStart(s);
              setRangeEnd(end);
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select solves">
                {isCustom
                  ? "Custom"
                  : quickOptions.find((o) => `${o.start}-${o.end}` === `${rangeStart}-${rangeEnd}`)?.label ?? `Solves ${rangeStart + 1}–${rangeEnd + 1}`}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {quickOptions.map((opt) => (
                <SelectItem key={`${opt.label}-${opt.start}-${opt.end}`} value={`${opt.start}-${opt.end}`}>
                  {opt.label}
                </SelectItem>
              ))}
              <SelectItem value="custom">Custom (select below)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Range selector (custom mode) */}
        {isCustom && (
          <div className="flex items-center gap-2 text-sm">
            <label className="text-muted-foreground text-xs shrink-0">Solve range:</label>
            <input
              type="number"
              min={1}
              max={rangeEnd + 1}
              value={rangeStart + 1}
              onChange={(e) => {
                const v = Math.max(0, Math.min(rangeEnd, Number(e.target.value) - 1));
                setRangeStart(v);
              }}
              className="w-16 rounded-md border border-border bg-muted px-2 py-1 text-sm text-center focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <span className="text-muted-foreground">to</span>
            <input
              type="number"
              min={rangeStart + 1}
              max={solves.length}
              value={rangeEnd + 1}
              onChange={(e) => {
                const v = Math.max(rangeStart, Math.min(solves.length - 1, Number(e.target.value) - 1));
                setRangeEnd(v);
              }}
              className="w-16 rounded-md border border-border bg-muted px-2 py-1 text-sm text-center focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <span className="text-muted-foreground text-xs">
              (newest first)
            </span>
          </div>
        )}

        {/* Stat highlights */}
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
              disabled={createPost.isPending || selectedSolves.length === 0}
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
