"use client";

import Link from "next/link";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { UserAvatar } from "@/lib/components/user-avatar";
import { countryCodeToFlag } from "@/lib/countries";
import { useSettings } from "@/lib/context/settings";

// Owner-only panel listing pending join requests with approve/deny controls.
export function ClubJoinRequests({ clubId }: { clubId: string }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { accent } = useSettings();

  const requestsQuery = useQuery(trpc.club.getJoinRequests.queryOptions({ clubId }));

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: trpc.club.getJoinRequests.queryKey({ clubId }) });
    queryClient.invalidateQueries({ queryKey: trpc.club.getById.queryKey({ clubId }) });
    queryClient.removeQueries({ queryKey: [["club", "list"]] });
  };

  const approve = useMutation(
    trpc.club.approveRequest.mutationOptions({
      onSuccess: () => {
        invalidate();
        toast.success("Request approved");
      },
      onError: (err) => toast.error(err.message),
    })
  );
  const deny = useMutation(
    trpc.club.denyRequest.mutationOptions({
      onSuccess: () => {
        invalidate();
        toast.success("Request denied");
      },
      onError: (err) => toast.error(err.message),
    })
  );

  const requests = requestsQuery.data ?? [];
  if (requests.length === 0) return null;

  const pending = approve.isPending || deny.isPending;

  return (
    <div>
      <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground mb-3">
        Join requests ({requests.length})
      </h2>
      <div className="flex flex-col gap-1">
        {requests.map((req) => (
          <div
            key={req.user.id}
            className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted/50 transition-colors"
          >
            <Link
              href={`/profile/${req.user.username}`}
              className="flex items-center gap-3 min-w-0 flex-1"
            >
              <UserAvatar user={req.user} size="sm" rounded="xl" />
              <div className="min-w-0">
                <p className="font-semibold truncate">
                  {req.user.firstName} {req.user.lastName}
                  {req.user.country && (
                    <span className="ml-1.5">{countryCodeToFlag(req.user.country)}</span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  @{req.user.username}
                </p>
              </div>
            </Link>
            <div className="flex shrink-0 gap-2">
              <button
                onClick={() => approve.mutate({ clubId, userId: req.user.id })}
                disabled={pending}
                className={`px-3 py-1.5 text-sm font-bold rounded ${accent.bg} text-white ${accent.hover} transition-colors disabled:opacity-50`}
              >
                Approve
              </button>
              <button
                onClick={() => deny.mutate({ clubId, userId: req.user.id })}
                disabled={pending}
                className="px-3 py-1.5 text-sm font-bold rounded border border-border hover:bg-muted transition-colors disabled:opacity-50"
              >
                Deny
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
