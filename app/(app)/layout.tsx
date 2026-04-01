import { redirect } from "next/navigation";
import { caller } from "@/lib/trpc/server";
import { ViewerProvider } from "@/lib/context/viewer";
import { SettingsProvider } from "@/lib/context/settings";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/lib/components/app-sidebar";
import { AccentToaster } from "@/lib/components/accent-toaster";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const trpc = await caller();
  const session = await trpc.auth.whoAmI();

  if (session.state === "unauthenticated") {
    redirect("/");
  }

  if (session.state === "needs-profile") {
    redirect("/create-profile");
  }

  return (
    <ViewerProvider user={session.user}>
      <SettingsProvider>
        <SidebarProvider>
          <AppSidebar />
          <main className="flex flex-col flex-1 min-h-0 overflow-y-auto">
            <div className="md:hidden flex items-center px-3 py-2 border-b border-border">
              <SidebarTrigger />
            </div>
            {children}
          </main>
          <AccentToaster />
        </SidebarProvider>
      </SettingsProvider>
    </ViewerProvider>
  );
}
