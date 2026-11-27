"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  BadgeCheck,
  ChevronRight,
  MessageSquare,
  UserPlus,
  UserCheck,
  Truck,
  RotateCcw,
  Star,
  Store as StoreIcon,
  Settings,
} from "lucide-react";
import { useWiserd } from "@/components/providers/wiserd-provider";
import { ProductCard, type EnrichedProduct } from "@/components/marketplace/product-card";
import {
  CatalogGridSkeleton,
  EmptyState,
  StatusBanner,
} from "@/components/ui/state-blocks";
import type { Review, Store } from "@/lib/types";

interface StoreResponse {
  store: Store & {
    rating: number | null;
    reviewCount: number;
    listingCount: number;
  };
  listings: EnrichedProduct[];
  reviews: Review[];
}

export default function StorefrontClient() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const { user, toggleFollowStore, openGoogleAuthModal } = useWiserd();
  const [data, setData] = useState<StoreResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [contactBusy, setContactBusy] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const loadStore = useCallback(async () => {
    if (!params?.slug) return;
    try {
      const res = await fetch(
        `/api/stores?slug=${encodeURIComponent(params.slug)}`,
        { cache: "no-store" }
      );
      if (res.ok) {
        const json = await res.json();
        setData(json);
      } else {
        setData(null);
      }
    } finally {
      setLoading(false);
    }
  }, [params?.slug]);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) loadStore();
    });
    return () => {
      active = false;
    };
  }, [loadStore]);

  if (loading) {
    return <CatalogGridSkeleton count={3} />;
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-[1320px] px-4 py-20 text-center">
        <h1 className="text-2xl font-medium text-[#171717]">Store not found</h1>
        <p className="mt-2 text-sm text-[#6B6B6B]">
          This storefront may have moved or is no longer active.
        </p>
        <Link
          href="/marketplace"
          className="mt-5 inline-flex h-10 items-center rounded-lg bg-[#315FC8] px-5 text-xs font-medium text-white hover:bg-[#274EA6]"
        >
          Explore Marketplace
        </Link>
      </div>
    );
  }

  const { store, listings, reviews } = data;
  const isOwner = Boolean(user && user.id === store.ownerId);
  const isFollowing = Boolean(user?.followedStoreIds.includes(store.id));

  const handleFollow = async () => {
    setFollowBusy(true);
    setNotice(null);
    try {
      await toggleFollowStore(store.id);
      await loadStore();
    } finally {
      setFollowBusy(false);
    }
  };

  const handleContactStore = async () => {
    if (!user) {
      openGoogleAuthModal();
      return;
    }
    setContactBusy(true);
    setNotice(null);
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start_or_send", storeId: store.id }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.conversation?.id) {
        router.push(`/messages?conversation=${json.conversation.id}`);
      } else {
        setNotice(json.error || "Could not open conversation with this seller.");
      }
    } catch {
      setNotice("Connection lost while opening seller conversation.");
    } finally {
      setContactBusy(false);
    }
  };

  const gridColsClass =
    listings.length <= 3
      ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
      : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4";

  return (
    <div className="mx-auto max-w-[1320px] space-y-8 px-4 pt-6 sm:px-6 lg:px-8">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-[#6B6B6B]">
        <Link href="/marketplace" className="hover:text-[#171717]">
          Marketplace
        </Link>
        <ChevronRight aria-hidden="true" className="h-3.5 w-3.5" />
        <span className="truncate text-[#171717]">{store.name}</span>
      </nav>

      <section className="overflow-hidden rounded-xl border border-[#E5E7EB] bg-white">
        <div className="h-16 w-full border-b border-[#F0F1F2] bg-[#F7F7F5] sm:h-20" />
        <div className="px-5 pb-6 sm:px-8">
          <div className="-mt-8 flex flex-col gap-5 sm:-mt-10 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-4">
              <span
                aria-hidden="true"
                className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border-4 border-white text-xl font-medium text-white shadow-sm sm:h-20 sm:w-20 sm:text-2xl"
                style={{ backgroundColor: store.accentColor }}
              >
                {store.initials}
              </span>
              <div className="min-w-0 sm:pb-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-medium tracking-tight text-[#171717] sm:text-3xl">
                    {store.name}
                  </h1>
                  <span
                    className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md px-2.5 py-0.5 text-xs font-medium ${
                      store.verificationStatus === "verified"
                        ? "bg-[#167A67]/12 text-[#167A67]"
                        : store.verificationStatus === "action_required"
                          ? "bg-[#B45309]/12 text-[#B45309]"
                          : "bg-[#F0F1F2] text-[#6B6B6B]"
                    }`}
                  >
                    {store.verificationStatus === "verified" && (
                      <BadgeCheck aria-hidden="true" className="h-3.5 w-3.5" />
                    )}
                    {store.verificationStatus === "verified"
                      ? "Verified Store"
                      : store.verificationStatus === "action_required"
                        ? "Under Review"
                        : "Pending Verification"}
                  </span>
                </div>
                <p className="mt-1 text-sm text-[#6B6B6B]">{store.tagline}</p>
                <p className="font-mono-light mt-1.5 text-xs text-[#6B6B6B]">
                  {store.followerCount} {store.followerCount === 1 ? "follower" : "followers"}
                  {" · "}
                  {listings.length} {listings.length === 1 ? "listing" : "listings"}
                  {" · "}
                  {store.responseTimeLabel}
                </p>
              </div>
            </div>

            {isOwner ? (
              <div className="flex shrink-0 items-center gap-2">
                <Link
                  href="/sell"
                  className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#315FC8] px-5 text-xs font-medium text-white transition hover:bg-[#274EA6] sm:w-auto"
                >
                  <Settings aria-hidden="true" className="h-4 w-4" />
                  Manage Store
                </Link>
              </div>
            ) : (
              <div className="grid shrink-0 grid-cols-2 gap-2.5 sm:flex sm:items-center">
                <button
                  type="button"
                  disabled={followBusy}
                  onClick={handleFollow}
                  aria-pressed={isFollowing}
                  className={`inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg px-4 text-xs font-medium whitespace-nowrap transition disabled:opacity-60 sm:px-5 ${
                    isFollowing
                      ? "border border-[#315FC8] bg-[#315FC8]/10 text-[#315FC8]"
                      : "bg-[#315FC8] text-white hover:bg-[#274EA6]"
                  }`}
                >
                  {isFollowing ? (
                    <>
                      <UserCheck aria-hidden="true" className="h-4 w-4 shrink-0" />
                      Following
                    </>
                  ) : (
                    <>
                      <UserPlus aria-hidden="true" className="h-4 w-4 shrink-0" />
                      Follow Store
                    </>
                  )}
                </button>
                <button
                  type="button"
                  disabled={contactBusy}
                  onClick={handleContactStore}
                  className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border border-[#E5E7EB] bg-[#F7F7F5] px-4 text-xs font-medium whitespace-nowrap text-[#171717] transition hover:border-[#171717]/30 disabled:opacity-60 sm:px-5"
                >
                  <MessageSquare aria-hidden="true" className="h-4 w-4 shrink-0 text-[#6B6B6B]" />
                  {contactBusy ? "Opening..." : "Contact Seller"}
                </button>
              </div>
            )}
          </div>

          {notice && (
            <div className="mt-4">
              <StatusBanner tone="error" message={notice} />
            </div>
          )}

          <p className="mt-5 max-w-3xl text-sm leading-relaxed text-[#6B6B6B]">
            {store.description}
          </p>

          <div className="mt-6 grid grid-cols-1 gap-4 border-t border-[#E5E7EB] pt-5 md:grid-cols-3">
            <div className="flex items-start gap-2.5 text-xs">
              <Truck aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-[#6B6B6B]" />
              <div>
                <p className="font-medium text-[#171717]">Delivery &amp; Shipping Policy</p>
                <p className="mt-0.5 leading-relaxed text-[#6B6B6B]">{store.shippingPolicy}</p>
              </div>
            </div>
            <div className="flex items-start gap-2.5 text-xs">
              <RotateCcw aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-[#6B6B6B]" />
              <div>
                <p className="font-medium text-[#171717]">Refund &amp; Return Policy</p>
                <p className="mt-0.5 leading-relaxed text-[#6B6B6B]">{store.refundPolicy}</p>
              </div>
            </div>
            <div className="flex items-start gap-2.5 text-xs">
              <Star aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-[#6B6B6B]" />
              <div>
                <p className="font-medium text-[#171717]">Store Reputation</p>
                <p className="mt-0.5 leading-relaxed text-[#6B6B6B]">
                  {store.rating
                    ? `${store.rating} / 5 across ${store.reviewCount} verified ${store.reviewCount === 1 ? "review" : "reviews"}`
                    : "No verified buyer reviews yet"}
                  {" · "}
                  {store.responseTimeLabel}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="flex items-baseline gap-2 text-xl text-[#171717]">
            <span>Listings</span>
            <span className="font-mono-light text-sm text-[#6B6B6B]">{listings.length}</span>
          </h2>
          {listings.length > 0 && (
            <Link
              href={`/marketplace?store=${encodeURIComponent(store.slug)}`}
              className="text-xs font-medium text-[#315FC8] hover:underline"
            >
              Filter in Marketplace
            </Link>
          )}
        </div>

        {listings.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              icon={StoreIcon}
              title="No published listings yet"
              description={
                isOwner
                  ? "Publish your first product from your Seller Dashboard to start receiving orders."
                  : "This store hasn't published active listings yet. Check back soon or follow the store."
              }
              action={
                isOwner ? (
                  <Link
                    href="/sell"
                    className="inline-flex h-9 items-center rounded-lg bg-[#315FC8] px-4 text-xs font-medium text-white hover:bg-[#274EA6]"
                  >
                    Publish Listing
                  </Link>
                ) : undefined
              }
            />
          </div>
        ) : (
          <div className={`mt-4 grid gap-5 ${gridColsClass}`}>
            {listings.map((item) => (
              <ProductCard
                key={item.id}
                product={{
                  ...item,
                  store: {
                    id: store.id,
                    slug: store.slug,
                    name: store.name,
                    initials: store.initials,
                    accentColor: store.accentColor,
                    verificationStatus: store.verificationStatus,
                    responseTimeLabel: store.responseTimeLabel,
                  },
                }}
              />
            ))}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-[#E5E7EB] bg-white p-6">
        <h2 className="flex items-baseline gap-2 text-lg text-[#171717]">
          <span>Customer Reviews</span>
          <span className="font-mono-light text-sm text-[#6B6B6B]">{reviews.length}</span>
        </h2>
        {reviews.length === 0 ? (
          <p className="mt-2 text-xs text-[#6B6B6B]">
            This storefront has no verified customer reviews yet.
          </p>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            {reviews.map((rev) => (
              <div
                key={rev.id}
                className="rounded-xl bg-[#F7F7F5] p-4"
              >
                <div className="flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-[#171717]">{rev.buyerName}</span>
                    <span className="font-mono-light text-[11px] text-[#6B6B6B]">
                      {new Date(rev.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <span className="font-mono-light text-[#315FC8]">{rev.rating}/5</span>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-[#171717]">{rev.comment}</p>
                {rev.sellerReply && (
                  <p className="mt-2 border-l-2 border-[#E5E7EB] pl-3 text-xs text-[#6B6B6B]">
                    <span className="font-medium text-[#171717]">Seller reply: </span>
                    {rev.sellerReply}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
