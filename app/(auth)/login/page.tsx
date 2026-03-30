"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

type Mode = "signin" | "signup" | "forgot" | "reset";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createBrowserSupabaseClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [mode, setMode] = useState<Mode>("signin");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Detect if we landed here from a password reset link (Supabase adds hash params)
  // The Supabase client auto-exchanges the token, so we just need to show the reset form
  useState(() => {
    if (typeof window !== "undefined" && window.location.hash.includes("type=recovery")) {
      setMode("reset");
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    if (mode === "forgot") {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/login`,
      });
      setLoading(false);
      if (error) {
        setError(error.message);
        return;
      }
      setMessage("Check your email for a password reset link.");
      return;
    }

    if (mode === "reset") {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      setLoading(false);
      if (error) {
        setError(error.message);
        return;
      }
      router.push("/");
      router.refresh();
      return;
    }

    const { error } = mode === "signup"
      ? await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/login` } })
      : await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    if (mode === "signup") {
      setMessage("Check your email for a confirmation link.");
      return;
    }

    router.push("/");
    router.refresh();
  };

  const title = {
    signin: "Sign in to twenty moves",
    signup: "Create an account",
    forgot: "Reset your password",
    reset: "Set a new password",
  }[mode];

  return (
    <div className="flex flex-col flex-1 items-center justify-center p-8 font-sans">
      <div className="w-full max-w-sm space-y-6">
        <h1 className="text-2xl font-bold text-center">{title}</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "reset" ? (
            <div>
              <label htmlFor="newPassword" className="block text-sm font-medium text-zinc-700">
                New password
              </label>
              <input
                id="newPassword"
                type="password"
                required
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              />
            </div>
          ) : (
            <>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-zinc-700">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                />
              </div>
              {mode !== "forgot" && (
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-zinc-700">
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                  />
                </div>
              )}
            </>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          {message && <p className="text-sm text-green-600">{message}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
          >
            {loading
              ? "..."
              : mode === "signup"
                ? "Sign up"
                : mode === "forgot"
                  ? "Send reset link"
                  : mode === "reset"
                    ? "Update password"
                    : "Sign in"}
          </button>
        </form>
        <div className="space-y-2">
          {mode === "signin" && (
            <>
              <button
                onClick={() => { setMode("forgot"); setError(null); setMessage(null); }}
                className="w-full text-center text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                Forgot your password?
              </button>
              <button
                onClick={() => { setMode("signup"); setError(null); setMessage(null); }}
                className="w-full text-center text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                Need an account? Sign up
              </button>
            </>
          )}
          {mode === "signup" && (
            <button
              onClick={() => { setMode("signin"); setError(null); setMessage(null); }}
              className="w-full text-center text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              Already have an account? Sign in
            </button>
          )}
          {mode === "forgot" && (
            <button
              onClick={() => { setMode("signin"); setError(null); setMessage(null); }}
              className="w-full text-center text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              Back to sign in
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
