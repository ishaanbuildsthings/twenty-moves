"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery } from "@tanstack/react-query";

export default function Home() {
  const router = useRouter();
  const trpc = useTRPC();
  const statusQuery = useQuery(trpc.auth.status.queryOptions());
  const usersQuery = useQuery({
    ...trpc.user.list.queryOptions(),
    enabled: statusQuery.data?.state === "ready",
  });

  useEffect(() => {
    if (!statusQuery.data) return;
    if (statusQuery.data.state === "unauthenticated") {
      router.replace("/login");
    } else if (statusQuery.data.state === "needs-profile") {
      router.replace("/create-profile");
    }
  }, [statusQuery.data, router]);

  if (!statusQuery.data || statusQuery.data.state !== "ready") {
    return (
      <div className="flex flex-col flex-1 items-center justify-center p-8">
        <p className="text-zinc-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 items-center justify-center p-8 font-sans">
      <main className="w-full max-w-md space-y-4">
        <h1 className="text-2xl font-bold">Cubing Strava</h1>
        {usersQuery.isLoading && <p className="text-zinc-500">Loading...</p>}
        <ul className="space-y-2">
          {usersQuery.data?.map((user) => (
            <li key={user.id} className="rounded border p-3">
              <p className="font-medium">
                {user.firstName} {user.lastName}
              </p>
              <p className="text-sm text-zinc-500">@{user.username}</p>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
