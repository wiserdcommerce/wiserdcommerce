"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Trash2, ArrowRight, ShieldCheck, Minus, Plus } from "lucide-react";
import { useWiserd } from "@/components/providers/wiserd-provider";
import { formatCategoryLabel } from "@/lib/commerce";
import type { EnrichedProduct } from "@/components/marketplace/product-card";

function formatUsd(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

export default function CartPage() {
  const { cart, updateCartQuantity, removeFromCart, pruneCartToValidIds } = useWiserd();
  const [products, setProducts] = useState<EnrichedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/products", { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error("Failed");
        return r.json();
      })
      .then((d) => {
        if (!active) return;
        const list = (d.products || []) as EnrichedProduct[];
        setProducts(list);
        pruneCartToValidIds(new Set(list.map((p) => p.id)));
      })
      .catch(() => {
        if (active) setLoadError("Could not load cart items. Please refresh.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [pruneCartToValidIds]);

  const groupedBySeller = useMemo(() => {
    const groups = new Map<
      string,
      {
        storeId: string;
        storeName: string;
        storeSlug: string;
        lines: Array<{
          product: EnrichedProduct;
          variationId?: string;
          variationLabel?: string;
          unitPriceCents: number;
          maxStock: number;
          quantity: number;
        }>;
      }
    >();

    for (const item of cart) {
      const product = products.find((p) => p.id === item.productId);
      if (!product) continue;
      const variation = item.variationId
        ? product.variations.find((v) => v.id === item.variationId)
        : product.variations[0];
      const unitPriceCents = product.priceCents + (variation?.priceDeltaCents || 0);
      const rawStock = variation ? variation.stock : product.stock;
      const maxStock = Math.min(20, Math.max(1, rawStock));
      const key = product.storeId;
      const group = groups.get(key) || {
        storeId: key,
        storeName: product.store?.name || "WISERD Store",
        storeSlug: product.store?.slug || "",
        lines: [],
      };
      group.lines.push({
        product,
        variationId: item.variationId,
        variationLabel: variation?.label,
        unitPriceCents,
        maxStock,
        quantity: item.quantity,
      });
      groups.set(key, group);
    }
    return Array.from(groups.values());
  }, [cart, products]);

  const subtotalCents = groupedBySeller.reduce(
    (sum, g) =>
      sum + g.lines.reduce((ls, l) => ls + l.unitPriceCents * l.quantity, 0),
    0
  );

  if (loading) {
    return (
      <div className="mx-auto max-w-[1320px] space-y-4 px-4 pt-8 sm:px-6 lg:px-8">
        <div className="h-8 w-48 animate-pulse rounded bg-[#E5E7EB]" />
        <div className="h-44 animate-pulse rounded-xl border border-[#E5E7EB] bg-white" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1320px] px-4 pt-8 sm:px-6 lg:px-8">
      <div className="border-b border-[#E5E7EB] pb-5">
        <p className="type-meta text-[#315FC8]">WISERD Commerce</p>
        <h1 className="mt-1 text-3xl text-[#171717]">Shopping Cart</h1>
        <p className="mt-1 text-sm text-[#6B6B6B]">
          Items from multiple stores are grouped by seller so each order follows
          its own fulfillment and escrow conditions.
        </p>
      </div>

      {loadError ? (
        <div
          role="alert"
          className="mt-8 rounded-xl border border-[#C81E1E]/25 bg-white p-6 text-xs font-medium text-[#C81E1E]"
        >
          {loadError}
        </div>
      ) : groupedBySeller.length === 0 ? (
        <div className="mt-10 rounded-xl border border-[#E5E7EB] bg-white p-12 text-center">
          <h2 className="text-xl text-[#171717]">Your cart is empty</h2>
          <p className="mt-2 text-sm text-[#6B6B6B]">
            Add physical goods, digital templates, gaming hardware, or services
            from any WISERD store.
          </p>
          <Link
            href="/marketplace"
            className="mt-5 inline-flex h-10 items-center rounded-lg bg-[#315FC8] px-5 text-xs font-medium text-white transition hover:bg-[#274EA6]"
          >
            Browse Marketplace
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-12">
          <div className="space-y-5 lg:col-span-8">
            {groupedBySeller.map((group) => {
              const groupSubtotal = group.lines.reduce(
                (s, l) => s + l.unitPriceCents * l.quantity,
                0
              );
              return (
                <section
                  key={group.storeId}
                  className="rounded-xl border border-[#E5E7EB] bg-white p-5"
                >
                  <div className="flex items-center justify-between gap-3 border-b border-[#F0F1F2] pb-3">
                    <Link
                      href={group.storeSlug ? `/stores/${group.storeSlug}` : "/marketplace"}
                      className="text-base font-medium text-[#171717] hover:text-[#315FC8]"
                    >
                      {group.storeName}
                    </Link>
                    <span className="font-mono-light text-sm text-[#6B6B6B]">
                      Subtotal{" "}
                      <span className="type-price text-sm">
                        {formatUsd(groupSubtotal)}
                      </span>
                    </span>
                  </div>

                  <div className="divide-y divide-[#F0F1F2]">
                    {group.lines.map((line) => (
                      <div
                        key={`${line.product.id}-${line.variationId || "std"}`}
                        className="flex flex-col gap-4 py-4 first:pt-4 last:pb-0 sm:flex-row sm:items-center"
                      >
                        <Link href={`/products/${line.product.slug}`} className="shrink-0">
                          <Image
                            src={line.product.imageUrl}
                            alt={line.product.title}
                            width={112}
                            height={80}
                            priority
                            className="h-20 w-28 rounded-lg border border-[#E5E7EB] bg-[#F2F2EF] object-cover"
                          />
                        </Link>
                        <div className="min-w-0 flex-1">
                          <Link
                            href={`/products/${line.product.slug}`}
                            className="text-sm font-medium text-[#171717] hover:text-[#315FC8]"
                          >
                            {line.product.title}
                          </Link>
                          <p className="mt-0.5 text-xs text-[#6B6B6B]">
                            {line.variationLabel || "Standard"} · {formatCategoryLabel(line.product.category)}
                          </p>
                          <p className="mt-1 text-xs font-medium text-[#167A67]">
                            {formatUsd(line.unitPriceCents)} each
                          </p>
                        </div>
                        <div className="flex items-center justify-between gap-3 sm:justify-end">
                          <div className="inline-flex items-center rounded-lg border border-[#E5E7EB] bg-white">
                            <button
                              type="button"
                              aria-label="Decrease quantity"
                              onClick={() =>
                                updateCartQuantity(
                                  line.product.id,
                                  line.variationId,
                                  line.quantity - 1
                                )
                              }
                              className="flex h-9 w-9 cursor-pointer items-center justify-center text-[#6B6B6B] hover:text-[#171717]"
                            >
                              <Minus aria-hidden="true" className="h-3.5 w-3.5" />
                            </button>
                            <span className="font-mono-light w-8 text-center text-sm text-[#171717]">
                              {line.quantity}
                            </span>
                            <button
                              type="button"
                              disabled={line.quantity >= line.maxStock}
                              aria-label="Increase quantity"
                              onClick={() =>
                                updateCartQuantity(
                                  line.product.id,
                                  line.variationId,
                                  Math.min(line.maxStock, line.quantity + 1)
                                )
                              }
                              className="flex h-9 w-9 cursor-pointer items-center justify-center text-[#6B6B6B] hover:text-[#171717] disabled:cursor-not-allowed disabled:opacity-35"
                            >
                              <Plus aria-hidden="true" className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <span className="type-price min-w-16 text-right text-base">
                            {formatUsd(line.unitPriceCents * line.quantity)}
                          </span>
                          <button
                            type="button"
                            aria-label={`Remove ${line.product.title}`}
                            onClick={() =>
                              removeFromCart(line.product.id, line.variationId)
                            }
                            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-[#6B6B6B] hover:bg-[#F7F7F5] hover:text-[#C81E1E]"
                          >
                            <Trash2 aria-hidden="true" className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>

          <aside className="lg:col-span-4">
            <div className="sticky top-20 rounded-xl border border-[#E5E7EB] bg-white p-6">
              <h2 className="text-lg text-[#171717]">Order Summary</h2>
              <dl className="mt-4 space-y-2.5 text-sm">
                <div className="flex justify-between">
                  <dt className="text-[#6B6B6B]">Seller shipments</dt>
                  <dd className="font-mono-light text-[#171717]">
                    {groupedBySeller.length}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[#6B6B6B]">Estimated subtotal</dt>
                  <dd className="type-price text-base">
                    {formatUsd(subtotalCents)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[#6B6B6B]">Platform fee (3%)</dt>
                  <dd className="font-mono-light text-sm text-[#171717]">
                    {formatUsd(Math.round(subtotalCents * 0.03))}
                  </dd>
                </div>
              </dl>

              <p className="mt-4 flex items-start gap-2 rounded-lg bg-[#F7F7F5] p-3 text-xs text-[#6B6B6B]">
                <ShieldCheck aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-[#167A67]" />
                Final totals, shipping fees, and escrow conditions are validated
                on the server at checkout.
              </p>

              <Link
                href="/checkout"
                className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#315FC8] text-xs font-medium text-white transition hover:bg-[#274EA6]"
              >
                Proceed to Checkout <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Link>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
