import type { CartItem, OrderItemSnapshot, Product, ProductCategory } from "./types";

export const PLATFORM_FEE_RATE = 0.03;
export const PHYSICAL_SHIPPING_CENTS = 1200;
export const FREE_SHIPPING_THRESHOLD_CENTS = 10000;

export const CATEGORY_LABELS: Record<ProductCategory, string> = {
  physical: "Physical",
  digital: "Digital",
  gaming: "Gaming",
  services: "Services",
};

export function formatCategoryLabel(category: string): string {
  return CATEGORY_LABELS[category as ProductCategory] || category;
}

export function productRequiresShipping(product: Pick<Product, "category" | "productType">): boolean {
  return product.category === "physical" || product.productType === "Gaming Hardware";
}

export interface StoreOrderBreakdown {
  storeId: string;
  items: OrderItemSnapshot[];
  requiresShipping: boolean;
  subtotalCents: number;
  shippingCents: number;
  platformFeeCents: number;
  totalCents: number;
}

export interface CartOrderCalculation {
  stores: StoreOrderBreakdown[];
  anyRequiresShipping: boolean;
  grandSubtotalCents: number;
  grandShippingCents: number;
  grandPlatformFeeCents: number;
  grandTotalCents: number;
}

/**
 * Single source of truth for per-store order splitting, shipping thresholds,
 * platform fee, and totals. Used identically by Checkout UI and POST /api/orders.
 */
export function calculateStoreOrderBreakdowns(
  cartItems: CartItem[],
  products: Product[]
): { calculation: CartOrderCalculation } | { error: string } {
  const byProduct = new Map(products.map((p) => [p.id, p]));

  // Aggregate duplicate (productId, variationId) entries before validating stock
  const merged = new Map<string, { productId: string; variationId?: string; quantity: number }>();
  for (const raw of cartItems) {
    const qty = Math.max(1, Math.min(20, Math.floor(Number(raw.quantity) || 1)));
    const product = byProduct.get(raw.productId);
    if (!product || product.status !== "published") {
      return { error: "One or more items in your cart are no longer available." };
    }
    const variation = raw.variationId
      ? product.variations.find((v) => v.id === raw.variationId)
      : product.variations[0];
    const key = `${product.id}::${variation?.id || "default"}`;
    const prev = merged.get(key);
    merged.set(key, {
      productId: product.id,
      variationId: variation?.id,
      quantity: Math.min(20, (prev?.quantity || 0) + qty),
    });
  }

  // Validate aggregate stock per product and per variation
  const requestedPerProduct = new Map<string, number>();
  const grouped = new Map<
    string,
    { storeId: string; items: OrderItemSnapshot[]; requiresShipping: boolean }
  >();

  for (const entry of merged.values()) {
    const product = byProduct.get(entry.productId)!;
    const variation = entry.variationId
      ? product.variations.find((v) => v.id === entry.variationId)
      : product.variations[0];

    const totalForProd = (requestedPerProduct.get(product.id) || 0) + entry.quantity;
    requestedPerProduct.set(product.id, totalForProd);

    if (product.stock < 999 && totalForProd > product.stock) {
      return { error: `Insufficient stock for ${product.title}.` };
    }
    if (variation && variation.stock < 999 && entry.quantity > variation.stock) {
      return {
        error: `Insufficient stock for ${product.title} (${variation.label}).`,
      };
    }

    const unitPriceCents = product.priceCents + (variation?.priceDeltaCents || 0);
    const snapshot: OrderItemSnapshot = {
      productId: product.id,
      productSlug: product.slug,
      productTitle: product.title,
      category: product.category,
      variationId: variation?.id,
      variationLabel: variation?.label,
      unitPriceCents,
      quantity: entry.quantity,
      lineTotalCents: unitPriceCents * entry.quantity,
      imageUrl: product.imageUrl,
    };

    const storeGroup = grouped.get(product.storeId) || {
      storeId: product.storeId,
      items: [],
      requiresShipping: false,
    };
    storeGroup.items.push(snapshot);
    if (productRequiresShipping(product)) {
      storeGroup.requiresShipping = true;
    }
    grouped.set(product.storeId, storeGroup);
  }

  const stores: StoreOrderBreakdown[] = [];
  let grandSubtotalCents = 0;
  let grandShippingCents = 0;
  let grandPlatformFeeCents = 0;
  let grandTotalCents = 0;

  for (const group of grouped.values()) {
    const subtotalCents = group.items.reduce((sum, i) => sum + i.lineTotalCents, 0);
    const shippingCents =
      group.requiresShipping && subtotalCents < FREE_SHIPPING_THRESHOLD_CENTS
        ? PHYSICAL_SHIPPING_CENTS
        : 0;
    const platformFeeCents = Math.round(subtotalCents * PLATFORM_FEE_RATE);
    const totalCents = subtotalCents + shippingCents + platformFeeCents;

    stores.push({
      storeId: group.storeId,
      items: group.items,
      requiresShipping: group.requiresShipping,
      subtotalCents,
      shippingCents,
      platformFeeCents,
      totalCents,
    });

    grandSubtotalCents += subtotalCents;
    grandShippingCents += shippingCents;
    grandPlatformFeeCents += platformFeeCents;
    grandTotalCents += totalCents;
  }

  return {
    calculation: {
      stores,
      anyRequiresShipping: stores.some((s) => s.requiresShipping),
      grandSubtotalCents,
      grandShippingCents,
      grandPlatformFeeCents,
      grandTotalCents,
    },
  };
}
