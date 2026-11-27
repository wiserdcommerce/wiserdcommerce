"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import {
  ChevronRight,
  Heart,
  ShieldCheck,
  ShoppingBag,
  MessageSquare,
  BadgeCheck,
  Truck,
  RotateCcw,
  Star,
  ZoomIn,
  ZoomOut,
  Maximize2,
  X,
  Minus,
  Plus,
} from "lucide-react";
import { useWiserd } from "@/components/providers/wiserd-provider";
import { ProductCard, type EnrichedProduct } from "@/components/marketplace/product-card";
import { formatCategoryLabel } from "@/lib/commerce";
import type { CommunityPost, Review } from "@/lib/types";

function formatUsd(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

interface GalleryFrame {
  id: string;
  src: string;
  label: string;
  objectPosition: string;
  zoomScale: number;
}

export default function ProductDetailClient() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const {
    user,
    recentlyViewedIds,
    addToCart,
    openCartDrawer,
    toggleFavorite,
    recordProductView,
    openGoogleAuthModal,
  } = useWiserd();

  const [product, setProduct] = useState<EnrichedProduct | null>(null);
  const [related, setRelated] = useState<EnrichedProduct[]>([]);
  const [allCatalog, setAllCatalog] = useState<EnrichedProduct[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [discussions, setDiscussions] = useState<CommunityPost[]>([]);
  const [selectedVariationId, setSelectedVariationId] = useState<string>("");
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [contactBusy, setContactBusy] = useState(false);

  const [activeFrameIdx, setActiveFrameIdx] = useState(0);
  const [zoomActive, setZoomActive] = useState(false);
  const [zoomOrigin, setZoomOrigin] = useState({ x: 50, y: 50 });
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const [infoTab, setInfoTab] = useState<"details" | "delivery" | "reviews" | "discussions">(
    "details"
  );

  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [reviewNotice, setReviewNotice] = useState<string | null>(null);

  const loadDetail = useCallback(
    async (trackView = false) => {
      if (!params?.slug) return;
      try {
        const qs = `slug=${encodeURIComponent(params.slug)}`;
        const [detailRes, listRes] = await Promise.all([
          fetch(`/api/products?${qs}`, { cache: "no-store" }),
          fetch("/api/products", { cache: "no-store" }),
        ]);
        if (!detailRes.ok) {
          setProduct(null);
          return;
        }
        const data = await detailRes.json();
        setProduct(data.product);
        setRelated(data.related || []);
        setReviews(data.reviews || []);
        setDiscussions(data.discussions || []);
        if (data.product?.variations?.[0]) {
          setSelectedVariationId(data.product.variations[0].id);
        }
        if (data.product?.id) {
          recordProductView(data.product.id);
        }
        if (trackView) {
          fetch("/api/products", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "track_view", slug: params.slug }),
          }).catch(() => {});
        }
        if (listRes.ok) {
          const listData = await listRes.json();
          setAllCatalog(listData.products || []);
        }
      } finally {
        setLoading(false);
      }
    },
    [params?.slug, recordProductView]
  );

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (!active) return;
      setActiveFrameIdx(0);
      setZoomActive(false);
      loadDetail(true);
    });
    return () => {
      active = false;
    };
  }, [loadDetail]);

  useEffect(() => {
    if (!lightboxOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxOpen]);

  const galleryFrames = useMemo<GalleryFrame[]>(() => {
    if (!product) return [];
    const baseSources =
      product.gallery && product.gallery.length > 0
        ? product.gallery
        : [product.imageUrl];

    if (baseSources.length >= 2) {
      return baseSources.map((src, idx) => ({
        id: `img-${idx}`,
        src,
        label: `View ${idx + 1}`,
        objectPosition: "50% 50%",
        zoomScale: 1,
      }));
    }

    const primary = baseSources[0];
    return [
      {
        id: "studio-front",
        src: primary,
        label: "Studio",
        objectPosition: "50% 50%",
        zoomScale: 1,
      },
      {
        id: "detail-left",
        src: primary,
        label: "Detail",
        objectPosition: "28% 46%",
        zoomScale: 1.45,
      },
      {
        id: "detail-right",
        src: primary,
        label: "Finish",
        objectPosition: "72% 54%",
        zoomScale: 1.45,
      },
    ];
  }, [product]);

  const recentlyViewedOthers = useMemo(() => {
    if (!product || recentlyViewedIds.length === 0) return [];
    const byId = new Map(allCatalog.map((p) => [p.id, p]));
    return recentlyViewedIds
      .filter((id) => id !== product.id)
      .map((id) => byId.get(id))
      .filter((p): p is EnrichedProduct => Boolean(p))
      .slice(0, 4);
  }, [product, recentlyViewedIds, allCatalog]);

  if (loading) {
    return (
      <div className="mx-auto max-w-[1320px] px-4 pt-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
          <div className="space-y-3 lg:col-span-7">
            <div className="aspect-[4/3] w-full animate-pulse rounded-xl bg-[#F0F1F2]" />
            <div className="grid grid-cols-3 gap-3">
              <div className="aspect-[4/3] animate-pulse rounded-lg bg-[#F0F1F2]" />
              <div className="aspect-[4/3] animate-pulse rounded-lg bg-[#F0F1F2]" />
              <div className="aspect-[4/3] animate-pulse rounded-lg bg-[#F0F1F2]" />
            </div>
          </div>
          <div className="space-y-4 lg:col-span-5">
            <div className="h-4 w-32 animate-pulse rounded bg-[#F0F1F2]" />
            <div className="h-9 w-4/5 animate-pulse rounded bg-[#F0F1F2]" />
            <div className="h-8 w-28 animate-pulse rounded bg-[#F0F1F2]" />
            <div className="h-24 w-full animate-pulse rounded-xl bg-[#F0F1F2]" />
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="mx-auto max-w-[1320px] px-4 py-20 text-center sm:px-6 lg:px-8">
        <h1 className="text-2xl text-[#171717]">Listing not found</h1>
        <p className="mt-2 text-sm text-[#6B6B6B]">
          This listing may have been paused or removed by its seller.
        </p>
        <Link
          href="/marketplace"
          className="mt-5 inline-flex h-10 items-center rounded-lg bg-[#315FC8] px-5 text-xs font-medium text-white"
        >
          Back to Marketplace
        </Link>
      </div>
    );
  }

  const activeFrame = galleryFrames[activeFrameIdx] || galleryFrames[0];
  const activeVariation =
    product.variations.find((v) => v.id === selectedVariationId) ||
    product.variations[0];
  const effectivePrice =
    product.priceCents + (activeVariation?.priceDeltaCents || 0);
  const availableStock = activeVariation ? activeVariation.stock : product.stock;
  const maxQty = Math.min(20, Math.max(1, availableStock));
  const isFavorited = Boolean(user?.favoriteProductIds.includes(product.id));

  const handleMouseMoveZoom = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!zoomActive) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
    setZoomOrigin({ x, y });
  };

  const handleAddToCart = () => {
    addToCart({
      productId: product.id,
      variationId: activeVariation?.id,
      quantity,
    });
    openCartDrawer();
  };

  const handleBuyNow = () => {
    addToCart({
      productId: product.id,
      variationId: activeVariation?.id,
      quantity,
    });
    router.push("/checkout");
  };

  const handleContactSeller = async () => {
    if (!user) {
      openGoogleAuthModal();
      return;
    }
    setContactBusy(true);
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "start_or_send",
          productId: product.id,
          storeId: product.storeId,
        }),
      });
      const data = await res.json();
      if (res.ok && data.conversation?.id) {
        router.push(`/messages?conversation=${data.conversation.id}`);
      }
    } finally {
      setContactBusy(false);
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      openGoogleAuthModal();
      return;
    }
    setReviewNotice(null);
    const res = await fetch("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId: product.id,
        rating: reviewRating,
        comment: reviewText,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setReviewNotice(data.error || "Could not submit review.");
    } else {
      setReviewText("");
      setReviewNotice("Your verified purchase review is now published.");
      await loadDetail(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1320px] px-4 pt-6 pb-20 sm:px-6 lg:px-8 lg:pb-0">
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-xs text-[#6B6B6B]">
        <Link href="/marketplace" className="hover:text-[#171717]">
          Marketplace
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link
          href={`/marketplace?category=${product.category}`}
          className="hover:text-[#171717]"
        >
          {formatCategoryLabel(product.category)}
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="truncate text-[#171717]">{product.title}</span>
      </nav>

      <div className="mt-5 grid grid-cols-1 items-start gap-8 lg:grid-cols-12 lg:gap-10">
        <div className="lg:col-span-7 lg:col-start-1 lg:row-start-1">
          <div
            onMouseMove={handleMouseMoveZoom}
            onMouseLeave={() => setZoomActive(false)}
            onClick={() => setZoomActive((z) => !z)}
            className={`group relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-[#E5E7EB] bg-[#F2F2EF] ${
              zoomActive ? "cursor-zoom-out" : "cursor-zoom-in"
            }`}
          >
            <Image
              src={activeFrame.src}
              alt={`${product.title}, ${activeFrame.label}`}
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 58vw"
              style={{
                objectPosition: activeFrame.objectPosition,
                transformOrigin: zoomActive
                  ? `${zoomOrigin.x}% ${zoomOrigin.y}%`
                  : "50% 50%",
                transform: `scale(${zoomActive ? 2.05 : activeFrame.zoomScale})`,
              }}
              className="object-cover transition-transform duration-200 ease-out"
            />

            <div className="absolute right-3 bottom-3 flex items-center gap-1.5">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setZoomActive((z) => !z);
                }}
                aria-label={zoomActive ? "Zoom out" : "Zoom in"}
                className="liquid-glass-pill inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-medium text-[#171717]"
              >
                {zoomActive ? (
                  <>
                    <ZoomOut className="h-3.5 w-3.5" />
                    Reset zoom
                  </>
                ) : (
                  <>
                    <ZoomIn className="h-3.5 w-3.5" />
                    Zoom
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxOpen(true);
                }}
                aria-label="Expand full screen view"
                className="liquid-glass-pill flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-[#171717]"
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div
            role="group"
            aria-label="Product image thumbnails"
            className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4"
          >
            {galleryFrames.map((frame, idx) => {
              const selected = idx === activeFrameIdx;
              return (
                <button
                  key={frame.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => {
                    setActiveFrameIdx(idx);
                    setZoomActive(false);
                  }}
                  className={`group cursor-pointer overflow-hidden rounded-lg border bg-[#F2F2EF] text-left transition ${
                    selected
                      ? "border-[#171717] ring-1 ring-[#171717]"
                      : "border-[#E5E7EB] hover:border-[#171717]/35"
                  }`}
                >
                  <div className="relative aspect-[4/3] overflow-hidden">
                    <Image
                      src={frame.src}
                      alt={frame.label}
                      fill
                      sizes="(max-width: 640px) 33vw, 180px"
                      style={{
                        objectPosition: frame.objectPosition,
                        transform: `scale(${frame.zoomScale})`,
                      }}
                      className="object-cover"
                    />
                  </div>
                  <p className="font-mono-light truncate border-t border-[#E5E7EB] bg-white px-2 py-1 text-[10px] text-[#6B6B6B]">
                    {frame.label}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        <aside className="lg:col-span-5 lg:col-start-8 lg:row-span-2 lg:row-start-1">
          <div className="rounded-xl border border-[#E5E7EB] bg-white p-6 lg:sticky lg:top-20">
            <div className="flex items-center justify-between gap-2 text-xs">
              {product.store ? (
                <Link
                  href={`/stores/${product.store.slug}`}
                  className="inline-flex items-center gap-1.5 text-[#6B6B6B] hover:text-[#171717]"
                >
                  <span>{product.store.name}</span>
                  {product.store.verificationStatus === "verified" && (
                    <BadgeCheck className="h-3.5 w-3.5 text-[#167A67]" />
                  )}
                </Link>
              ) : (
                <span className="text-[#6B6B6B]">WISERD Seller</span>
              )}
              <span className="font-mono-light text-[11px] text-[#6B6B6B]">
                {product.views} views
              </span>
            </div>

            <h1 className="mt-2.5 text-2xl text-[#171717] sm:text-[30px]">
              {product.title}
            </h1>

            <p className="mt-2 text-xs text-[#6B6B6B]">{product.summary}</p>

            <div className="mt-4 flex items-baseline justify-between gap-3 border-y border-[#E5E7EB] py-4">
              <div className="flex items-baseline gap-2">
                <span className="font-base-black text-3xl text-[#171717]">
                  {formatUsd(effectivePrice)}
                </span>
                <span className="font-mono-light text-xs text-[#6B6B6B]">USD</span>
              </div>
              <span className="inline-flex items-center gap-1.5 text-xs text-[#167A67]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#167A67]" />
                {availableStock >= 999
                  ? "Digital instant access"
                  : availableStock > 0
                    ? `${availableStock} available`
                    : "Out of stock"}
              </span>
            </div>

            {product.variations.length > 0 && (
              <div className="mt-5">
                <p className="text-xs text-[#6B6B6B]">Option</p>
                <div className="mt-2 space-y-2">
                  {product.variations.map((v) => {
                    const selected = activeVariation?.id === v.id;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => {
                          setSelectedVariationId(v.id);
                          setQuantity(1);
                        }}
                        className={`flex w-full cursor-pointer items-center justify-between rounded-lg border px-3.5 py-2.5 text-left text-xs transition ${
                          selected
                            ? "border-[#171717] bg-[#F7F7F5] text-[#171717]"
                            : "border-[#E5E7EB] bg-white text-[#6B6B6B] hover:border-[#171717]/30"
                        }`}
                      >
                        <span className="font-medium text-[#171717]">{v.label}</span>
                        <span className="font-mono-light text-[11px] text-[#6B6B6B]">
                          {v.priceDeltaCents > 0
                            ? `+${formatUsd(v.priceDeltaCents)}`
                            : "Included"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="mt-5 flex items-center justify-between">
              <label htmlFor="product-qty" className="text-xs text-[#6B6B6B]">
                Quantity
              </label>
              <div className="inline-flex items-center rounded-lg border border-[#E5E7EB] bg-white">
                <button
                  type="button"
                  aria-label="Decrease quantity"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="flex h-9 w-9 cursor-pointer items-center justify-center text-[#6B6B6B] hover:bg-[#F7F7F5] hover:text-[#171717]"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <input
                  id="product-qty"
                  type="number"
                  min={1}
                  max={maxQty}
                  value={quantity}
                  onChange={(e) =>
                    setQuantity(Math.max(1, Math.min(maxQty, Number(e.target.value) || 1)))
                  }
                  className="font-mono-light h-9 w-12 bg-transparent text-center text-sm text-[#171717] focus:outline-none"
                />
                <button
                  type="button"
                  aria-label="Increase quantity"
                  onClick={() => setQuantity((q) => Math.min(maxQty, q + 1))}
                  className="flex h-9 w-9 cursor-pointer items-center justify-center text-[#6B6B6B] hover:bg-[#F7F7F5] hover:text-[#171717]"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="mt-5 space-y-2.5">
              <button
                type="button"
                disabled={availableStock === 0}
                onClick={handleAddToCart}
                className="inline-flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-[#315FC8] px-4 text-sm font-medium text-white transition hover:bg-[#274EA6] disabled:opacity-50"
              >
                <ShoppingBag className="h-4 w-4" />
                Add to Cart ({formatUsd(effectivePrice * quantity)})
              </button>

              <button
                type="button"
                disabled={availableStock === 0}
                onClick={handleBuyNow}
                className="h-11 w-full cursor-pointer rounded-lg border border-[#171717] bg-white px-4 text-sm font-medium text-[#171717] transition hover:bg-[#F7F7F5] disabled:opacity-50"
              >
                Buy Now
              </button>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => toggleFavorite(product.id)}
                  aria-pressed={isFavorited}
                  className="inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-3 text-xs text-[#171717] hover:border-[#171717]/30"
                >
                  <Heart
                    className={`h-3.5 w-3.5 ${
                      isFavorited ? "fill-[#315FC8] text-[#315FC8]" : ""
                    }`}
                  />
                  {isFavorited ? "Saved" : "Save"}
                </button>
                <button
                  type="button"
                  disabled={contactBusy}
                  onClick={handleContactSeller}
                  className="inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-3 text-xs text-[#171717] hover:border-[#171717]/30"
                >
                  <MessageSquare className="h-3.5 w-3.5 text-[#6B6B6B]" />
                  {contactBusy ? "Opening..." : "Message Seller"}
                </button>
              </div>
            </div>

            <div className="mt-5 space-y-2.5 border-t border-[#E5E7EB] pt-4 text-xs text-[#6B6B6B]">
              {product.escrowEligible && (
                <p className="flex items-start gap-2">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#167A67]" />
                  <span>
                    <span className="text-[#171717]">Escrow eligible:</span>{" "}
                    {product.escrowConditions}
                  </span>
                </p>
              )}
              <p className="flex items-start gap-2">
                <Truck className="mt-0.5 h-4 w-4 shrink-0 text-[#6B6B6B]" />
                <span>{product.deliveryInfo}</span>
              </p>
            </div>
          </div>
        </aside>

        <div className="rounded-xl border border-[#E5E7EB] bg-white lg:col-span-7 lg:col-start-1 lg:row-start-2">
          <div
            role="tablist"
            aria-label="Product information sections"
            className="flex flex-wrap border-b border-[#E5E7EB] px-4"
          >
            {[
              { id: "details", label: "Overview & Specs" },
              { id: "delivery", label: "Delivery & Escrow" },
              { id: "reviews", label: `Reviews (${reviews.length})` },
              { id: "discussions", label: `Discussions (${discussions.length})` },
            ].map((t) => (
              <button
                key={t.id}
                role="tab"
                type="button"
                aria-selected={infoTab === t.id}
                onClick={() => setInfoTab(t.id as typeof infoTab)}
                className={`-mb-px cursor-pointer border-b-2 px-3 py-3 text-xs font-medium transition ${
                  infoTab === t.id
                    ? "border-[#171717] text-[#171717]"
                    : "border-transparent text-[#6B6B6B] hover:text-[#171717]"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="p-6">
            {infoTab === "details" && (
              <div>
                <h2 className="text-base text-[#171717]">Description</h2>
                <p className="mt-2.5 text-sm text-[#6B6B6B]">{product.description}</p>

                <h3 className="mt-6 text-sm text-[#171717]">Specifications</h3>
                <dl className="mt-3 divide-y divide-[#F0F1F2] border-t border-[#F0F1F2] text-xs">
                  {Object.entries(product.specs).map(([key, val]) => (
                    <div
                      key={key}
                      className="grid grid-cols-1 gap-1 py-2.5 sm:grid-cols-3"
                    >
                      <dt className="text-[#6B6B6B]">{key}</dt>
                      <dd className="text-[#171717] sm:col-span-2">{val}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}

            {infoTab === "delivery" && (
              <div className="divide-y divide-[#F0F1F2] text-sm">
                <div className="pb-4">
                  <p className="flex items-center gap-2 text-xs font-medium text-[#171717]">
                    <Truck className="h-4 w-4 text-[#6B6B6B]" />
                    Delivery &amp; fulfillment
                  </p>
                  <p className="mt-1.5 text-xs text-[#6B6B6B]">
                    {product.deliveryInfo}
                  </p>
                </div>
                <div className="py-4">
                  <p className="flex items-center gap-2 text-xs font-medium text-[#171717]">
                    <RotateCcw className="h-4 w-4 text-[#6B6B6B]" />
                    Refund &amp; return policy
                  </p>
                  <p className="mt-1.5 text-xs text-[#6B6B6B]">
                    {product.refundConditions}
                  </p>
                </div>
                {product.escrowEligible && (
                  <div className="pt-4">
                    <p className="flex items-center gap-2 text-xs font-medium text-[#167A67]">
                      <ShieldCheck className="h-4 w-4" />
                      Escrow release conditions
                    </p>
                    <p className="mt-1.5 text-xs text-[#6B6B6B]">
                      {product.escrowConditions}
                    </p>
                  </div>
                )}
              </div>
            )}

            {infoTab === "reviews" && (
              <div>
                {reviews.length === 0 ? (
                  <p className="text-xs text-[#6B6B6B]">
                    No verified buyer reviews yet. Reviews unlock once an order
                    for this listing is delivered or completed.
                  </p>
                ) : (
                  <div className="divide-y divide-[#F0F1F2]">
                    {reviews.map((rev) => (
                      <div key={rev.id} className="py-3.5 first:pt-0">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-[#171717]">{rev.buyerName}</span>
                          <span className="font-mono-light inline-flex items-center gap-1 text-[#315FC8]">
                            <Star className="h-3.5 w-3.5 fill-[#315FC8]" />
                            {rev.rating}/5
                          </span>
                        </div>
                        <p className="mt-1.5 text-xs text-[#6B6B6B]">
                          {rev.comment}
                        </p>
                        {rev.sellerReply && (
                          <p className="mt-2 border-l-2 border-[#E5E7EB] pl-3 text-xs text-[#6B6B6B]">
                            <span className="text-[#171717]">Seller reply: </span>
                            {rev.sellerReply}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <form
                  onSubmit={handleSubmitReview}
                  className="mt-5 border-t border-[#E5E7EB] pt-5"
                >
                  <p className="text-xs font-medium text-[#171717]">
                    Write a review (verified orders only)
                  </p>
                  <div className="mt-2.5 flex items-center gap-2">
                    <label htmlFor="review-rating" className="text-xs text-[#6B6B6B]">
                      Rating
                    </label>
                    <select
                      id="review-rating"
                      value={reviewRating}
                      onChange={(e) => setReviewRating(Number(e.target.value))}
                      className="h-9 rounded-lg border border-[#E5E7EB] bg-white px-2.5 text-xs"
                    >
                      {[5, 4, 3, 2, 1].map((n) => (
                        <option key={n} value={n}>
                          {n} / 5
                        </option>
                      ))}
                    </select>
                  </div>
                  <label htmlFor="review-comment" className="sr-only">
                    Write your review
                  </label>
                  <textarea
                    id="review-comment"
                    rows={3}
                    value={reviewText}
                    onChange={(e) => setReviewText(e.target.value)}
                    placeholder="Describe product quality, delivery accuracy, and seller responsiveness..."
                    className="mt-2.5 w-full rounded-lg border border-[#E5E7EB] bg-[#F7F7F5] p-3 text-xs text-[#171717]"
                  />
                  <button
                    type="submit"
                    className="mt-2.5 h-9 cursor-pointer rounded-lg bg-[#315FC8] px-4 text-xs font-medium text-white hover:bg-[#274EA6]"
                  >
                    Submit Review
                  </button>
                  {reviewNotice && (
                    <p role="status" className="mt-2 text-xs text-[#315FC8]">
                      {reviewNotice}
                    </p>
                  )}
                </form>
              </div>
            )}

            {infoTab === "discussions" && (
              <div>
                {discussions.length === 0 ? (
                  <p className="text-xs text-[#6B6B6B]">
                    No community threads reference this listing yet.{" "}
                    <Link href="/community" className="text-[#315FC8] hover:underline">
                      Start a discussion
                    </Link>
                  </p>
                ) : (
                  <div className="divide-y divide-[#F0F1F2]">
                    {discussions.map((post) => (
                      <Link
                        key={post.id}
                        href="/community"
                        className="block py-3 first:pt-0 hover:text-[#315FC8]"
                      >
                        <p className="text-xs text-[#6B6B6B]">{post.authorName}</p>
                        <p className="mt-0.5 text-sm text-[#171717]">{post.title}</p>
                        <p className="mt-1 line-clamp-2 text-xs text-[#6B6B6B]">
                          {post.body}
                        </p>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-14 border-t border-[#E5E7EB] pt-8">
          <h2 className="text-lg text-[#171717]">Related listings</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((item) => (
              <ProductCard key={item.id} product={item} />
            ))}
          </div>
        </section>
      )}

      {recentlyViewedOthers.length > 0 && (
        <section className="mt-12 border-t border-[#E5E7EB] pt-8">
          <h2 className="text-lg text-[#171717]">Recently viewed</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {recentlyViewedOthers.map((item) => (
              <ProductCard key={item.id} product={item} />
            ))}
          </div>
        </section>
      )}

      {/* Sticky Mobile Buy Bar (above mobile bottom nav) */}
      <div className="fixed right-0 bottom-[57px] left-0 z-30 border-t border-[#E5E7EB] bg-white/[0.97] px-4 py-2.5 backdrop-blur-md lg:hidden">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-base-black text-lg leading-none text-[#171717]">
              {formatUsd(effectivePrice * quantity)}
            </p>
            <p className="mt-0.5 truncate text-[11px] text-[#6B6B6B]">
              {activeVariation ? activeVariation.label : product.productType}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              disabled={availableStock === 0}
              onClick={handleBuyNow}
              className="h-10 cursor-pointer rounded-lg border border-[#171717] bg-white px-3.5 text-xs font-medium text-[#171717] hover:bg-[#F7F7F5] disabled:opacity-50"
            >
              Buy Now
            </button>
            <button
              type="button"
              disabled={availableStock === 0}
              onClick={handleAddToCart}
              className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-lg bg-[#315FC8] px-4 text-xs font-medium text-white hover:bg-[#274EA6] disabled:opacity-50"
            >
              <ShoppingBag aria-hidden="true" className="h-3.5 w-3.5" />
              Add to Cart
            </button>
          </div>
        </div>
      </div>

      {lightboxOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Expanded product image"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#171717]/80 p-4 backdrop-blur-sm"
          onClick={() => setLightboxOpen(false)}
        >
          <div
            className="relative w-full max-w-4xl overflow-hidden rounded-2xl bg-[#F2F2EF]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setLightboxOpen(false)}
              aria-label="Close expanded image"
              className="absolute top-3 right-3 z-10 flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg bg-white text-[#171717] shadow"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="relative aspect-[4/3] w-full">
              <Image
                src={activeFrame.src}
                alt={`${product.title}, ${activeFrame.label}`}
                fill
                sizes="(max-width: 1024px) 100vw, 896px"
                style={{
                  objectPosition: activeFrame.objectPosition,
                  transform: `scale(${activeFrame.zoomScale})`,
                }}
                className="object-cover"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
