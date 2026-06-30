"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useTRPC } from "@/lib/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useSettings } from "@/lib/context/settings";

interface CreateClubDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateClubDialog({ open, onOpenChange }: CreateClubDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();
  const { accent } = useSettings();

  const createClub = useMutation(trpc.club.create.mutationOptions());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const club = await createClub.mutateAsync({
      name: name.trim(),
      description: description.trim(),
    });
    setName("");
    setDescription("");
    onOpenChange(false);
    queryClient.removeQueries({ queryKey: [["club", "list"]] });
    toast.success("Club created!", {
      action: {
        label: "View",
        onClick: () => router.push(`/clubs/${club.id}`),
      },
    });
    router.push(`/clubs/${club.id}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create a club 👥</DialogTitle>
          <DialogDescription>
            Start a club for your cubing crew. You&apos;ll be its first member.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="club-name" className="block text-sm font-medium mb-1">
              Name
            </label>
            <input
              id="club-name"
              type="text"
              minLength={3}
              maxLength={50}
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Bay Area Speedcubers"
              className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-white"
            />
          </div>
          <div>
            <label htmlFor="club-description" className="block text-sm font-medium mb-1">
              Description
            </label>
            <textarea
              id="club-description"
              rows={3}
              maxLength={300}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's this club about?"
              className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-white"
            />
            <p className="text-xs text-right mt-1 text-muted-foreground">
              {description.length}/300
            </p>
          </div>
          {createClub.error && (
            <p className="text-sm text-red-500">{createClub.error.message}</p>
          )}
          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={createClub.isPending || name.trim().length < 3}
              className={`px-4 py-2 text-sm font-bold rounded ${accent.bg} text-white ${accent.hover} transition-colors ${accent.shadow} disabled:opacity-50`}
            >
              {createClub.isPending ? "Creating..." : "Create club"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
