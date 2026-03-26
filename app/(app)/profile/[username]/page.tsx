"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useViewer } from "@/lib/hooks/useViewer";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil, X, Check, ExternalLink } from "lucide-react";


export default function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  const { viewer, setViewer } = useViewer();
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const profileQuery = useQuery(
    trpc.user.getByUsername.queryOptions({ username })
  );

  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    firstName: "",
    lastName: "",
    username: "",
  });

  const updateMutation = useMutation({
    ...trpc.user.updateProfile.mutationOptions(),
    onSuccess: (updatedUser) => {
      // Update cache directly with mutation response — no refetch needed.
      queryClient.setQueryData(
        trpc.user.getByUsername.queryKey({ username }),
        updatedUser,
      );
      // Update the viewer context so the sidebar and other components
      // reflect the new name/username immediately.
      setViewer(updatedUser);
      // If username changed, navigate to the new URL.
      if (updatedUser.username !== username) {
        router.replace(`/profile/${updatedUser.username}`);
      }
      setEditing(false);
    },
  });

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

  const startEditing = () => {
    setEditForm({
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,
    });
    setEditing(true);
  };

  const handleSave = () => {
    updateMutation.mutate({
      firstName: editForm.firstName,
      lastName: editForm.lastName,
      username: editForm.username,
    });
  };

  return (
    <div className="flex flex-1 flex-col p-8 max-w-lg mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center text-2xl font-bold">
            {user.firstName[0].toUpperCase()}
          </div>
          <div>
            {editing ? (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    className="bg-muted rounded-md px-2 py-1 text-sm w-24"
                    value={editForm.firstName}
                    onChange={(e) => setEditForm((f) => ({ ...f, firstName: e.target.value }))}
                    placeholder="First name"
                  />
                  <input
                    className="bg-muted rounded-md px-2 py-1 text-sm w-24"
                    value={editForm.lastName}
                    onChange={(e) => setEditForm((f) => ({ ...f, lastName: e.target.value }))}
                    placeholder="Last name"
                  />
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground text-sm">@</span>
                  <input
                    className="bg-muted rounded-md px-2 py-1 text-sm w-32"
                    value={editForm.username}
                    onChange={(e) => setEditForm((f) => ({ ...f, username: e.target.value }))}
                    placeholder="username"
                  />
                </div>
              </div>
            ) : (
              <>
                <h1 className="text-xl font-bold">
                  {user.firstName} {user.lastName}
                </h1>
                <p className="text-muted-foreground">@{user.username}</p>
              </>
            )}
          </div>
        </div>

        {isOwnProfile && !editing && (
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-md bg-muted hover:bg-muted/80 transition-colors"
            onClick={startEditing}
          >
            <Pencil className="w-3.5 h-3.5" />
            Edit
          </button>
        )}

        {editing && (
          <div className="flex items-center gap-2">
            <button
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              onClick={handleSave}
              disabled={updateMutation.isPending}
            >
              <Check className="w-3.5 h-3.5" />
              {updateMutation.isPending ? "Saving..." : "Save"}
            </button>
            <button
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md hover:bg-muted transition-colors text-muted-foreground"
              onClick={() => setEditing(false)}
            >
              <X className="w-3.5 h-3.5" />
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Profile details */}
      <div className="space-y-4">
        {/* WCA ID */}
        <div className="flex items-center justify-between py-3 border-b border-border">
          <div>
            <p className="text-sm font-semibold">WCA ID</p>
            <p className="text-xs text-muted-foreground">World Cube Association profile</p>
          </div>
          {user.wcaId ? (
            <a
              href={`https://www.worldcubeassociation.org/persons/${user.wcaId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-sm text-primary hover:underline"
            >
              {user.wcaId}
              <ExternalLink className="w-3 h-3" />
            </a>
          ) : isOwnProfile ? (
            <span className="text-sm text-muted-foreground">Not set</span>
          ) : null}
        </div>

        {/* Member since — only visible on own profile */}
        {isOwnProfile && "createdAt" in user && (
          <div className="flex items-center justify-between py-3 border-b border-border">
            <div>
              <p className="text-sm font-semibold">Member since</p>
            </div>
            <span className="text-sm text-muted-foreground">
              {new Date(user.createdAt as string | Date).toLocaleDateString("en-US", {
                month: "long",
                year: "numeric",
              })}
            </span>
          </div>
        )}

        {updateMutation.error && (
          <p className="text-sm text-red-500">
            {updateMutation.error.message}
          </p>
        )}
      </div>
    </div>
  );
}
