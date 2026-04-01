"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useTRPC } from "@/lib/trpc/client";
import { useMutation } from "@tanstack/react-query";
import { COUNTRIES, countryCodeToFlag } from "@/lib/countries";
import { validateAvatarFile, uploadAvatar, ACCEPTED_IMAGE_TYPES } from "@/lib/supabase/upload-avatar";
import { publicEnv } from "@/lib/env";
import { UserAvatar } from "@/lib/components/user-avatar";

const WCA_AUTHORIZE_URL = "https://www.worldcubeassociation.org/oauth/authorize";
const WCA_STATE_COOKIE = "wca_oauth_state";

function startWcaOAuth() {
  const state = crypto.randomUUID();
  document.cookie = `${WCA_STATE_COOKIE}=${state}; path=/; max-age=600; SameSite=Lax`;
  // Tell the WCA callback to redirect back to onboarding instead of the profile page.
  document.cookie = `wca_redirect=/create-profile?step=2; path=/; max-age=600; SameSite=Lax`;
  const params = new URLSearchParams({
    client_id: publicEnv().NEXT_PUBLIC_WCA_CLIENT_ID,
    redirect_uri: `${window.location.origin}/api/wca/callback`,
    response_type: "code",
    scope: "public",
    state,
  });
  window.location.href = `${WCA_AUTHORIZE_URL}?${params}`;
}

