"use client";

import { useState, useEffect } from "react";
import { useSettings } from "@/lib/context/settings";
import type { EventConfig } from "@/lib/cubing/events";

// Renders the icon for an event — either the 3D SVG or the flat
// cubing-icons font, based on the user's display preference.
// Defaults to flat icons during SSR to avoid hydration mismatch
// (localStorage isn't available on the server).
export function EventIcon({
  event,
  size = 20,
  className = "",
}: {
  event: EventConfig;
  size?: number;
  className?: string;
}) {
  const { displaySettings } = useSettings();
  // Start with flat icons on server + first client render to avoid
  // hydration mismatch. Switch to 3D after mount if preference is set.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const use3d = mounted && displaySettings.use3dIcons && event.icon3d;

  if (use3d) {
    return (
      <img
        src={event.icon3d!}
        alt={event.name}
        width={size}
        height={size}
        className={`inline-block ${className}`}
      />
    );
  }

  return (
    <span
      className={`cubing-icon ${event.iconClass} ${className}`}
      style={{ fontSize: size }}
    />
  );
}
