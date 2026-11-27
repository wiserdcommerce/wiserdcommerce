"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  MessageSquare,
  Heart,
  Bookmark,
  Flag,
  Search,
  Plus,
  Send,
  Trash2,
  CornerDownRight,
  X,
} from "lucide-react";
import { useWiserd } from "@/components/providers/wiserd-provider";
import type { Comment, CommunityPost, DiscussionRoom, Product } from "@/lib/types";

function formatRelativeTime(iso: string): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (diffSec < 60) return "Just now";
  const mins = Math.floor(diffSec / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

interface EnrichedPost extends CommunityPost {
  comments: Comment[];
  attachedProduct: {
    id: string;
    slug: string;
    title: string;
    priceCents: number;
    category: string;
    imageUrl: string;
    storeName: string;
  } | null;
}

const POST_TYPE_LABELS: Record<CommunityPost["postType"], string> = {
  discussion: "Discussion",
  product_share: "Product share",
  question: "Question",
  recommendation: "Recommendation",
};

function CommunitySkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, idx) => (
        <div
          key={idx}
          aria-hidden="true"
          className="rounded-xl border border-[#E5E7EB] bg-white p-5"
        >
          <div className="flex justify-between">
            <div className="h-3.5 w-36 animate-pulse rounded bg-[#F0F1F2]" />
            <div className="h-3.5 w-20 animate-pulse rounded bg-[#F0F1F2]" />
          </div>
          <div className="mt-3 h-5 w-3/4 animate-pulse rounded bg-[#F0F1F2]" />
          <div className="mt-2 h-3.5 w-full animate-pulse rounded bg-[#F0F1F2]" />
          <div className="mt-1.5 h-3.5 w-2/3 animate-pulse rounded bg-[#F0F1F2]" />
        </div>
      ))}
    </div>
  );
}

