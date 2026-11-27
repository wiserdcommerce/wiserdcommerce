import { NextResponse } from "next/server";
import {
  checkRateLimit,
  getServerSession,
  isLocalSandboxAllowed,
  parseJsonBody,
  requireActiveUser,
} from "@/lib/auth-session";
import { calculateStoreOrderBreakdowns } from "@/lib/commerce";
import { mutateDb, readDb, makeId } from "@/lib/db";
import { getIntegrationStatus } from "@/lib/integrations";
import type { CartItem, Order, Product } from "@/lib/types";

function recomputeAvailability(prod: Product): Product["availability"] {
  if (prod.availability === "made_to_order" && prod.stock > 0) return "made_to_order";
  if (prod.stock <= 0) return "out_of_stock";
  if (prod.stock <= 5) return "limited";
  return "in_stock";
}

function restoreOrderInventory(products: Product[], order: Order) {
  for (const item of order.items) {
    const prod = products.find((p) => p.id === item.productId);
    if (!prod || prod.stock >= 999) continue;
    prod.stock += item.quantity;
    if (item.variationId) {
      const variation = prod.variations.find((v) => v.id === item.variationId);
      if (variation && variation.stock < 999) {
        variation.stock += item.quantity;
      }
    }
    prod.availability = recomputeAvailability(prod);
  }
}

