"use client";

import { EVENT_CONFIGS } from "@/lib/cubing/events";
import { EventIcon } from "@/lib/components/event-icon";

// Placeholder status for each event. Will be replaced with real data
// from tourney.getStatus once the API is implemented.
type TourneyStatus = "not-started" | "in-progress" | "completed";

export default function TourneyPage() {
  return (
    <div className="flex flex-col flex-1 p-6 overflow-y-auto">
      <div className="max-w-3xl mx-auto w-full space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-extrabold">Daily Tournament</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Compete against everyone. Same scrambles, same day.
          </p>
        </div>

        {/* Countdown to next tournament */}
        <div className="rounded-lg bg-card border border-border p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Next tournament in
            </p>
            <p className="text-2xl font-extrabold font-mono tabular-nums mt-1">
              --:--:--
            </p>
          </div>
          <span className="text-3xl" suppressHydrationWarning>🏆</span>
        </div>

        {/* Event grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {EVENT_CONFIGS.map((config) => {
            const status: TourneyStatus = "not-started";

            return (
              <button
                key={config.id}
                className="rounded-lg bg-card border border-border p-4 flex items-center gap-3 hover:bg-muted transition-colors text-left"
              >
                <EventIcon event={config} size={32} />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm">{config.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {config.tournamentSolveCount === 5 ? "Ao5" : "Mo3"}
                    {" · "}
                    {config.tournamentSolveCount} solves
                  </p>
                </div>
                <StatusBadge status={status} />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: TourneyStatus }) {
  if (status === "completed") {
    return (
      <span className="text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-full">
        Done
      </span>
    );
  }
  if (status === "in-progress") {
    return (
      <span className="text-[10px] font-bold uppercase tracking-wider text-yellow-500 bg-yellow-500/10 px-2 py-0.5 rounded-full">
        In progress
      </span>
    );
  }
  return null;
}
