"use client";

import { createContext, useContext } from "react";
import type { IUser } from "@/lib/transforms/user";

// The current authenticated user, available to any component inside the
// (app) route group. Set once by the server-side (app)/layout.tsx from
// auth.status, so there's no duplicate client-side auth check needed.
const ViewerContext = createContext<IUser | null>(null);

export function ViewerProvider({
  user,
  children,
}: {
  user: IUser;
  children: React.ReactNode;
}) {
  return (
    <ViewerContext.Provider value={user}>{children}</ViewerContext.Provider>
  );
}

// Returns the current authenticated user. Only works inside the (app)
// route group where ViewerProvider is mounted. Throws if used outside.
export function useViewer(): IUser {
  const viewer = useContext(ViewerContext);
  if (!viewer) {
    throw new Error("useViewer must be used within the (app) route group");
  }
  return viewer;
}
