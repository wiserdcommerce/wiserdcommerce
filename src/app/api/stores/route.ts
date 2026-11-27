import { NextResponse } from "next/server";
import {
  checkRateLimit,
  getServerSession,
  parseJsonBody,
  requireActiveUser,
} from "@/lib/auth-session";
import { mutateDb, readDb, makeId, slugify } from "@/lib/db";
import type { PayoutProvider } from "@/lib/types";

const VALID_PAYOUT_PROVIDERS = new Set<PayoutProvider>([
  "paypal",
  "wise",
  "stripe_connect",
  "payoneer",
  "crypto_wallet",
]);

const VALID_CRYPTO_NETWORKS = new Set([
  "Base",
  "Ethereum",
  "Arbitrum",
  "Optimism",
  "Polygon",
]);

function maskPayoutDestination(provider: PayoutProvider, destination: string): string {
  if (provider === "crypto_wallet") {
    return `${destination.slice(0, 6)}...${destination.slice(-4)}`;
  }
  const at = destination.indexOf("@");
  if (at > 1) {
    return `${destination[0]}***${destination.slice(at)}`;
  }
  return destination.length > 4 ? `${destination.slice(0, 2)}***` : "***";
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug");
  const mine = searchParams.get("mine") === "true";

  const db = readDb();
  const session = await getServerSession();

  const enrichStore = (s: (typeof db.stores)[number], includePrivateMetrics = false) => {
    const listings = db.products.filter((p) => p.storeId === s.id);
    const publishedListings = listings.filter((p) => p.status === "published");
    const reviews = db.reviews.filter((r) => r.storeId === s.id);
    const rating = reviews.length
      ? Number((reviews.reduce((a, b) => a + b.rating, 0) / reviews.length).toFixed(1))
      : null;

    const publicBase = {
      id: s.id,
      ownerId: s.ownerId,
      slug: s.slug,
      name: s.name,
      tagline: s.tagline,
      description: s.description,
      accentColor: s.accentColor,
      initials: s.initials,
      verificationStatus: s.verificationStatus,
      shippingPolicy: s.shippingPolicy,
      refundPolicy: s.refundPolicy,
      responseTimeLabel: s.responseTimeLabel,
      followerCount: s.followerCount,
      createdAt: s.createdAt,
      rating,
      reviewCount: reviews.length,
      listingCount: publishedListings.length,
    };

    if (!includePrivateMetrics) {
      return publicBase;
    }

    const storeOrders = db.orders.filter((o) => o.storeId === s.id);
    const totalSalesCents = storeOrders
      .filter(
        (o) =>
          ![
            "Pending Payment",
            "Payment Processing",
            "Payment Failed",
            "Cancelled",
            "Refund Processing",
            "Refund Completed",
          ].includes(o.escrowStatus)
      )
      .reduce((acc, o) => acc + o.subtotalCents, 0);

    // Compute profile completion objectively from real store fields (0–100)
    const checks = [
      Boolean(s.name.trim()),
      Boolean(s.tagline.trim()),
      Boolean(s.description.trim().length >= 30),
      Boolean(s.shippingPolicy.trim()),
      Boolean(s.refundPolicy.trim()),
      publishedListings.length > 0,
      s.verificationStatus === "verified",
      s.payoutStatus === "active",
    ];
    const profileCompletion = Math.round(
      (checks.filter(Boolean).length / checks.length) * 100
    );

    return {
      ...publicBase,
      payoutStatus: s.payoutStatus,
      payoutDestination: s.payoutDestination || null,
      storageUsedMb: s.storageUsedMb,
      storageLimitMb: s.storageLimitMb,
      monthlyListingLimit: s.monthlyListingLimit,
      totalListingCount: listings.length,
      orderCount: storeOrders.length,
      totalSalesCents,
      profileCompletion,
    };
  };

  if (mine) {
    if (!session) {
      return NextResponse.json({ store: null, listings: [], orders: [] });
    }
    const store = db.stores.find((s) => s.ownerId === session.userId);
    if (!store) {
      return NextResponse.json({ store: null, listings: [], orders: [] });
    }
    const listings = db.products.filter((p) => p.storeId === store.id);
    const orders = db.orders
      .filter((o) => o.storeId === store.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const reviews = db.reviews.filter((r) => r.storeId === store.id);
    return NextResponse.json(
      {
        store: enrichStore(store, true),
        listings,
        orders,
        reviews,
      },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  }

  if (slug) {
    const store = db.stores.find((s) => s.slug === slug || s.id === slug);
    if (!store) {
      return NextResponse.json({ error: "Store not found." }, { status: 404 });
    }
    const listings = db.products.filter(
      (p) => p.storeId === store.id && p.status === "published"
    );
    const reviews = db.reviews.filter((r) => r.storeId === store.id);
    return NextResponse.json({
      store: enrichStore(store, false),
      listings,
      reviews,
    });
  }

  return NextResponse.json({
    stores: db.stores.map((s) => enrichStore(s, false)),
  });
}

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in to open a WISERD store." }, { status: 401 });
  }
  const limited = checkRateLimit(`stores:${session.userId}`, 20, 60_000);
  if (limited) return limited;

  const parsed = await parseJsonBody<{
    name: string;
    tagline: string;
    description: string;
    shippingPolicy: string;
    refundPolicy: string;
  }>(request);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  if (!body.name?.trim() || body.name.trim().length < 3) {
    return NextResponse.json(
      { error: "Store name must be at least 3 characters." },
      { status: 400 }
    );
  }

  const result = await mutateDb((db) => {
    const active = requireActiveUser(db, session);
    if ("error" in active) return active;
    const { user } = active;

    const existing = db.stores.find((s) => s.ownerId === user.id);
    if (existing) {
      existing.name = body.name.trim();
      existing.tagline = body.tagline?.trim() || existing.tagline;
      existing.description = body.description?.trim() || existing.description;
      existing.shippingPolicy = body.shippingPolicy?.trim() || existing.shippingPolicy;
      existing.refundPolicy = body.refundPolicy?.trim() || existing.refundPolicy;
      return { store: existing };
    }

    const baseSlug = slugify(body.name);
    const slug = db.stores.some((s) => s.slug === baseSlug)
      ? `${baseSlug}-${makeId("s").slice(-4)}`
      : baseSlug;
    const words = body.name.trim().split(/\s+/);
    const initials = ((words[0]?.[0] || "W") + (words[1]?.[0] || words[0]?.[1] || "S")).toUpperCase();

    const store = {
      id: makeId("store"),
      ownerId: user.id,
      slug,
      name: body.name.trim(),
      tagline: body.tagline?.trim() || "Independent WISERD Seller",
      description:
        body.description?.trim() ||
        "Independent storefront operating on WISERD with transparent escrow terms.",
      accentColor: "#315FC8",
      initials,
      verificationStatus: "pending" as const,
      shippingPolicy:
        body.shippingPolicy?.trim() ||
        "Orders dispatch or deliver digitally within 2 business days with tracking submitted in WISERD.",
      refundPolicy:
        body.refundPolicy?.trim() ||
        "Returns and refunds follow documented WISERD escrow review rules.",
      payoutStatus: "unconfigured" as const,
      storageUsedMb: 18,
      storageLimitMb: 500,
      monthlyListingLimit: 25,
      responseTimeLabel: "New storefront",
      followerCount: 1,
      createdAt: new Date().toISOString(),
    };
    db.stores.unshift(store);
    if (!user.roles.includes("seller")) {
      user.roles.push("seller");
    }
    db.notifications.unshift({
      id: makeId("notif"),
      recipientId: user.id,
      eventType: "seller_verification",
      title: `Storefront "${store.name}" created`,
      body: "Your store is live with Pending Verification status. Publish your first listing and review verification requirements.",
      href: "/sell",
      importantTransaction: false,
      read: false,
      createdAt: new Date().toISOString(),
    });
    return { store };
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: "status" in result ? result.status : 400 });
  }
  return NextResponse.json({ store: result.store }, { status: 201 });
}

