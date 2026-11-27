import { NextResponse } from "next/server";
import {
  checkRateLimit,
  getServerSession,
  parseJsonBody,
  requireActiveUser,
} from "@/lib/auth-session";
import { mutateDb, readDb, makeId } from "@/lib/db";

const VALID_POST_TYPES = new Set([
  "discussion",
  "product_share",
  "question",
  "recommendation",
]);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const room = searchParams.get("room") || "";
  const q = (searchParams.get("q") || "").trim().toLowerCase();

  const db = readDb();
  const productMap = new Map(db.products.map((p) => [p.id, p]));
  const storeMap = new Map(db.stores.map((s) => [s.id, s]));

  let posts = db.posts
    .filter((p) => p.status !== "removed")
    .map((p) => {
      const attachedProduct = p.attachedProductId
        ? productMap.get(p.attachedProductId) || null
        : null;
      const attachedStore = attachedProduct
        ? storeMap.get(attachedProduct.storeId) || null
        : null;
      const comments = db.comments.filter((c) => c.postId === p.id);
      return {
        ...p,
        comments,
        attachedProduct: attachedProduct
          ? {
              id: attachedProduct.id,
              slug: attachedProduct.slug,
              title: attachedProduct.title,
              priceCents: attachedProduct.priceCents,
              category: attachedProduct.category,
              imageUrl: attachedProduct.imageUrl,
              storeName: attachedStore?.name || "WISERD Store",
            }
          : null,
      };
    });

  if (room) {
    const matchedRoom = db.discussionRooms.find(
      (r) => r.slug === room || r.id === room
    );
    if (matchedRoom) {
      posts = posts.filter((p) => p.roomId === matchedRoom.id);
    }
  }
  if (q) {
    posts = posts.filter((p) =>
      `${p.title} ${p.body} ${p.authorName}`.toLowerCase().includes(q)
    );
  }

  posts.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return NextResponse.json({
    posts,
    rooms: db.discussionRooms,
  });
}

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json(
      { error: "Sign in to publish posts, comment, or react in WISERD Community." },
      { status: 401 }
    );
  }

  const limited = checkRateLimit(`community:${session.userId}`, 30, 60_000);
  if (limited) return limited;

  const parsed = await parseJsonBody<{
    action:
      | "create_post"
      | "add_comment"
      | "toggle_like"
      | "report_post"
      | "delete_post"
      | "delete_comment";
    title?: string;
    body?: string;
    postType?: "discussion" | "product_share" | "question" | "recommendation";
    roomId?: string;
    attachedProductId?: string;
    postId?: string;
    commentId?: string;
    parentCommentId?: string;
    reportReason?: string;
  }>(request);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  const result = await mutateDb((db) => {
    const active = requireActiveUser(db, session);
    if ("error" in active) return active;
    const { user } = active;
    const now = new Date().toISOString();

    if (body.action === "create_post") {
      if (!body.title?.trim() || !body.body?.trim()) {
        return { error: "Please include both a title and post content.", status: 400 as const };
      }
      const userStore = db.stores.find((s) => s.ownerId === user.id);
      const validAttachedProduct = body.attachedProductId
        ? db.products.find(
            (p) => p.id === body.attachedProductId && p.status === "published"
          )
        : undefined;
      const validRoom = db.discussionRooms.find((r) => r.id === body.roomId);
      const safePostType =
        body.postType && VALID_POST_TYPES.has(body.postType)
          ? body.postType
          : "discussion";

      const post = {
        id: makeId("post"),
        authorId: user.id,
        authorName: user.displayName,
        authorRoleLabel: userStore
          ? `Seller, ${userStore.name}`
          : "WISERD Member",
        roomId: validRoom?.id || "room_general",
        postType: safePostType,
        title: body.title.trim().slice(0, 140),
        body: body.body.trim().slice(0, 2000),
        attachedProductId: validAttachedProduct?.id,
        likedBy: [],
        status: "active" as const,
        createdAt: now,
      };
      db.posts.unshift(post);
      return { post };
    }

    if (body.action === "add_comment" && body.postId) {
      const text = body.body?.trim();
      if (!text) return { error: "Comment cannot be empty.", status: 400 as const };
      const post = db.posts.find((p) => p.id === body.postId && p.status !== "removed");
      if (!post) return { error: "Post not found.", status: 404 as const };

      let validParentId: string | undefined;
      if (body.parentCommentId) {
        const parent = db.comments.find(
          (c) => c.id === body.parentCommentId && c.postId === post.id
        );
        if (!parent) {
          return { error: "Parent comment not found in this thread.", status: 400 as const };
        }
        validParentId = parent.id;
      }

      const comment = {
        id: makeId("cmt"),
        postId: post.id,
        parentCommentId: validParentId,
        authorId: user.id,
        authorName: user.displayName,
        body: text.slice(0, 1000),
        createdAt: now,
      };
      db.comments.push(comment);
      if (post.authorId !== user.id) {
        db.notifications.unshift({
          id: makeId("notif"),
          recipientId: post.authorId,
          eventType: "community",
          title: `${user.displayName} replied to your post`,
          body: text.slice(0, 100),
          href: "/community",
          importantTransaction: false,
          read: false,
          createdAt: now,
        });
      }
      return { comment };
    }

    if (body.action === "delete_post" && body.postId) {
      const post = db.posts.find((p) => p.id === body.postId && p.status !== "removed");
      if (!post) return { error: "Post not found.", status: 404 as const };
      if (post.authorId !== user.id && !user.roles.includes("admin")) {
        return { error: "You can only delete your own posts.", status: 403 as const };
      }
      post.status = "removed";
      post.updatedAt = now;
      return { ok: true };
    }

    if (body.action === "delete_comment" && body.commentId) {
      const idx = db.comments.findIndex((c) => c.id === body.commentId);
      if (idx === -1) return { error: "Comment not found.", status: 404 as const };
      const target = db.comments[idx];
      if (target.authorId !== user.id && !user.roles.includes("admin")) {
        return { error: "You can only delete your own comments.", status: 403 as const };
      }
      db.comments = db.comments.filter(
        (c) => c.id !== target.id && c.parentCommentId !== target.id
      );
      return { ok: true };
    }

    if (body.action === "toggle_like" && body.postId) {
      const post = db.posts.find((p) => p.id === body.postId);
      if (!post) return { error: "Post not found.", status: 404 as const };
      const exists = post.likedBy.includes(user.id);
      post.likedBy = exists
        ? post.likedBy.filter((id) => id !== user.id)
        : [...post.likedBy, user.id];
      return { post };
    }

    if (body.action === "report_post" && body.postId) {
      const post = db.posts.find((p) => p.id === body.postId);
      if (!post) return { error: "Post not found.", status: 404 as const };
      // Queue for administrator moderation without unilaterally hiding the post from the homepage
      db.reports.unshift({
        id: makeId("rep"),
        reporterId: user.id,
        reporterName: user.displayName,
        entityType: "post",
        entityId: post.id,
        entityLabel: post.title,
        reason: body.reportReason?.trim() || "Reported community post",
        evidence: "Submitted via Community feed report control.",
        reviewStatus: "open",
        createdAt: now,
      });
      return { ok: true };
    }

    return { error: "Unsupported community action.", status: 400 as const };
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result);
}
