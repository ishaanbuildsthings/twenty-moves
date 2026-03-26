"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useViewer } from "@/lib/hooks/useViewer";
import { useTRPC } from "@/lib/trpc/client";
import { useMutation } from "@tanstack/react-query";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

export default function SettingsPage() {
  const { viewer, setViewer } = useViewer();
  const router = useRouter();
  const trpc = useTRPC();
  const supabase = createBrowserSupabaseClient();

  const [editForm, setEditForm] = useState({
    firstName: viewer.firstName,
    lastName: viewer.lastName,
    username: viewer.username,
  });

  const updateMutation = useMutation({
    ...trpc.user.updateProfile.mutationOptions(),
    onSuccess: (updatedUser) => {
      setViewer(updatedUser);
      // Reset form with new values.
      setEditForm({
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        username: updatedUser.username,
      });
    },
  });

  const hasChanges =
    editForm.firstName !== viewer.firstName ||
    editForm.lastName !== viewer.lastName ||
    editForm.username !== viewer.username;

  const handleSave = () => {
    updateMutation.mutate({
      firstName: editForm.firstName,
      lastName: editForm.lastName,
      username: editForm.username,
    });
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.refresh();
  };

  return (
    <div className="flex flex-1 flex-col p-8 max-w-lg mx-auto w-full">
      <h1 className="text-2xl font-bold mb-8">Settings</h1>

      {/* Profile section */}
      <section className="space-y-4 mb-8">
        <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
          Profile
        </h2>

        <div className="space-y-3">
          <div>
            <label className="text-sm font-semibold mb-1 block">First name</label>
            <input
              className="w-full bg-muted rounded-md px-3 py-2 text-sm"
              value={editForm.firstName}
              onChange={(e) => setEditForm((f) => ({ ...f, firstName: e.target.value }))}
            />
          </div>

          <div>
            <label className="text-sm font-semibold mb-1 block">Last name</label>
            <input
              className="w-full bg-muted rounded-md px-3 py-2 text-sm"
              value={editForm.lastName}
              onChange={(e) => setEditForm((f) => ({ ...f, lastName: e.target.value }))}
            />
          </div>

          <div>
            <label className="text-sm font-semibold mb-1 block">Username</label>
            <div className="flex items-center">
              <span className="text-muted-foreground text-sm mr-1">@</span>
              <input
                className="flex-1 bg-muted rounded-md px-3 py-2 text-sm"
                value={editForm.username}
                onChange={(e) => setEditForm((f) => ({ ...f, username: e.target.value }))}
              />
            </div>
          </div>
        </div>

        {updateMutation.error && (
          <p className="text-sm text-red-500">
            {updateMutation.error.message}
          </p>
        )}

        <div className="flex items-center gap-2">
          <button
            className="px-4 py-2 text-sm font-semibold rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            onClick={handleSave}
            disabled={!hasChanges || updateMutation.isPending}
          >
            {updateMutation.isPending ? "Saving..." : "Save changes"}
          </button>
          {hasChanges && (
            <button
              className="px-4 py-2 text-sm rounded-md hover:bg-muted transition-colors text-muted-foreground"
              onClick={() =>
                setEditForm({
                  firstName: viewer.firstName,
                  lastName: viewer.lastName,
                  username: viewer.username,
                })
              }
            >
              Reset
            </button>
          )}
        </div>
      </section>

      {/* Account section */}
      <section className="space-y-4 pt-6 border-t border-border">
        <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
          Account
        </h2>

        <button
          className="px-4 py-2 text-sm font-semibold rounded-md text-red-500 bg-red-500/10 hover:bg-red-500/20 transition-colors"
          onClick={handleSignOut}
        >
          Sign out
        </button>
      </section>
    </div>
  );
}
