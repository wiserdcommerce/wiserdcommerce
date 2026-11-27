import { NextResponse } from "next/server";
import {
  checkRateLimit,
  getClientIp,
  getServerSession,
  parseJsonBody,
  requireActiveUser,
} from "@/lib/auth-session";
import { mutateDb, readDb, makeId, slugify } from "@/lib/db";
import type { ProductCategory } from "@/lib/types";

const CATEGORY_DEFAULT_IMAGES: Record<ProductCategory, string> = {
  physical: "/catalog/keyboard.webp",
  digital: "/catalog/ui-kit.webp",
  gaming: "/catalog/controller.webp",
  services: "/catalog/brand-service.webp",
};

function sanitizeImageUrl(input?: string): string | null {
  const val = input?.trim();
  if (!val) return null;
  if (val.startsWith("/catalog/") && !val.includes("..")) return val;
  try {
    const u = new URL(val);
    if (u.protocol === "https:") return u.toString();
  } catch {
    // invalid URL
  }
  return null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").trim().toLowerCase();
  const category = searchParams.get("category") || "";
  const storeSlug = searchParams.get("store") || "";
  const productSlug = searchParams.get("slug") || "";
  const availability = searchParams.get("availability") || "";
  const productType = (searchParams.get("type") || "").toLowerCase();
  const minPrice = Number(searchParams.get("minPrice") || 0);
  const maxPrice = Number(searchParams.get("maxPrice") || 0);
  const minRating = Number(searchParams.get("minRating") || 0);
  const escrowOnly = searchParams.get("escrow") === "true";
  const sort = searchParams.get("sort") || "relevance";
  const wantsAll = searchParams.get("includeAll") === "true";

  const db = readDb();
  const session = wantsAll ? await getServerSession() : null;
  const actor = session ? db.users.find((u) => u.id === session.userId) : null;
  const isAdmin = Boolean(actor && actor.status === "active" && actor.roles.includes("admin"));
  const ownStoreId = actor
    ? db.stores.find((s) => s.ownerId === actor.id)?.id || null
    : null;

  const storeById = new Map(db.stores.map((s) => [s.id, s]));
  const reviewsByProduct = new Map<string, number[]>();
  const reviewsByStore = new Map<string, number[]>();
  for (const r of db.reviews) {
    reviewsByProduct.set(r.productId, [...(reviewsByProduct.get(r.productId) || []), r.rating]);
    reviewsByStore.set(r.storeId, [...(reviewsByStore.get(r.storeId) || []), r.rating]);
  }

  const enriched = db.products
    .filter((p) => {
      if (p.status === "published") return true;
      if (!wantsAll) return false;
      if (isAdmin) return true;
      return Boolean(ownStoreId && p.storeId === ownStoreId);
    })
    .map((p) => {
      const store = storeById.get(p.storeId);
      const pRatings = reviewsByProduct.get(p.id) || [];
      const sRatings = store ? reviewsByStore.get(store.id) || [] : [];
      const rating = pRatings.length
        ? Number((pRatings.reduce((a, b) => a + b, 0) / pRatings.length).toFixed(1))
        : null;
      const storeRating = sRatings.length
        ? Number((sRatings.reduce((a, b) => a + b, 0) / sRatings.length).toFixed(1))
        : null;
      return {
        ...p,
        rating,
        reviewCount: pRatings.length,
        store: store
          ? {
              id: store.id,
              slug: store.slug,
              name: store.name,
              initials: store.initials,
              accentColor: store.accentColor,
              verificationStatus: store.verificationStatus,
              responseTimeLabel: store.responseTimeLabel,
              rating: storeRating,
              reviewCount: sRatings.length,
            }
          : null,
      };
    });

  if (productSlug) {
    const match = enriched.find((p) => p.slug === productSlug || p.id === productSlug);
    if (!match) {
      return NextResponse.json({ error: "Product not found." }, { status: 404 });
    }
    const related = enriched
      .filter((p) => p.id !== match.id && p.category === match.category && p.status === "published")
      .slice(0, 4);
    const reviews = db.reviews.filter((r) => r.productId === match.id);
    const discussions = db.posts.filter(
      (post) => post.attachedProductId === match.id && post.status === "active"
    );
    return NextResponse.json({ product: match, related, reviews, discussions });
  }

  let filtered = enriched;
  if (category && ["physical", "digital", "gaming", "services"].includes(category)) {
    filtered = filtered.filter((p) => p.category === category);
  }
  if (storeSlug) {
    filtered = filtered.filter((p) => p.store?.slug === storeSlug || p.storeId === storeSlug);
  }
  if (availability) {
    filtered = filtered.filter((p) => p.availability === availability);
  }
  if (productType) {
    filtered = filtered.filter((p) => p.productType.toLowerCase().includes(productType));
  }
  if (minPrice > 0) {
    filtered = filtered.filter((p) => p.priceCents >= Math.round(minPrice * 100));
  }
  if (maxPrice > 0) {
    filtered = filtered.filter((p) => p.priceCents <= Math.round(maxPrice * 100));
  }
  if (minRating > 0) {
    filtered = filtered.filter((p) => (p.rating || 0) >= minRating);
  }
  if (escrowOnly) {
    filtered = filtered.filter((p) => p.escrowEligible);
  }
  if (q) {
    filtered = filtered.filter((p) => {
      const hay = `${p.title} ${p.summary} ${p.category} ${p.productType} ${p.store?.name || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }

  filtered.sort((a, b) => {
    switch (sort) {
      case "newest":
        return b.createdAt.localeCompare(a.createdAt);
      case "price_asc":
        return a.priceCents - b.priceCents;
      case "price_desc":
        return b.priceCents - a.priceCents;
      case "rating":
        return (b.rating || 0) - (a.rating || 0) || b.views - a.views;
      case "popular":
        return b.views - a.views || b.popularScore - a.popularScore;
      default:
        return b.views - a.views || b.popularScore - a.popularScore;
    }
  });

  return NextResponse.json({
    products: filtered,
    total: filtered.length,
  });
}

export async function PATCH(request: Request) {
  const limited = checkRateLimit(`products:view:${getClientIp(request)}`, 90, 60_000);
  if (limited) return limited;

  const parsed = await parseJsonBody<{ action?: string; slug?: string }>(request);
  if (!parsed.ok) return parsed.response;
  const { action, slug } = parsed.data;

  if (action === "track_view" && slug?.trim()) {
    await mutateDb((db) => {
      const item = db.products.find((p) => p.slug === slug || p.id === slug);
      if (item) item.views += 1;
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unsupported product patch action." }, { status: 400 });
}

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in to publish or edit listings." }, { status: 401 });
  }

  const parsed = await parseJsonBody<{
    id?: string;
    title: string;
    category: ProductCategory;
    productType: string;
    summary: string;
    description: string;
    priceDollars: number;
    stock: number;
    deliveryInfo: string;
    refundConditions: string;
    imageUrl?: string;
    escrowEligible?: boolean;
    status?: "draft" | "published" | "paused";
    specs?: Record<string, string>;
  }>(request);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  if (!body.title?.trim() || body.title.trim().length < 4) {
    return NextResponse.json({ error: "Product title must be at least 4 characters." }, { status: 400 });
  }
  if (!["physical", "digital", "gaming", "services"].includes(body.category)) {
    return NextResponse.json({ error: "Select a valid product category." }, { status: 400 });
  }
  const priceCents = Math.round(Number(body.priceDollars) * 100);
  if (!Number.isFinite(priceCents) || priceCents < 100) {
    return NextResponse.json({ error: "Price must be at least $1.00." }, { status: 400 });
  }

  const customImage = sanitizeImageUrl(body.imageUrl);

  const result = await mutateDb((db) => {
    const active = requireActiveUser(db, session);
    if ("error" in active) return active;

    const store = db.stores.find((s) => s.ownerId === session.userId);
    if (!store) {
      return {
        error: "Create your seller storefront before adding listings.",
        status: 400 as const,
      };
    }

    if (body.id) {
      const existing = db.products.find((p) => p.id === body.id && p.storeId === store.id);
      if (!existing) {
        return { error: "Listing not found in your store.", status: 404 as const };
      }
      existing.title = body.title.trim();
      existing.category = body.category;
      existing.productType = body.productType?.trim() || existing.productType;
      existing.summary = body.summary?.trim() || existing.summary;
      existing.description = body.description?.trim() || existing.description;
      existing.priceCents = priceCents;
      const nextStock = Math.max(0, Math.floor(Number(body.stock) || 0));
      existing.stock = nextStock;
      if (existing.availability !== "made_to_order" || nextStock === 0) {
        existing.availability =
          nextStock === 0
            ? "out_of_stock"
            : nextStock <= 5
              ? "limited"
              : "in_stock";
      }
      if (existing.variations.length === 1) {
        existing.variations[0].stock = nextStock;
      }
      existing.deliveryInfo = body.deliveryInfo?.trim() || existing.deliveryInfo;
      existing.refundConditions = body.refundConditions?.trim() || existing.refundConditions;
      existing.escrowEligible = body.escrowEligible ?? existing.escrowEligible;
      if (body.status && ["draft", "published", "paused"].includes(body.status)) {
        existing.status = body.status;
      }
      if (customImage) {
        existing.imageUrl = customImage;
        existing.gallery = [customImage];
      }
      if (body.specs) existing.specs = body.specs;
      return { product: existing };
    }

    const storeListingCount = db.products.filter((p) => p.storeId === store.id).length;
    if (storeListingCount >= store.monthlyListingLimit) {
      return {
        error: `Monthly listing quota reached (${store.monthlyListingLimit} listings). Pause or delete an older listing first.`,
        status: 400 as const,
      };
    }

    const baseSlug = slugify(body.title);
    const uniqueSlug = db.products.some((p) => p.slug === baseSlug)
      ? `${baseSlug}-${makeId("p").slice(-4)}`
      : baseSlug;

    const stock = Math.max(0, Math.floor(Number(body.stock) || 1));
    const img = customImage || CATEGORY_DEFAULT_IMAGES[body.category];
    const created = {
      id: makeId("prod"),
      storeId: store.id,
      slug: uniqueSlug,
      category: body.category,
      productType: body.productType?.trim() || "Marketplace Item",
      title: body.title.trim(),
      summary: body.summary?.trim() || body.description?.trim().slice(0, 120) || body.title.trim(),
      description: body.description?.trim() || body.summary?.trim() || "",
      priceCents,
      currency: "USD" as const,
      stock,
      availability:
        stock === 0
          ? ("out_of_stock" as const)
          : stock <= 5
            ? ("limited" as const)
            : ("in_stock" as const),
      escrowEligible: body.escrowEligible ?? true,
      escrowConditions:
        body.category === "digital"
          ? "Digital delivery verified with a 72-hour buyer inspection window prior to seller release."
          : "Funds remain protected until delivery confirmation and buyer review.",
      deliveryInfo:
        body.deliveryInfo?.trim() ||
        (body.category === "digital"
          ? "Instant digital delivery upon verified payment."
          : "Tracked delivery submitted inside WISERD Orders."),
      refundConditions:
        body.refundConditions?.trim() ||
        "Covered by store refund policy and WISERD escrow dispute review.",
      specs: body.specs || { Category: body.category, Delivery: "Escrow Tracked" },
      imageUrl: img,
      gallery: [img],
      variations: [
        { id: makeId("var"), label: "Standard Edition", priceDeltaCents: 0, stock },
      ],
      status: body.status || ("published" as const),
      featured: false,
      popularScore: 65,
      views: 0,
      createdAt: new Date().toISOString(),
    };
    db.products.unshift(created);
    store.storageUsedMb = Math.min(store.storageLimitMb, store.storageUsedMb + 12);
    return { product: created };
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ product: result.product }, { status: 201 });
}

export async function DELETE(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in to manage listings." }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Listing id is required." }, { status: 400 });
  }

  const result = await mutateDb((db) => {
    const active = requireActiveUser(db, session);
    if ("error" in active) return active;
    const store = db.stores.find((s) => s.ownerId === session.userId);
    if (!store) return { error: "Storefront not found.", status: 404 as const };
    const idx = db.products.findIndex((p) => p.id === id && p.storeId === store.id);
    if (idx === -1) return { error: "Listing not found in your store.", status: 404 as const };
    db.products.splice(idx, 1);
    store.storageUsedMb = Math.max(0, store.storageUsedMb - 12);
    return { ok: true };
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ ok: true });
}
