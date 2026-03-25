import { redirect } from "next/navigation";
import { caller } from "@/lib/trpc/server";
import { ViewerProvider } from "@/lib/context/viewer";
import { SettingsProvider } from "@/lib/context/settings";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/lib/components/app-sidebar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const trpc = await caller();
  const session = await trpc.auth.whoAmI();

  if (session.state === "unauthenticated") {
    redirect("/login");
  }

  if (session.state === "needs-profile") {
    redirect("/create-profile");
  }

  return (
    <ViewerProvider user={session.user}>
      <SettingsProvider>
        <SidebarProvider>
          <AppSidebar />
          <main className="flex flex-col flex-1 min-h-0">
            {children}
          </main>
        </SidebarProvider>
      </SettingsProvider>
    </ViewerProvider>
  );
}
