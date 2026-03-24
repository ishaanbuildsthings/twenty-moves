"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import type { User } from "@supabase/supabase-js";

export function AuthButton() {
  const router = useRouter();
  const [supabaseUser, setSupabaseUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createBrowserSupabaseClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setSupabaseUser(user);
      setLoading(false);
    });
  }, [supabase]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.refresh();
  };

  if (loading) return null;

  if (!supabaseUser) {
    return (
      <a href="/login" className="text-sm text-zinc-500 hover:text-zinc-900">
        Sign in
      </a>
    );
  }

  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-zinc-500">{supabaseUser.email}</span>
      <button
        onClick={handleSignOut}
        className="text-zinc-500 hover:text-zinc-900"
      >
        Sign out
      </button>
    </div>
  );
}
