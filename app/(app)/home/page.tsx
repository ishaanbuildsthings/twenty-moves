"use client";

import { useEffect, useRef, useCallback } from "react";
import { useTRPC } from "@/lib/trpc/client";
import { useInfiniteQuery } from "@tanstack/react-query";
import { PracticePostCard } from "@/lib/components/practice-post-card";

export default function HomePage() {
  const trpc = useTRPC();
  const sentinelRef = useRef<HTMLDivElement>(null);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useInfiniteQuery(
      trpc.post.getFeed.infiniteQueryOptions(
        {},
        { getNextPageParam: (lastPage) => lastPage.nextCursor }
      )
    );

  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    },
    [fetchNextPage, hasNextPage, isFetchingNextPage]
  );

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(handleObserver, { threshold: 0 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [handleObserver]);

  const posts = data?.pages.flatMap((page) => page.posts) ?? [];

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-muted-foreground text-sm">Loading feed...</p>
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-muted-foreground text-sm">
          No posts yet. Follow some cubers to see their sessions here!
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-2xl space-y-4 p-4">
        {posts.map((post) => (
          <PracticePostCard key={post.id} post={post} />
        ))}
        <div ref={sentinelRef} className="h-1" />
        {isFetchingNextPage && (
          <p className="text-center text-sm text-muted-foreground py-2">
            Loading more...
          </p>
        )}
      </div>
    </div>
  );
}
