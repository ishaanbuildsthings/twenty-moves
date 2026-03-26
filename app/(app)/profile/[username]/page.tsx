"use client";

import { useParams } from "next/navigation";
import { useViewer } from "@/lib/hooks/useViewer";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import Link from "next/link";

export default function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  const { viewer } = useViewer();
  const trpc = useTRPC();

  const profileQuery = useQuery(
    trpc.user.getByUsername.queryOptions({ username })
  );

  if (profileQuery.status === "pending") {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (profileQuery.status === "error") {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-red-500">User not found</p>
      </div>
    );
  }

  const user = profileQuery.data;
  const isOwnProfile = viewer.id === user.id;

  return (
    <div className="flex flex-1 flex-col p-8 max-w-lg mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center text-2xl font-bold">
            {user.firstName[0].toUpperCase()}
          </div>
          <div>
            <h1 className="text-xl font-bold">
              {user.firstName} {user.lastName}
            </h1>
            <p className="text-muted-foreground">@{user.username}</p>
          </div>
        </div>

        {isOwnProfile && (
          <Link
            href="/settings"
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-md bg-muted hover:bg-muted/80 transition-colors"
          >
            Edit profile
          </Link>
        )}
      </div>

      {/* Profile details */}
      <div className="space-y-4">
        {user.wcaId && (
          <div className="flex items-center justify-between py-3 border-b border-border">
            <div>
              <p className="text-sm font-semibold">WCA ID</p>
              <p className="text-xs text-muted-foreground">World Cube Association profile</p>
            </div>
            <a
              href={`https://www.worldcubeassociation.org/persons/${user.wcaId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-sm text-primary hover:underline"
            >
              {user.wcaId}
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
