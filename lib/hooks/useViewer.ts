"use client";

import { useContext } from "react";
import type { IUser } from "@/lib/transforms/user";
import { ViewerContext } from "@/lib/context/viewer";

// Returns the current authenticated user and a setter to update it.
// Only works inside the (app) route group where ViewerProvider is mounted.
export function useViewer(): { viewer: IUser; setViewer: (user: IUser) => void } {
  const ctx = useContext(ViewerContext);
  if (!ctx) {
    throw new Error("useViewer must be used within the (app) route group");
  }
  return ctx;
}
