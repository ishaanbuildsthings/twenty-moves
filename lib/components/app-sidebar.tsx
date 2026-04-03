"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NotificationBell } from "@/lib/components/notification-bell";
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
  useSidebar,
} from "@/components/ui/sidebar";
import { useViewer } from "@/lib/hooks/useViewer";
import { useSettings } from "@/lib/context/settings";

const navItems = [
  { label: "Practice", href: "/practice", icon: "⏱️", comingSoon: false, hoverClass: "hover:bg-orange-500/15 hover:text-orange-300" },
  { label: "Home", href: "/home", icon: "🏠", comingSoon: false, hoverClass: "hover:bg-blue-500/15 hover:text-blue-300" },
  { label: "Tourney", href: "/tourney", icon: "🏆", comingSoon: false, hoverClass: "hover:bg-green-500/15 hover:text-green-300" },
  { label: "Race Rooms", href: "/race", icon: "🏁", comingSoon: true, hoverClass: "hover:bg-red-500/15 hover:text-red-300" },
  { label: "Head to Head", href: "/h2h", icon: "⚔️", comingSoon: true, hoverClass: "hover:bg-purple-500/15 hover:text-purple-300" },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { viewer } = useViewer();
  const { accent } = useSettings();
  const { setOpenMobile } = useSidebar();

  return (
    <Sidebar collapsible="offcanvas">
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
                      render={<Link href={item.href} onClick={() => setOpenMobile(false)} />}
                      isActive={pathname.startsWith(item.href)}
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
        <div className="mx-2 mb-2 flex items-center gap-1.5 rounded-lg bg-[oklch(0.18_0.005_60)] p-2 hover:bg-[oklch(0.22_0.005_60)] transition-colors">
          <Link
            href={`/profile/${viewer.username}`}
            onClick={() => setOpenMobile(false)}
            className="flex items-center gap-2 min-w-0 flex-1"
          >
            <UserAvatar user={viewer} size="sm" rounded="xl" />
            <span className="text-sm font-bold truncate">{viewer.firstName}</span>
          </Link>
          <div className="flex items-center shrink-0">
            <Link
              href="/settings"
              onClick={() => setOpenMobile(false)}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors"
              title="Settings"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-[22px] h-[22px]">
                <path fillRule="evenodd" d="M11.078 2.25c-.917 0-1.699.663-1.85 1.567L9.05 4.889c-.02.12-.115.26-.297.348a7.493 7.493 0 0 0-.986.57c-.166.115-.334.126-.45.083L6.3 5.508a1.875 1.875 0 0 0-2.282.819l-.922 1.597a1.875 1.875 0 0 0 .432 2.385l.84.692c.095.078.17.229.154.43a7.598 7.598 0 0 0 0 1.139c.015.2-.059.352-.153.43l-.841.692a1.875 1.875 0 0 0-.432 2.385l.922 1.597a1.875 1.875 0 0 0 2.282.818l1.019-.382c.115-.043.283-.031.45.082.312.214.641.405.985.57.182.088.277.228.297.35l.178 1.071c.151.904.933 1.567 1.85 1.567h1.844c.916 0 1.699-.663 1.85-1.567l.178-1.072c.02-.12.114-.26.297-.349.344-.165.673-.356.985-.57.167-.114.335-.125.45-.082l1.02.382a1.875 1.875 0 0 0 2.28-.819l.923-1.597a1.875 1.875 0 0 0-.432-2.385l-.84-.692c-.095-.078-.17-.229-.154-.43a7.614 7.614 0 0 0 0-1.139c-.016-.2.059-.352.153-.43l.84-.692c.708-.582.891-1.59.433-2.385l-.922-1.597a1.875 1.875 0 0 0-2.282-.818l-1.02.382c-.114.043-.282.031-.449-.083a7.49 7.49 0 0 0-.985-.57c-.183-.087-.277-.227-.297-.348l-.179-1.072a1.875 1.875 0 0 0-1.85-1.567h-1.843ZM12 15.75a3.75 3.75 0 1 0 0-7.5 3.75 3.75 0 0 0 0 7.5Z" clipRule="evenodd" />
              </svg>
            </Link>
            <NotificationBell />
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
