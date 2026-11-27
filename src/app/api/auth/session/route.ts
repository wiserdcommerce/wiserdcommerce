import { NextResponse } from "next/server";
import {
  checkRateLimit,
  getServerSession,
  getSessionCookieOptions,
  parseJsonBody,
  requireActiveUser,
  SESSION_COOKIE_NAME,
} from "@/lib/auth-session";
import { mutateDb, readDb, makeId } from "@/lib/db";
import { getIntegrationStatus } from "@/lib/integrations";

export async function GET() {
  const session = await getServerSession();
  const db = readDb();
  const integrations = getIntegrationStatus();

  const noStore = { headers: { "Cache-Control": "private, no-store" } };

  if (!session) {
    return NextResponse.json(
      {
        authenticated: false,
        user: null,
        wallets: [],
        notifications: [],
        integrations,
      },
      noStore
    );
  }

  const user = db.users.find((u) => u.id === session.userId) || null;
  if (!user || user.status === "suspended") {
    return NextResponse.json(
      {
        authenticated: false,
        user: null,
        wallets: [],
        notifications: [],
        integrations,
      },
      noStore
    );
  }

  const wallets = db.wallets.filter(
    (w) => w.userId === user.id && w.status === "connected"
  );
  const notifications = db.notifications
    .filter((n) => n.recipientId === user.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return NextResponse.json(
    {
      authenticated: true,
      user,
      wallets,
      notifications,
      integrations,
    },
    noStore
  );
}

export async function PATCH(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in to update your account." }, { status: 401 });
  }
  const limited = checkRateLimit(`session:${session.userId}`, 60, 60_000);
  if (limited) return limited;

  const parsed = await parseJsonBody<{
    action?: string;
    displayName?: string;
    bio?: string;
    productId?: string;
    storeId?: string;
    postId?: string;
    notificationId?: string;
    address?: {
      label: string;
      recipient: string;
      line1: string;
      city: string;
      country: string;
      postalCode: string;
    };
    removeAddressId?: string;
  }>(request);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  const result = await mutateDb((db) => {
    const active = requireActiveUser(db, session);
    if ("error" in active) return active;
    const { user } = active;

    if (body.action === "toggle_favorite" && body.productId) {
      const exists = user.favoriteProductIds.includes(body.productId);
      user.favoriteProductIds = exists
        ? user.favoriteProductIds.filter((id) => id !== body.productId)
        : [...user.favoriteProductIds, body.productId];
    } else if (body.action === "toggle_follow_store" && body.storeId) {
      const exists = user.followedStoreIds.includes(body.storeId);
      user.followedStoreIds = exists
        ? user.followedStoreIds.filter((id) => id !== body.storeId)
        : [...user.followedStoreIds, body.storeId];
      const store = db.stores.find((s) => s.id === body.storeId);
      if (store) {
        store.followerCount = Math.max(0, store.followerCount + (exists ? -1 : 1));
      }
    } else if (body.action === "toggle_save_post" && body.postId) {
      const exists = user.savedPostIds.includes(body.postId);
      user.savedPostIds = exists
        ? user.savedPostIds.filter((id) => id !== body.postId)
        : [...user.savedPostIds, body.postId];
    } else if (body.action === "mark_notification_read") {
      db.notifications.forEach((n) => {
        if (n.recipientId === user.id && (!body.notificationId || n.id === body.notificationId)) {
          n.read = true;
        }
      });
    } else if (body.action === "add_address" && body.address) {
      const a = body.address;
      if (a.recipient?.trim() && a.line1?.trim() && a.city?.trim()) {
        user.addresses.push({
          id: makeId("addr"),
          label: a.label?.trim() || "Shipping Address",
          recipient: a.recipient.trim(),
          line1: a.line1.trim(),
          city: a.city.trim(),
          country: a.country?.trim() || "United States",
          postalCode: a.postalCode?.trim() || "",
        });
      }
    } else if (body.action === "remove_address" && body.removeAddressId) {
      user.addresses = user.addresses.filter((a) => a.id !== body.removeAddressId);
    } else {
      if (typeof body.displayName === "string" && body.displayName.trim().length >= 2) {
        user.displayName = body.displayName.trim().slice(0, 60);
        const parts = user.displayName.split(/\s+/);
        user.avatarInitials = (
          (parts[0]?.[0] || "W") + (parts[1]?.[0] || parts[0]?.[1] || "R")
        ).toUpperCase();
      }
      if (typeof body.bio === "string") {
        user.bio = body.bio.trim().slice(0, 280);
      }
    }

    return { user };
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ user: result.user });
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE_NAME, "", getSessionCookieOptions(0));
  return response;
}
