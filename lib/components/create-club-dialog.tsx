"use client";

import { useState } from "react";
import { Users } from "lucide-react";
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
import {
  uploadClubImage,
  validateClubImageFile,
  ACCEPTED_IMAGE_TYPES,
} from "@/lib/supabase/upload-club-image";

interface CreateClubDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateClubDialog({ open, onOpenChange }: CreateClubDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();
  const { accent } = useSettings();

  const createClub = useMutation(trpc.club.create.mutationOptions());
  const updateImage = useMutation(trpc.club.updateImage.mutationOptions());

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const err = validateClubImageFile(file);
    if (err) {
      setImageError(err);
      return;
    }
    setImageError(null);
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const reset = () => {
    setName("");
    setDescription("");
    setIsPrivate(false);
    setImageFile(null);
    setImagePreview(null);
    setImageError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const club = await createClub.mutateAsync({
        name: name.trim(),
        description: description.trim(),
        isPrivate,
      });

      // Image needs the club id for its storage path, so upload after create.
      if (imageFile) {
        try {
          const url = await uploadClubImage(club.id, imageFile);
          await updateImage.mutateAsync({ clubId: club.id, imageUrl: url });
        } catch {
          toast.error("Club created, but the photo failed to upload.");
        }
      }

      reset();
      onOpenChange(false);
      queryClient.removeQueries({ queryKey: [["club", "list"]] });
      toast.success("Club created!", {
        action: {
          label: "View",
          onClick: () => router.push(`/clubs/${club.id}`),
        },
      });
      router.push(`/clubs/${club.id}`);
    } finally {
      setSubmitting(false);
    }
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
            <label className="block text-sm font-medium mb-1">
              Photo <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <div className="flex items-center gap-3">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted">
                {imagePreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imagePreview} alt="Club photo preview" className="h-full w-full object-cover" />
                ) : (
                  <Users className="h-7 w-7 text-muted-foreground" />
                )}
              </div>
              <label className="cursor-pointer rounded-md border border-border px-3 py-1.5 text-sm font-semibold hover:bg-muted transition-colors">
                Choose image
                <input
                  type="file"
                  accept={ACCEPTED_IMAGE_TYPES}
                  onChange={handleImageChange}
                  className="hidden"
                />
              </label>
            </div>
            {imageError && <p className="text-sm text-red-500 mt-1">{imageError}</p>}
          </div>
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
          <div>
            <label className="block text-sm font-medium mb-1">Visibility</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: false, label: "Public", hint: "Anyone can join" },
                { value: true, label: "Private", hint: "Owner approves requests. Anyone can see the club." },
              ].map((opt) => (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => setIsPrivate(opt.value)}
                  className={`rounded-md border px-3 py-2 text-left transition-colors ${
                    isPrivate === opt.value
                      ? `${accent.border} bg-muted`
                      : "border-border hover:bg-muted/50"
                  }`}
                >
                  <span className="block text-sm font-bold">{opt.label}</span>
                  <span className="block text-xs text-muted-foreground">{opt.hint}</span>
                </button>
              ))}
            </div>
          </div>
          {createClub.error && (
            <p className="text-sm text-red-500">{createClub.error.message}</p>
          )}
          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={submitting || name.trim().length < 3}
              className={`px-4 py-2 text-sm font-bold rounded ${accent.bg} text-white ${accent.hover} transition-colors ${accent.shadow} disabled:opacity-50`}
            >
              {submitting ? "Creating..." : "Create club"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
