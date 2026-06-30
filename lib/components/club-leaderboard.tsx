"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery } from "@tanstack/react-query";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EventIcon } from "@/lib/components/event-icon";
import { UserAvatar } from "@/lib/components/user-avatar";
import { CubeLoader } from "@/lib/components/cube-loader";
import { EVENT_CONFIGS, EVENT_MAP, CubeEvent } from "@/lib/cubing/events";
import { formatTime } from "@/lib/cubing/format";
import { useSettings } from "@/lib/context/settings";

type SortKey = "solves" | "average";

export function ClubLeaderboard({ clubId }: { clubId: string }) {
  const trpc = useTRPC();
  const { accent } = useSettings();
  const [event, setEvent] = useState<CubeEvent>(CubeEvent.THREE);
  const [sortBy, setSortBy] = useState<SortKey>("solves");

  const eventConfig = EVENT_MAP[event];
  const lbQuery = useQuery(trpc.club.getLeaderboard.queryOptions({ clubId, event }));

  const rows = [...(lbQuery.data ?? [])].sort((a, b) => {
    if (sortBy === "solves") return b.numSolves - a.numSolves;
    // average asc; members without an average sort last
    if (a.average === null && b.average === null) return 0;
    if (a.average === null) return 1;
    if (b.average === null) return -1;
    return a.average - b.average;
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
            Leaderboard
          </h2>
          <p className="text-xs text-muted-foreground/60">This week (Mon–Sun PST)</p>
        </div>
        {/* Event selector */}
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-border hover:bg-muted transition-colors">
            <EventIcon event={eventConfig} size={20} />
            <span className="font-bold">{eventConfig.name}</span>
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="max-h-72 overflow-y-auto">
            {EVENT_CONFIGS.map((config) => (
              <DropdownMenuItem
                key={config.id}
                onClick={() => setEvent(config.id)}
                className={event === config.id ? "bg-muted" : ""}
              >
                <EventIcon event={config} size={16} />
                <span>{config.name}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {lbQuery.isLoading ? (
        <div className="flex justify-center py-12">
          <CubeLoader message="Loading leaderboard..." />
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">
          No members yet.
        </p>
      ) : (
        <div className="rounded-lg bg-card border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs font-bold text-muted-foreground uppercase tracking-wider">
                <th className="px-4 py-2 text-left w-10">#</th>
                <th className="px-3 py-2 text-left">Member</th>
                <th className="px-3 py-2 text-right">
                  <button
                    onClick={() => setSortBy("solves")}
                    className={`uppercase tracking-wider hover:text-foreground transition-colors ${sortBy === "solves" ? accent.text : ""}`}
                  >
                    Solves
                  </button>
                </th>
                <th className="px-4 py-2 text-right">
                  <button
                    onClick={() => setSortBy("average")}
                    className={`uppercase tracking-wider hover:text-foreground transition-colors ${sortBy === "average" ? accent.text : ""}`}
                  >
                    Avg
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={row.user.id}
                  className={`border-b border-border last:border-0 ${i % 2 === 1 ? "bg-muted/60" : ""}`}
                >
                  <td className="px-4 py-3 text-center text-muted-foreground font-bold">
                    {i + 1}
                  </td>
                  <td className="px-3 py-3">
                    <Link
                      href={`/profile/${row.user.username}`}
                      className="flex items-center gap-2.5 hover:underline decoration-muted-foreground/40 min-w-0"
                    >
                      <UserAvatar user={row.user} size="sm" rounded="xl" />
                      <span className="font-semibold truncate">
                        {row.user.firstName} {row.user.lastName}
                      </span>
                    </Link>
                  </td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums font-bold">
                    {row.numSolves}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums font-bold">
                    {row.average !== null ? formatTime(row.average) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
