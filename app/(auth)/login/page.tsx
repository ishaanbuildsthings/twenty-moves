"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

type Mode = "signin" | "signup" | "forgot";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createBrowserSupabaseClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<Mode>("signin");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    if (mode === "forgot") {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      });
      setLoading(false);
      if (error) {
        setError(error.message);
        return;
      }
      setMessage("Check your email for a password reset link.");
      return;
    }

    const { error } = mode === "signup"
      ? await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/create-profile` } })
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

    router.push("/practice");
    router.refresh();
  };

  const title = {
    signin: "Sign in to twenty moves",
    signup: "Create an account",
    forgot: "Reset your password",
  }[mode];

  const subtitle = {
    signin: "Welcome back, cuber",
    signup: "Join the community",
    forgot: "We'll send you a reset link",
  }[mode];

  return (
    <div className="flex flex-col flex-1 items-center justify-center p-8 font-sans">
      {/* Logo */}
      <div className="mb-8 flex flex-col items-center gap-3">
        <img src="/twenty-moves-favicon.svg" alt="twenty moves" className="w-14 h-14 rounded-xl" />
      </div>

      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-extrabold">{title}</h1>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-muted-foreground mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="block w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-white/40"
              placeholder="you@example.com"
            />
          </div>
          {mode !== "forgot" && (
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-muted-foreground mb-1">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-white/40"
                placeholder="••••••••"
              />
            </div>
          )}
          {error && <p className="text-sm text-red-400">{error}</p>}
          {message && <p className="text-sm text-emerald-400">{message}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-amber-600 hover:bg-amber-500 px-4 py-2.5 text-sm font-bold text-white transition-colors disabled:opacity-50 shadow-[0_3px_0_0_theme(colors.amber.800)] active:shadow-none active:translate-y-[3px]"
          >
            {loading
              ? "..."
              : mode === "signup"
                ? "Sign up"
                : mode === "forgot"
                  ? "Send reset link"
                  : "Sign in"}
          </button>
        </form>

        <div className="space-y-2">
          {mode === "signin" && (
            <>
              <button
                onClick={() => { setMode("forgot"); setError(null); setMessage(null); }}
                className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Forgot your password?
              </button>
              <button
                onClick={() => { setMode("signup"); setError(null); setMessage(null); }}
                className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Need an account? <span className="font-semibold text-amber-400">Sign up</span>
              </button>
            </>
          )}
          {mode === "signup" && (
            <button
              onClick={() => { setMode("signin"); setError(null); setMessage(null); }}
              className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Already have an account? <span className="font-semibold text-amber-400">Sign in</span>
            </button>
          )}
          {mode === "forgot" && (
            <button
              onClick={() => { setMode("signin"); setError(null); setMessage(null); }}
              className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Back to sign in
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
