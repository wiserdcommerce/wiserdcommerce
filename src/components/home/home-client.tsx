"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  ArrowRight,
  MessageSquare,
  BadgeCheck,
  ShieldCheck,
  Wallet,
  Store as StoreIcon,
} from "lucide-react";
import { TechScrambleHeadline } from "@/components/motion/motion-primitives";
import { ProductCard, type EnrichedProduct } from "@/components/marketplace/product-card";
import { EmptyState } from "@/components/ui/state-blocks";
import { useWiserd } from "@/components/providers/wiserd-provider";
import type { CommunityPost, DiscussionRoom, Store } from "@/lib/types";

interface HomeClientProps {
  products: EnrichedProduct[];
  stores: Array<Store & { listingCount: number; rating: number | null; reviewCount: number }>;
  posts: Array<
    CommunityPost & {
      attachedProduct?: {
        id: string;
        slug: string;
        title: string;
        priceCents: number;
      } | null;
      commentCount: number;
    }
  >;
  rooms: DiscussionRoom[];
}

const CATEGORY_TABS = [
  { id: "all", label: "All listings" },
  { id: "physical", label: "Physical" },
  { id: "digital", label: "Digital" },
  { id: "gaming", label: "Gaming" },
  { id: "services", label: "Services" },
] as const;

/**
 * Editorial, Anti-AI-Slop Ecommerce Homepage.
 * - Zero oversized marketing hero box, zero decorative blur blobs, zero nested cards-in-cards
 * - Immediate access to search, category filtering, and real product photography in the first viewport
 */
