import { NextResponse } from "next/server";
import {
  checkRateLimit,
  getServerSession,
  parseJsonBody,
  requireActiveUser,
} from "@/lib/auth-session";
import { mutateDb, readDb, makeId } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const productId = searchParams.get("productId");
  const storeId = searchParams.get("storeId");

  const db = readDb();
  let reviews = db.reviews;
  if (productId) reviews = reviews.filter((r) => r.productId === productId);
  if (storeId) reviews = reviews.filter((r) => r.storeId === storeId);

  return NextResponse.json({ reviews });
}

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in to leave or reply to a review." }, { status: 401 });
  }
  const limited = checkRateLimit(`reviews:${session.userId}`, 20, 60_000);
  if (limited) return limited;

  const parsed = await parseJsonBody<{
    action?: "create" | "seller_reply";
    productId?: string;
    orderId?: string;
    rating?: number;
    comment?: string;
    reviewId?: string;
    reply?: string;
  }>(request);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  const result = await mutateDb((db) => {
    const active = requireActiveUser(db, session);
    if ("error" in active) return active;
    const { user } = active;
    const now = new Date().toISOString();

    if (body.action === "seller_reply" && body.reviewId) {
      const review = db.reviews.find((r) => r.id === body.reviewId);
      if (!review) return { error: "Review not found." };
      const store = db.stores.find((s) => s.id === review.storeId);
      if (!store || store.ownerId !== user.id) {
        return { error: "Only the store owner can reply to this review." };
      }
      review.sellerReply = body.reply?.trim().slice(0, 600) || "";
      review.sellerReplyAt = now;
      return { review };
    }

    const rating = Math.round(Number(body.rating));
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      return { error: "Rating must be between 1 and 5." };
    }
    const comment = body.comment?.trim();
    if (!comment || comment.length < 6) {
      return { error: "Please write at least a brief review (6+ characters)." };
    }

    // Reviews must be connected to an eligible purchase and prevent duplicates
    const eligibleOrder = db.orders.find(
      (o) =>
        o.buyerId === user.id &&
        (!body.orderId || o.id === body.orderId) &&
        o.items.some((i) => i.productId === body.productId) &&
        ["Shipped or Delivered", "Awaiting Buyer Confirmation", "Released", "Paid Out"].includes(
          o.escrowStatus
        )
    );

    if (!eligibleOrder || !body.productId) {
      return {
        error:
          "Only verified buyers with a delivered or completed order for this listing can submit a review.",
      };
    }

    const duplicate = db.reviews.some(
      (r) =>
        r.orderId === eligibleOrder.id &&
        r.productId === body.productId &&
        r.buyerId === user.id
    );
    if (duplicate) {
      return { error: "You have already reviewed this product for this order." };
    }

    const review = {
      id: makeId("rev"),
      productId: body.productId,
      storeId: eligibleOrder.storeId,
      orderId: eligibleOrder.id,
      buyerId: user.id,
      buyerName: user.displayName,
      rating,
      comment: comment.slice(0, 1000),
      createdAt: now,
    };
    db.reviews.unshift(review);
    return { review };
  });

  if ("error" in result) {
    return NextResponse.json(
      { error: result.error },
      { status: "status" in result ? result.status : 400 }
    );
  }
  return NextResponse.json(result, { status: 201 });
}