export async function PATCH(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json(
      { error: "Sign in to manage store payout settings." },
      { status: 401 }
    );
  }
  const limited = checkRateLimit(`stores:payout:${session.userId}`, 20, 60_000);
  if (limited) return limited;

  const parsed = await parseJsonBody<{
    action: "update_payout" | "clear_payout";
    provider?: PayoutProvider;
    accountHolder?: string;
    destination?: string;
    networkName?: string;
  }>(request);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  const result = await mutateDb((db) => {
    const active = requireActiveUser(db, session);
    if ("error" in active) return active;
    const { user } = active;
    const store = db.stores.find((s) => s.ownerId === user.id);
    if (!store) {
      return { error: "Create your storefront before configuring payouts.", status: 404 as const };
    }
    const now = new Date().toISOString();

    if (body.action === "clear_payout") {
      store.payoutDestination = undefined;
      store.payoutStatus = "unconfigured";
      db.auditLogs.unshift({
        id: makeId("audit"),
        actorId: user.id,
        actorName: user.displayName,
        action: "store.payout_cleared",
        targetType: "store",
        targetId: store.id,
        details: `Cleared payout destination for ${store.name}.`,
        createdAt: now,
      });
      return { store };
    }

    if (body.action !== "update_payout") {
      return { error: "Unsupported store update action.", status: 400 as const };
    }

    if (!body.provider || !VALID_PAYOUT_PROVIDERS.has(body.provider)) {
      return { error: "Select a supported international payout provider.", status: 400 as const };
    }

    const accountHolder = body.accountHolder?.trim() || "";
    const destination = body.destination?.trim() || "";
    if (accountHolder.length < 2 || accountHolder.length > 80) {
      return {
        error: "Account holder or beneficiary name must be 2–80 characters.",
        status: 400 as const,
      };
    }

    let networkName: string | undefined;
    let walletVerified = false;

    if (body.provider === "crypto_wallet") {
      if (!/^0x[a-fA-F0-9]{40}$/.test(destination)) {
        return {
          error: "Enter a valid EVM wallet address starting with 0x (42 characters).",
          status: 400 as const,
        };
      }
      networkName =
        body.networkName && VALID_CRYPTO_NETWORKS.has(body.networkName)
          ? body.networkName
          : "Base";
      walletVerified = db.wallets.some(
        (w) =>
          w.userId === user.id &&
          w.status === "connected" &&
          w.ownershipVerified &&
          w.address.toLowerCase() === destination.toLowerCase()
      );
    } else {
      const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(destination);
      const isWiseTag =
        body.provider === "wise" && /^@[a-zA-Z0-9._-]{3,40}$/.test(destination);
      if (!isEmail && !isWiseTag) {
        return {
          error:
            body.provider === "wise"
              ? "Enter a valid Wise email address or @wisetag."
              : "Enter a valid email address linked to your payout account.",
          status: 400 as const,
        };
      }
    }

    store.payoutDestination = {
      provider: body.provider,
      accountHolder,
      destination,
      networkName,
      walletVerified,
      updatedAt: now,
    };
    store.payoutStatus = "pending";

    db.auditLogs.unshift({
      id: makeId("audit"),
      actorId: user.id,
      actorName: user.displayName,
      action: "store.payout_updated",
      targetType: "store",
      targetId: store.id,
      details: `Configured ${body.provider} payout (${maskPayoutDestination(body.provider, destination)}) for ${store.name}.`,
      createdAt: now,
    });

    return { store };
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ store: result.store });
}
