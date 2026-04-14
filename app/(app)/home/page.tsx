"use client";

import { useEffect, useRef, useCallback } from "react";
import { useTRPC } from "@/lib/trpc/client";
import { useInfiniteQuery } from "@tanstack/react-query";
import { PracticePostCard } from "@/lib/components/practice-post-card";
import { UserSearch } from "@/lib/components/user-search";
import { CubeLoader } from "@/lib/components/cube-loader";

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
      <div className="flex flex-col flex-1 items-center justify-center">
        <CubeLoader message="Loading feed..." />
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
    <div className="flex-1 flex flex-col min-h-0">
      <div className="mx-auto max-w-2xl w-full border-x border-border bg-card px-5 py-3 border-b shrink-0">
        <UserSearch />
      </div>
      <div className="flex-1 overflow-y-auto overscroll-none">
        <div className="mx-auto max-w-2xl border-x border-border bg-card min-h-full">
        {posts.map((post) => (
          <div key={post.id} className="border-b border-border">
            <PracticePostCard post={post} />
          </div>
        ))}
        <div ref={sentinelRef} className="h-1" />
        {isFetchingNextPage && (
          <p className="text-center text-sm text-muted-foreground py-4">
            Loading more...
          </p>
        )}
        {!hasNextPage && !isFetchingNextPage && posts.length > 0 && (
          <p className="text-center text-sm text-muted-foreground py-8">
            You&apos;re all caught up!
          </p>
        )}
        </div>
      </div>
    </div>
  );
}
