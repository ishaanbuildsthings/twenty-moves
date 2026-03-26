"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { User, Settings, LogOut } from "lucide-react";
import { UserAvatar } from "@/lib/components/user-avatar";
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
  { label: "Practice", href: "/", icon: "⏱️", comingSoon: false, hoverClass: "hover:bg-orange-500/15 hover:text-orange-300" },
  { label: "Home", href: "/home", icon: "🏠", comingSoon: false, hoverClass: "hover:bg-blue-500/15 hover:text-blue-300" },
  { label: "Race", href: "/race", icon: "🏁", comingSoon: true, hoverClass: "hover:bg-red-500/15 hover:text-red-300" },
  { label: "Tourney", href: "/tourney", icon: "🏆", comingSoon: true, hoverClass: "hover:bg-green-500/15 hover:text-green-300" },
];

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { viewer } = useViewer();
  const supabase = createBrowserSupabaseClient();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.refresh();
  };

  return (
    <Sidebar collapsible="none">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  {item.comingSoon ? (
                    <SidebarMenuButton disabled className={`opacity-40 cursor-not-allowed ${item.hoverClass}`}>
                      <span className="text-xl leading-none grayscale">{item.icon}</span>
                      <span className="text-base font-bold">{item.label}</span>
                      <span className="ml-auto text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Soon</span>
                    </SidebarMenuButton>
                  ) : (
                    <SidebarMenuButton
                      render={<Link href={item.href} />}
                      isActive={item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)}
                      className={item.hoverClass}
                    >
                      <span className="text-xl leading-none">{item.icon}</span>
                      <span className="text-base font-bold">{item.label}</span>
                    </SidebarMenuButton>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        {/* Floating profile card — Discord-style */}
        <div className="mx-2 mb-2 rounded-lg bg-[oklch(0.18_0.005_60)] p-2">
          <DropdownMenu>
            <DropdownMenuTrigger render={<button />} className="flex items-center gap-2 w-full rounded-md px-1 py-1 hover:bg-[oklch(0.24_0.005_60)] transition-colors">
              <UserAvatar user={viewer} size="sm" rounded="xl" />
              <div className="flex flex-col items-start overflow-hidden group-data-[collapsible=icon]:hidden">
                <span className="text-sm font-semibold truncate w-full text-left">{viewer.firstName}</span>
                <span className="text-xs text-muted-foreground truncate w-full text-left">@{viewer.username}</span>
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
              <DropdownMenuItem onClick={handleSignOut} className="text-red-500 focus:text-red-500">
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
