"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTRPC } from "@/lib/trpc/client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { EVENT_CONFIGS, EVENT_MAP, type CubeEvent } from "@/lib/cubing/events";
import { EventIcon } from "@/lib/components/event-icon";
import { useSettings } from "@/lib/context/settings";
import { formatTime } from "@/lib/cubing/format";
import { Users, Plus, ArrowRight, Globe, Lock } from "lucide-react";

export default function RaceLandingPage() {
  const router = useRouter();
  const trpc = useTRPC();
  const { timerSettings, accent } = useSettings();

  const [selectedEvent, setSelectedEvent] = useState<CubeEvent>(
    timerSettings.selectedEvent
  );
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const publicRoomsQuery = useQuery(
    trpc.race.listPublicRooms.queryOptions()
  );

  const createRoom = useMutation(
    trpc.race.createRoom.mutationOptions({
      onSuccess: (data) => {
        router.push(`/race/${data.code}`);
      },
      onError: (err) => {
        setError(err.message);
      },
    })
  );

  const joinRoom = useMutation(
    trpc.race.joinRoom.mutationOptions({
      onSuccess: (data) => {
        router.push(`/race/${data.code}`);
      },
      onError: (err) => {
        setError(err.message);
      },
    })
  );

  const handleCreate = () => {
    setError(null);
    createRoom.mutate({ eventName: selectedEvent });
  };

  const handleJoin = () => {
    const code = joinCode.trim().toUpperCase();
    if (code.length !== 5) {
      setError("Room code must be 5 characters");
      return;
    }
    setError(null);
    joinRoom.mutate({ code });
  };

  const handleJoinPublic = (code: string) => {
    setError(null);
    joinRoom.mutate({ code });
  };

  const publicRooms = publicRoomsQuery.data ?? [];

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-8">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Users className="w-6 h-6 text-muted-foreground" />
            <h1 className="text-2xl font-extrabold">Race</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Solve the same scrambles with friends in real-time
          </p>
        </div>

        {/* Public Rooms */}
        {publicRooms.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-5 space-y-3">
            <div className="flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-muted-foreground" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                Public Rooms
              </h2>
            </div>

            <div className="flex flex-col gap-2">
              {publicRooms.map((room) => {
                const eventConfig = EVENT_MAP[room.eventName as CubeEvent];
                return (
                  <button
                    key={room.code}
                    onClick={() => handleJoinPublic(room.code)}
                    disabled={joinRoom.isPending}
                    className="flex items-center gap-3 w-full p-3 rounded-lg bg-muted/30 hover:bg-muted/60 transition-colors text-left"
                  >
                    {eventConfig && (
                      <EventIcon event={eventConfig} size={20} />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm">{room.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {room.maxTimeMs
                          ? `Official avg under ${formatTime(room.maxTimeMs * 10)}`
                          : "Open to all"}
                        {" · "}
                        {room.participantCount} in room
                      </div>
                    </div>
                    {room.maxTimeMs && (
                      <Lock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Create Room */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Create Room
          </h2>

          {/* Event picker */}
          <div className="grid grid-cols-5 gap-1.5">
            {EVENT_CONFIGS.map((ec) => (
              <button
                key={ec.id}
                onClick={() => setSelectedEvent(ec.id)}
                className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${
                  selectedEvent === ec.id
                    ? `${accent.bg} text-white`
                    : "bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                <EventIcon event={ec} size={18} />
                <span className="text-[10px] font-bold">{ec.name}</span>
              </button>
            ))}
          </div>

          <button
            onClick={handleCreate}
            disabled={createRoom.isPending}
            className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg font-bold text-sm text-white transition-colors disabled:opacity-50 ${accent.bg} ${accent.hover} ${accent.shadow}`}
          >
            <Plus className="w-4 h-4" />
            {createRoom.isPending ? "Creating..." : "Create Room"}
          </button>
        </div>

        {/* Join Room */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Join Room
          </h2>

          <div className="flex gap-2">
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 5))}
              placeholder="ABCDE"
              maxLength={5}
              className="flex-1 bg-muted/50 rounded-lg px-4 py-2.5 text-center font-mono text-lg font-bold tracking-[0.3em] uppercase placeholder:text-muted-foreground/40 placeholder:tracking-[0.3em] focus:outline-none focus:ring-1 focus:ring-border"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleJoin();
              }}
            />
            <button
              onClick={handleJoin}
              disabled={joinRoom.isPending || joinCode.length !== 5}
              className={`px-4 py-2.5 rounded-lg font-bold text-sm text-white transition-colors disabled:opacity-30 ${accent.bg} ${accent.hover} ${accent.shadow}`}
            >
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Error display */}
        {error && (
          <p className="text-center text-sm text-red-500">{error}</p>
        )}
      </div>
    </div>
  );
}
