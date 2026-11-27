"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Heart, Eye } from "lucide-react";
import { useWiserd } from "@/components/providers/wiserd-provider";
import { QuickViewModal } from "@/components/marketplace/quick-view-modal";
import type { Product } from "@/lib/types";

export interface EnrichedProduct extends Product {
  rating?: number | null;
  reviewCount?: number;
  store?: {
    id: string;
    slug: string;
    name: string;
    initials: string;
    accentColor: string;
    verificationStatus: "pending" | "verified" | "action_required";
    responseTimeLabel: string;
    rating?: number | null;
    reviewCount?: number;
  } | null;
}

const AVAILABILITY_TEXT: Record<string, { label: string; dot: string }> = {
  in_stock: { label: "In stock", dot: "bg-[#167A67]" },
  limited: { label: "Limited", dot: "bg-[#B45309]" },
  made_to_order: { label: "Made to order", dot: "bg-[#7853D8]" },
  out_of_stock: { label: "Out of stock", dot: "bg-[#6B6B6B]" },
};

function formatPrice(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

/**
 * Quiet, editorial ecommerce Product Card (Anti-AI-Slop standard).
 * - Solid #FFFFFF surface, crisp hairline border, prominent 4:3 photography
 * - Zero marketing blurb clutter, zero competing badge soup
 * - Scannable 3-line hierarchy: Store + Availability -> Title -> Price + Escrow
 */
export function ProductCard({ product }: { product: EnrichedProduct }) {
  const { user, toggleFavorite } = useWiserd();
  const [quickOpen, setQuickOpen] = useState(false);
  const isFavorited = Boolean(user?.favoriteProductIds.includes(product.id));
  const avail = AVAILABILITY_TEXT[product.availability] || AVAILABILITY_TEXT.in_stock;

  return (
    <>
      <article className="group relative flex flex-col overflow-hidden rounded-xl border border-[#E5E7EB] bg-white transition-colors duration-150 hover:border-[#171717]/25">
        {/* Product Media — Primary Visual Element */}
        <div className="relative overflow-hidden border-b border-[#E5E7EB] bg-[#F2F2EF]">
          <Link href={`/products/${product.slug}`} className="relative block aspect-[4/3] w-full">
            <Image
              src={product.imageUrl}
              alt={product.title}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
              className="object-cover transition-transform duration-300 ease-out group-hover:scale-[1.02]"
            />
          </Link>

          {/* Quiet Floating Wishlist Button */}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggleFavorite(product.id);
            }}
            aria-label={
              isFavorited
                ? `Remove ${product.title} from favorites`
                : `Add ${product.title} to favorites`
            }
            aria-pressed={isFavorited}
            className={`liquid-glass-pill absolute top-2.5 right-2.5 z-10 flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg transition ${
              isFavorited
                ? "opacity-100"
                : "opacity-90 hover:opacity-100"
            }`}
          >
            <Heart
              aria-hidden="true"
              className={`h-4 w-4 ${
                isFavorited
                  ? "fill-[#315FC8] text-[#315FC8]"
                  : "text-[#171717]"
              }`}
            />
          </button>

          {/* Quiet Quick View Trigger on Hover / Keyboard Focus */}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setQuickOpen(true);
            }}
            className="liquid-glass-pill absolute bottom-2.5 left-2.5 inline-flex min-h-[32px] cursor-pointer items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-[#171717] opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100"
          >
            <Eye aria-hidden="true" className="h-3.5 w-3.5 text-[#315FC8]" />
            Quick view
          </button>
        </div>

        {/* Clean 3-Row Commercial Metadata */}
        <div className="flex flex-1 flex-col p-3.5">
          <div className="flex items-center justify-between gap-2 text-xs">
            {product.store ? (
              <Link
                href={`/stores/${product.store.slug}`}
                className="min-w-0 truncate text-[#6B6B6B] transition hover:text-[#171717]"
              >
                {product.store.name}
              </Link>
            ) : (
              <span className="min-w-0 truncate text-[#6B6B6B]">Independent Seller</span>
            )}
            <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap text-[11px] text-[#6B6B6B]">
              <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${avail.dot}`} />
              {avail.label}
            </span>
          </div>

          <Link
            href={`/products/${product.slug}`}
            className="mt-1.5 line-clamp-2 text-[14px] leading-[1.3] font-medium text-[#171717] transition group-hover:text-[#315FC8]"
          >
            {product.title}
          </Link>

          <div className="mt-auto flex items-baseline justify-between gap-2 pt-3">
            <span className="font-base-black text-[16px] leading-none text-[#171717]">
              {formatPrice(product.priceCents)}
            </span>
            <span className="font-mono-light text-[11px] text-[#6B6B6B]">
              {product.escrowEligible ? "Escrow" : product.category}
            </span>
          </div>
        </div>
      </article>

      {quickOpen && (
        <QuickViewModal product={product} onClose={() => setQuickOpen(false)} />
      )}
    </>
  );
}