export async function GET(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ orders: [], disputes: [] });
  }
  const { searchParams } = new URL(request.url);
  const orderId = searchParams.get("id");

  const db = readDb();
  const active = requireActiveUser(db, session);
  if ("error" in active) {
    return NextResponse.json({ error: active.error }, { status: active.status });
  }
  const { user } = active;
  const userStore = db.stores.find((s) => s.ownerId === user.id);
  const isAdmin = user.roles.includes("admin");

  const visibleOrders = db.orders
    .filter(
      (o) =>
        isAdmin ||
        o.buyerId === user.id ||
        (userStore && o.storeId === userStore.id)
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  if (orderId) {
    const order = visibleOrders.find((o) => o.id === orderId || o.referenceCode === orderId);
    if (!order) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }
    const dispute = db.disputes.find((d) => d.orderId === order.id) || null;
    const isBuyer = order.buyerId === user.id;
    const isStoreOwner = Boolean(userStore && order.storeId === userStore.id);
    const viewerRole = isStoreOwner ? "seller" : isBuyer ? "buyer" : "admin";
    return NextResponse.json({ order, dispute, viewerRole, isStoreOwner });
  }

  return NextResponse.json({
    orders: visibleOrders,
    disputes: db.disputes.filter(
      (d) =>
        isAdmin ||
        d.buyerId === user.id ||
        (userStore && d.storeId === userStore.id)
    ),
  });
}

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json(
      { error: "Please sign in with your WISERD account to complete checkout." },
      { status: 401 }
    );
  }

  const limited = checkRateLimit(`orders:create:${session.userId}`, 20, 60_000);
  if (limited) return limited;

  const parsed = await parseJsonBody<{
    items: CartItem[];
    paymentMethod: "fiat_escrow" | "wallet_escrow";
    shippingAddress?: {
      recipient: string;
      line1: string;
      city: string;
      country: string;
      postalCode: string;
    };
  }>(request);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  if (!Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ error: "Your cart is empty." }, { status: 400 });
  }
  if (body.paymentMethod !== "fiat_escrow" && body.paymentMethod !== "wallet_escrow") {
    return NextResponse.json({ error: "Select a valid payment method." }, { status: 400 });
  }

  const integrations = getIntegrationStatus();

  const result = await mutateDb((db) => {
    const active = requireActiveUser(db, session);
    if ("error" in active) return active;
    const buyer = active.user;

    const connectedWallet = db.wallets.find(
      (w) => w.userId === buyer.id && w.status === "connected"
    );

    if (body.paymentMethod === "wallet_escrow" && !connectedWallet) {
      return {
        error: "Connect and verify a wallet first before selecting the wallet escrow option.",
        status: 400 as const,
      };
    }

    const calc = calculateStoreOrderBreakdowns(body.items, db.products);
    if ("error" in calc) {
      return { error: calc.error, status: 400 as const };
    }
    const { calculation } = calc;

    if (
      calculation.anyRequiresShipping &&
      (!body.shippingAddress?.recipient?.trim() ||
        !body.shippingAddress?.line1?.trim() ||
        !body.shippingAddress?.city?.trim())
    ) {
      return {
        error: "Shipping recipient, street address, and city are required for physical items.",
        status: 400 as const,
      };
    }

    const createdOrders: Order[] = [];
    const now = new Date().toISOString();

    for (const group of calculation.stores) {
      const store = db.stores.find((s) => s.id === group.storeId);
      if (!store) continue;

      const providerConfigured =
        body.paymentMethod === "wallet_escrow"
          ? integrations.onchainEscrow.configured
          : integrations.fiatPaymentProvider.configured;

      const orderId = makeId("ord");
      const refCode = `WSR-${orderId.slice(-6).toUpperCase()}`;

      const order: Order = {
        id: orderId,
        referenceCode: refCode,
        buyerId: buyer.id,
        buyerName: buyer.displayName,
        storeId: store.id,
        storeName: store.name,
        storeSlug: store.slug,
        items: group.items,
        requiresShipping: group.requiresShipping,
        shippingAddress: group.requiresShipping ? body.shippingAddress : undefined,
        subtotalCents: group.subtotalCents,
        shippingCents: group.shippingCents,
        platformFeeCents: group.platformFeeCents,
        paymentFeeCents: 0,
        totalCents: group.totalCents,
        currency: "USD",
        paymentMethod: body.paymentMethod,
        // Stays pending until a verified payment webhook or onchain receipt confirms settlement
        paymentVerification: providerConfigured ? "pending" : "unconfigured_preview",
        escrowMode: providerConfigured
          ? body.paymentMethod === "wallet_escrow"
            ? "onchain_contract"
            : "fiat_provider"
          : "unconfigured_preview",
        walletAddressUsed:
          body.paymentMethod === "wallet_escrow" ? connectedWallet?.address : undefined,
        escrowStatus: "Pending Payment",
        escrowConditions:
          "Funds cannot enter live custody until an authorized payment provider or audited escrow smart contract confirms payment. In preview mode, workflow steps can be inspected transparently.",
        escrowEvents: [
          {
            id: makeId("evt"),
            status: "Pending Payment",
            actor: buyer.displayName,
            note: providerConfigured
              ? "Order created and awaiting verified payment confirmation."
              : "Order created in Escrow Workflow Preview (live payment provider / onchain escrow contract not configured).",
            timestamp: now,
          },
        ],
        payoutStatus: "pending_provider",
        createdAt: now,
        updatedAt: now,
      };

      // Decrement both product and variation inventory atomically
      for (const item of group.items) {
        const prod = db.products.find((p) => p.id === item.productId);
        if (prod && prod.stock < 999) {
          prod.stock = Math.max(0, prod.stock - item.quantity);
          if (item.variationId) {
            const variation = prod.variations.find((v) => v.id === item.variationId);
            if (variation && variation.stock < 999) {
              variation.stock = Math.max(0, variation.stock - item.quantity);
            }
          }
          prod.availability = recomputeAvailability(prod);
        }
      }

      db.orders.unshift(order);
      createdOrders.push(order);

      db.notifications.unshift({
        id: makeId("notif"),
        recipientId: buyer.id,
        eventType: "order",
        title: `Order ${refCode} created`,
        body: `Awaiting payment confirmation for ${store.name}.`,
        href: `/orders/${order.id}`,
        importantTransaction: true,
        read: false,
        createdAt: now,
      });

      db.notifications.unshift({
        id: makeId("notif"),
        recipientId: store.ownerId,
        eventType: "order",
        title: `New order ${refCode} received`,
        body: `${buyer.displayName} placed an order totaling $${(group.totalCents / 100).toFixed(2)}.`,
        href: `/orders/${order.id}`,
        importantTransaction: true,
        read: false,
        createdAt: now,
      });
    }

    return { orders: createdOrders };
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ orders: result.orders }, { status: 201 });
}

