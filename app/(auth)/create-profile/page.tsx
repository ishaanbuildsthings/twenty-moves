"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTRPC } from "@/lib/trpc/client";
import { useMutation } from "@tanstack/react-query";
import { COUNTRIES, countryCodeToFlag } from "@/lib/countries";
import { validateAvatarFile, uploadAvatar, ACCEPTED_IMAGE_TYPES } from "@/lib/supabase/upload-avatar";

export default function CreateProfilePage() {
  const router = useRouter();
  const trpc = useTRPC();
  const [username, setUsername] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [country, setCountry] = useState("");
  const [profilePictureFile, setProfilePictureFile] = useState<File | null>(null);
  const [profilePicturePreview, setProfilePicturePreview] = useState<string | null>(null);
  const [profilePictureError, setProfilePictureError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const createProfile = useMutation(
    trpc.auth.createProfile.mutationOptions()
  );

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

  const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();

    let profilePictureUrl: string | undefined;

    if (profilePictureFile) {
      profilePictureUrl = await uploadAvatar(profilePictureFile);
    }

    await createProfile.mutateAsync({ username, firstName, lastName, profilePictureUrl, country: country || undefined });
    router.push("/");
  };

  return (
    <div className="flex flex-col flex-1 items-center justify-center p-8 font-sans">
      <div className="w-full max-w-sm space-y-6">
        <h1 className="text-2xl font-bold text-center">Create your profile</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-20 h-20 rounded-full border-2 border-dashed border-zinc-300 overflow-hidden flex items-center justify-center text-zinc-400 hover:border-zinc-400 transition-colors"
            >
              {profilePicturePreview ? (
                <img src={profilePicturePreview} alt="Profile picture preview" className="w-full h-full object-cover" />
              ) : (
                <span className="text-xs text-center leading-tight px-1">Add photo</span>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_IMAGE_TYPES}
              className="hidden"
              onChange={handleFileChange}
            />
            {profilePictureError && (
              <p className="text-xs text-red-500">{profilePictureError}</p>
            )}
          </div>
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-zinc-700">
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
              className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="firstName" className="block text-sm font-medium text-zinc-700">
              First name
            </label>
            <input
              id="firstName"
              type="text"
              required
              maxLength={50}
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="lastName" className="block text-sm font-medium text-zinc-700">
              Last name
            </label>
            <input
              id="lastName"
              type="text"
              required
              maxLength={50}
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="country" className="block text-sm font-medium text-zinc-700">
              Country
            </label>
            <select
              id="country"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm appearance-none"
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
            <p className="text-sm text-red-600">{createProfile.error.message}</p>
          )}
          <button
            type="submit"
            disabled={createProfile.isPending}
            className="w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
          >
            {createProfile.isPending ? "Creating..." : "Create profile"}
          </button>
        </form>
      </div>
    </div>
  );
}