export default function CommunityPage() {
  const { user, openGoogleAuthModal, refreshSession } = useWiserd();
  const [posts, setPosts] = useState<EnrichedPost[]>([]);
  const [rooms, setRooms] = useState<DiscussionRoom[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [activeRoom, setActiveRoom] = useState<string>("");
  const [feedTab, setFeedTab] = useState<"for_you" | "following" | "recent">("for_you");
  const [searchQ, setSearchQ] = useState("");
  const [loading, setLoading] = useState(true);

  const [composerOpen, setComposerOpen] = useState(false);
  const [postType, setPostType] = useState<
    "discussion" | "product_share" | "question" | "recommendation"
  >("discussion");
  const [postRoomId, setPostRoomId] = useState("room_general");
  const [postTitle, setPostTitle] = useState("");
  const [postBody, setPostBody] = useState("");
  const [attachedProductId, setAttachedProductId] = useState("");
  const [posting, setPosting] = useState(false);

  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [replyingTo, setReplyingTo] = useState<
    Record<string, { id: string; authorName: string } | undefined>
  >({});
  const [notice, setNotice] = useState<string | null>(null);

  const loadCommunity = useCallback(async () => {
    const params = new URLSearchParams();
    if (activeRoom) params.set("room", activeRoom);
    if (searchQ.trim()) params.set("q", searchQ.trim());
    try {
      const [commRes, prodRes] = await Promise.all([
        fetch(`/api/community?${params.toString()}`, { cache: "no-store" }),
        fetch("/api/products", { cache: "no-store" }),
      ]);
      if (commRes.ok) {
        const d = await commRes.json();
        setPosts(d.posts || []);
        setRooms(d.rooms || []);
      }
      if (prodRes.ok) {
        const pd = await prodRes.json();
        setProducts(pd.products || []);
      }
    } finally {
      setLoading(false);
    }
  }, [activeRoom, searchQ]);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) loadCommunity();
    });
    return () => {
      active = false;
    };
  }, [loadCommunity]);

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      openGoogleAuthModal();
      return;
    }
    setPosting(true);
    setNotice(null);
    try {
      const res = await fetch("/api/community", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_post",
          title: postTitle,
          body: postBody,
          postType,
          roomId: postRoomId,
          attachedProductId: attachedProductId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setNotice(data.error || "Could not publish post.");
      } else {
        setPostTitle("");
        setPostBody("");
        setAttachedProductId("");
        setComposerOpen(false);
        await loadCommunity();
      }
    } finally {
      setPosting(false);
    }
  };

  const handleLike = async (postId: string) => {
    if (!user) {
      openGoogleAuthModal();
      return;
    }
    await fetch("/api/community", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "toggle_like", postId }),
    });
    await loadCommunity();
  };

  const handleSave = async (postId: string) => {
    if (!user) {
      openGoogleAuthModal();
      return;
    }
    await fetch("/api/auth/session", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "toggle_save_post", postId }),
    });
    await refreshSession();
  };

  const handleReport = async (postId: string) => {
    if (!user) {
      openGoogleAuthModal();
      return;
    }
    await fetch("/api/community", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "report_post",
        postId,
        reportReason: "Flagged by community member for moderation review",
      }),
    });
    setNotice("Report submitted for moderation review.");
    await loadCommunity();
  };

  const handleComment = async (postId: string) => {
    if (!user) {
      openGoogleAuthModal();
      return;
    }
    const text = (commentDrafts[postId] || "").trim();
    if (!text) return;
    const parentCommentId = replyingTo[postId]?.id;
    const res = await fetch("/api/community", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "add_comment",
        postId,
        parentCommentId,
        body: text,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setNotice(data.error || "Could not post reply.");
      return;
    }
    setCommentDrafts((prev) => ({ ...prev, [postId]: "" }));
    setReplyingTo((prev) => ({ ...prev, [postId]: undefined }));
    await loadCommunity();
  };

  const handleDeletePost = async (postId: string) => {
    const res = await fetch("/api/community", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete_post", postId }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setNotice(data.error || "Could not delete post.");
      return;
    }
    setNotice("Post removed.");
    await loadCommunity();
  };

  const handleDeleteComment = async (commentId: string) => {
    const res = await fetch("/api/community", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete_comment", commentId }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setNotice(data.error || "Could not delete comment.");
      return;
    }
    await loadCommunity();
  };

  const visiblePosts = (() => {
    if (feedTab === "following") {
      if (!user) return [];
      return posts.filter(
        (p) =>
          p.authorId === user.id ||
          user.followingUserIds.includes(p.authorId) ||
          user.savedPostIds.includes(p.id)
      );
    }
    if (feedTab === "for_you") {
      return [...posts].sort((a, b) => {
        const scoreA = a.likedBy.length * 2 + a.comments.length * 3;
        const scoreB = b.likedBy.length * 2 + b.comments.length * 3;
        return scoreB - scoreA || b.createdAt.localeCompare(a.createdAt);
      });
    }
    return posts;
  })();

  return (
    <div className="mx-auto max-w-[1320px] px-4 pt-7 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#E5E7EB] pb-5">
        <div>
          <h1 className="type-page text-[#171717]">Community</h1>
          <p className="mt-1.5 text-sm text-[#6B6B6B]">
            Share products, ask questions, and discuss listings with buyers and
            independent sellers.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            if (!user) {
              openGoogleAuthModal();
              return;
            }
            setComposerOpen((prev) => !prev);
          }}
          className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-lg bg-[#315FC8] px-4 text-xs font-medium text-white transition hover:bg-[#274EA6]"
        >
          <Plus className="h-4 w-4" />
          New post
        </button>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-8">
        {/* Compact Room Selector on Mobile/Tablet so Feed Stays Above the Fold */}
        <div className="flex items-center gap-2 lg:hidden">
          <label htmlFor="mobile-room-select" className="type-meta shrink-0">
            Room
          </label>
          <select
            id="mobile-room-select"
            aria-label="Filter discussion room"
            value={activeRoom}
            onChange={(e) => setActiveRoom(e.target.value)}
            className="h-9 flex-1 rounded-lg border border-[#E5E7EB] bg-white px-3 text-xs text-[#171717]"
          >
            <option value="">All rooms ({rooms.length})</option>
            {rooms.map((room) => (
              <option key={room.id} value={room.slug}>
                {room.name}
              </option>
            ))}
          </select>
        </div>

        {/* Quiet Discussion Rooms Rail (Desktop) */}
        <aside className="hidden lg:col-span-3 lg:block">
          <div className="rounded-xl border border-[#E5E7EB] bg-white p-4">
            <h2 className="type-meta px-2 text-[#6B6B6B]">
              Discussion rooms ({rooms.length})
            </h2>
            <div className="mt-2.5 space-y-0.5">
              <button
                type="button"
                aria-pressed={activeRoom === ""}
                onClick={() => setActiveRoom("")}
                className={`flex h-9 w-full cursor-pointer items-center rounded-lg px-2.5 text-left text-xs transition ${
                  activeRoom === ""
                    ? "bg-[#171717] text-white"
                    : "text-[#171717] hover:bg-[#F7F7F5]"
                }`}
              >
                All rooms
              </button>
              {rooms.map((room) => (
                <button
                  key={room.id}
                  type="button"
                  aria-pressed={activeRoom === room.slug}
                  onClick={() => setActiveRoom(room.slug)}
                  className={`flex h-9 w-full cursor-pointer items-center rounded-lg px-2.5 text-left text-xs transition ${
                    activeRoom === room.slug
                      ? "bg-[#171717] text-white"
                      : "text-[#6B6B6B] hover:bg-[#F7F7F5] hover:text-[#171717]"
                  }`}
                >
                  <span className="truncate">{room.name}</span>
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* Main Feed Column */}
        <div className="space-y-5 lg:col-span-9">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-1.5">
              {[
                { id: "for_you", label: "For you" },
                { id: "following", label: "Saved and following" },
                { id: "recent", label: "Recent" },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={feedTab === t.id}
                  onClick={() => setFeedTab(t.id as typeof feedTab)}
                  className={`h-9 cursor-pointer rounded-lg border px-3 text-xs transition ${
                    feedTab === t.id
                      ? "border-[#171717] bg-[#171717] text-white"
                      : "border-[#E5E7EB] bg-white text-[#6B6B6B] hover:border-[#171717]/30 hover:text-[#171717]"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="relative sm:w-64">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[#6B6B6B]"
              />
              <label htmlFor="community-search" className="sr-only">
                Search discussions
              </label>
              <input
                id="community-search"
                type="search"
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                placeholder="Search posts..."
                className="h-9 w-full rounded-lg border border-[#E5E7EB] bg-white pr-3 pl-9 text-xs text-[#171717] placeholder:text-[#6B6B6B]"
              />
            </div>
          </div>

          {notice && (
            <div
              role="status"
              className="rounded-lg border border-[#167A67]/25 bg-white px-4 py-2.5 text-xs text-[#167A67]"
            >
              {notice}
            </div>
          )}

          {composerOpen && (
            <form
              onSubmit={handleCreatePost}
              className="space-y-3.5 rounded-xl border border-[#E5E7EB] bg-white p-5"
            >
              <h2 className="type-section text-[#171717]">New post</h2>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                <select
                  value={postType}
                  onChange={(e) => setPostType(e.target.value as typeof postType)}
                  className="h-9 rounded-lg border border-[#E5E7EB] bg-white px-2.5 text-xs"
                >
                  <option value="discussion">Discussion</option>
                  <option value="product_share">Product share</option>
                  <option value="question">Question</option>
                  <option value="recommendation">Recommendation</option>
                </select>
                <select
                  value={postRoomId}
                  onChange={(e) => setPostRoomId(e.target.value)}
                  className="h-9 rounded-lg border border-[#E5E7EB] bg-white px-2.5 text-xs"
                >
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
                <select
                  value={attachedProductId}
                  onChange={(e) => setAttachedProductId(e.target.value)}
                  className="h-9 rounded-lg border border-[#E5E7EB] bg-white px-2.5 text-xs"
                >
                  <option value="">Attach listing (optional)</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title} (${(p.priceCents / 100).toFixed(0)})
                    </option>
                  ))}
                </select>
              </div>
              <input
                required
                value={postTitle}
                onChange={(e) => setPostTitle(e.target.value)}
                placeholder="Post title"
                className="h-10 w-full rounded-lg border border-[#E5E7EB] bg-[#F7F7F5] px-3 text-sm"
              />
              <textarea
                required
                rows={3}
                value={postBody}
                onChange={(e) => setPostBody(e.target.value)}
                placeholder="Share questions, recommendations, or product feedback..."
                className="w-full rounded-lg border border-[#E5E7EB] bg-[#F7F7F5] p-3 text-sm"
              />
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={posting}
                  className="h-9 cursor-pointer rounded-lg bg-[#315FC8] px-4 text-xs font-medium text-white hover:bg-[#274EA6]"
                >
                  {posting ? "Publishing..." : "Publish"}
                </button>
                <button
                  type="button"
                  onClick={() => setComposerOpen(false)}
                  className="h-9 cursor-pointer rounded-lg border border-[#E5E7EB] bg-white px-3.5 text-xs text-[#6B6B6B] hover:text-[#171717]"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {loading ? (
            <CommunitySkeleton />
          ) : visiblePosts.length === 0 ? (
            <div className="rounded-xl border border-[#E5E7EB] bg-white px-6 py-12 text-center">
              <p className="text-sm font-medium text-[#171717]">
                No discussions in this view yet
              </p>
              <p className="mt-1 text-xs text-[#6B6B6B]">
                Switch rooms, clear your search, or start a new post for other
                members.
              </p>
              {activeRoom || searchQ || feedTab !== "for_you" ? (
                <button
                  type="button"
                  onClick={() => {
                    setActiveRoom("");
                    setSearchQ("");
                    setFeedTab("for_you");
                  }}
                  className="mt-4 h-9 cursor-pointer rounded-lg border border-[#E5E7EB] bg-white px-3.5 text-xs text-[#171717]"
                >
                  View all discussions
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    if (!user) {
                      openGoogleAuthModal();
                      return;
                    }
                    setComposerOpen(true);
                  }}
                  className="mt-4 inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-[#315FC8] px-4 text-xs font-medium text-white hover:bg-[#274EA6]"
                >
                  <Plus aria-hidden="true" className="h-3.5 w-3.5" />
                  Start a discussion
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {visiblePosts.map((post) => {
                const liked = Boolean(user && post.likedBy.includes(user.id));
                const saved = Boolean(user && user.savedPostIds.includes(post.id));
                const room = rooms.find((r) => r.id === post.roomId);
                return (
                  <article
                    key={post.id}
                    className="rounded-xl border border-[#E5E7EB] bg-white p-5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#6B6B6B]">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-[#171717]">{post.authorName}</span>
                        <span>{post.authorRoleLabel}</span>
                        <span className="font-mono-light text-[11px]">
                          · {formatRelativeTime(post.createdAt)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2.5">
                        {room && (
                          <span className="type-meta">{room.name}</span>
                        )}
                        <span className="rounded-md bg-[#F7F7F5] px-2 py-0.5 text-[11px] text-[#315FC8]">
                          {POST_TYPE_LABELS[post.postType]}
                        </span>
                      </div>
                    </div>

                    <h2 className="mt-2.5 text-base text-[#171717]">
                      {post.title}
                    </h2>
                    <p className="mt-1.5 text-sm text-[#6B6B6B]">{post.body}</p>

                    {post.attachedProduct && (
                      <Link
                        href={`/products/${post.attachedProduct.slug}`}
                        className="mt-4 flex items-center justify-between gap-4 rounded-lg border border-[#E5E7EB] bg-[#F7F7F5] p-3 transition hover:border-[#171717]/25"
                      >
                        <div className="flex items-center gap-3">
                          <Image
                            src={post.attachedProduct.imageUrl}
                            alt={post.attachedProduct.title}
                            width={64}
                            height={48}
                            className="h-12 w-16 rounded-md border border-[#E5E7EB] bg-white object-cover"
                          />
                          <div>
                            <p className="text-sm text-[#171717]">
                              {post.attachedProduct.title}
                            </p>
                            <p className="text-xs text-[#6B6B6B]">
                              {post.attachedProduct.storeName}
                            </p>
                          </div>
                        </div>
                        <span className="type-price text-base">
                          ${(post.attachedProduct.priceCents / 100).toFixed(0)}
                        </span>
                      </Link>
                    )}

                    <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-[#F0F1F2] pt-3 text-xs text-[#6B6B6B]">
                      <button
                        type="button"
                        aria-label={`${liked ? "Unlike" : "Like"} post (${post.likedBy.length})`}
                        aria-pressed={liked}
                        onClick={() => handleLike(post.id)}
                        className={`inline-flex cursor-pointer items-center gap-1.5 ${
                          liked ? "text-[#315FC8]" : "hover:text-[#171717]"
                        }`}
                      >
                        <Heart className={`h-3.5 w-3.5 ${liked ? "fill-[#315FC8]" : ""}`} />
                        {post.likedBy.length}
                      </button>
                      <span className="inline-flex items-center gap-1.5">
                        <MessageSquare className="h-3.5 w-3.5" />
                        {post.comments.length} {post.comments.length === 1 ? "reply" : "replies"}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleSave(post.id)}
                        className={`inline-flex cursor-pointer items-center gap-1.5 ${
                          saved ? "text-[#315FC8]" : "hover:text-[#171717]"
                        }`}
                      >
                        <Bookmark className={`h-3.5 w-3.5 ${saved ? "fill-[#315FC8]" : ""}`} />
                        {saved ? "Saved" : "Save"}
                      </button>
                      <div className="ml-auto flex items-center gap-3">
                        {user && (post.authorId === user.id || user.roles.includes("admin")) && (
                          <button
                            type="button"
                            onClick={() => handleDeletePost(post.id)}
                            className="inline-flex cursor-pointer items-center gap-1 hover:text-[#C81E1E]"
                          >
                            <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
                            Delete
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleReport(post.id)}
                          className="inline-flex cursor-pointer items-center gap-1 hover:text-[#C81E1E]"
                        >
                          <Flag aria-hidden="true" className="h-3.5 w-3.5" />
                          Report
                        </button>
                      </div>
                    </div>

                    <div className="mt-3.5 space-y-2 border-t border-[#F0F1F2] pt-3">
                      {post.comments.map((cmt) => {
                        const canDeleteComment = Boolean(
                          user && (cmt.authorId === user.id || user.roles.includes("admin"))
                        );
                        return (
                          <div
                            key={cmt.id}
                            className={`rounded-lg bg-[#F7F7F5] px-3 py-2 text-xs ${
                              cmt.parentCommentId ? "ml-5 border-l-2 border-[#E5E7EB]" : ""
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5">
                                <span className="font-medium text-[#171717]">{cmt.authorName}</span>
                                <span className="font-mono-light text-[11px] text-[#6B6B6B]">
                                  · {formatRelativeTime(cmt.createdAt)}
                                </span>
                              </div>
                              <div className="flex items-center gap-2.5 text-[11px] text-[#6B6B6B]">
                                {!cmt.parentCommentId && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setReplyingTo((prev) => ({
                                        ...prev,
                                        [post.id]: { id: cmt.id, authorName: cmt.authorName },
                                      }))
                                    }
                                    className="inline-flex cursor-pointer items-center gap-1 hover:text-[#171717]"
                                  >
                                    <CornerDownRight aria-hidden="true" className="h-3 w-3" />
                                    Reply
                                  </button>
                                )}
                                {canDeleteComment && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteComment(cmt.id)}
                                    aria-label="Delete comment"
                                    className="cursor-pointer hover:text-[#C81E1E]"
                                  >
                                    <Trash2 aria-hidden="true" className="h-3 w-3" />
                                  </button>
                                )}
                              </div>
                            </div>
                            <p className="mt-0.5 text-[#6B6B6B]">{cmt.body}</p>
                          </div>
                        );
                      })}

                      {replyingTo[post.id] && (
                        <div className="flex items-center justify-between rounded-md bg-[#F7F7F5] px-2.5 py-1 text-[11px] text-[#6B6B6B]">
                          <span>
                            Replying to{" "}
                            <span className="font-medium text-[#171717]">
                              {replyingTo[post.id]?.authorName}
                            </span>
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setReplyingTo((prev) => ({ ...prev, [post.id]: undefined }))
                            }
                            aria-label="Cancel reply"
                            className="cursor-pointer hover:text-[#171717]"
                          >
                            <X aria-hidden="true" className="h-3 w-3" />
                          </button>
                        </div>
                      )}

                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          handleComment(post.id);
                        }}
                        className="flex gap-2 pt-1"
                      >
                        <label htmlFor={`reply-${post.id}`} className="sr-only">
                          Reply to {post.title}
                        </label>
                        <input
                          id={`reply-${post.id}`}
                          value={commentDrafts[post.id] || ""}
                          onChange={(e) =>
                            setCommentDrafts((prev) => ({
                              ...prev,
                              [post.id]: e.target.value,
                            }))
                          }
                          placeholder={
                            replyingTo[post.id]
                              ? `Reply to ${replyingTo[post.id]?.authorName}...`
                              : "Write a reply..."
                          }
                          className="h-9 flex-1 rounded-lg border border-[#E5E7EB] bg-[#F7F7F5] px-3 text-xs text-[#171717]"
                        />
                        <button
                          type="submit"
                          className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-[#315FC8] px-3.5 text-xs font-medium text-white hover:bg-[#274EA6]"
                        >
                          <Send aria-hidden="true" className="h-3.5 w-3.5" />
                          Reply
                        </button>
                      </form>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