export function HomeClient({ products, stores, posts }: HomeClientProps) {
  const router = useRouter();
  const { recentlyViewedIds, recentSearches, recordSearch } = useWiserd();
  const [query, setQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>("all");

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return products
      .filter((p) =>
        `${p.title} ${p.category} ${p.productType} ${p.store?.name || ""}`
          .toLowerCase()
          .includes(q)
      )
      .slice(0, 5);
  }, [query, products]);

  const filteredCatalog = useMemo(() => {
    if (activeCategory === "all") return products;
    return products.filter((p) => p.category === activeCategory);
  }, [products, activeCategory]);

  const featuredProducts = useMemo(() => {
    const featured = filteredCatalog.filter((p) => p.featured);
    return (featured.length >= 4 ? featured : filteredCatalog).slice(0, 4);
  }, [filteredCatalog]);

  const recentProducts = useMemo(() => {
    const featuredIds = new Set(featuredProducts.map((p) => p.id));
    const remaining = [...filteredCatalog]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .filter((p) => !featuredIds.has(p.id));
    return (remaining.length >= 4 ? remaining : filteredCatalog).slice(0, 4);
  }, [filteredCatalog, featuredProducts]);

  const popularProducts = useMemo(
    () =>
      [...products]
        .sort((a, b) => b.views - a.views || b.popularScore - a.popularScore)
        .slice(0, 4),
    [products]
  );

  const recentlyViewedProducts = useMemo(() => {
    if (recentlyViewedIds.length === 0) return [];
    const map = new Map(products.map((p) => [p.id, p]));
    return recentlyViewedIds
      .map((id) => map.get(id))
      .filter((p): p is EnrichedProduct => Boolean(p))
      .slice(0, 4);
  }, [recentlyViewedIds, products]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (q) recordSearch(q);
    router.push(q ? `/marketplace?q=${encodeURIComponent(q)}` : "/marketplace");
  };

  return (
    <div className="mx-auto max-w-[1320px] px-4 sm:px-6 lg:px-8">
      {/* Quiet, Direct Marketplace Header — Directly on #F7F7F5 Canvas */}
      <section className="border-b border-[#E5E7EB] pt-7 pb-6 sm:pt-9 sm:pb-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-xl">
            <TechScrambleHeadline
              text="Discover more. Shop independently."
              className="text-[28px] text-[#171717] sm:text-[36px] lg:text-[40px]"
            />
            <p className="mt-2 text-sm text-[#6B6B6B]">
              Physical hardware, digital tools, gaming gear, and studio services
              from independent sellers.
            </p>
          </div>

          {/* Inline Search + Direct Marketplace Actions */}
          <div className="flex w-full flex-col gap-2.5 sm:flex-row sm:items-center lg:max-w-[560px]">
            <div className="relative flex-1">
              <form
                onSubmit={handleSearch}
                className="flex h-10 items-center rounded-lg border border-[#E5E7EB] bg-white px-3 transition focus-within:border-[#315FC8]"
              >
                <Search aria-hidden="true" className="h-4 w-4 shrink-0 text-[#6B6B6B]" />
                <label htmlFor="hero-marketplace-search" className="sr-only">
                  Search WISERD marketplace
                </label>
                <input
                  id="hero-marketplace-search"
                  type="search"
                  value={query}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => window.setTimeout(() => setSearchFocused(false), 180)}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search products, stores, or categories..."
                  className="h-full w-full bg-transparent pl-2.5 text-sm text-[#171717] placeholder:text-[#6B6B6B] focus:outline-none"
                />
              </form>

              {searchFocused && (suggestions.length > 0 || (!query.trim() && recentSearches.length > 0)) && (
                <div className="absolute right-0 left-0 z-30 mt-1.5 overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-sm">
                  {!query.trim() && recentSearches.length > 0 ? (
                    <div className="p-2.5">
                      <p className="type-meta px-1.5 pb-1.5">
                        Recent searches
                      </p>
                      <div className="space-y-0.5">
                        {recentSearches.map((term) => (
                          <button
                            key={term}
                            type="button"
                            onMouseDown={() => {
                              setQuery(term);
                              router.push(`/marketplace?q=${encodeURIComponent(term)}`);
                            }}
                            className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-[#171717] hover:bg-[#F7F7F5]"
                          >
                            <Search aria-hidden="true" className="h-3 w-3 text-[#6B6B6B]" />
                            {term}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    suggestions.map((item) => (
                      <Link
                        key={item.id}
                        href={`/products/${item.slug}`}
                        className="flex items-center justify-between gap-3 border-b border-[#F0F1F2] px-3.5 py-2.5 text-xs last:border-none hover:bg-[#F7F7F5]"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium text-[#171717]">
                            {item.title}
                          </p>
                          <p className="text-[#6B6B6B]">{item.store?.name}</p>
                        </div>
                        <span className="type-price shrink-0 text-sm">
                          ${(item.priceCents / 100).toFixed(0)}
                        </span>
                      </Link>
                    ))
                  )}
                </div>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <Link
                href="/marketplace"
                className="inline-flex h-10 items-center rounded-lg bg-[#315FC8] px-4 text-xs font-medium whitespace-nowrap text-white transition hover:bg-[#274EA6]"
              >
                Explore
              </Link>
              <Link
                href="/sell"
                className="inline-flex h-10 items-center rounded-lg border border-[#E5E7EB] bg-white px-4 text-xs font-medium whitespace-nowrap text-[#171717] transition hover:border-[#171717]/30"
              >
                Open Store
              </Link>
            </div>
          </div>
        </div>

        {/* Flat Editorial Category Strip (Wraps cleanly on mobile) */}
        <div className="mt-5 flex flex-wrap items-center gap-2">
          {CATEGORY_TABS.map((tab) => {
            const count =
              tab.id === "all"
                ? products.length
                : products.filter((p) => p.category === tab.id).length;
            const active = activeCategory === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                aria-pressed={active}
                onClick={() => setActiveCategory(tab.id)}
                className={`inline-flex min-h-[36px] shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg border px-3 text-xs transition ${
                  active
                    ? "border-[#171717] bg-[#171717] text-white"
                    : "border-[#E5E7EB] bg-white text-[#6B6B6B] hover:border-[#171717]/30 hover:text-[#171717]"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`font-mono-light text-xs ${
                    active ? "text-white/80" : "text-[#6B6B6B]"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Featured Products (or Clean Day-1 Launch State when catalog is empty) */}
      <section aria-labelledby="featured-heading" className="pt-7">
        {products.length === 0 ? (
          <div className="pt-2">
            <h2 id="featured-heading" className="sr-only">
              Marketplace catalog
            </h2>
            <EmptyState
              icon={StoreIcon}
              title="Be the first seller on WISERD"
              description="No listings have been published yet. Open your independent store to list physical hardware, digital tools, gaming gear, or studio services."
              action={
                <div className="flex flex-wrap items-center justify-center gap-2.5">
                  <Link
                    href="/sell"
                    className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-[#315FC8] px-4 text-xs font-medium text-white transition hover:bg-[#274EA6]"
                  >
                    Open Store <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
                  </Link>
                  <Link
                    href="/community"
                    className="inline-flex h-10 items-center rounded-lg border border-[#E5E7EB] bg-white px-4 text-xs font-medium text-[#171717] transition hover:border-[#171717]/30"
                  >
                    Join Community
                  </Link>
                </div>
              }
            />
          </div>
        ) : (
          <>
            <div className="flex items-baseline justify-between gap-4">
              <h2 id="featured-heading" className="text-xl text-[#171717]">
                {activeCategory === "all"
                  ? "Featured products"
                  : `${CATEGORY_TABS.find((t) => t.id === activeCategory)?.label || "Filtered"} products`}
              </h2>
              <Link
                href={
                  activeCategory === "all"
                    ? "/marketplace"
                    : `/marketplace?category=${activeCategory}`
                }
                className="inline-flex items-center gap-1 text-xs font-medium text-[#315FC8] hover:underline"
              >
                View all <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
              </Link>
            </div>

            {(activeCategory === "all" ? featuredProducts : filteredCatalog).length === 0 ? (
              <div className="mt-4">
                <EmptyState
                  icon={StoreIcon}
                  title="No listings in this category yet"
                  description="Switch back to all listings or open a store to publish the first item here."
                  action={
                    <button
                      type="button"
                      onClick={() => setActiveCategory("all")}
                      className="inline-flex h-9 cursor-pointer items-center rounded-lg border border-[#E5E7EB] bg-white px-3.5 text-xs font-medium text-[#171717] hover:border-[#171717]/30"
                    >
                      View all listings
                    </button>
                  }
                />
              </div>
            ) : (
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {(activeCategory === "all" ? featuredProducts : filteredCatalog).map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            )}
          </>
        )}
      </section>

      {/* Recently Added */}
      {activeCategory === "all" && recentProducts.length > 0 && (
        <section aria-labelledby="recent-heading" className="pt-12">
          <div className="flex items-baseline justify-between gap-4">
            <h2 id="recent-heading" className="text-xl text-[#171717]">
              Recently added
            </h2>
            <Link
              href="/marketplace?sort=newest"
              className="inline-flex items-center gap-1 text-xs font-medium text-[#315FC8] hover:underline"
            >
              Newest first <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {recentProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}

      {/* Popular Listings */}
      {popularProducts.length > 0 && (
        <section aria-labelledby="popular-heading" className="pt-12">
          <div className="flex items-baseline justify-between gap-4">
            <h2 id="popular-heading" className="text-xl text-[#171717]">
              Popular listings
            </h2>
            <Link
              href="/marketplace?sort=popular"
              className="inline-flex items-center gap-1 text-xs font-medium text-[#315FC8] hover:underline"
            >
              Browse catalog <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {popularProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}

      {/* Recently Viewed (Displayed only once real product views exist) */}
      {recentlyViewedProducts.length > 0 && (
        <section aria-labelledby="recently-viewed-heading" className="pt-12">
          <div className="flex items-baseline justify-between gap-4">
            <h2 id="recently-viewed-heading" className="text-xl text-[#171717]">
              Recently viewed
            </h2>
            <Link
              href="/marketplace"
              className="inline-flex items-center gap-1 text-xs font-medium text-[#315FC8] hover:underline"
            >
              Continue browsing <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {recentlyViewedProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}

      {/* Independent Seller Storefronts */}
      {stores.length > 0 && (
      <section aria-labelledby="stores-heading" className="pt-12">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="stores-heading" className="text-xl text-[#171717]">
            Independent stores
          </h2>
          <Link
            href="/sell"
            className="inline-flex items-center gap-1 text-xs font-medium text-[#315FC8] hover:underline"
          >
            Sell on WISERD <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {stores.map((store) => (
            <Link
              key={store.id}
              href={`/stores/${store.slug}`}
              className="group flex flex-col rounded-xl border border-[#E5E7EB] bg-white p-4 transition-colors hover:border-[#171717]/25"
            >
              <div className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-medium text-white"
                  style={{ backgroundColor: store.accentColor }}
                >
                  {store.initials}
                </span>
                <div className="min-w-0">
                  <h3 className="truncate text-sm text-[#171717] group-hover:text-[#315FC8]">
                    {store.name}
                  </h3>
                  <p className="font-mono-light text-xs text-[#6B6B6B]">
                    {store.listingCount} listings
                  </p>
                </div>
              </div>
              <p className="mt-2.5 line-clamp-2 text-xs text-[#6B6B6B]">
                {store.tagline}
              </p>
              <div className="mt-auto flex items-center justify-between border-t border-[#F0F1F2] pt-3 text-xs">
                {store.verificationStatus === "verified" ? (
                  <span className="inline-flex items-center gap-1 text-[#167A67]">
                    <BadgeCheck aria-hidden="true" className="h-3.5 w-3.5" />
                    Verified
                  </span>
                ) : (
                  <span className="text-[#6B6B6B]">Pending review</span>
                )}
                <span className="text-[#6B6B6B]">{store.responseTimeLabel}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>
      )}

      {/* Community Discussions */}
      {posts.length > 0 && (
      <section aria-labelledby="community-heading" className="pt-12">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="community-heading" className="text-xl text-[#171717]">
            Community discussions
          </h2>
          <Link
            href="/community"
            className="inline-flex items-center gap-1 text-xs font-medium text-[#315FC8] hover:underline"
          >
            All discussions <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          {posts.slice(0, 3).map((post) => (
            <article
              key={post.id}
              className="flex flex-col rounded-xl border border-[#E5E7EB] bg-white p-4"
            >
              <div className="flex items-center justify-between gap-2 text-xs text-[#6B6B6B]">
                <span className="text-[#171717]">{post.authorName}</span>
                <span className="type-meta capitalize">
                  {post.postType.replace("_", " ")}
                </span>
              </div>
              <Link
                href="/community"
                className="mt-2 text-sm text-[#171717] hover:text-[#315FC8]"
              >
                {post.title}
              </Link>
              <p className="mt-1 line-clamp-2 text-xs text-[#6B6B6B]">
                {post.body}
              </p>

              {post.attachedProduct && (
                <Link
                  href={`/products/${post.attachedProduct.slug}`}
                  className="mt-3 flex items-center justify-between gap-2 rounded-lg border border-[#E5E7EB] bg-[#F7F7F5] px-3 py-2 text-xs hover:border-[#171717]/25"
                >
                  <span className="truncate text-[#171717]">
                    {post.attachedProduct.title}
                  </span>
                  <span className="type-price shrink-0 text-xs">
                    ${(post.attachedProduct.priceCents / 100).toFixed(0)}
                  </span>
                </Link>
              )}

              <div className="mt-auto flex items-center justify-between pt-3 text-xs text-[#6B6B6B]">
                <span className="inline-flex items-center gap-1">
                  <MessageSquare aria-hidden="true" className="h-3.5 w-3.5" />
                  {post.commentCount} {post.commentCount === 1 ? "reply" : "replies"}
                </span>
                <Link href="/community" className="text-[#315FC8] hover:underline">
                  Read thread
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>
      )}

      {/* Quiet Functional Utility Bar */}
      <section className="mt-12 border-t border-[#E5E7EB] py-6">
        <div className="grid grid-cols-1 gap-4 text-xs text-[#6B6B6B] sm:grid-cols-3">
          <div className="flex items-start gap-2.5">
            <ShieldCheck aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-[#6B6B6B]" />
            <div>
              <p className="text-[#171717]">Structured escrow workflows</p>
              <p className="mt-0.5">
                Orders track payment confirmation, delivery, buyer review, and disputes.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <MessageSquare aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-[#6B6B6B]" />
            <div>
              <p className="text-[#171717]">Direct seller messaging</p>
              <p className="mt-0.5">
                Ask questions directly from any listing or active order page.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <Wallet aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-[#6B6B6B]" />
            <div>
              <p className="text-[#171717]">Optional wallet controls</p>
              <p className="mt-0.5">
                Separate from Google sign-in.{" "}
                <Link href="/wallet" className="text-[#315FC8] hover:underline">
                  Manage wallet
                </Link>
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
