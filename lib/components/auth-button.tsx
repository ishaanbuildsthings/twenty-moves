"use client";

import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { useViewer } from "@/lib/hooks/useViewer";

export function AuthButton() {
  const router = useRouter();
  const { viewer } = useViewer();
  const supabase = createBrowserSupabaseClient();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.refresh();
  };

  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-zinc-500">@{viewer.username}</span>
      <button
        onClick={handleSignOut}
        className="text-zinc-500 hover:text-zinc-900"
      >
        Sign out
      </button>
    </div>
  );
}
