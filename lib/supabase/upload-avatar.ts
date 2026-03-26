// Shared avatar upload logic used by both create-profile and settings.
// Validates the file, uploads to Supabase avatars bucket, and returns
// the public URL with a cache-busting timestamp.

import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
// For use in <input accept="..."> attributes.
export const ACCEPTED_IMAGE_TYPES = ALLOWED_IMAGE_TYPES.join(",");
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export function validateAvatarFile(file: File): string | null {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return "Please upload a JPEG, PNG, WebP, or GIF.";
  }
  if (file.size > MAX_FILE_SIZE) {
    return "Photo must be under 5MB.";
  }
  return null;
}

export async function uploadAvatar(file: File): Promise<string> {
  const supabase = createBrowserSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const path = `${user.id}/profile`;

  const { error } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true });

  if (error) throw new Error(error.message);

  // Append timestamp to bust cache on the CDN/browser.
  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return `${data.publicUrl}?t=${Date.now()}`;
}
