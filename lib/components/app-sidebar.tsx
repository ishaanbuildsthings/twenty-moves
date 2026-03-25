"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Timer, Rss, User, Settings, LogOut } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
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
  { label: "Timer", href: "/", icon: Timer },
  { label: "Feed", href: "/feed", icon: Rss },
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
    <Sidebar>
      {/* Cube-colored accent bar at the top of the sidebar */}
      <div className="cube-gradient h-1 shrink-0" />
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
                    <item.icon />
                    <span>{item.label}</span>
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
            <DropdownMenu>
              <DropdownMenuTrigger render={<SidebarMenuButton />}>
                <div className="cube-gradient-ring rounded-full p-[2px] shrink-0">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-sidebar text-xs font-semibold">
                    {viewer.username[0].toUpperCase()}
                  </div>
                </div>
                <span className="truncate text-sm">@{viewer.username}</span>
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
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
