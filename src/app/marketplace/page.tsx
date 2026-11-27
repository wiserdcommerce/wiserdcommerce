"use client";

import React, { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Search,
  SlidersHorizontal,
  X,
  RotateCcw,
  Heart,
  ShieldCheck,
} from "lucide-react";
import { ProductCard, type EnrichedProduct } from "@/components/marketplace/product-card";
import { useWiserd } from "@/components/providers/wiserd-provider";

const CATEGORY_OPTIONS = [
  { id: "", label: "All listings" },
  { id: "physical", label: "Physical" },
  { id: "digital", label: "Digital" },
  { id: "gaming", label: "Gaming" },
  { id: "services", label: "Services" },
];

const AVAILABILITY_OPTIONS = [
  { id: "", label: "Any availability" },
  { id: "in_stock", label: "In stock" },
  { id: "limited", label: "Limited stock" },
  { id: "made_to_order", label: "Made to order" },
];

const SORT_OPTIONS = [
  { id: "popular", label: "Most popular" },
  { id: "newest", label: "Newest" },
  { id: "price_asc", label: "Price: Low to high" },
  { id: "price_desc", label: "Price: High to low" },
  { id: "rating", label: "Highest rated" },
];

function ProductCardSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="overflow-hidden rounded-xl border border-[#E5E7EB] bg-white"
    >
      <div className="aspect-[4/3] w-full animate-pulse bg-[#F0F1F2]" />
      <div className="space-y-2.5 p-3.5">
        <div className="flex justify-between">
          <div className="h-3 w-24 animate-pulse rounded bg-[#F0F1F2]" />
          <div className="h-3 w-14 animate-pulse rounded bg-[#F0F1F2]" />
        </div>
        <div className="h-4 w-4/5 animate-pulse rounded bg-[#F0F1F2]" />
        <div className="flex justify-between pt-2">
          <div className="h-4 w-16 animate-pulse rounded bg-[#F0F1F2]" />
          <div className="h-3 w-12 animate-pulse rounded bg-[#F0F1F2]" />
        </div>
      </div>
    </div>
  );
}

function MarketplaceContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, recentlyViewedIds, recentSearches, recordSearch, openGoogleAuthModal } = useWiserd();

  const [q, setQ] = useState(searchParams.get("q") || "");
  const [category, setCategory] = useState(searchParams.get("category") || "");
  const [storeSlug, setStoreSlug] = useState(searchParams.get("store") || "");
  const [availability, setAvailability] = useState(searchParams.get("availability") || "");
  const [minPrice, setMinPrice] = useState(searchParams.get("minPrice") || "");
  const [maxPrice, setMaxPrice] = useState(searchParams.get("maxPrice") || "");
  const [escrowOnly, setEscrowOnly] = useState(searchParams.get("escrow") === "true");
  const [wishlistOnly, setWishlistOnly] = useState(false);
  const [sort, setSort] = useState(searchParams.get("sort") || "popular");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const [allCatalog, setAllCatalog] = useState<EnrichedProduct[]>([]);
  const [storesList, setStoresList] = useState<Array<{ slug: string; name: string }>>([]);
  const [products, setProducts] = useState<EnrichedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const priceRangeInvalid =
    minPrice !== "" &&
    maxPrice !== "" &&
    Number(minPrice) > Number(maxPrice);

  // Lock background scroll and allow Escape dismissal when mobile filter sheet is open
  useEffect(() => {
    if (!mobileFiltersOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileFiltersOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [mobileFiltersOpen]);

  // Sync filter & sort state into URL so reload, sharing, and Back navigation preserve filters
  useEffect(() => {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (category) params.set("category", category);
    if (storeSlug) params.set("store", storeSlug);
    if (availability) params.set("availability", availability);
    if (minPrice) params.set("minPrice", minPrice);
    if (maxPrice) params.set("maxPrice", maxPrice);
    if (escrowOnly) params.set("escrow", "true");
    if (sort && sort !== "popular") params.set("sort", sort);
    const qs = params.toString();
    const targetUrl = qs ? `/marketplace?${qs}` : "/marketplace";
    if (typeof window !== "undefined") {
      const currentUrl = `${window.location.pathname}${window.location.search}`;
      if (currentUrl !== targetUrl) {
        const t = window.setTimeout(() => {
          router.replace(targetUrl, { scroll: false });
        }, 180);
        return () => window.clearTimeout(t);
      }
    }
  }, [q, category, storeSlug, availability, minPrice, maxPrice, escrowOnly, sort, router]);

  // Fetch full published catalog + stores list once for counts, seller filter, and recently viewed
  useEffect(() => {
    Promise.all([
      fetch("/api/products", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/stores", { cache: "no-store" }).then((r) => r.json()),
    ])
      .then(([prodData, storeData]) => {
        setAllCatalog(prodData.products || []);
        setStoresList(
          (storeData.stores || []).map((s: { slug: string; name: string }) => ({
            slug: s.slug,
            name: s.name,
          }))
        );
      })
      .catch(() => {});
  }, []);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (category) params.set("category", category);
    if (storeSlug) params.set("store", storeSlug);
    if (availability) params.set("availability", availability);
    if (minPrice) params.set("minPrice", minPrice);
    if (maxPrice) params.set("maxPrice", maxPrice);
    if (escrowOnly) params.set("escrow", "true");
    if (sort) params.set("sort", sort);

    try {
      const res = await fetch(`/api/products?${params.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to load marketplace listings.");
      const data = await res.json();
      setProducts(data.products || []);
    } catch {
      setError("Could not load marketplace listings. Please retry.");
    } finally {
      setLoading(false);
    }
  }, [q, category, storeSlug, availability, minPrice, maxPrice, escrowOnly, sort]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadProducts();
    }, 100);
    return () => window.clearTimeout(timer);
  }, [loadProducts]);

  const displayedProducts = useMemo(() => {
    if (!wishlistOnly) return products;
    if (!user) return [];
    return products.filter((p) => user.favoriteProductIds.includes(p.id));
  }, [products, wishlistOnly, user]);

  const recentlyViewedProducts = useMemo(() => {
    if (recentlyViewedIds.length === 0 || allCatalog.length === 0) return [];
    const byId = new Map(allCatalog.map((p) => [p.id, p]));
    return recentlyViewedIds
      .map((id) => byId.get(id))
      .filter((p): p is EnrichedProduct => Boolean(p))
      .slice(0, 4);
  }, [recentlyViewedIds, allCatalog]);

  const resetFilters = () => {
    setQ("");
    setCategory("");
    setStoreSlug("");
    setAvailability("");
    setMinPrice("");
    setMaxPrice("");
    setEscrowOnly(false);
    setWishlistOnly(false);
    setSort("popular");
    router.replace("/marketplace");
  };

  const activeChips: Array<{ label: string; clear: () => void }> = [];
  if (q.trim()) activeChips.push({ label: `"${q.trim()}"`, clear: () => setQ("") });
  if (category) {
    const catLabel = CATEGORY_OPTIONS.find((c) => c.id === category)?.label || category;
    activeChips.push({ label: catLabel, clear: () => setCategory("") });
  }
  if (storeSlug) {
    const sLabel = storesList.find((s) => s.slug === storeSlug)?.name || storeSlug;
    activeChips.push({ label: `Store: ${sLabel}`, clear: () => setStoreSlug("") });
  }
  if (availability) {
    const aLabel =
      AVAILABILITY_OPTIONS.find((a) => a.id === availability)?.label || availability;
    activeChips.push({ label: aLabel, clear: () => setAvailability("") });
  }
  if (minPrice) activeChips.push({ label: `Min $${minPrice}`, clear: () => setMinPrice("") });
  if (maxPrice) activeChips.push({ label: `Max $${maxPrice}`, clear: () => setMaxPrice("") });
  if (escrowOnly) activeChips.push({ label: "Escrow eligible", clear: () => setEscrowOnly(false) });
  if (wishlistOnly) activeChips.push({ label: "Saved wishlist", clear: () => setWishlistOnly(false) });

  const FilterControls = (
    <div className="divide-y divide-[#E5E7EB]">
      <div className="pb-5">
        <p className="type-meta">
          Price range (USD)
        </p>
        <div className="mt-2.5 grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="min-price" className="text-xs text-[#6B6B6B]">
              Min
            </label>
            <input
              id="min-price"
              type="number"
              min="0"
              placeholder="0"
              aria-invalid={priceRangeInvalid}
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              className={`mt-1 h-10 w-full rounded-lg border bg-white px-2.5 text-sm text-[#171717] ${
                priceRangeInvalid ? "border-[#C81E1E]" : "border-[#E5E7EB]"
              }`}
            />
          </div>
          <div>
            <label htmlFor="max-price" className="text-xs text-[#6B6B6B]">
              Max
            </label>
            <input
              id="max-price"
              type="number"
              min="0"
              placeholder="500"
              aria-invalid={priceRangeInvalid}
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              className={`mt-1 h-10 w-full rounded-lg border bg-white px-2.5 text-sm text-[#171717] ${
                priceRangeInvalid ? "border-[#C81E1E]" : "border-[#E5E7EB]"
              }`}
            />
          </div>
        </div>
        {priceRangeInvalid && (
          <p role="alert" className="mt-2 text-xs text-[#C81E1E]">
            Minimum price cannot exceed maximum price.
          </p>
        )}
      </div>

      <div className="py-5">
        <label
          htmlFor="seller-filter"
          className="type-meta block"
        >
          Seller store
        </label>
        <select
          id="seller-filter"
          value={storeSlug}
          onChange={(e) => setStoreSlug(e.target.value)}
          className="mt-2 h-10 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-1.5 text-sm leading-normal text-[#171717]"
        >
          <option value="">All stores</option>
          {storesList.map((s) => (
            <option key={s.slug} value={s.slug}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      <div className="py-5">
        <label
          htmlFor="availability-filter"
          className="type-meta block"
        >
          Availability
        </label>
        <select
          id="availability-filter"
          value={availability}
          onChange={(e) => setAvailability(e.target.value)}
          className="mt-2 h-10 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-1.5 text-sm leading-normal text-[#171717]"
        >
          {AVAILABILITY_OPTIONS.map((opt) => (
            <option key={opt.id || "any"} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2.5 py-5">
        <p className="type-meta">
          Transaction &amp; saved
        </p>
        <label className="flex min-h-[36px] cursor-pointer items-center gap-2.5 text-xs text-[#171717]">
          <input
            type="checkbox"
            checked={escrowOnly}
            onChange={(e) => setEscrowOnly(e.target.checked)}
            className="h-4 w-4 rounded border-[#E5E7EB] accent-[#315FC8]"
          />
          <ShieldCheck aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-[#167A67]" />
          <span>Escrow-eligible listings only</span>
        </label>

        <button
          type="button"
          aria-pressed={wishlistOnly}
          onClick={() => {
            if (!user) {
              openGoogleAuthModal();
              return;
            }
            setWishlistOnly((prev) => !prev);
          }}
          className={`flex h-10 w-full cursor-pointer items-center justify-between rounded-lg border px-3 text-xs transition ${
            wishlistOnly
              ? "border-[#315FC8] bg-[#315FC8]/[0.07] text-[#315FC8]"
              : "border-[#E5E7EB] bg-white text-[#171717] hover:border-[#171717]/25"
          }`}
        >
          <span className="inline-flex items-center gap-2">
            <Heart
              aria-hidden="true"
              className={`h-3.5 w-3.5 shrink-0 ${wishlistOnly ? "fill-[#315FC8] text-[#315FC8]" : ""}`}
            />
            Saved wishlist
          </span>
          <span className="font-mono-light text-xs">
            {user ? user.favoriteProductIds.length : 0}
          </span>
        </button>
      </div>

      {activeChips.length > 0 && (
        <div className="pt-4">
          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex h-10 w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-3 text-xs text-[#171717] transition hover:border-[#171717]/30"
          >
            <RotateCcw aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
            Reset all filters
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="mx-auto max-w-[1320px] px-4 pt-7 sm:px-6 lg:px-8">
      {/* Editorial Header + Search & Sort */}
      <div className="border-b border-[#E5E7EB] pb-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl text-[#171717]">Marketplace</h1>
            <p className="mt-1.5 text-sm text-[#6B6B6B]">
              Browse independent storefronts across physical hardware, digital
              products, gaming gear, and services.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1 sm:w-72">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[#6B6B6B]"
              />
              <label htmlFor="marketplace-search-input" className="sr-only">
                Search listings
              </label>
              <input
                id="marketplace-search-input"
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && q.trim()) recordSearch(q);
                }}
                placeholder="Search products or stores..."
                className="h-10 w-full rounded-lg border border-[#E5E7EB] bg-white pr-9 pl-9 text-sm text-[#171717] placeholder:text-[#6B6B6B] focus:border-[#315FC8] focus:outline-none"
              />
              {q && (
                <button
                  type="button"
                  onClick={() => setQ("")}
                  aria-label="Clear search query"
                  className="absolute top-1/2 right-1.5 flex h-7 w-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-[#6B6B6B] transition hover:bg-[#F0F1F2] hover:text-[#171717]"
                >
                  <X aria-hidden="true" className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMobileFiltersOpen(true)}
                aria-label={
                  activeChips.length > 0
                    ? `Open filters (${activeChips.length} active)`
                    : "Open filters"
                }
                className="inline-flex h-10 cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg border border-[#E5E7EB] bg-white px-3.5 text-xs font-medium text-[#171717] lg:hidden"
              >
                <SlidersHorizontal aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                <span>Filters</span>
                {activeChips.length > 0 && (
                  <span className="font-mono-light inline-flex h-5 min-w-[20px] items-center justify-center rounded bg-[#315FC8] px-1 text-[11px] text-white">
                    {activeChips.length}
                  </span>
                )}
              </button>

              <label htmlFor="sort-select" className="sr-only">
                Sort products
              </label>
              <select
                id="sort-select"
                aria-label="Sort products"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="h-10 flex-1 rounded-lg border border-[#E5E7EB] bg-white px-3 py-1.5 text-xs leading-normal font-medium text-[#171717] sm:flex-initial"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    Sort: {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Horizontal Category Navigation Strip */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {CATEGORY_OPTIONS.map((opt) => {
              const count =
                opt.id === ""
                  ? allCatalog.length
                  : allCatalog.filter((p) => p.category === opt.id).length;
              const active = category === opt.id;
              return (
                <button
                  key={opt.id || "all"}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setCategory(opt.id)}
                  className={`inline-flex min-h-[36px] cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg border px-3 text-xs transition ${
                    active
                      ? "border-[#171717] bg-[#171717] text-white"
                      : "border-[#E5E7EB] bg-white text-[#6B6B6B] hover:border-[#171717]/30 hover:text-[#171717]"
                  }`}
                >
                  <span>{opt.label}</span>
                  {allCatalog.length > 0 && (
                    <span
                      className={`font-mono-light text-xs ${
                        active ? "text-white/80" : "text-[#6B6B6B]"
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {recentSearches.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="type-meta">
                Recent:
              </span>
              {recentSearches.slice(0, 3).map((term) => (
                <button
                  key={term}
                  type="button"
                  onClick={() => setQ(term)}
                  className="min-h-[32px] max-w-[180px] cursor-pointer truncate whitespace-nowrap rounded-md border border-[#E5E7EB] bg-white px-2.5 text-xs text-[#6B6B6B] transition hover:border-[#171717]/30 hover:text-[#171717]"
                >
                  {term}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Applied Filter Tags */}
      {activeChips.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="type-meta">
            Active:
          </span>
          {activeChips.map((chip) => (
            <button
              key={chip.label}
              type="button"
              onClick={chip.clear}
              aria-label={`Remove filter: ${chip.label}`}
              className="inline-flex min-h-[32px] max-w-[240px] cursor-pointer items-center gap-1.5 rounded-md border border-[#315FC8]/30 bg-white px-2.5 text-xs text-[#315FC8] transition hover:bg-[#315FC8] hover:text-white"
            >
              <span className="min-w-0 truncate whitespace-nowrap">{chip.label}</span>
              <X aria-hidden="true" className="h-3 w-3 shrink-0" />
            </button>
          ))}
        </div>
      )}

      {/* Main Two-Column Discovery Grid */}
      <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-12">
        <aside className="hidden lg:col-span-3 lg:block">
          <div className="sticky top-20 rounded-xl border border-[#E5E7EB] bg-white p-5">
            {FilterControls}
          </div>
        </aside>

        <div className="lg:col-span-9">
          <div className="mb-4 flex items-center justify-between text-xs text-[#6B6B6B]">
            <p
              role="status"
              aria-live="polite"
              aria-atomic="true"
              className="font-mono-light"
            >
              {loading
                ? "Loading catalog..."
                : `${displayedProducts.length} ${displayedProducts.length === 1 ? "listing" : "listings"}`}
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-xl border border-[#C81E1E]/25 bg-white p-5 text-sm text-[#C81E1E]"
            >
              <p>{error}</p>
              <button
                type="button"
                onClick={loadProducts}
                className="mt-3 h-9 cursor-pointer rounded-lg border border-[#E5E7EB] px-3 text-xs text-[#171717]"
              >
                Retry
              </button>
            </div>
          )}

          {loading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <ProductCardSkeleton key={i} />
              ))}
            </div>
          ) : !error && displayedProducts.length === 0 ? (
            <div className="rounded-xl border border-[#E5E7EB] bg-white px-6 py-14 text-center">
              {!wishlistOnly && activeChips.length === 0 && allCatalog.length === 0 ? (
                <>
                  <p className="text-base font-medium text-[#171717]">
                    No listings published yet
                  </p>
                  <p className="mx-auto mt-1.5 max-w-md text-xs text-[#6B6B6B]">
                    WISERD is ready for its first independent sellers. Open a store to publish physical goods, digital products, gaming gear, or studio services.
                  </p>
                  <Link
                    href="/sell"
                    className="mt-5 inline-flex h-10 items-center rounded-lg bg-[#315FC8] px-4 text-xs font-medium text-white hover:bg-[#274EA6]"
                  >
                    Open Store
                  </Link>
                </>
              ) : (
                <>
                  <p className="text-base font-medium text-[#171717]">
                    {wishlistOnly
                      ? "No saved listings match these filters"
                      : "No listings match your current search"}
                  </p>
                  <p className="mx-auto mt-1.5 max-w-md text-xs text-[#6B6B6B]">
                    {wishlistOnly
                      ? "Save products using the heart button on any listing to compare them in your wishlist."
                      : "Adjust your price range, switch category, or reset filters to see all available listings."}
                  </p>
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="mt-5 inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-lg bg-[#315FC8] px-4 text-xs font-medium text-white hover:bg-[#274EA6]"
                  >
                    <RotateCcw aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                    Reset filters
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {displayedProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recently Viewed Shelf (Only shown when real product views exist) */}
      {recentlyViewedProducts.length > 0 && (
        <section className="mt-14 border-t border-[#E5E7EB] pt-8">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="text-lg text-[#171717]">Recently viewed</h2>
            <span className="font-mono-light text-xs text-[#6B6B6B]">
              {recentlyViewedProducts.length} items
            </span>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {recentlyViewedProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}

      {/* Mobile Filter Bottom Sheet */}
      {mobileFiltersOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-[#171717]/35 backdrop-blur-[2px] lg:hidden"
          onClick={(e) => {
            if (e.target === e.currentTarget) setMobileFiltersOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="mobile-filters-title"
            className="max-h-[82dvh] w-full overflow-y-auto rounded-t-2xl border-t border-[#E5E7EB] bg-white p-5 shadow-xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 id="mobile-filters-title" className="text-base text-[#171717]">
                Filters
              </h2>
              <button
                type="button"
                onClick={() => setMobileFiltersOpen(false)}
                aria-label="Close filters"
                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-[#E5E7EB] text-[#6B6B6B] hover:text-[#171717]"
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </button>
            </div>
            {FilterControls}
            <button
              type="button"
              onClick={() => setMobileFiltersOpen(false)}
              className="mt-5 h-10 w-full cursor-pointer rounded-lg bg-[#315FC8] text-xs font-medium text-white transition hover:bg-[#274EA6]"
            >
              Show {displayedProducts.length} {displayedProducts.length === 1 ? "result" : "results"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MarketplacePage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-[1320px] px-4 py-12 text-xs text-[#6B6B6B]">
          Loading Marketplace...
        </div>
      }
    >
      <MarketplaceContent />
    </Suspense>
  );
}
