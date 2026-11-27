"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  MessageSquare,
  AlertTriangle,
  CheckCircle2,
  Truck,
} from "lucide-react";
import { useWiserd } from "@/components/providers/wiserd-provider";
import {
  EscrowStatusBadge,
  EscrowTimeline,
} from "@/components/orders/escrow-timeline";
import { DetailSplitSkeleton } from "@/components/ui/state-blocks";
import type { Dispute, Order } from "@/lib/types";

function formatUsd(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user, integrations, refreshSession } = useWiserd();
  const [order, setOrder] = useState<Order | null>(null);
  const [dispute, setDispute] = useState<Dispute | null>(null);
  const [isStoreOwner, setIsStoreOwner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Fulfillment form
  const [trackingNumber, setTrackingNumber] = useState("");
  const [fulfillmentNote, setFulfillmentNote] = useState("");

  // Dispute form
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [disputeReason, setDisputeReason] = useState("Item not as described");
  const [buyerStatement, setBuyerStatement] = useState("");
  const [evidenceNotes, setEvidenceNotes] = useState("");
  const [sellerResponse, setSellerResponse] = useState("");

  const loadOrder = useCallback(async () => {
    if (!params?.id) return;
    try {
      const res = await fetch(
        `/api/orders?id=${encodeURIComponent(params.id)}`,
        { cache: "no-store" }
      );
      if (res.ok) {
        const data = await res.json();
        setOrder(data.order);
        setDispute(data.dispute || null);
        setIsStoreOwner(Boolean(data.isStoreOwner));
      } else {
        setOrder(null);
      }
    } finally {
      setLoading(false);
    }
  }, [params?.id]);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) loadOrder();
    });
    return () => {
      active = false;
    };
  }, [loadOrder]);

  const runAction = async (payload: Record<string, unknown>) => {
    if (!order) return;
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch("/api/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.id, ...payload }),
      });
      const data = await res.json();
      if (!res.ok) {
        setNotice(data.error || "Action failed.");
      } else {
        setDisputeOpen(false);
        await loadOrder();
        await refreshSession();
      }
    } finally {
      setBusy(false);
    }
  };

  const openOrderConversation = async () => {
    if (!order) return;
    const res = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "start_or_send",
        orderId: order.id,
        storeId: order.storeId,
      }),
    });
    const data = await res.json();
    if (res.ok && data.conversation?.id) {
      router.push(`/messages?conversation=${data.conversation.id}`);
    }
  };

  if (loading) {
    return <DetailSplitSkeleton />;
  }

  if (!order) {
    return (
      <div className="mx-auto max-w-[1200px] px-4 py-20 text-center">
        <h1 className="text-2xl font-bold text-[#171717]">Order not found</h1>
        <Link
          href="/orders"
          className="mt-4 inline-flex h-10 items-center rounded-lg bg-[#315FC8] px-5 text-sm font-semibold text-white"
        >
          Back to My Orders
        </Link>
      </div>
    );
  }

  const isBuyer = user?.id === order.buyerId;
  const isAdmin = Boolean(user?.roles.includes("admin"));
  const canSubmitFulfillment = isStoreOwner || (isAdmin && !isBuyer);

  return (
    <div className="mx-auto max-w-[1200px] space-y-6 px-4 pt-6 sm:px-6 lg:px-8">
      <Link
        href="/orders"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-[#6B6B6B] hover:text-[#171717]"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to My Orders
      </Link>

      {/* Top Order Banner */}
      <section className="rounded-xl border border-[#E5E7EB] bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="font-mono-light text-base text-[#315FC8]">
                {order.referenceCode}
              </span>
              <EscrowStatusBadge status={order.escrowStatus} />
            </div>
            <h1 className="mt-2 text-2xl font-medium text-[#171717]">
              Order with {order.storeName}
            </h1>
            <p className="mt-1 text-xs text-[#6B6B6B]">
              Placed {new Date(order.createdAt).toLocaleString()} by{" "}
              {order.buyerName} ({order.paymentMethod === "wallet_escrow" ? "Wallet escrow" : "Fiat escrow"})
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={openOrderConversation}
              className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-[#E5E7EB] bg-[#F7F7F5] px-4 text-xs font-medium text-[#171717] hover:border-[#171717]/30"
            >
              <MessageSquare className="h-4 w-4 text-[#6B6B6B]" />
              Order Conversation
            </button>
          </div>
        </div>

        {/* Escrow Timeline */}
        <div className="mt-6">
          <EscrowTimeline
            status={order.escrowStatus}
            events={order.escrowEvents}
            escrowMode={order.escrowMode}
          />
        </div>
      </section>

      {notice && (
        <div
          role="alert"
          className="rounded-xl border border-[#C81E1E]/25 bg-white p-4 text-sm font-medium text-[#C81E1E]"
        >
          {notice}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: Next Required Actions & Items */}
        <div className="space-y-6 lg:col-span-8">
          {/* Interactive Escrow Lifecycle Controls */}
          <section className="rounded-xl border border-[#E5E7EB] bg-white p-6">
            <h2 className="text-lg font-bold text-[#171717]">
              Available Order Actions
            </h2>

            <div className="mt-4 space-y-4">
              {order.escrowStatus === "Pending Payment" && (
                <div className="space-y-3">
                  {order.escrowMode === "unconfigured_preview" &&
                  integrations?.localSandboxEnabled ? (
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => runAction({ action: "confirm_preview_payment" })}
                        className="min-h-[44px] cursor-pointer rounded-lg bg-[#315FC8] px-5 text-sm font-semibold text-white hover:bg-[#274EA6] disabled:opacity-60"
                      >
                        Advance Preview Payment State
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => runAction({ action: "cancel_order" })}
                        className="min-h-[44px] cursor-pointer rounded-xl border border-[#E5E7EB] px-4 text-sm font-semibold text-[#6B6B6B] hover:text-[#C81E1E]"
                      >
                        Cancel Order
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E5E7EB] bg-[#F7F7F5] p-4 text-xs text-[#6B6B6B]">
                      <span>
                        {order.escrowMode === "unconfigured_preview"
                          ? "Preview payment advancement is disabled in production. Configure a live payment provider or audited escrow contract to settle orders."
                          : "Awaiting verified payment settlement from the configured settlement provider."}
                      </span>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => runAction({ action: "cancel_order" })}
                        className="min-h-[40px] shrink-0 cursor-pointer rounded-xl border border-[#E5E7EB] bg-white px-4 text-xs font-semibold text-[#6B6B6B] hover:text-[#C81E1E]"
                      >
                        Cancel Order
                      </button>
                    </div>
                  )}
                </div>
              )}

              {order.escrowStatus === "Escrow Active" && canSubmitFulfillment && (
                <div className="space-y-3 rounded-xl border border-[#E5E7EB] bg-[#F7F7F5] p-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-[#171717]">
                    <Truck className="h-4 w-4 text-[#6B6B6B]" />
                    Seller Fulfillment Submission
                  </div>
                  {order.requiresShipping && (
                    <input
                      type="text"
                      value={trackingNumber}
                      onChange={(e) => setTrackingNumber(e.target.value)}
                      placeholder="Courier tracking number (e.g. UPS-1Z999AA101)"
                      className="h-11 w-full rounded-xl border border-[#E5E7EB] bg-white px-3.5 text-sm"
                    />
                  )}
                  <textarea
                    rows={2}
                    value={fulfillmentNote}
                    onChange={(e) => setFulfillmentNote(e.target.value)}
                    placeholder="Add fulfillment confirmation, download access instructions, or delivery notes..."
                    className="w-full rounded-xl border border-[#E5E7EB] bg-white p-3 text-sm"
                  />
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      runAction({
                        action: "submit_fulfillment",
                        trackingNumber,
                        fulfillmentNote,
                      })
                    }
                    className="min-h-[44px] cursor-pointer rounded-lg bg-[#315FC8] px-5 text-sm font-semibold text-white hover:bg-[#274EA6]"
                  >
                    Submit Delivery Information
                  </button>
                </div>
              )}

              {order.escrowStatus === "Awaiting Buyer Confirmation" && (isBuyer || isAdmin) && (
                <div className="space-y-3">
                  {order.trackingNumber && (
                    <p className="text-sm text-[#171717]">
                      <strong>Tracking number:</strong>{" "}
                      <span className="font-condensed text-base font-bold text-[#315FC8]">
                        {order.trackingNumber}
                      </span>
                    </p>
                  )}
                  {order.fulfillmentNote && (
                    <p className="text-sm text-[#6B6B6B]">{order.fulfillmentNote}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => runAction({ action: "buyer_confirm_completion" })}
                      className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-lg bg-[#167A67] px-5 text-sm font-semibold text-white hover:opacity-95"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Confirm Completion &amp; Release Escrow
                    </button>
                    <button
                      type="button"
                      onClick={() => setDisputeOpen((prev) => !prev)}
                      className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl border border-[#C81E1E]/35 bg-white px-4 text-sm font-semibold text-[#C81E1E]"
                    >
                      <AlertTriangle className="h-4 w-4" />
                      Open Dispute
                    </button>
                  </div>
                </div>
              )}

              {disputeOpen && (
                <div className="space-y-3 rounded-xl border border-[#C81E1E]/25 bg-[#F7F7F5] p-4">
                  <p className="text-sm font-bold text-[#C81E1E]">
                    Open Escrow Dispute
                  </p>
                  <select
                    value={disputeReason}
                    onChange={(e) => setDisputeReason(e.target.value)}
                    className="h-10 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm"
                  >
                    <option>Item not as described</option>
                    <option>Package damaged or missing</option>
                    <option>Digital deliverable corrupted or incomplete</option>
                    <option>Service milestone not fulfilled</option>
                  </select>
                  <textarea
                    rows={3}
                    value={buyerStatement}
                    onChange={(e) => setBuyerStatement(e.target.value)}
                    placeholder="Explain what went wrong and what resolution you are requesting..."
                    className="w-full rounded-xl border border-[#E5E7EB] bg-white p-3 text-sm"
                  />
                  <input
                    type="text"
                    value={evidenceNotes}
                    onChange={(e) => setEvidenceNotes(e.target.value)}
                    placeholder="Supporting evidence reference (tracking record, screenshot notes, etc.)"
                    className="h-10 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm"
                  />
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      runAction({
                        action: "open_dispute",
                        disputeReason,
                        buyerStatement,
                        evidenceNotes,
                      })
                    }
                    className="min-h-[44px] cursor-pointer rounded-lg bg-[#C81E1E] px-5 text-sm font-semibold text-white"
                  >
                    Submit Dispute &amp; Hold Release
                  </button>
                </div>
              )}

              {dispute && (
                <div className="space-y-3 rounded-xl border border-[#C81E1E]/30 bg-[#C81E1E]/5 p-4 text-sm">
                  <p className="font-bold text-[#C81E1E]">
                    Dispute Record ({dispute.status.replace("_", " ")})
                  </p>
                  <p>
                    <strong>Reason:</strong> {dispute.reason}
                  </p>
                  <p className="text-[#6B6B6B]">
                    <strong className="text-[#171717]">Buyer statement:</strong>{" "}
                    {dispute.buyerStatement}
                  </p>
                  {dispute.sellerResponse && (
                    <p className="text-[#6B6B6B]">
                      <strong className="text-[#171717]">Seller response:</strong>{" "}
                      {dispute.sellerResponse}
                    </p>
                  )}
                  {dispute.resolutionNote && (
                    <p className="rounded-xl bg-white p-3 text-xs font-semibold text-[#167A67]">
                      Resolution ({dispute.resolvedBy}): {dispute.resolutionNote}
                    </p>
                  )}
                  {!dispute.sellerResponse && canSubmitFulfillment && (
                    <div className="space-y-2 pt-2">
                      <textarea
                        rows={2}
                        value={sellerResponse}
                        onChange={(e) => setSellerResponse(e.target.value)}
                        placeholder="Seller response with fulfillment proof..."
                        className="w-full rounded-xl border border-[#E5E7EB] bg-white p-3 text-xs"
                      />
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          runAction({
                            action: "seller_dispute_response",
                            sellerResponse,
                          })
                        }
                        className="min-h-[40px] cursor-pointer rounded-lg bg-[#315FC8] px-4 text-xs font-semibold text-white"
                      >
                        Submit Seller Response
                      </button>
                    </div>
                  )}
                </div>
              )}

              {order.escrowStatus === "Released" && (
                <p className="text-sm font-semibold text-[#167A67]">
                  Completion confirmed. Eligible items in this order can now be
                  reviewed directly on their product pages.
                </p>
              )}
            </div>
          </section>

          {/* Items Ordered */}
          <section className="rounded-xl border border-[#E5E7EB] bg-white p-6">
            <h2 className="text-lg text-[#171717]">Ordered Items</h2>
            <div className="mt-3 divide-y divide-[#F0F1F2]">
              {order.items.map((item) => (
                <div
                  key={`${item.productId}-${item.variationId || "std"}`}
                  className="flex items-center justify-between gap-4 py-3.5 first:pt-1 last:pb-0"
                >
                  <div className="flex items-center gap-3.5">
                    <Image
                      src={item.imageUrl}
                      alt={item.productTitle}
                      width={80}
                      height={56}
                      className="h-14 w-20 rounded-lg border border-[#E5E7EB] bg-[#F2F2EF] object-cover"
                    />
                    <div>
                      <Link
                        href={`/products/${item.productSlug}`}
                        className="text-sm font-medium text-[#171717] hover:text-[#315FC8]"
                      >
                        {item.productTitle}
                      </Link>
                      <p className="text-xs text-[#6B6B6B]">
                        {item.variationLabel || "Standard"} × {item.quantity}
                      </p>
                    </div>
                  </div>
                  <span className="type-price text-base">
                    {formatUsd(item.lineTotalCents)}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Right: Transparent Financial Summary */}
        <aside className="space-y-5 lg:col-span-4">
          <div className="rounded-xl border border-[#E5E7EB] bg-white p-6">
            <h2 className="text-base text-[#171717]">
              Financial Breakdown
            </h2>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between text-[#6B6B6B]">
                <dt>Subtotal</dt>
                <dd className="font-mono-light text-[#171717]">
                  {formatUsd(order.subtotalCents)}
                </dd>
              </div>
              <div className="flex justify-between text-[#6B6B6B]">
                <dt>Shipping</dt>
                <dd className="font-mono-light text-[#171717]">
                  {order.shippingCents > 0
                    ? formatUsd(order.shippingCents)
                    : order.requiresShipping
                      ? "Free tracked shipping"
                      : "Digital delivery"}
                </dd>
              </div>
              <div className="flex justify-between text-[#6B6B6B]">
                <dt>Platform fee</dt>
                <dd className="font-mono-light text-[#171717]">
                  {formatUsd(order.platformFeeCents)}
                </dd>
              </div>
              <div className="flex justify-between border-t border-[#E5E7EB] pt-3 text-base font-medium text-[#171717]">
                <dt>Total</dt>
                <dd className="type-price text-xl text-[#315FC8]">
                  {formatUsd(order.totalCents)}
                </dd>
              </div>
            </dl>
            <div className="mt-4 border-t border-[#F0F1F2] pt-3 text-xs text-[#6B6B6B]">
              <p>
                <span className="font-medium text-[#171717]">Payout status:</span>{" "}
                {order.payoutStatus.replace("_", " ")}
              </p>
              {order.walletAddressUsed && (
                <p className="mt-1">
                  <span className="font-medium text-[#171717]">Wallet used:</span>{" "}
                  {order.walletAddressUsed.slice(0, 6)}...
                  {order.walletAddressUsed.slice(-4)}
                </p>
              )}
            </div>
          </div>

          {order.shippingAddress && (
            <div className="rounded-xl border border-[#E5E7EB] bg-white p-5 text-xs">
              <h3 className="text-sm text-[#171717]">Shipping Destination</h3>
              <p className="mt-2 text-[#6B6B6B]">
                {order.shippingAddress.recipient}
                <br />
                {order.shippingAddress.line1}
                <br />
                {order.shippingAddress.city}, {order.shippingAddress.postalCode}
                <br />
                {order.shippingAddress.country}
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
