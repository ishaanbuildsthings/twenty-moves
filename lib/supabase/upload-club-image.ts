// Club photo upload. Reuses the shared `avatars` bucket and the image
// validators from upload-avatar. The file is stored under the uploader's uid
// folder (`${uid}/club-${clubId}`) so it satisfies the same per-user storage
// policy that user avatars rely on. Only club owners call this (enforced by
// the club.updateImage mutation server-side).

import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

export { validateAvatarFile as validateClubImageFile, ACCEPTED_IMAGE_TYPES } from "@/lib/supabase/upload-avatar";

export async function uploadClubImage(clubId: string, file: File): Promise<string> {
  const supabase = createBrowserSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const path = `${user.id}/club-${clubId}`;

  const { error } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true });

  if (error) throw new Error(error.message);

  // Append timestamp to bust the CDN/browser cache after re-upload.
  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return `${data.publicUrl}?t=${Date.now()}`;
}
