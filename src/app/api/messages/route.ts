import { NextResponse } from "next/server";
import {
  checkRateLimit,
  getServerSession,
  parseJsonBody,
  requireActiveUser,
} from "@/lib/auth-session";
import { mutateDb, readDb, makeId } from "@/lib/db";

export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json(
      { conversations: [], messages: [] },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  }
  const db = readDb();
  const active = requireActiveUser(db, session);
  if ("error" in active) {
    return NextResponse.json(
      { error: active.error },
      { status: active.status, headers: { "Cache-Control": "private, no-store" } }
    );
  }
  const conversations = db.conversations
    .filter((c) => c.participantIds.includes(session.userId))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const convIds = new Set(conversations.map((c) => c.id));
  const messages = db.messages
    .filter((m) => convIds.has(m.conversationId))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  return NextResponse.json(
    { conversations, messages },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in to send messages." }, { status: 401 });
  }

  const limited = checkRateLimit(`messages:${session.userId}`, 40, 60_000);
  if (limited) return limited;

  const parsed = await parseJsonBody<{
    action: "start_or_send" | "send" | "mark_read" | "block" | "report";
    conversationId?: string;
    recipientUserId?: string;
    storeId?: string;
    productId?: string;
    orderId?: string;
    text?: string;
    reportReason?: string;
  }>(request);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  const result = await mutateDb((db) => {
    const active = requireActiveUser(db, session);
    if ("error" in active) return active;
    const sender = active.user;
    const now = new Date().toISOString();

    if (body.action === "mark_read" && body.conversationId) {
      const conv = db.conversations.find((c) => c.id === body.conversationId);
      if (!conv || !conv.participantIds.includes(sender.id)) {
        return { error: "Conversation not found.", status: 403 as const };
      }
      conv.unreadBy = conv.unreadBy.filter((id) => id !== sender.id);
      return { ok: true };
    }

    if (body.action === "block" && body.conversationId) {
      const conv = db.conversations.find((c) => c.id === body.conversationId);
      if (!conv || !conv.participantIds.includes(sender.id)) {
        return { error: "Conversation not found.", status: 403 as const };
      }
      if (conv.status === "blocked") {
        if (
          conv.blockedBy &&
          conv.blockedBy !== sender.id &&
          !sender.roles.includes("admin")
        ) {
          return {
            error: "Only the account that blocked this conversation can unblock it.",
            status: 403 as const,
          };
        }
        conv.status = "open";
        conv.blockedBy = undefined;
      } else {
        conv.status = "blocked";
        conv.blockedBy = sender.id;
      }
      return { conversation: conv };
    }

    if (body.action === "report" && body.conversationId) {
      const conv = db.conversations.find((c) => c.id === body.conversationId);
      if (!conv || !conv.participantIds.includes(sender.id)) {
        return { error: "You can only report conversations you participate in.", status: 403 as const };
      }
      conv.status = "reported";
      db.reports.unshift({
        id: makeId("rep"),
        reporterId: sender.id,
        reporterName: sender.displayName,
        entityType: "message",
        entityId: conv.id,
        entityLabel: conv.storeName || conv.productTitle || `Conversation ${conv.id}`,
        reason: body.reportReason?.trim() || "Reported conversation",
        evidence: "Submitted from WISERD Messages.",
        reviewStatus: "open",
        createdAt: now,
      });
      return { conversation: conv };
    }

    const text = body.text?.trim() || "";

    if (body.action === "send" && body.conversationId) {
      if (!text) return { error: "Message cannot be empty.", status: 400 as const };
      const conv = db.conversations.find((c) => c.id === body.conversationId);
      if (!conv || !conv.participantIds.includes(sender.id)) {
        return { error: "Conversation not found.", status: 403 as const };
      }
      if (conv.status === "blocked") {
        return { error: "This conversation is blocked.", status: 400 as const };
      }
      const msg = {
        id: makeId("msg"),
        conversationId: conv.id,
        senderId: sender.id,
        senderName: sender.displayName,
        body: text.slice(0, 2000),
        deliveryState: "delivered" as const,
        createdAt: now,
      };
      db.messages.push(msg);
      conv.updatedAt = now;
      conv.unreadBy = conv.participantIds.filter((id) => id !== sender.id);
      for (const otherId of conv.unreadBy) {
        db.notifications.unshift({
          id: makeId("notif"),
          recipientId: otherId,
          eventType: "message",
          title: `New message from ${sender.displayName}`,
          body: text.slice(0, 96),
          href: `/messages?conversation=${conv.id}`,
          importantTransaction: Boolean(conv.orderId),
          read: false,
          createdAt: now,
        });
      }
      return { conversation: conv, message: msg };
    }

    // start_or_send
    const store = body.storeId ? db.stores.find((s) => s.id === body.storeId) : undefined;
    const product = body.productId
      ? db.products.find((p) => p.id === body.productId && p.status === "published")
      : undefined;
    const order = body.orderId ? db.orders.find((o) => o.id === body.orderId) : undefined;

    if (order) {
      const orderStore = db.stores.find((s) => s.id === order.storeId);
      const isParticipant =
        order.buyerId === sender.id ||
        orderStore?.ownerId === sender.id ||
        sender.roles.includes("admin");
      if (!isParticipant) {
        return {
          error: "You do not have permission to link this order to a conversation.",
          status: 403 as const,
        };
      }
    }

    const targetStore =
      store ||
      (product ? db.stores.find((s) => s.id === product.storeId) : undefined) ||
      (order ? db.stores.find((s) => s.id === order.storeId) : undefined);

    const recipientId = body.recipientUserId || targetStore?.ownerId;
    if (!recipientId) {
      return { error: "Recipient could not be determined.", status: 400 as const };
    }
    if (recipientId === sender.id) {
      return { error: "You cannot start a conversation with yourself.", status: 400 as const };
    }
    const recipient = db.users.find((u) => u.id === recipientId);
    if (!recipient) return { error: "Recipient account not found.", status: 404 as const };
    if (
      !order &&
      !sender.roles.includes("admin") &&
      recipient.privacy &&
      recipient.privacy.allowDirectMessages === false
    ) {
      return {
        error: "This member has disabled unsolicited direct messages.",
        status: 403 as const,
      };
    }

    let conv = db.conversations.find(
      (c) =>
        c.participantIds.includes(sender.id) &&
        c.participantIds.includes(recipientId) &&
        ((order && c.orderId === order.id) ||
          (product && c.productId === product.id) ||
          (!order && !product && targetStore && c.storeId === targetStore.id))
    );

    if (conv && conv.status === "blocked" && text) {
      return { error: "This conversation is blocked.", status: 400 as const };
    }

    if (!conv) {
      conv = {
        id: makeId("conv"),
        participantIds: Array.from(new Set([sender.id, recipientId])),
        participantNames: {
          [sender.id]: sender.displayName,
          [recipientId]: targetStore?.name || recipient.displayName,
        },
        storeId: targetStore?.id,
        storeName: targetStore?.name,
        productId: product?.id,
        productTitle: product?.title,
        productSlug: product?.slug,
        orderId: order?.id,
        orderReference: order?.referenceCode,
        status: "open",
        unreadBy: [],
        updatedAt: now,
      };
      db.conversations.unshift(conv);
    }

    let createdMessage = null;
    if (text) {
      createdMessage = {
        id: makeId("msg"),
        conversationId: conv.id,
        senderId: sender.id,
        senderName: sender.displayName,
        body: text.slice(0, 2000),
        deliveryState: "delivered" as const,
        createdAt: now,
      };
      db.messages.push(createdMessage);
      conv.updatedAt = now;
      conv.unreadBy = conv.participantIds.filter((id) => id !== sender.id);
      for (const otherId of conv.unreadBy) {
        db.notifications.unshift({
          id: makeId("notif"),
          recipientId: otherId,
          eventType: "message",
          title: `New message from ${sender.displayName}`,
          body: text.slice(0, 96),
          href: `/messages?conversation=${conv.id}`,
          importantTransaction: Boolean(conv.orderId),
          read: false,
          createdAt: now,
        });
      }
    }

    return { conversation: conv, message: createdMessage };
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result);
}
