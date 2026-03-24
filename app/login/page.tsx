"use client";

import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

export default function LoginPage() {
  const supabase = createBrowserSupabaseClient();

  const handleGoogleSignIn = () => {
    supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  return (
    <div className="flex flex-col flex-1 items-center justify-center p-8 font-sans">
      <div className="w-full max-w-sm space-y-6">
        <h1 className="text-2xl font-bold text-center">Sign in to Cubing Strava</h1>
        <button
          onClick={handleGoogleSignIn}
          className="w-full rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
        >
          Sign in with Google
        </button>
      </div>
    </div>
  );
}
