"use client";

import React, { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight, ReceiptText } from "lucide-react";
import { useWiserd } from "@/components/providers/wiserd-provider";
import { EscrowStatusBadge } from "@/components/orders/escrow-timeline";
import type { Order } from "@/lib/types";

function formatUsd(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

function OrdersListContent() {
  const searchParams = useSearchParams();
  const createdCount = Number(searchParams.get("created") || 0);
  const { user, openGoogleAuthModal } = useWiserd();
  const [orders, setOrders] = useState<Order[]>([]);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "completed" | "closed">(
    "all"
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (!active) return;
      if (!user) {
        setOrders([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      fetch("/api/orders", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : { orders: [] }))
        .then((d) => {
          if (active) setOrders(d.orders || []);
        })
        .catch(() => {})
        .finally(() => {
          if (active) setLoading(false);
        });
    });
    return () => {
      active = false;
    };
  }, [user]);

  const filteredOrders = orders.filter((order) => {
    if (statusFilter === "all") return true;
    const isCompleted = ["Released", "Paid Out"].includes(order.escrowStatus);
    const isClosed = ["Cancelled", "Refund Completed", "Disputed", "Payment Failed"].includes(
      order.escrowStatus
    );
    if (statusFilter === "completed") return isCompleted;
    if (statusFilter === "closed") return isClosed;
    return !isCompleted && !isClosed;
  });

  return (
    <div className="mx-auto max-w-[1200px] px-4 pt-8 sm:px-6 lg:px-8">
      <div className="border-b border-[#E5E7EB] pb-5">
        <p className="type-meta text-[#315FC8]">
          Order &amp; Escrow Center
        </p>
        <h1 className="mt-1 text-3xl font-medium tracking-tight text-[#171717]">
          My Orders
        </h1>
        <p className="mt-1 text-sm text-[#6B6B6B]">
          Track payment verification, escrow lifecycle status, seller
          fulfillment, delivery confirmation, and disputes.
        </p>
      </div>

      {createdCount > 1 && (
        <div
          role="status"
          className="mt-5 rounded-xl border border-[#167A67]/25 bg-[#167A67]/8 px-4 py-3 text-xs font-medium text-[#167A67]"
        >
          Your multi-store checkout created {createdCount} separate seller orders below so each storefront tracks its own shipping and escrow workflow independently.
        </div>
      )}

      {!user ? (
        <div className="mt-10 rounded-xl border border-[#E5E7EB] bg-white p-10 text-center">
          <h2 className="text-lg text-[#171717]">
            Sign in to view your orders
          </h2>
          <p className="mt-1 text-sm text-[#6B6B6B]">
            Your purchase history, digital downloads, and escrow records are
            connected to your WISERD account.
          </p>
          <button
            type="button"
            onClick={openGoogleAuthModal}
            className="mt-5 h-10 cursor-pointer rounded-lg bg-[#315FC8] px-5 text-xs font-medium text-white transition hover:bg-[#274EA6]"
          >
            Continue with Google
          </button>
        </div>
      ) : loading ? (
        <div className="mt-6 space-y-3">
          {Array.from({ length: 3 }).map((_, idx) => (
            <div key={idx} className="h-24 animate-pulse rounded-xl border border-[#E5E7EB] bg-white" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="mt-10 rounded-xl border border-[#E5E7EB] bg-white p-12 text-center">
          <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl border border-[#E5E7EB] bg-[#F7F7F5] text-[#6B6B6B]">
            <ReceiptText aria-hidden="true" className="h-5 w-5" />
          </span>
          <h2 className="mt-3 text-lg text-[#171717]">
            No orders yet
          </h2>
          <p className="mt-1 text-sm text-[#6B6B6B]">
            When you purchase a listing or receive a store order, its full
            escrow timeline appears here.
          </p>
          <Link
            href="/marketplace"
            className="mt-5 inline-flex h-10 items-center rounded-lg bg-[#315FC8] px-5 text-xs font-medium text-white transition hover:bg-[#274EA6]"
          >
            Explore Marketplace
          </Link>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {orders.length > 3 && (
            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  { id: "all", label: `All (${orders.length})` },
                  { id: "active", label: "Active" },
                  { id: "completed", label: "Completed" },
                  { id: "closed", label: "Disputed & Cancelled" },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  aria-pressed={statusFilter === tab.id}
                  onClick={() => setStatusFilter(tab.id)}
                  className={`h-8 cursor-pointer rounded-lg border px-3 text-xs transition ${
                    statusFilter === tab.id
                      ? "border-[#171717] bg-[#171717] text-white"
                      : "border-[#E5E7EB] bg-white text-[#6B6B6B] hover:border-[#171717]/30 hover:text-[#171717]"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}

          {filteredOrders.length === 0 ? (
            <div className="rounded-xl border border-[#E5E7EB] bg-white p-8 text-center text-xs text-[#6B6B6B]">
              No orders in this status view.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredOrders.map((order) => (
                <Link
                  key={order.id}
                  href={`/orders/${order.id}`}
                  className="block rounded-xl border border-[#E5E7EB] bg-white p-5 transition hover:border-[#171717]/25"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="font-mono-light text-sm text-[#315FC8]">
                          {order.referenceCode}
                        </span>
                        <EscrowStatusBadge status={order.escrowStatus} />
                      </div>
                      <p className="mt-1 text-sm font-medium text-[#171717]">
                        {order.storeName} · {order.items.length}{" "}
                        {order.items.length === 1 ? "item" : "items"}
                      </p>
                      <p className="text-xs text-[#6B6B6B]">
                        {order.items.map((i) => i.productTitle).join(", ")}
                      </p>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="type-price text-lg">
                          {formatUsd(order.totalCents)}
                        </p>
                        <p className="font-mono-light text-xs text-[#6B6B6B]">
                          {new Date(order.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <ArrowRight aria-hidden="true" className="h-4 w-4 text-[#6B6B6B]" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function OrdersListPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-[1200px] px-4 py-12 text-sm text-[#6B6B6B]">
          Loading orders...
        </div>
      }
    >
      <OrdersListContent />
    </Suspense>
  );
}
