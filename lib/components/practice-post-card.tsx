"use client";

import { useState, useContext, useRef, useEffect } from "react";
import { type IPracticePost } from "@/lib/transforms/post";
import { EVENT_MAP, type CubeEvent } from "@/lib/cubing/events";
import { EventIcon } from "@/lib/components/event-icon";
import { UserAvatar } from "@/lib/components/user-avatar";
import { formatTime, timeAgo } from "@/lib/cubing/format";
import { useTRPC } from "@/lib/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { MessageCircle, Trash2, Send, MoreHorizontal } from "lucide-react";
import { ViewerContext } from "@/lib/context/viewer";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Link from "next/link";
import { toast } from "sonner";

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
  const viewer = useContext(ViewerContext);
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const eventConfig = EVENT_MAP[post.eventName as CubeEvent];
  const [commentsOpen, setCommentsOpen] = useState(false);
  const deletePost = useMutation(trpc.post.deletePost.mutationOptions({
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: [["post"]] });
      removePostFromCache(queryClient, post.id);
    },
    onSuccess: () => {
      toast.success("Post deleted!");
      queryClient.invalidateQueries({ queryKey: [["user"]] });
    },
  }));

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
        {viewer && viewer.viewer.id === post.user.id && (
          <DropdownMenu>
            <DropdownMenuTrigger className="p-1 text-muted-foreground/50 hover:text-foreground transition-colors">
              <MoreHorizontal className="w-5 h-5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
              <DropdownMenuItem
                className="text-red-500 focus:text-red-500"
                onClick={() => deletePost.mutate({ postId: post.id })}
              >
                <div className="flex items-start gap-2">
                  <Trash2 className="w-4 h-4 mt-0.5 shrink-0" />
                  <div>
                    <div className="font-medium">Delete</div>
                    <div className="text-[11px] text-muted-foreground font-normal leading-snug">Deleting a post with a PB will recompute your PBs from previous posts.</div>
                  </div>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
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

// Remove a post from all infinite query caches (feed + profile posts)
function removePostFromCache(
  queryClient: ReturnType<typeof useQueryClient>,
  postId: string,
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
            posts: page.posts.filter((p) => p.id !== postId),
          })),
        };
      }
    );
  }
}

