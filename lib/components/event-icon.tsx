"use client";

import { useSettings } from "@/lib/context/settings";
import type { EventConfig } from "@/lib/cubing/events";

// Renders the icon for an event — either the 3D SVG or the flat
// cubing-icons font, based on the user's display preference.
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
  const use3d = displaySettings.use3dIcons && event.icon3d;

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
