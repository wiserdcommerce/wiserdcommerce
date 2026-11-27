"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { X, ShoppingBag, ShieldCheck, ArrowUpRight, BadgeCheck } from "lucide-react";
import { CenterRevealPanel } from "@/components/motion/motion-primitives";
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

/**
 * Product Quick View Modal (Reviewer Section 5: "Quick view or product detail navigation").
 * Clean solid white product interior framed inside a refined modal container.
 */
export function QuickViewModal({
  product,
  onClose,
}: {
  product: EnrichedProduct | null;
  onClose: () => void;
}) {
  const { addToCart, openCartDrawer, recordProductView } = useWiserd();
  const [variationId, setVariationId] = useState<string>(
    () => product?.variations[0]?.id || ""
  );
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!product) return;
    recordProductView(product.id);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeBtnRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [product, onClose, recordProductView]);

  if (!product) return null;

  const activeVar =
    product.variations.find((v) => v.id === variationId) || product.variations[0];
  const priceCents = product.priceCents + (activeVar?.priceDeltaCents || 0);

  const handleAdd = () => {
    addToCart({
      productId: product.id,
      variationId: activeVar?.id,
      quantity: 1,
    });
    onClose();
    openCartDrawer();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[#171717]/38 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <CenterRevealPanel className="w-full max-w-[740px]">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="quick-view-title"
          className="max-h-[90dvh] overflow-y-auto rounded-t-2xl border border-[#E5E7EB] bg-white p-5 shadow-xl sm:rounded-2xl sm:p-6"
        >
          <div className="flex items-start justify-between gap-4">
            <span className="type-meta text-[#315FC8]">
              Quick view ({formatCategoryLabel(product.category)})
            </span>
            <button
              ref={closeBtnRef}
              type="button"
              onClick={onClose}
              aria-label="Close quick view"
              className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-[#E5E7EB] text-[#6B6B6B] transition hover:border-[#171717]/25 hover:text-[#171717]"
            >
              <X aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-12">
            <div className="sm:col-span-5">
              <div className="relative aspect-[4/3] overflow-hidden rounded-xl border border-[#E5E7EB] bg-[#F7F7F5]">
                <Image
                  src={product.imageUrl}
                  alt={product.title}
                  fill
                  sizes="(max-width: 640px) 100vw, 320px"
                  className="object-cover"
                />
              </div>
              {product.store && (
                <div className="mt-3 flex items-center justify-between gap-2 rounded-lg border border-[#E5E7EB] bg-[#F7F7F5] px-3 py-2 text-xs">
                  <span className="min-w-0 truncate font-medium text-[#171717]">
                    {product.store.name}
                  </span>
                  {product.store.verificationStatus === "verified" ? (
                    <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap font-medium text-[#167A67]">
                      <BadgeCheck aria-hidden="true" className="h-3.5 w-3.5" />
                      Verified
                    </span>
                  ) : (
                    <span className="shrink-0 whitespace-nowrap text-[#6B6B6B]">
                      Pending review
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-col sm:col-span-7">
              <h2
                id="quick-view-title"
                className="text-xl text-[#171717]"
              >
                {product.title}
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-[#6B6B6B]">
                {product.summary}
              </p>

              <div className="mt-3 flex flex-wrap items-baseline gap-2.5">
                <span className="type-price text-2xl">
                  {formatUsd(priceCents)}
                </span>
                {product.escrowEligible && (
                  <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-[#167A67]/20 bg-[#167A67]/[0.06] px-2 py-0.5 text-xs font-medium text-[#167A67]">
                    <ShieldCheck aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                    Escrow eligible
                  </span>
                )}
              </div>

              {product.variations.length > 0 && (
                <div className="mt-4">
                  <p className="type-meta">Option</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {product.variations.map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        aria-pressed={activeVar?.id === v.id}
                        onClick={() => setVariationId(v.id)}
                        className={`min-h-[38px] cursor-pointer whitespace-nowrap rounded-lg border px-3 text-xs font-medium transition ${
                          activeVar?.id === v.id
                            ? "border-[#315FC8] bg-[#315FC8]/[0.08] text-[#315FC8]"
                            : "border-[#E5E7EB] bg-white text-[#171717] hover:border-[#171717]/25"
                        }`}
                      >
                        {v.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <p className="mt-3 text-xs text-[#6B6B6B]">{product.deliveryInfo}</p>

              <div className="mt-auto flex flex-wrap items-center gap-2.5 pt-5">
                <button
                  type="button"
                  onClick={handleAdd}
                  className="inline-flex h-10 flex-1 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-[#315FC8] px-4 text-xs font-medium text-white transition hover:bg-[#274EA6]"
                >
                  <ShoppingBag aria-hidden="true" className="h-4 w-4 shrink-0" />
                  Add to Cart
                </button>
                <Link
                  href={`/products/${product.slug}`}
                  onClick={onClose}
                  className="inline-flex h-10 items-center gap-1.5 whitespace-nowrap rounded-lg border border-[#E5E7EB] bg-white px-4 text-xs font-medium text-[#171717] transition hover:border-[#171717]/30"
                >
                  Full Details
                  <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </CenterRevealPanel>
    </div>
  );
}
