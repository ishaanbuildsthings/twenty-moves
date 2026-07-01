"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { Users, ArrowLeft } from "lucide-react";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CubeLoader } from "@/lib/components/cube-loader";
import { ClubLeaderboard } from "@/lib/components/club-leaderboard";
import { ClubOwnerMenu } from "@/lib/components/club-owner-menu";
import { UserAvatar } from "@/lib/components/user-avatar";
import { countryCodeToFlag } from "@/lib/countries";
import { useSettings } from "@/lib/context/settings";

export default function ClubDetailPage() {
  const params = useParams();
  const clubId = params.clubId as string;
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { accent } = useSettings();

  const clubQuery = useQuery(trpc.club.getById.queryOptions({ clubId }));

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: trpc.club.getById.queryKey({ clubId }) });
    queryClient.removeQueries({ queryKey: [["club", "list"]] });
  };

  const joinClub = useMutation(
    trpc.club.join.mutationOptions({
      onSuccess: () => {
        invalidate();
        toast.success("Joined club!");
      },
    })
  );
  const leaveClub = useMutation(
    trpc.club.leave.mutationOptions({
      onSuccess: () => {
        invalidate();
        toast.success("Left club");
      },
      onError: (err) => toast.error(err.message),
    })
  );

  if (clubQuery.isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <CubeLoader message="Loading club..." />
      </div>
    );
  }

  if (clubQuery.isError || !clubQuery.data) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-red-500">Club not found</p>
      </div>
    );
  }

  const club = clubQuery.data;
  const pending = joinClub.isPending || leaveClub.isPending;

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      {/* Header */}
      <div className="pt-8 pb-4 px-8 max-w-3xl mx-auto w-full">
        <Link
          href="/clubs"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4" /> All clubs
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-5 min-w-0">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-muted">
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-extrabold truncate">{club.name}</h1>
              <p className="text-sm text-muted-foreground">
                {club.memberCount} member{club.memberCount !== 1 ? "s" : ""}
              </p>
              {club.description && (
                <p className="text-sm text-foreground mt-2">{club.description}</p>
              )}
            </div>
          </div>

          {club.isOwner ? (
            <div className="flex shrink-0 self-start items-center gap-2">
              <span className="whitespace-nowrap px-4 py-2 text-sm font-bold rounded border border-border text-muted-foreground">
                Owner
              </span>
              <ClubOwnerMenu clubId={clubId} description={club.description} />
            </div>
          ) : club.isMember ? (
            <button
              onClick={() => leaveClub.mutate({ clubId })}
              disabled={pending}
              className="shrink-0 self-start whitespace-nowrap px-4 py-2 text-sm font-bold rounded border border-border hover:bg-muted transition-colors disabled:opacity-50"
            >
              {leaveClub.isPending ? "Leaving..." : "Leave"}
            </button>
          ) : (
            <button
              onClick={() => joinClub.mutate({ clubId })}
              disabled={pending}
              className={`shrink-0 self-start whitespace-nowrap px-4 py-2 text-sm font-bold rounded ${accent.bg} text-white ${accent.hover} transition-colors ${accent.shadow} disabled:opacity-50`}
            >
              {joinClub.isPending ? "Joining..." : "Join"}
            </button>
          )}
        </div>
      </div>

      {/* Leaderboard */}
      <div className="border-t border-border px-8 py-6 max-w-3xl mx-auto w-full">
        <ClubLeaderboard clubId={clubId} />
      </div>

      {/* Members */}
      <div className="border-t border-border px-8 py-6 max-w-3xl mx-auto w-full">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground mb-3">
          Members
        </h2>
        <div className="flex flex-col gap-1">
          {club.members.map((m) => (
            <Link
              key={m.user.id}
              href={`/profile/${m.user.username}`}
              className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted/50 transition-colors"
            >
              <UserAvatar user={m.user} size="sm" rounded="xl" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold truncate">
                  {m.user.firstName} {m.user.lastName}
                  {m.user.country && (
                    <span className="ml-1.5">{countryCodeToFlag(m.user.country)}</span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  @{m.user.username}
                </p>
              </div>
              {m.role === "owner" && (
                <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Owner
                </span>
              )}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
