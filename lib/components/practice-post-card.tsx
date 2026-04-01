"use client";

import { useState, useContext, useRef, useEffect } from "react";
import { type IPracticePost } from "@/lib/transforms/post";
import { EVENT_MAP, type CubeEvent } from "@/lib/cubing/events";
import { EventIcon } from "@/lib/components/event-icon";
import { UserAvatar } from "@/lib/components/user-avatar";
import { formatTime, timeAgo } from "@/lib/cubing/format";
import { useTRPC } from "@/lib/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Heart, MessageCircle, Trash2, Send } from "lucide-react";
import { ViewerContext } from "@/lib/context/viewer";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import Link from "next/link";

export interface IComment {
  id: string;
  user: { id: string; username: string; profilePictureUrl: string | null; firstName: string; lastName: string };
  body: string;
  createdAt: Date;
}

type PostWithInteractions = IPracticePost & { liked: boolean; comments: IComment[] };

interface PracticePostCardProps {
  post: PostWithInteractions;
}

export function PracticePostCard({ post }: PracticePostCardProps) {
  const eventConfig = EVENT_MAP[post.eventName as CubeEvent];
  const [commentsOpen, setCommentsOpen] = useState(false);

  const highlights: { label: string; value: number; isPb: boolean }[] = [];
  if (post.bestSingle !== null) highlights.push({ label: "Single", value: post.bestSingle, isPb: post.isPbSingle });
  if (post.bestAo5 !== null) highlights.push({ label: "Ao5", value: post.bestAo5, isPb: post.isPbAo5 });
  if (post.bestAo12 !== null) highlights.push({ label: "Ao12", value: post.bestAo12, isPb: post.isPbAo12 });
  if (post.bestAo100 !== null) highlights.push({ label: "Ao100", value: post.bestAo100, isPb: post.isPbAo100 });
  if (post.sessionMean !== null) highlights.push({ label: "Mean", value: post.sessionMean, isPb: false });

  return (
    <div className="border border-border rounded-xl bg-card overflow-hidden">
      {/* Header — user + event + timestamp */}
      <div className="flex items-center gap-3 px-5 py-4">
        <Link href={`/profile/${post.user.username}`}>
          <UserAvatar user={post.user} size="sm" rounded="full" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Link href={`/profile/${post.user.username}`} className="font-semibold truncate hover:underline">
              {post.user.username}
            </Link>
            <span className="text-muted-foreground text-xs shrink-0">{timeAgo(post.createdAt)}</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            {eventConfig && <EventIcon event={eventConfig} size={16} />}
            <span>{eventConfig?.name ?? post.eventName}</span>
            <span className="text-muted-foreground/50">·</span>
            <span>{post.numSolves} solve{post.numSolves !== 1 ? "s" : ""}</span>
          </div>
        </div>
      </div>

      {/* Stat highlights */}
      {highlights.length > 0 && (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(0,1fr))] gap-px bg-border mx-5 mb-4 rounded-lg overflow-hidden">
          {highlights.map((h) => (
            <div
              key={h.label}
              className="flex flex-col items-center gap-1 bg-muted/50 px-3 py-3"
            >
              <span className="font-mono tabular-nums text-base font-bold">
                {formatTime(h.value)}
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                  {h.label}
                </span>
                {h.isPb && (
                  <span className="text-[9px] font-bold uppercase tracking-wide bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded-full leading-none">
                    PB
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Caption */}
      {post.caption && (
        <div className="px-5 pb-4">
          <p className="text-sm leading-relaxed break-all">{post.caption}</p>
        </div>
      )}

      {/* Footer — like + comment buttons */}
      <PostFooter post={post} onOpenComments={() => setCommentsOpen(true)} />

      {/* Comments modal */}
      <CommentsModal post={post} open={commentsOpen} onOpenChange={setCommentsOpen} />
    </div>
  );
}

type PostPageData = { pages: { posts: PostWithInteractions[]; nextCursor?: string }[]; pageParams: unknown[] };

// Update a post in all infinite query caches (feed + profile posts)
function updatePostInCache(
  queryClient: ReturnType<typeof useQueryClient>,
  postId: string,
  updater: (post: PostWithInteractions) => PostWithInteractions
) {
  for (const key of [[["post", "getFeed"]], [["post", "getUserPosts"]]]) {
    queryClient.setQueriesData<PostPageData>(
      { queryKey: key },
      (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            posts: page.posts.map((p) => (p.id === postId ? updater(p) : p)),
          })),
        };
      }
    );
  }
}

