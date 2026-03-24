import { redirect } from "next/navigation";
import { caller } from "@/lib/trpc/server";
import { ViewerProvider } from "@/lib/components/viewer-provider";
import { AuthButton } from "@/lib/components/auth-button";

// Auth guard for all pages inside the (app) route group.
// Calls auth.status to determine the user's state:
// - unauthenticated → redirect to /login
// - needs-profile → redirect to /create-profile
// - ready → render the page with the user available via useViewer()
//
// Pages in the (auth) route group (login, create-profile) are NOT
// wrapped by this layout, so they're always accessible.
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const trpc = await caller();
  const status = await trpc.auth.status();

  if (status.state === "unauthenticated") {
    redirect("/login");
  }

  if (status.state === "needs-profile") {
    redirect("/create-profile");
  }

  return (
    <ViewerProvider user={status.user}>
      <header className="flex items-center justify-between border-b px-6 py-3">
        <a href="/" className="font-bold">Cubing Strava</a>
        <AuthButton />
      </header>
      {children}
    </ViewerProvider>
  );
}
