"use client";

import type { RacePresence } from "@/lib/race/types";
import { ParticipantCard } from "./participant-card";

interface ParticipantPanelProps {
  peers: Map<string, RacePresence>;
  hostId: string;
  viewerId: string;
  onVoteSkip: (targetUserId: string) => void;
}

export function ParticipantPanel({
  peers,
  hostId,
  viewerId,
  onVoteSkip,
}: ParticipantPanelProps) {
  // Sort: viewer first, then host, then alphabetical
  const sorted = Array.from(peers.values()).sort((a, b) => {
    if (a.userId === viewerId) return -1;
    if (b.userId === viewerId) return 1;
    if (a.userId === hostId) return -1;
    if (b.userId === hostId) return 1;
    return a.username.localeCompare(b.username);
  });

  return (
    <div className="flex flex-col gap-1">
      <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-1 mb-1">
        Participants ({sorted.length})
      </h3>
      <div className="flex flex-col gap-1.5">
        {sorted.map((p) => (
          <ParticipantCard
            key={p.userId}
            presence={p}
            isHost={p.userId === hostId}
            isViewer={p.userId === viewerId}
            canVoteSkip={p.status === "idle" && p.userId !== viewerId}
            onVoteSkip={() => onVoteSkip(p.userId)}
          />
        ))}
      </div>
    </div>
  );
}
