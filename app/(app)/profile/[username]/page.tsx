"use client";

import { useParams } from "next/navigation";
import { useViewer } from "@/lib/hooks/useViewer";

export default function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  const viewer = useViewer();
  const isOwnProfile = viewer.username === username;

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-2xl font-bold">@{username}</h1>
      {isOwnProfile && (
        <p className="text-sm text-muted-foreground">This is your profile</p>
      )}
    </div>
  );
}
