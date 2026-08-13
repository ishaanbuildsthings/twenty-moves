"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MoreVertical, Pencil, Trash2, ImageIcon } from "lucide-react";
import { useTRPC } from "@/lib/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  uploadClubImage,
  validateClubImageFile,
  ACCEPTED_IMAGE_TYPES,
} from "@/lib/supabase/upload-club-image";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useSettings } from "@/lib/context/settings";

interface ClubOwnerMenuProps {
  clubId: string;
  description: string;
}

export function ClubOwnerMenu({ clubId, description }: ClubOwnerMenuProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();
  const { accent } = useSettings();

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [draft, setDraft] = useState(description);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: trpc.club.getById.queryKey({ clubId }) });
    queryClient.removeQueries({ queryKey: [["club", "list"]] });
  };

  const updateImage = useMutation(trpc.club.updateImage.mutationOptions());

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const err = validateClubImageFile(file);
    if (err) {
      toast.error(err);
      return;
    }
    setUploadingPhoto(true);
    try {
      const url = await uploadClubImage(clubId, file);
      await updateImage.mutateAsync({ clubId, imageUrl: url });
      invalidate();
      toast.success("Photo updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const updateClub = useMutation(
    trpc.club.updateDescription.mutationOptions({
      onSuccess: () => {
        invalidate();
        setEditOpen(false);
        toast.success("Club updated");
      },
      onError: (err) => toast.error(err.message),
    })
  );

  const deleteClub = useMutation(
    trpc.club.delete.mutationOptions({
      onSuccess: () => {
        queryClient.removeQueries({ queryKey: [["club", "list"]] });
        toast.success("Club deleted");
        router.push("/clubs");
      },
      onError: (err) => toast.error(err.message),
    })
  );

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className="shrink-0 self-start inline-flex h-9 w-9 items-center justify-center rounded border border-border hover:bg-muted transition-colors">
          <MoreVertical className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingPhoto}
          >
            <ImageIcon className="h-4 w-4" />
            <span>{uploadingPhoto ? "Uploading…" : "Change photo"}</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              setDraft(description);
              setEditOpen(true);
            }}
          >
            <Pencil className="h-4 w-4" />
            <span>Edit description</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setDeleteOpen(true)}
            className="text-red-500 focus:text-red-500"
          >
            <Trash2 className="h-4 w-4" />
            <span>Delete club</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES}
        onChange={handlePhotoChange}
        className="hidden"
      />

      {/* Edit description */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit club</DialogTitle>
            <DialogDescription>Update your club&apos;s description.</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              updateClub.mutate({ clubId, description: draft.trim() });
            }}
            className="space-y-4"
          >
            <div>
              <label htmlFor="edit-club-desc" className="block text-sm font-medium mb-1">
                Description
              </label>
              <textarea
                id="edit-club-desc"
                rows={3}
                maxLength={300}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="What's this club about?"
                className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-white"
              />
              <p className="text-xs text-right mt-1 text-muted-foreground">
                {draft.length}/300
              </p>
            </div>
            {updateClub.error && (
              <p className="text-sm text-red-500">{updateClub.error.message}</p>
            )}
            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={updateClub.isPending}
                className={`px-4 py-2 text-sm font-bold rounded ${accent.bg} text-white ${accent.hover} transition-colors ${accent.shadow} disabled:opacity-50`}
              >
                {updateClub.isPending ? "Saving..." : "Save"}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete club?</DialogTitle>
            <DialogDescription>
              This permanently deletes the club and removes all members. This can&apos;t
              be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={() => setDeleteOpen(false)}
              className="px-4 py-2 text-sm font-bold rounded border border-border hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => deleteClub.mutate({ clubId })}
              disabled={deleteClub.isPending}
              className="px-4 py-2 text-sm font-bold rounded bg-red-600 text-white hover:bg-red-500 transition-colors disabled:opacity-50"
            >
              {deleteClub.isPending ? "Deleting..." : "Delete"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
