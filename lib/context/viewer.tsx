"use client";

import { createContext, useEffect, useState } from "react";
import type { IUser } from "@/lib/transforms/user";

// Holds the current authenticated user and a setter to update it
// (e.g., after a profile edit). Set initially by the server-side
// (app)/layout.tsx from auth.whoAmI.
export const ViewerContext = createContext<{
  viewer: IUser;
  setViewer: (user: IUser) => void;
} | null>(null);

export function ViewerProvider({
  user: initialUser,
  children,
}: {
  user: IUser;
  children: React.ReactNode;
}) {
  const [viewer, setViewer] = useState<IUser>(initialUser);

  // Sync with server data on every navigation. The (app)/layout.tsx
  // re-runs whoAmI on each page load and passes the fresh user as a prop.
  // useState ignores new initialValues after mount, so we sync manually.
  useEffect(() => {
    setViewer(initialUser);
  }, [initialUser]);

  return (
    <ViewerContext.Provider value={{ viewer, setViewer }}>
      {children}
    </ViewerContext.Provider>
  );
}