const TOTAL_STEPS = 4;

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2 justify-center mb-8">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`h-1.5 rounded-full transition-all duration-300 ${
            i < current
              ? "w-8 bg-amber-500"
              : i === current
                ? "w-8 bg-amber-400"
                : "w-4 bg-muted"
          }`}
        />
      ))}
    </div>
  );
}

// --- Step 1: Profile basics ---

function StepProfile({
  onNext,
}: {
  onNext: (data: { username: string; firstName: string; lastName: string; country: string; profilePictureUrl?: string }) => void;
}) {
  const trpc = useTRPC();
  const [username, setUsername] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [country, setCountry] = useState("");
  const [profilePictureFile, setProfilePictureFile] = useState<File | null>(null);
  const [profilePicturePreview, setProfilePicturePreview] = useState<string | null>(null);
  const [profilePictureError, setProfilePictureError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const createProfile = useMutation(trpc.auth.createProfile.mutationOptions());

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (file) {
      const validationError = validateAvatarFile(file);
      if (validationError) {
        e.target.value = "";
        setProfilePictureError(validationError);
        return;
      }
    }
    setProfilePictureError(null);
    setProfilePictureFile(file);
    setProfilePicturePreview(file ? URL.createObjectURL(file) : null);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    let profilePictureUrl: string | undefined;
    if (profilePictureFile) {
      profilePictureUrl = await uploadAvatar(profilePictureFile);
    }

    await createProfile.mutateAsync({
      username,
      firstName,
      lastName,
      profilePictureUrl,
      country: country || undefined,
    });

    onNext({ username, firstName, lastName, country, profilePictureUrl });
  };

  return (
    <>
      <div className="text-center space-y-1 mb-6">
        <h1 className="text-2xl font-extrabold">Set up your profile</h1>
        <p className="text-sm text-muted-foreground">Tell us a bit about yourself</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Avatar upload */}
        <div className="flex flex-col items-center gap-2 mb-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-20 h-20 rounded-full border-2 border-dashed border-muted-foreground/30 overflow-hidden flex items-center justify-center text-muted-foreground hover:border-muted-foreground/60 transition-colors"
          >
            {profilePicturePreview ? (
              <img src={profilePicturePreview} alt="Preview" className="w-full h-full object-cover" />
            ) : (
              <svg viewBox="0 0 24 24" className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path d="M12 16v-8m-4 4h8" strokeLinecap="round" />
                <circle cx="12" cy="12" r="10" />
              </svg>
            )}
          </button>
          <span className="text-xs text-muted-foreground">Add a photo</span>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_IMAGE_TYPES}
            className="hidden"
            onChange={handleFileChange}
          />
          {profilePictureError && (
            <p className="text-xs text-red-400">{profilePictureError}</p>
          )}
        </div>

        <div>
          <label htmlFor="username" className="block text-sm font-medium text-muted-foreground mb-1">
            Username
          </label>
          <input
            id="username"
            type="text"
            required
            minLength={3}
            maxLength={30}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="block w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-white/40"
            placeholder="cuber123"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="firstName" className="block text-sm font-medium text-muted-foreground mb-1">
              First name
            </label>
            <input
              id="firstName"
              type="text"
              required
              maxLength={50}
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="block w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-white/40"
            />
          </div>
          <div>
            <label htmlFor="lastName" className="block text-sm font-medium text-muted-foreground mb-1">
              Last name
            </label>
            <input
              id="lastName"
              type="text"
              required
              maxLength={50}
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="block w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-white/40"
            />
          </div>
        </div>

        <div>
          <label htmlFor="country" className="block text-sm font-medium text-muted-foreground mb-1">
            Country <span className="text-muted-foreground/60">(optional)</span>
          </label>
          <select
            id="country"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="block w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-white/40 appearance-none"
          >
            <option value="">Select a country</option>
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name} {countryCodeToFlag(c.code)}
              </option>
            ))}
          </select>
        </div>

        {createProfile.error && (
          <p className="text-sm text-red-400">{createProfile.error.message}</p>
        )}

        <button
          type="submit"
          disabled={createProfile.isPending}
          className="w-full rounded-lg bg-amber-600 hover:bg-amber-500 px-4 py-2.5 text-sm font-bold text-white transition-colors disabled:opacity-50 shadow-[0_3px_0_0_theme(colors.amber.800)] active:shadow-none active:translate-y-[3px]"
        >
          {createProfile.isPending ? "Creating..." : "Continue"}
        </button>
      </form>
    </>
  );
}

// --- Step 2: Link WCA ---

function StepWCA({ onNext }: { onNext: () => void }) {
  return (
    <>
      <div className="text-center space-y-1 mb-6">
        <h1 className="text-2xl font-extrabold">Link your WCA account</h1>
        <p className="text-sm text-muted-foreground">
          Appear on tournament leaderboards and earn medals
        </p>
      </div>

      <div className="flex flex-col items-center gap-6">
        <div className="w-20 h-20 rounded-2xl bg-muted flex items-center justify-center text-3xl font-extrabold tracking-tight text-foreground">
          WCA
        </div>

        <div className="text-center space-y-2 text-sm text-muted-foreground max-w-xs">
          <p>Link your World Cube Association account to:</p>
          <ul className="text-left space-y-1.5 pl-4">
            <li className="flex items-start gap-2">
              <span className="text-amber-400 mt-0.5">•</span>
              Appear on daily tournament leaderboards
            </li>
            <li className="flex items-start gap-2">
              <span className="text-amber-400 mt-0.5">•</span>
              Earn 🥇🥈🥉 medals for top 3 finishes
            </li>
            <li className="flex items-start gap-2">
              <span className="text-amber-400 mt-0.5">•</span>
              Show your WCA ID on your profile
            </li>
          </ul>
        </div>

        <div className="w-full space-y-3">
          <button
            onClick={startWcaOAuth}
            className="w-full rounded-lg bg-amber-600 hover:bg-amber-500 px-4 py-2.5 text-sm font-bold text-white transition-colors shadow-[0_3px_0_0_theme(colors.amber.800)] active:shadow-none active:translate-y-[3px]"
          >
            Link WCA Account
          </button>
          <button
            onClick={onNext}
            className="w-full rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            Skip for now
          </button>
        </div>
      </div>
    </>
  );
}

// --- Step 3: YouTube channel ---

function StepYouTube({ onNext }: { onNext: () => void }) {
  const trpc = useTRPC();
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateProfile = useMutation(trpc.user.updateProfile.mutationOptions());

  const handleSave = async () => {
    if (!url.trim()) {
      onNext();
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updateProfile.mutateAsync({ youtubeChannelUrl: url.trim() });
      onNext();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
      setSaving(false);
    }
  };

  return (
    <>
      <div className="text-center space-y-1 mb-6">
        <h1 className="text-2xl font-extrabold">Add your YouTube channel</h1>
        <p className="text-sm text-muted-foreground">
          Share your cubing content with the community
        </p>
      </div>

      <div className="flex flex-col items-center gap-6">
        <div className="w-20 h-20 rounded-2xl bg-muted flex items-center justify-center text-4xl">
          🎬
        </div>

        <div className="w-full space-y-3">
          <div>
            <label htmlFor="youtube" className="block text-sm font-medium text-muted-foreground mb-1">
              Channel URL
            </label>
            <input
              id="youtube"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="block w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-white/40"
              placeholder="https://youtube.com/@yourchannel"
            />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full rounded-lg bg-amber-600 hover:bg-amber-500 px-4 py-2.5 text-sm font-bold text-white transition-colors disabled:opacity-50 shadow-[0_3px_0_0_theme(colors.amber.800)] active:shadow-none active:translate-y-[3px]"
          >
            {saving ? "Saving..." : url.trim() ? "Save & Continue" : "Continue"}
          </button>
          {url.trim() && (
            <button
              onClick={onNext}
              className="w-full rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              Skip for now
            </button>
          )}
        </div>
      </div>
    </>
  );
}

// --- Step 4: Follow someone ---

function StepFollow({ onNext }: { onNext: () => void }) {
  const trpc = useTRPC();
  const [following, setFollowing] = useState(false);

  const followMutation = useMutation(trpc.user.follow.mutationOptions({
    onSuccess: () => setFollowing(true),
  }));

  // We need the actual user ID — let's fetch it
  const [resolvedUsers, setResolvedUsers] = useState<Array<{
    id: string;
    username: string;
    firstName: string;
    lastName: string;
    profilePictureUrl: string | null;
  }>>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  // Fetch recommended user profiles on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/trpc/user.getByUsername?batch=1&input=${encodeURIComponent(JSON.stringify({ "0": { json: { username: "ishaan" } } }))}`);
        const data = await res.json();
        const user = data[0]?.result?.data?.json;
        if (user) {
          setResolvedUsers([{
            id: user.id,
            username: user.username,
            firstName: user.firstName,
            lastName: user.lastName,
            profilePictureUrl: user.profilePictureUrl,
          }]);
        }
      } catch {
        // Silently fail — skip step if user lookup fails
      } finally {
        setLoadingUsers(false);
      }
    })();
  }, []);

  return (
    <>
      <div className="text-center space-y-1 mb-6">
        <h1 className="text-2xl font-extrabold">Follow cubers</h1>
        <p className="text-sm text-muted-foreground">
          See their solves and posts in your feed
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {loadingUsers ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-muted-foreground/30 border-t-amber-500 rounded-full animate-spin" />
          </div>
        ) : (
          resolvedUsers.map((user) => (
            <div
              key={user.id}
              className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card"
            >
              <UserAvatar user={user} size="sm" rounded="full" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{user.firstName} {user.lastName}</p>
                <p className="text-xs text-muted-foreground">@{user.username}</p>
              </div>
              <button
                onClick={() => followMutation.mutate({ userId: user.id })}
                disabled={following || followMutation.isPending}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  following
                    ? "bg-muted text-muted-foreground"
                    : "bg-amber-600 hover:bg-amber-500 text-white"
                }`}
              >
                {following ? "Following" : followMutation.isPending ? "..." : "Follow"}
              </button>
            </div>
          ))
        )}

        <button
          onClick={onNext}
          className="w-full rounded-lg bg-amber-600 hover:bg-amber-500 px-4 py-2.5 text-sm font-bold text-white transition-colors shadow-[0_3px_0_0_theme(colors.amber.800)] active:shadow-none active:translate-y-[3px] mt-4"
        >
          {following ? "Let's go!" : "Continue"}
        </button>
      </div>
    </>
  );
}

// --- Main onboarding page ---

export default function CreateProfilePage() {
  const router = useRouter();
  const trpc = useTRPC();

  // Check if the user already has a profile (e.g. refreshed after step 1).
  const whoAmI = useQuery(trpc.auth.whoAmI.queryOptions());
  const profileExists = whoAmI.data?.state === "ready";

  // Resume from a specific step (e.g. after WCA OAuth redirect).
  const searchParams = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const initialStep = parseInt(searchParams.get("step") ?? "0", 10);
  const [step, setStep] = useState(isNaN(initialStep) ? 0 : initialStep);

  // If profile already exists but we're on step 0, skip to step 1.
  useEffect(() => {
    if (profileExists && step === 0) {
      setStep(1);
    }
  }, [profileExists, step]);

  const handleComplete = () => {
    router.push("/");
    router.refresh();
  };

  return (
    <div className="flex flex-col flex-1 items-center justify-center p-8 font-sans">
      {/* Logo */}
      <div className="mb-6 flex flex-col items-center gap-3">
        <img src="/twenty-moves-favicon.svg" alt="twenty moves" className="w-14 h-14 rounded-xl" />
      </div>

      <div className="w-full max-w-sm">
        <StepIndicator current={step} total={TOTAL_STEPS} />

        {step === 0 && (
          <StepProfile onNext={() => setStep(1)} />
        )}
        {step === 1 && (
          <StepWCA onNext={() => setStep(2)} />
        )}
        {step === 2 && (
          <StepYouTube onNext={() => setStep(3)} />
        )}
        {step === 3 && (
          <StepFollow onNext={handleComplete} />
        )}
      </div>
    </div>
  );
}
