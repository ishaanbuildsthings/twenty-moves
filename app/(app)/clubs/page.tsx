"use client";

import { useState } from "react";
import Link from "next/link";
import { Users } from "lucide-react";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { CubeLoader } from "@/lib/components/cube-loader";
import { CreateClubDialog } from "@/lib/components/create-club-dialog";
import { useSettings } from "@/lib/context/settings";

export default function ClubsPage() {
  const trpc = useTRPC();
  const { accent } = useSettings();
  const [createOpen, setCreateOpen] = useState(false);

  const clubsQuery = useQuery(trpc.club.list.queryOptions());

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      {/* Header */}
      <div className="pt-8 pb-4 px-8 max-w-3xl mx-auto w-full">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold">Clubs</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Find your crew, compete as a team.
            </p>
          </div>
          <button
            onClick={() => setCreateOpen(true)}
            className={`shrink-0 whitespace-nowrap px-4 py-2 text-sm font-bold rounded ${accent.bg} text-white ${accent.hover} transition-colors ${accent.shadow}`}
          >
            New Club
          </button>
        </div>
      </div>

      {/* Club list */}
      <div className="px-8 pb-8 max-w-3xl mx-auto w-full">
        {clubsQuery.isLoading ? (
          <div className="flex justify-center py-12">
            <CubeLoader message="Loading clubs..." />
          </div>
        ) : clubsQuery.data && clubsQuery.data.length > 0 ? (
          <div className="flex flex-col gap-3">
            {clubsQuery.data.map((club) => (
              <Link
                key={club.id}
                href={`/clubs/${club.id}`}
                className="flex items-center gap-4 rounded-lg border border-border bg-card p-4 hover:bg-muted/50 transition-colors"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <Users className="h-6 w-6 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="font-bold truncate">{club.name}</h2>
                    {club.isMember && (
                      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Joined
                      </span>
                    )}
                  </div>
                  {club.description && (
                    <p className="text-sm text-muted-foreground truncate">
                      {club.description}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {club.memberCount} member{club.memberCount !== 1 ? "s" : ""}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Users className="w-12 h-12 mx-auto mb-3 text-muted-foreground/40" />
            <p className="text-muted-foreground font-semibold">No clubs yet</p>
            <p className="text-sm text-muted-foreground/60 mt-1">
              Be the first to start one.
            </p>
          </div>
        )}
      </div>

      <CreateClubDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
