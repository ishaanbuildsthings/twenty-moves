"use client";

import { Toaster } from "sonner";
import { useSettings } from "@/lib/context/settings";

const ACCENT_CSS: Record<string, { bg: string; border: string }> = {
  orange: { bg: "rgb(217 119 6)",  border: "rgb(245 158 11)" },
  red:    { bg: "rgb(220 38 38)",  border: "rgb(239 68 68)" },
  green:  { bg: "rgb(5 150 105)",  border: "rgb(16 185 129)" },
  blue:   { bg: "rgb(37 99 235)",  border: "rgb(59 130 246)" },
  yellow: { bg: "rgb(202 138 4)",  border: "rgb(234 179 8)" },
};

export function AccentToaster() {
  const { displaySettings } = useSettings();
  const colors = ACCENT_CSS[displaySettings.accentColor];

  return (
    <Toaster
      theme="dark"
      position="bottom-center"
      toastOptions={{
        style: {
          background: colors.bg,
          border: `1px solid ${colors.border}`,
          color: "white",
        },
      }}
    />
  );
}