/** Cubie icon from /public/cubie.svg with colored fills when liked. */
function CubeIcon({ className, filled }: { className?: string; filled?: boolean }) {
  return (
    <svg viewBox="0 0 352 352" className={className}>
      {filled && (
        <>
          {/* Top face — blue */}
          <path fill="#3B82F6" d="M70.665649,85.262642 C102.799530,71.277542 134.304245,57.748417 165.618805,43.792606 C175.965714,39.181339 185.564117,39.383850 195.859955,43.954048 C228.109314,58.269188 260.549713,72.153831 292.906738,86.226814 C295.136444,87.196587 298.229889,87.716820 298.251709,90.741058 C298.272430,93.622810 295.392670,94.628876 293.185730,95.697662 C260.974152,111.297249 228.970169,127.332382 196.374023,142.126984 C184.953842,147.310349 173.370224,147.235886 162.103363,141.777954 C132.440277,127.408493 102.869530,112.848396 73.265968,98.356148 C71.023491,97.258354 68.798820,96.122215 66.590538,94.957161 C64.759560,93.991173 63.197433,92.803925 63.314564,90.401390 C63.429501,88.044083 65.380394,87.611153 67.000244,86.847710 C68.203728,86.280510 69.442558,85.788269 70.665649,85.262642z" />
          {/* Left face — red */}
          <path fill="#E53E3E" d="M116.634071,286.797638 C98.837852,277.193787 81.840500,267.651703 64.537292,258.700836 C54.148468,253.326736 49.439720,244.890854 49.314289,233.753571 C49.074154,212.431213 49.212471,191.104523 49.204216,169.779633 C49.197060,151.286819 49.172882,132.793930 49.218712,114.301231 C49.241291,105.189644 53.476063,102.513161 61.561623,106.500069 C92.928467,121.966736 124.300774,137.422775 155.615982,152.993500 C167.567734,158.936203 173.768127,168.447784 173.711609,182.146790 C173.547318,221.964005 173.651794,261.782318 173.648193,301.600220 C173.648087,302.766144 173.711670,303.942078 173.587433,305.096344 C172.855240,311.899506 167.908493,314.644989 161.843811,311.386108 C146.732895,303.266235 131.698929,295.003204 116.634071,286.797638z" />
          {/* Right face — white */}
          <path fill="#F5F5F5" d="M262.155243,277.607452 C240.784500,288.991211 220.072601,300.048492 199.359772,311.103973 C191.259796,315.427338 186.341980,312.668335 186.331024,303.580963 C186.280426,261.604065 186.206039,219.626617 186.383896,177.650406 C186.429016,166.999084 191.365616,158.572769 201.057541,153.867905 C234.006363,137.873184 267.063843,122.101418 300.132996,106.356140 C307.500305,102.848297 312.631348,106.254654 312.642822,114.534889 C312.697083,153.680023 312.826538,192.826355 312.567596,231.969879 C312.486206,244.277344 307.440552,253.960968 295.632568,259.710297 C284.263947,265.245728 273.298065,271.608307 262.155243,277.607452z" />
        </>
      )}
      {/* Full outline */}
      <path fill={filled ? "none" : "currentColor"} stroke="none" d="M36.682274,199.999939 C36.680527,170.011490 36.638966,140.522980 36.693272,111.034653 C36.723831,94.440445 44.557487,82.946114 59.738586,76.351532 C93.948494,61.490944 128.162735,46.640148 162.344162,31.714231 C174.455460,26.425625 186.477539,26.239475 198.616760,31.556026 C233.084732,46.651798 267.528381,61.804581 302.074432,76.719818 C317.467651,83.365829 324.991791,95.156380 325.094147,111.468178 C325.344940,151.450943 325.328278,191.437057 325.120392,231.420242 C325.028198,249.156540 317.473328,262.523499 301.252960,271.055176 C267.945557,288.574432 234.938004,306.662750 201.714508,324.342957 C187.134735,332.101715 172.517639,331.923950 157.884857,323.887878 C125.770584,306.251434 93.739922,288.445221 61.284000,271.455475 C44.290989,262.560089 36.295811,249.353821 36.649815,230.488419 C36.837330,220.495575 36.682720,210.496307 36.682274,199.999939 M262.155243,277.607452 C273.298065,271.608307 284.263947,265.245728 295.632568,259.710297 C307.440552,253.960968 312.486206,244.277344 312.567596,231.969879 C312.826538,192.826355 312.697083,153.680023 312.642822,114.534889 C312.631348,106.254654 307.500305,102.848297 300.132996,106.356140 C267.063843,122.101418 234.006363,137.873184 201.057541,153.867905 C191.365616,158.572769 186.429016,166.999084 186.383896,177.650406 C186.206039,219.626617 186.280426,261.604065 186.331024,303.580963 C186.341980,312.668335 191.259796,315.427338 199.359772,311.103973 C220.072601,300.048492 240.784500,288.991211 262.155243,277.607452 M116.634071,286.797638 C131.698929,295.003204 146.732895,303.266235 161.843811,311.386108 C167.908493,314.644989 172.855240,311.899506 173.587433,305.096344 C173.711670,303.942078 173.648087,302.766144 173.648193,301.600220 C173.651794,261.782318 173.547318,221.964005 173.711609,182.146790 C173.768127,168.447784 167.567734,158.936203 155.615982,152.993500 C124.300774,137.422775 92.928467,121.966736 61.561623,106.500069 C53.476063,102.513161 49.241291,105.189644 49.218712,114.301231 C49.172882,132.793930 49.197060,151.286819 49.204216,169.779633 C49.212471,191.104523 49.074154,212.431213 49.314289,233.753571 C49.439720,244.890854 54.148468,253.326736 64.537292,258.700836 C81.840500,267.651703 98.837852,277.193787 116.634071,286.797638 M70.665649,85.262642 C69.442558,85.788269 68.203728,86.280510 67.000244,86.847710 C65.380394,87.611153 63.429501,88.044083 63.314564,90.401390 C63.197433,92.803925 64.759560,93.991173 66.590538,94.957161 C68.798820,96.122215 71.023491,97.258354 73.265968,98.356148 C102.869530,112.848396 132.440277,127.408493 162.103363,141.777954 C173.370224,147.235886 184.953842,147.310349 196.374023,142.126984 C228.970169,127.332382 260.974152,111.297249 293.185730,95.697662 C295.392670,94.628876 298.272430,93.622810 298.251709,90.741058 C298.229889,87.716820 295.136444,87.196587 292.906738,86.226814 C260.549713,72.153831 228.109314,58.269188 195.859955,43.954048 C185.564117,39.383850 175.965714,39.181339 165.618805,43.792606 C134.304245,57.748417 102.799530,71.277542 70.665649,85.262642z" />
    </svg>
  );
}

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

function PostFooter({ post, onOpenComments }: { post: PostWithInteractions; onOpenComments: () => void; }) {
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
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors hover:bg-muted ${
          post.liked ? "text-white" : "text-muted-foreground"
        }`}
        disabled={likePending}
        onClick={() => post.liked ? unlike.mutate({ postId: post.id }) : like.mutate({ postId: post.id })}
      >
        <CubeIcon className={`w-4 h-4 ${post.liked ? "cube-pop" : ""}`} filled={post.liked} key={post.liked ? "liked" : "not-liked"} />
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
