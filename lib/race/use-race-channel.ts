"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { RacePresence, RaceBroadcastEvent } from "./types";

export interface UseRaceChannelOptions {
  code: string;
  userId: string;
  initialPresence: Omit<RacePresence, "userId">;
  onBroadcast: (event: RaceBroadcastEvent) => void;
}

export function useRaceChannel({
  code,
  userId,
  initialPresence,
  onBroadcast,
}: UseRaceChannelOptions) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const [peers, setPeers] = useState<Map<string, RacePresence>>(new Map());
  const onBroadcastRef = useRef(onBroadcast);
  onBroadcastRef.current = onBroadcast;

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    const channel = supabase.channel(`race:${code}`, {
      config: { presence: { key: userId } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<RacePresence>();
        const next = new Map<string, RacePresence>();
        for (const [key, presences] of Object.entries(state)) {
          if (presences.length > 0) {
            next.set(key, presences[0] as RacePresence);
          }
        }
        setPeers(next);
      })
      .on("broadcast", { event: "race_event" }, ({ payload }) => {
        onBroadcastRef.current(payload as RaceBroadcastEvent);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ userId, ...initialPresence });
        }
      });

    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, userId]);

  const updatePresence = useCallback(
    async (data: Partial<RacePresence>) => {
      if (!channelRef.current) return;
      await channelRef.current.track({ userId, ...data });
    },
    [userId]
  );

  const broadcast = useCallback((event: RaceBroadcastEvent) => {
    if (!channelRef.current) return;
    channelRef.current.send({
      type: "broadcast",
      event: "race_event",
      payload: event,
    });
  }, []);

  return { peers, updatePresence, broadcast };
}
