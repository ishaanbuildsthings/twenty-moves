"use client";

import { UserAvatar } from "@/lib/components/user-avatar";
import { formatTime } from "@/lib/cubing/format";
import type { RacePresence } from "@/lib/race/types";

interface ParticipantCardProps {
  presence: RacePresence;
  isHost: boolean;
  isViewer: boolean;
  canVoteSkip: boolean;
  onVoteSkip: () => void;
}

const STATUS_LABELS: Record<RacePresence["status"], string> = {
  idle: "Idle",
  inspecting: "Inspecting",
  solving: "Solving...",
};

const STATUS_COLORS: Record<RacePresence["status"], string> = {
  idle: "text-muted-foreground",
  inspecting: "text-yellow-500",
  solving: "text-green-500",
};

export function ParticipantCard({
  presence,
  isHost,
  isViewer,
  canVoteSkip,
  onVoteSkip,
}: ParticipantCardProps) {
  return (
    <div
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg ${
        isViewer ? "bg-muted/50 ring-1 ring-border" : ""
      }`}
    >
      <UserAvatar
        user={{
          profilePictureUrl: presence.profilePictureUrl,
          firstName: presence.firstName,
          lastName: presence.lastName,
          username: presence.username,
        }}
        size="sm"
        rounded="full"
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-sm truncate">
            {presence.username}
          </span>
          {isHost && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-500">
              HOST
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className={STATUS_COLORS[presence.status]}>
            {STATUS_LABELS[presence.status]}
          </span>
          <span className="text-muted-foreground">
            #{presence.currentScrambleIndex + 1}
          </span>
        </div>
      </div>

      <div className="text-right shrink-0">
        {presence.latestTimeMs !== null && (
          <div className="font-mono tabular-nums text-sm font-bold">
            {formatTime(presence.latestTimeMs)}
          </div>
        )}
        {presence.currentAo5 !== null && (
          <div className="font-mono tabular-nums text-[11px] text-muted-foreground">
            Ao5: {formatTime(presence.currentAo5)}
          </div>
        )}
      </div>

      {canVoteSkip && !isViewer && (
        <button
          onClick={onVoteSkip}
          className="text-[10px] font-bold px-2 py-1 rounded bg-neutral-700 hover:bg-neutral-600 text-muted-foreground hover:text-foreground transition-colors"
        >
          Skip
        </button>
      )}
    </div>
  );
}
