"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { User, Settings, LogOut, PanelLeft } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useViewer } from "@/lib/hooks/useViewer";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

const navItems = [
  { label: "Practice", href: "/", icon: "⏱️" },
  { label: "Home", href: "/home", icon: "🏠" },
  { label: "Race", href: "/race", icon: "🏁" },
  { label: "Tourney", href: "/tourney", icon: "🏆" },
];

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const viewer = useViewer();
  const supabase = createBrowserSupabaseClient();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.refresh();
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    render={<Link href={item.href} />}
                    isActive={item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)}
                  >
                    <span className="text-xl leading-none">{item.icon}</span>
                    <span className="text-base font-bold">{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarTrigger className="w-full justify-start" />
          </SidebarMenuItem>
        </SidebarMenu>
        {/* Floating profile card — Discord-style */}
        <div className="mx-2 mb-2 rounded-lg bg-[oklch(0.14_0.003_260)] p-2">
          <DropdownMenu>
            <DropdownMenuTrigger render={<button />} className="flex items-center gap-2 w-full rounded-md px-1 py-1 hover:bg-[oklch(0.20_0.004_260)] transition-colors">
              <div className="w-8 h-8 rounded-full bg-[oklch(0.30_0.004_260)] flex items-center justify-center text-xs font-bold shrink-0">
                {viewer.username[0].toUpperCase()}
              </div>
              <div className="flex flex-col items-start overflow-hidden group-data-[collapsible=icon]:hidden">
                <span className="text-sm font-semibold truncate w-full">{viewer.firstName}</span>
                <span className="text-xs text-muted-foreground truncate w-full">@{viewer.username}</span>
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-48">
              <DropdownMenuItem
                render={<Link href={`/profile/${viewer.username}`} />}
              >
                <User />
                <span>Profile</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                render={<Link href="/settings" />}
              >
                <Settings />
                <span>Settings</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut}>
                <LogOut />
                <span>Sign out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
