"use client";

import Link from "next/link";
import { Users } from "lucide-react";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { CubeLoader } from "@/lib/components/cube-loader";

interface UserClubsTabProps {
  userId: string;
  firstName: string;
  isOwnProfile: boolean;
}

export function UserClubsTab({ userId, firstName, isOwnProfile }: UserClubsTabProps) {
  const trpc = useTRPC();
  const clubsQuery = useQuery(trpc.club.listForUser.queryOptions({ userId }));

  if (clubsQuery.isLoading) {
    return (
      <div className="flex justify-center py-12">
        <CubeLoader message="Loading clubs..." />
      </div>
    );
  }

  const clubs = clubsQuery.data ?? [];

  if (clubs.length === 0) {
    return (
      <div className="text-center py-12">
        <Users className="w-12 h-12 mx-auto mb-3 text-muted-foreground/40" />
        <p className="text-muted-foreground font-semibold">No clubs yet</p>
        <p className="text-sm text-muted-foreground/60 mt-1">
          {isOwnProfile ? (
            <>
              <Link href="/clubs" className="hover:underline">
                Find a club
              </Link>{" "}
              to join or create your own.
            </>
          ) : (
            `${firstName} hasn't joined any clubs yet`
          )}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {clubs.map((club) => (
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
              {club.role === "owner" && (
                <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Owner
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {club.memberCount} member{club.memberCount !== 1 ? "s" : ""}
            </p>
          </div>
        </Link>
      ))}
    </div>
  );
}