function PostFooter({ post, onOpenComments }: { post: PostWithInteractions; onOpenComments: () => void }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const like = useMutation(trpc.post.likePost.mutationOptions({
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: [["post"]] });
      updatePostInCache(queryClient, post.id, (p) => ({ ...p, liked: true, numLikes: p.numLikes + 1 }));
    },
    onError: () => {
      updatePostInCache(queryClient, post.id, (p) => ({ ...p, liked: false, numLikes: p.numLikes - 1 }));
    },
  }));
  const unlike = useMutation(trpc.post.unlikePost.mutationOptions({
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: [["post"]] });
      updatePostInCache(queryClient, post.id, (p) => ({ ...p, liked: false, numLikes: p.numLikes - 1 }));
    },
    onError: () => {
      updatePostInCache(queryClient, post.id, (p) => ({ ...p, liked: true, numLikes: p.numLikes + 1 }));
    },
  }));

  const likePending = like.isPending || unlike.isPending;

  return (
    <div className="flex items-center gap-1 px-3 py-2 border-t border-border">
      <button
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
          post.liked
            ? "text-red-500"
            : "text-muted-foreground hover:text-red-500 hover:bg-muted"
        }`}
        disabled={likePending}
        onClick={() => post.liked ? unlike.mutate({ postId: post.id }) : like.mutate({ postId: post.id })}
      >
        <Heart className={`w-4 h-4 ${post.liked ? "fill-current" : ""}`} />
        <span>{post.numLikes}</span>
      </button>
      <button
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        onClick={onOpenComments}
      >
        <MessageCircle className="w-4 h-4" />
        {post.numComments > 0 && <span>{post.numComments}</span>}
      </button>
    </div>
  );
}

function CommentsModal({ post, open, onOpenChange }: { post: PostWithInteractions; open: boolean; onOpenChange: (open: boolean) => void }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const viewer = useContext(ViewerContext)!.viewer;
  const [commentText, setCommentText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus the input when modal opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const addComment = useMutation(trpc.post.addComment.mutationOptions({
    onSuccess: (newComment) => {
      updatePostInCache(queryClient, post.id, (p) => ({
        ...p,
        numComments: p.numComments + 1,
        comments: [newComment, ...p.comments],
      }));
      setCommentText("");
    },
  }));

  const deleteComment = useMutation(trpc.post.deleteComment.mutationOptions({
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: [["post"]] });
      updatePostInCache(queryClient, post.id, (p) => ({
        ...p,
        numComments: p.numComments - 1,
        comments: p.comments.filter((c) => c.id !== vars.commentId),
      }));
    },
  }));

  const handleSubmitComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    addComment.mutate({ postId: post.id, body: commentText.trim() });
  };

  const eventConfig = EVENT_MAP[post.eventName as CubeEvent];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserAvatar user={post.user} size="sm" rounded="full" />
            <span>{post.user.username}</span>
          </DialogTitle>
          <DialogDescription className="flex items-center gap-1.5">
            {eventConfig && <EventIcon event={eventConfig} size={14} />}
            <span>{eventConfig?.name ?? post.eventName}</span>
            <span>·</span>
            <span>{post.numSolves} solve{post.numSolves !== 1 ? "s" : ""}</span>
            <span>·</span>
            <span>{timeAgo(post.createdAt)}</span>
          </DialogDescription>
        </DialogHeader>

        {/* Caption */}
        {post.caption && (
          <p className="text-sm leading-relaxed break-all">{post.caption}</p>
        )}

        {/* Comments list */}
        <div className="flex-1 overflow-y-auto space-y-3 min-h-0">
          {post.comments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No comments yet. Be the first!</p>
          ) : (
            post.comments.map((comment) => (
              <div key={comment.id} className="flex items-start gap-2 group">
                <UserAvatar user={comment.user} size="sm" rounded="full" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm break-all">
                    <span className="font-semibold mr-1.5">{comment.user.username}</span>
                    {comment.body}
                  </p>
                  <span className="text-[10px] text-muted-foreground">{timeAgo(comment.createdAt)}</span>
                </div>
                {comment.user.id === viewer.id && (
                  <button
                    className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-red-500 transition-all"
                    onClick={() => deleteComment.mutate({ commentId: comment.id })}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        {/* Comment input */}
        <form onSubmit={handleSubmitComment} className="border-t border-border pt-3 space-y-1">
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Add a comment..."
              maxLength={200}
              className="flex-1 bg-muted rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <button
              type="submit"
              disabled={addComment.isPending || !commentText.trim()}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground text-right">{commentText.length}/200</p>
        </form>
      </DialogContent>
    </Dialog>
  );
}
