"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTRPC } from "@/lib/trpc/client";
import { useMutation } from "@tanstack/react-query";

export default function CreateProfilePage() {
  const router = useRouter();
  const trpc = useTRPC();
  const [username, setUsername] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  const createProfile = useMutation(
    trpc.auth.createProfile.mutationOptions()
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createProfile.mutateAsync({ username, firstName, lastName });
    router.push("/");
  };

  return (
    <div className="flex flex-col flex-1 items-center justify-center p-8 font-sans">
      <div className="w-full max-w-sm space-y-6">
        <h1 className="text-2xl font-bold text-center">Create your profile</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
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
