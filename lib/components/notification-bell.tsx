"use client";

import { useState } from "react";
import { Check, Heart } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { UserAvatar } from "@/lib/components/user-avatar";
import { useSettings } from "@/lib/context/settings";
import Link from "next/link";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w`;
}

export function NotificationBell() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { accent } = useSettings();
  const [open, setOpen] = useState(false);

  const unreadQuery = useQuery({
    ...trpc.notification.unreadCount.queryOptions(),
    refetchInterval: 30_000, // poll every 30s
  });

  const listQuery = useQuery({
    ...trpc.notification.list.queryOptions({ limit: 20 }),
    enabled: open, // only fetch when popover is open
  });

  const markAllRead = useMutation(
    trpc.notification.markAllRead.mutationOptions({
      onSuccess: () => {
        queryClient.setQueryData(
          trpc.notification.unreadCount.queryKey(),
          { count: 0 }
        );
        queryClient.invalidateQueries({
          queryKey: trpc.notification.list.queryKey({ limit: 20 }),
        });
      },
    })
  );

  const unreadCount = unreadQuery.data?.count ?? 0;
  const notifications = listQuery.data?.notifications ?? [];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className="relative p-2 rounded-md hover:bg-muted transition-colors">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-[22px] h-[22px] text-muted-foreground">
          <path fillRule="evenodd" d="M5.25 9a6.75 6.75 0 0 1 13.5 0v.75c0 2.123.8 4.057 2.118 5.52a.75.75 0 0 1-.297 1.206c-1.544.57-3.16.99-4.831 1.243a3.75 3.75 0 1 1-7.48 0 24.585 24.585 0 0 1-4.831-1.244.75.75 0 0 1-.298-1.205A8.217 8.217 0 0 0 5.25 9.75V9Zm4.502 8.9a2.25 2.25 0 0 0 4.496 0 25.057 25.057 0 0 1-4.496 0Z" clipRule="evenodd" />
        </svg>
        {unreadCount > 0 && (
          <span className={`absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full ${accent.bg} text-white text-[10px] font-bold px-1`}>
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent side="right" align="start" className="w-80 p-0 max-h-[400px] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <span className="text-sm font-bold">Notifications</span>
          {unreadCount > 0 && (
            <button
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => markAllRead.mutate()}
            >
              <Check className="w-3 h-3" />
              Mark all read
            </button>
          )}
        </div>

        {/* List */}
        <div className="overflow-y-auto flex-1">
          {notifications.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2">
                <path fillRule="evenodd" d="M5.25 9a6.75 6.75 0 0 1 13.5 0v.75c0 2.123.8 4.057 2.118 5.52a.75.75 0 0 1-.297 1.206c-1.544.57-3.16.99-4.831 1.243a3.75 3.75 0 1 1-7.48 0 24.585 24.585 0 0 1-4.831-1.244.75.75 0 0 1-.298-1.205A8.217 8.217 0 0 0 5.25 9.75V9Zm4.502 8.9a2.25 2.25 0 0 0 4.496 0 25.057 25.057 0 0 1-4.496 0Z" clipRule="evenodd" />
              </svg>
              <p className="text-sm text-muted-foreground">No notifications yet</p>
            </div>
          ) : (
            notifications.map((n) => (
              <NotificationRow key={n.id} notification={n} onClose={() => setOpen(false)} />
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function NotificationRow({
  notification: n,
  onClose,
}: {
  notification: {
    id: string;
    type: string;
    read: boolean;
    resourceId: string | null;
    createdAt: Date;
    actor: {
      id: string;
      username: string;
      firstName: string;
      lastName: string;
      profilePictureUrl: string | null;
    };
  };
  onClose: () => void;
}) {
  const message = (() => {
    switch (n.type) {
      case "like":
        return "liked your post";
      case "comment":
        return "commented on your post";
      case "follow":
        return "started following you";
      case "medal":
        return "You earned a medal!";
      default:
        return "sent you a notification";
    }
  })();

  const icon = (() => {
    switch (n.type) {
      case "like":
        return <Heart className="w-3.5 h-3.5 text-red-400 fill-red-400" />;
      default:
        return null;
    }
  })();

  const href = (() => {
    switch (n.type) {
      case "like":
      case "comment":
        return "/home"; // navigate to feed where the post lives
      case "follow":
        return `/profile/${n.actor.username}`;
      default:
        return "/home";
    }
  })();

  return (
    <Link
      href={href}
      onClick={onClose}
      className={`flex items-start gap-3 px-4 py-3 hover:bg-muted/50 transition-colors border-b border-border/30 ${
        !n.read ? "bg-muted/20" : ""
      }`}
    >
      <UserAvatar
        user={n.actor}
        size="sm"
        rounded="full"
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm">
          <span className="font-semibold">{n.actor.username}</span>{" "}
          <span className="text-muted-foreground">{message}</span>
        </p>
        <div className="flex items-center gap-1.5 mt-0.5">
          {icon}
          <span className="text-xs text-muted-foreground">
            {timeAgo(new Date(n.createdAt))}
          </span>
        </div>
      </div>
      {!n.read && (
        <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-2" />
      )}
    </Link>
  );
}