export async function PATCH(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in to manage orders." }, { status: 401 });
  }

  const parsed = await parseJsonBody<{
    orderId: string;
    action:
      | "confirm_preview_payment"
      | "submit_fulfillment"
      | "buyer_confirm_completion"
      | "open_dispute"
      | "seller_dispute_response"
      | "cancel_order";
    trackingNumber?: string;
    fulfillmentNote?: string;
    digitalDeliveryNote?: string;
    disputeReason?: string;
    buyerStatement?: string;
    evidenceNotes?: string;
    sellerResponse?: string;
  }>(request);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  const result = await mutateDb((db) => {
    const active = requireActiveUser(db, session);
    if ("error" in active) return active;
    const { user } = active;

    const order = db.orders.find((o) => o.id === body.orderId);
    if (!order) return { error: "Order not found.", status: 404 as const };

    const store = db.stores.find((s) => s.id === order.storeId);
    if (!store) return { error: "Store record missing.", status: 404 as const };

    const isBuyer = order.buyerId === user.id;
    const isSeller = store.ownerId === user.id;
    const isAdmin = user.roles.includes("admin");
    if (!isBuyer && !isSeller && !isAdmin) {
      return { error: "You do not have permission to update this order.", status: 403 as const };
    }

    const now = new Date().toISOString();

    if (body.action === "confirm_preview_payment") {
      if (!isLocalSandboxAllowed()) {
        return {
          error: "Preview payment confirmation is disabled in production.",
          status: 403 as const,
        };
      }
      if (order.escrowMode !== "unconfigured_preview") {
        return {
          error: "Live payment confirmation must come from the configured settlement provider.",
          status: 403 as const,
        };
      }
      if (order.escrowStatus !== "Pending Payment") {
        return { error: "Order is not awaiting payment.", status: 400 as const };
      }
      order.escrowStatus = "Escrow Active";
      order.escrowEvents.push(
        {
          id: makeId("evt"),
          status: "Payment Confirmed",
          actor: "WISERD Workflow Preview",
          note: "Preview payment state advanced for testing (no real money moved; live provider not configured).",
          timestamp: now,
        },
        {
          id: makeId("evt"),
          status: "Escrow Active",
          actor: "WISERD Escrow Ledger",
          note: "Seller notified to begin fulfillment according to order terms.",
          timestamp: now,
        }
      );
      order.updatedAt = now;
      return { order };
    }

    if (body.action === "submit_fulfillment") {
      if (!isSeller && !isAdmin) {
        return { error: "Only the seller can submit fulfillment details.", status: 403 as const };
      }
      if (order.escrowStatus !== "Escrow Active" && order.escrowStatus !== "Seller Processing") {
        return {
          error: "Fulfillment can only be submitted once escrow is active.",
          status: 400 as const,
        };
      }
      order.trackingNumber = body.trackingNumber?.trim() || order.trackingNumber;
      order.fulfillmentNote =
        body.fulfillmentNote?.trim() || "Order fulfilled and ready for buyer inspection.";
      order.digitalDeliveryNote = body.digitalDeliveryNote?.trim() || order.digitalDeliveryNote;
      order.escrowStatus = "Awaiting Buyer Confirmation";
      order.escrowEvents.push(
        {
          id: makeId("evt"),
          status: "Shipped or Delivered",
          actor: store.name,
          note: order.trackingNumber
            ? `Fulfillment submitted with tracking #${order.trackingNumber}.`
            : order.fulfillmentNote,
          timestamp: now,
        },
        {
          id: makeId("evt"),
          status: "Awaiting Buyer Confirmation",
          actor: "WISERD Escrow Ledger",
          note: "Buyer can now inspect the delivered item/service and confirm completion or open a dispute.",
          timestamp: now,
        }
      );
      order.updatedAt = now;
      db.notifications.unshift({
        id: makeId("notif"),
        recipientId: order.buyerId,
        eventType: "delivery",
        title: `Delivery submitted for ${order.referenceCode}`,
        body: `${store.name} submitted delivery details. Please review and confirm completion.`,
        href: `/orders/${order.id}`,
        importantTransaction: true,
        read: false,
        createdAt: now,
      });
      return { order };
    }

    if (body.action === "buyer_confirm_completion") {
      if (!isBuyer && !isAdmin) {
        return { error: "Only the buyer can confirm order completion.", status: 403 as const };
      }
      if (
        order.escrowStatus !== "Awaiting Buyer Confirmation" &&
        order.escrowStatus !== "Shipped or Delivered"
      ) {
        return {
          error: "Order completion can only be confirmed after seller delivery.",
          status: 400 as const,
        };
      }
      order.escrowStatus = "Released";
      order.payoutStatus =
        order.escrowMode === "unconfigured_preview" ? "pending_provider" : "processing";
      order.escrowEvents.push({
        id: makeId("evt"),
        status: "Released",
        actor: user.displayName,
        note:
          order.escrowMode === "unconfigured_preview"
            ? "Buyer confirmed completion. Settlement release logged in preview mode (payout provider not configured)."
            : "Buyer confirmed completion and authorized escrow release to seller payout queue.",
        timestamp: now,
      });
      order.updatedAt = now;
      return { order };
    }

    if (body.action === "open_dispute") {
      if (!isBuyer && !isAdmin) {
        return { error: "Only the buyer can open a dispute on this order.", status: 403 as const };
      }
      if (order.disputeId) {
        return { error: "A dispute already exists for this order.", status: 400 as const };
      }
      if (
        !["Escrow Active", "Shipped or Delivered", "Awaiting Buyer Confirmation"].includes(
          order.escrowStatus
        )
      ) {
        return {
          error: "Disputes can only be opened on active or delivered escrow orders.",
          status: 400 as const,
        };
      }
      if (!body.disputeReason?.trim() || !body.buyerStatement?.trim()) {
        return { error: "Please provide a dispute reason and explanation.", status: 400 as const };
      }
      const dispute = {
        id: makeId("dsp"),
        orderId: order.id,
        orderReference: order.referenceCode,
        buyerId: order.buyerId,
        buyerName: order.buyerName,
        storeId: order.storeId,
        storeName: order.storeName,
        reason: body.disputeReason.trim(),
        buyerStatement: body.buyerStatement.trim(),
        evidenceNotes: body.evidenceNotes?.trim() || "",
        status: "open" as const,
        createdAt: now,
      };
      db.disputes.unshift(dispute);
      order.disputeId = dispute.id;
      order.escrowStatus = "Disputed";
      order.payoutStatus = "held";
      order.escrowEvents.push({
        id: makeId("evt"),
        status: "Disputed",
        actor: user.displayName,
        note: `Dispute opened: ${dispute.reason}. Release held pending review.`,
        timestamp: now,
      });
      order.updatedAt = now;
      db.notifications.unshift({
        id: makeId("notif"),
        recipientId: store.ownerId,
        eventType: "dispute",
        title: `Dispute opened on ${order.referenceCode}`,
        body: `Reason: ${dispute.reason}. Submit your seller response in Order Details.`,
        href: `/orders/${order.id}`,
        importantTransaction: true,
        read: false,
        createdAt: now,
      });
      return { order, dispute };
    }

    if (body.action === "seller_dispute_response") {
      if (!isSeller && !isAdmin) {
        return { error: "Only the seller can submit a dispute response.", status: 403 as const };
      }
      if (order.escrowStatus !== "Disputed") {
        return { error: "This order is not currently under dispute.", status: 400 as const };
      }
      const dispute = db.disputes.find((d) => d.orderId === order.id);
      if (!dispute) return { error: "No active dispute found for this order.", status: 404 as const };
      dispute.sellerResponse = body.sellerResponse?.trim() || "";
      dispute.status = "under_review";
      order.updatedAt = now;
      return { order, dispute };
    }

    if (body.action === "cancel_order") {
      if (order.escrowStatus !== "Pending Payment") {
        return { error: "Only unpaid orders can be cancelled directly.", status: 400 as const };
      }
      order.escrowStatus = "Cancelled";
      restoreOrderInventory(db.products, order);
      order.escrowEvents.push({
        id: makeId("evt"),
        status: "Cancelled",
        actor: user.displayName,
        note: "Order cancelled prior to payment. Reserved inventory restored.",
        timestamp: now,
      });
      order.updatedAt = now;
      return { order };
    }

    return { error: "Unsupported order action.", status: 400 as const };
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result);
}
