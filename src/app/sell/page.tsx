"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Store as StoreIcon,
  Package,
  ReceiptText,
  Settings,
  BadgeCheck,
  ArrowUpRight,
  AlertTriangle,
  Pencil,
  Trash2,
  MessageSquare,
  Wallet,
  Check,
} from "lucide-react";
import { useWiserd } from "@/components/providers/wiserd-provider";
import { WiserdMeter } from "@/components/ui/wiserd-meter";
import { CardSkeleton, StatusBanner } from "@/components/ui/state-blocks";
import { EscrowStatusBadge } from "@/components/orders/escrow-timeline";
import { formatCategoryLabel } from "@/lib/commerce";
import type {
  Order,
  PayoutProvider,
  Product,
  ProductCategory,
  Review,
  Store,
  StorePayoutDestination,
} from "@/lib/types";

const PAYOUT_PROVIDERS: Array<{
  id: PayoutProvider;
  label: string;
  hint: string;
  placeholder: string;
}> = [
  {
    id: "paypal",
    label: "PayPal",
    hint: "International USD payouts via PayPal email",
    placeholder: "payouts@yourstudio.com",
  },
  {
    id: "wise",
    label: "Wise",
    hint: "Low-fee multi-currency payout via Wise email or @wisetag",
    placeholder: "payouts@yourstudio.com or @yourtag",
  },
  {
    id: "stripe_connect",
    label: "Stripe Connect",
    hint: "Direct marketplace split settlement for global sellers",
    placeholder: "stripe-account@yourstudio.com",
  },
  {
    id: "payoneer",
    label: "Payoneer",
    hint: "Cross-border payouts in USD, EUR, or GBP",
    placeholder: "payoneer@yourstudio.com",
  },
  {
    id: "crypto_wallet",
    label: "Crypto Wallet (USDC / ETH)",
    hint: "Onchain settlement to an EVM address (MetaMask, Rainbow, etc.)",
    placeholder: "0x...",
  },
];

const CRYPTO_NETWORKS = ["Base", "Ethereum", "Arbitrum", "Optimism", "Polygon"] as const;

function payoutProviderLabel(provider?: PayoutProvider): string {
  return PAYOUT_PROVIDERS.find((p) => p.id === provider)?.label || "Not configured";
}

interface SellerSnapshot {
  store:
    | (Store & {
        rating: number | null;
        reviewCount: number;
        listingCount: number;
        totalListingCount: number;
        orderCount: number;
        totalSalesCents: number;
        profileCompletion: number;
        payoutDestination?: StorePayoutDestination | null;
      })
    | null;
  listings: Product[];
  orders: Order[];
  reviews?: Review[];
}

function formatUsd(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

export default function SellDashboardPage() {
  const { user, wallets, openGoogleAuthModal, openWalletModal, refreshSession } = useWiserd();
  const [snapshot, setSnapshot] = useState<SellerSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<
    "overview" | "products" | "orders" | "reviews" | "payouts" | "settings"
  >("overview");
  const [notice, setNotice] = useState<{ tone: "success" | "error"; message: string } | null>(
    null
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [busyListingId, setBusyListingId] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});

  // International Payout Destination form
  const [payoutProvider, setPayoutProvider] = useState<PayoutProvider>("paypal");
  const [payoutHolder, setPayoutHolder] = useState("");
  const [payoutDestination, setPayoutDestination] = useState("");
  const [payoutNetwork, setPayoutNetwork] = useState<string>("Base");
  const [savingPayout, setSavingPayout] = useState(false);

  // Onboarding / Store Settings form
  const [storeName, setStoreName] = useState("");
  const [tagline, setTagline] = useState("");
  const [description, setDescription] = useState("");
  const [shippingPolicy, setShippingPolicy] = useState(
    "Dispatched or delivered digitally within 2 business days with status submitted in WISERD."
  );
  const [refundPolicy, setRefundPolicy] = useState(
    "14-day return policy for unused physical items; 72-hour digital file integrity review."
  );

  // New Listing Form (category-adaptive)
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<ProductCategory>("physical");
  const [productType, setProductType] = useState("Hardware");
  const [priceDollars, setPriceDollars] = useState("75");
  const [stock, setStock] = useState("10");
  const [summary, setSummary] = useState("");
  const [listingDesc, setListingDesc] = useState("");
  const [deliveryInfo, setDeliveryInfo] = useState("");
  const [saving, setSaving] = useState(false);

  const loadMine = useCallback(async () => {
    try {
      const res = await fetch("/api/stores?mine=true", { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as SellerSnapshot;
        setSnapshot(data);
        if (data.store) {
          setStoreName(data.store.name);
          setTagline(data.store.tagline);
          setDescription(data.store.description);
          setShippingPolicy(data.store.shippingPolicy);
          setRefundPolicy(data.store.refundPolicy);
          if (data.store.payoutDestination) {
            setPayoutProvider(data.store.payoutDestination.provider);
            setPayoutHolder(data.store.payoutDestination.accountHolder);
            setPayoutDestination(data.store.payoutDestination.destination);
            if (data.store.payoutDestination.networkName) {
              setPayoutNetwork(data.store.payoutDestination.networkName);
            }
          }
        }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (!active) return;
      if (!user) {
        setSnapshot(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      loadMine();
    });
    return () => {
      active = false;
    };
  }, [loadMine, user]);

  const handleSaveStore = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setNotice(null);
    try {
      const res = await fetch("/api/stores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: storeName,
          tagline,
          description,
          shippingPolicy,
          refundPolicy,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNotice({ tone: "error", message: data.error || "Could not save store." });
      } else {
        setNotice({ tone: "success", message: "Storefront saved and live on WISERD." });
        await refreshSession();
        await loadMine();
      }
    } catch {
      setNotice({ tone: "error", message: "Connection lost while saving storefront." });
    } finally {
      setSaving(false);
    }
  };

  const handleCreateListing = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setNotice(null);
    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingId || undefined,
          title,
          category,
          productType,
          priceDollars: Number(priceDollars),
          stock: category === "digital" ? 999 : Number(stock),
          summary,
          description: listingDesc,
          imageUrl: imageUrl.trim() || undefined,
          deliveryInfo:
            deliveryInfo ||
            (category === "digital"
              ? "Instant digital file delivery upon verified payment."
              : "Tracked delivery submitted inside WISERD Orders."),
          refundConditions: refundPolicy,
          status: "published",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNotice({ tone: "error", message: data.error || "Could not save listing." });
      } else {
        const wasEditing = Boolean(editingId);
        setEditingId(null);
        setTitle("");
        setSummary("");
        setListingDesc("");
        setDeliveryInfo("");
        setImageUrl("");
        setNotice({
          tone: "success",
          message: wasEditing
            ? `Updated "${data.product.title}".`
            : `Published "${data.product.title}" to the marketplace.`,
        });
        await loadMine();
      }
    } catch {
      setNotice({ tone: "error", message: "Connection lost while saving listing." });
    } finally {
      setSaving(false);
    }
  };

  const startEditListing = (prod: Product) => {
    setEditingId(prod.id);
    setTitle(prod.title);
    setCategory(prod.category);
    setProductType(prod.productType);
    setPriceDollars(String(prod.priceCents / 100));
    setStock(String(prod.stock >= 999 ? 10 : prod.stock));
    setSummary(prod.summary);
    setListingDesc(prod.description);
    setDeliveryInfo(prod.deliveryInfo);
    setImageUrl(prod.imageUrl);
    setNotice(null);
  };

  const handleDeleteListing = async (prod: Product) => {
    if (confirmDeleteId !== prod.id) {
      setConfirmDeleteId(prod.id);
      return;
    }
    setConfirmDeleteId(null);
    setBusyListingId(prod.id);
    setNotice(null);
    try {
      const res = await fetch(`/api/products?id=${encodeURIComponent(prod.id)}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNotice({ tone: "error", message: data.error || "Could not remove listing." });
      } else {
        if (editingId === prod.id) setEditingId(null);
        setNotice({ tone: "success", message: `Removed "${prod.title}" from your storefront.` });
        await loadMine();
      }
    } catch {
      setNotice({ tone: "error", message: "Connection lost while removing listing." });
    } finally {
      setBusyListingId(null);
    }
  };

  const handleReplyReview = async (reviewId: string) => {
    const reply = (replyDrafts[reviewId] || "").trim();
    if (!reply) return;
    setNotice(null);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "seller_reply", reviewId, reply }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNotice({ tone: "error", message: data.error || "Could not publish reply." });
      } else {
        setReplyDrafts((prev) => ({ ...prev, [reviewId]: "" }));
        setNotice({ tone: "success", message: "Seller reply published." });
        await loadMine();
      }
    } catch {
      setNotice({ tone: "error", message: "Connection lost while posting reply." });
    }
  };

  const toggleListingStatus = async (prod: Product) => {
    if (prod.status === "moderated") return;
    setBusyListingId(prod.id);
    setNotice(null);
    const nextStatus = prod.status === "published" ? "paused" : "published";
    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: prod.id,
          title: prod.title,
          category: prod.category,
          productType: prod.productType,
          summary: prod.summary,
          description: prod.description,
          priceDollars: prod.priceCents / 100,
          stock: prod.stock,
          imageUrl: prod.imageUrl,
          deliveryInfo: prod.deliveryInfo,
          refundConditions: prod.refundConditions,
          status: nextStatus,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNotice({ tone: "error", message: data.error || "Could not update listing status." });
      } else {
        setNotice({
          tone: "success",
          message:
            nextStatus === "paused"
              ? `Paused "${prod.title}".`
              : `Published "${prod.title}" to the marketplace.`,
        });
        await loadMine();
      }
    } catch {
      setNotice({ tone: "error", message: "Connection lost while updating listing status." });
    } finally {
      setBusyListingId(null);
    }
  };

  const handleSavePayout = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPayout(true);
    setNotice(null);
    try {
      const res = await fetch("/api/stores", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_payout",
          provider: payoutProvider,
          accountHolder: payoutHolder,
          destination: payoutDestination,
          networkName: payoutProvider === "crypto_wallet" ? payoutNetwork : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNotice({
          tone: "error",
          message: data.error || "Could not save payout destination.",
        });
      } else {
        setNotice({
          tone: "success",
          message: `${payoutProviderLabel(payoutProvider)} payout destination saved. Future released orders will route here once live settlement is enabled.`,
        });
        await loadMine();
      }
    } catch {
      setNotice({ tone: "error", message: "Connection lost while saving payout settings." });
    } finally {
      setSavingPayout(false);
    }
  };

  const handleClearPayout = async () => {
    setSavingPayout(true);
    setNotice(null);
    try {
      const res = await fetch("/api/stores", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "clear_payout" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setNotice({ tone: "error", message: data.error || "Could not remove payout destination." });
      } else {
        setPayoutHolder("");
        setPayoutDestination("");
        setNotice({ tone: "success", message: "Payout destination removed." });
        await loadMine();
      }
    } catch {
      setNotice({ tone: "error", message: "Connection lost while removing payout settings." });
    } finally {
      setSavingPayout(false);
    }
  };

  if (!user) {
    return (
      <div className="mx-auto max-w-[960px] px-4 pt-12 sm:px-6 lg:px-8">
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-8 text-center sm:p-12">
          <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl border border-[#E5E7EB] bg-[#F7F7F5] text-[#6B6B6B]">
            <StoreIcon className="h-5 w-5" />
          </span>
          <h1 className="mt-4 text-3xl font-medium text-[#171717]">
            Open your storefront on WISERD
          </h1>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-[#6B6B6B]">
            Sell physical goods, digital templates, publisher-safe gaming
            products, or fixed-scope services with clear escrow terms and direct
            buyer messaging.
          </p>
          <button
            type="button"
            onClick={openGoogleAuthModal}
            className="mt-6 h-10 cursor-pointer rounded-lg bg-[#315FC8] px-7 text-sm font-semibold text-white hover:bg-[#274EA6]"
          >
            Sign in with Google to get started
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-[1320px] px-4 pt-8 sm:px-6 lg:px-8">
        <CardSkeleton rows={4} />
      </div>
    );
  }

  const store = snapshot?.store || null;

  // Guided Seller Onboarding when user doesn't have a store yet
  if (!store) {
    return (
      <div className="mx-auto max-w-[820px] px-4 pt-8 sm:px-6 lg:px-8">
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-6 sm:p-8">
          <p className="type-meta text-[#315FC8]">
            Seller Onboarding
          </p>
          <h1 className="mt-1 text-3xl font-medium tracking-tight text-[#171717]">
            Launch your WISERD storefront
          </h1>
          <p className="mt-2 text-sm text-[#6B6B6B]">
            Complete your storefront profile and policies. Your store opens with
            Pending Verification status until reviewed by a WISERD
            administrator.
          </p>

          <form onSubmit={handleSaveStore} className="mt-6 space-y-4">
            <div>
              <label htmlFor="onb-name" className="text-xs font-semibold text-[#171717]">
                Store name
              </label>
              <input
                id="onb-name"
                required
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                placeholder="e.g. Northlight Studio Goods"
                className="mt-1 h-11 w-full rounded-lg border border-[#E5E7EB] bg-white px-3.5 text-sm text-[#171717] placeholder:text-[#6B6B6B]"
              />
            </div>
            <div>
              <label htmlFor="onb-tag" className="text-xs font-semibold text-[#171717]">
                Short tagline
              </label>
              <input
                id="onb-tag"
                required
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                placeholder="What do you make or offer?"
                className="mt-1 h-11 w-full rounded-lg border border-[#E5E7EB] bg-white px-3.5 text-sm text-[#171717] placeholder:text-[#6B6B6B]"
              />
            </div>
            <div>
              <label htmlFor="onb-desc" className="text-xs font-semibold text-[#171717]">
                Store description
              </label>
              <textarea
                id="onb-desc"
                rows={3}
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Tell buyers about your craft, turnaround times, and support."
                className="mt-1 w-full rounded-lg border border-[#E5E7EB] bg-white p-3 text-sm"
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="onb-ship" className="text-xs font-semibold text-[#171717]">
                  Delivery &amp; shipping policy
                </label>
                <textarea
                  id="onb-ship"
                  rows={2}
                  value={shippingPolicy}
                  onChange={(e) => setShippingPolicy(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#E5E7EB] bg-white p-3 text-xs"
                />
              </div>
              <div>
                <label htmlFor="onb-refund" className="text-xs font-semibold text-[#171717]">
                  Refund &amp; return policy
                </label>
                <textarea
                  id="onb-refund"
                  rows={2}
                  value={refundPolicy}
                  onChange={(e) => setRefundPolicy(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#E5E7EB] bg-white p-3 text-xs"
                />
              </div>
            </div>

            {notice && (
              <StatusBanner tone={notice.tone} message={notice.message} />
            )}

            <button
              type="submit"
              disabled={saving}
              className="h-11 cursor-pointer rounded-lg bg-[#315FC8] px-6 text-sm font-semibold text-white hover:bg-[#274EA6]"
            >
              {saving ? "Creating storefront..." : "Publish Storefront"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const listings = snapshot?.listings || [];
  const orders = snapshot?.orders || [];
  const storeReviews = snapshot?.reviews || [];
  const pendingOrders = orders.filter(
    (o) => !["Released", "Paid Out", "Cancelled", "Refund Completed"].includes(o.escrowStatus)
  );
  const completedOrders = orders.filter((o) =>
    ["Released", "Paid Out"].includes(o.escrowStatus)
  );

  return (
    <div className="mx-auto max-w-[1320px] space-y-6 px-4 pt-8 sm:px-6 lg:px-8">
      {/* Seller Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#E5E7EB] pb-5">
        <div>
          <p className="type-meta text-[#315FC8]">
            Seller Dashboard
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="text-3xl text-[#171717]">
              {store.name}
            </h1>
            <span
              className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium ${
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
                ? "Verified Seller"
                : store.verificationStatus === "action_required"
                  ? "Action Required"
                  : "Pending Verification"}
            </span>
          </div>
        </div>

        <Link
          href={`/stores/${store.slug}`}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-4 text-xs font-medium text-[#171717] hover:border-[#315FC8]/40"
        >
          View Public Storefront <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5 text-[#6B6B6B]" />
        </Link>
      </div>

      {/* Navigation Tabs */}
      <div role="tablist" aria-label="Seller dashboard sections" className="flex flex-wrap gap-2">
        {[
          { id: "overview", label: "Overview", icon: StoreIcon },
          { id: "products", label: `Products (${listings.length})`, icon: Package },
          { id: "orders", label: `Orders (${orders.length})`, icon: ReceiptText },
          { id: "reviews", label: `Reviews (${storeReviews.length})`, icon: MessageSquare },
          { id: "payouts", label: "Payouts", icon: Wallet },
          { id: "settings", label: "Store Settings", icon: Settings },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              role="tab"
              type="button"
              aria-selected={tab === item.id}
              onClick={() => setTab(item.id as typeof tab)}
              className={`inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg px-4 text-xs font-medium transition ${
                tab === item.id
                  ? "bg-[#315FC8] text-white"
                  : "border border-[#E5E7EB] bg-white text-[#171717] hover:border-[#315FC8]/40"
              }`}
            >
              <Icon aria-hidden="true" className="h-3.5 w-3.5" />
              {item.label}
            </button>
          );
        })}
      </div>

      {notice && (
        <StatusBanner tone={notice.tone} message={notice.message} />
      )}

      {/* Overview Tab with Base UI Meter Components (real data only!) */}
      {tab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div className="rounded-xl border border-[#E5E7EB] bg-white p-5">
              <p className="type-meta">Recorded sales</p>
              <p className="type-price mt-1 text-2xl">
                {formatUsd(store.totalSalesCents)}
              </p>
            </div>
            <div className="rounded-xl border border-[#E5E7EB] bg-white p-5">
              <p className="type-meta">Active listings</p>
              <p className="font-mono-light mt-1 text-3xl text-[#171717]">
                {store.listingCount}
              </p>
            </div>
            <div className="rounded-xl border border-[#E5E7EB] bg-white p-5">
              <p className="type-meta">Pending orders</p>
              <p className="font-mono-light mt-1 text-3xl text-[#315FC8]">
                {pendingOrders.length}
              </p>
            </div>
            <div className="rounded-xl border border-[#E5E7EB] bg-white p-5">
              <p className="type-meta">Completed orders</p>
              <p className="font-mono-light mt-1 text-3xl text-[#167A67]">
                {completedOrders.length}
              </p>
            </div>
          </div>

          {/* Base UI Meter Section (numerical range values ONLY) */}
          <section className="rounded-xl border border-[#E5E7EB] bg-white p-6">
            <h2 className="text-lg text-[#171717]">
              Store Capacity &amp; Readiness
            </h2>
            <p className="mt-1 text-xs text-[#6B6B6B]">
              Measured directly from your live storefront configuration and
              listing records.
            </p>
            <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-3">
              <WiserdMeter
                label="Seller Profile Completion"
                value={store.profileCompletion}
                max={100}
                tone="success"
                helperText="Calculated from store info, policies, active listings, verification, and payout setup."
              />
              <WiserdMeter
                label="Storage Used"
                value={store.storageUsedMb}
                max={store.storageLimitMb}
                formattedValue={`${store.storageUsedMb} / ${store.storageLimitMb} MB`}
                tone="blue"
                helperText="Media & digital deliverable storage allocated to your storefront."
              />
              <WiserdMeter
                label="Monthly Listing Quota"
                value={store.totalListingCount}
                max={store.monthlyListingLimit}
                formattedValue={`${store.totalListingCount} / ${store.monthlyListingLimit}`}
                tone="violet"
                helperText="Active and draft listings counted against your store plan limit."
              />
            </div>
          </section>

          <section className="rounded-xl border border-[#E5E7EB] bg-white p-5 text-xs text-[#6B6B6B]">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-start gap-2.5">
                {store.payoutDestination ? (
                  <Check aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-[#167A67]" />
                ) : (
                  <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-[#B45309]" />
                )}
                <div>
                  <p className="font-medium text-[#171717]">
                    Payout Destination:{" "}
                    {store.payoutDestination
                      ? `${payoutProviderLabel(store.payoutDestination.provider)} (${store.payoutDestination.destination})`
                      : "Not Configured"}
                  </p>
                  <p className="mt-0.5">
                    {store.payoutDestination
                      ? `Status: ${store.payoutStatus}. Released order earnings (minus 3% WISERD fee) route to this destination once live disbursement is active.`
                      : "Add your international e-wallet (PayPal, Wise, Stripe Connect, Payoneer) or crypto wallet address to receive order payouts."}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTab("payouts")}
                className="h-9 shrink-0 cursor-pointer rounded-lg border border-[#E5E7EB] bg-[#F7F7F5] px-3.5 text-xs font-medium text-[#171717] hover:border-[#171717]/30"
              >
                {store.payoutDestination ? "Manage Payouts" : "Set up Payouts"}
              </button>
            </div>
          </section>
        </div>
      )}

      {/* Products Manager Tab */}
      {tab === "products" && (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          <form
            onSubmit={handleCreateListing}
            className="space-y-4 rounded-xl border border-[#E5E7EB] bg-white p-6 lg:col-span-5"
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg text-[#171717]">
                {editingId ? "Edit Listing" : "Publish New Listing"}
              </h2>
              {editingId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(null);
                    setTitle("");
                    setSummary("");
                    setListingDesc("");
                    setDeliveryInfo("");
                    setImageUrl("");
                  }}
                  className="cursor-pointer text-xs text-[#6B6B6B] hover:text-[#171717]"
                >
                  Cancel edit
                </button>
              )}
            </div>
            <div>
              <label htmlFor="prod-cat" className="text-xs font-semibold text-[#171717]">
                Category (adapts form requirements)
              </label>
              <select
                id="prod-cat"
                value={category}
                onChange={(e) => {
                  const next = e.target.value as ProductCategory;
                  setCategory(next);
                  setProductType(
                    next === "physical"
                      ? "Hardware"
                      : next === "digital"
                        ? "Digital Template"
                        : next === "gaming"
                          ? "Gaming Asset"
                          : "Creative Service"
                  );
                }}
                className="mt-1 h-11 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm"
              >
                <option value="physical">Physical Product</option>
                <option value="digital">Digital Product</option>
                <option value="gaming">Gaming Product</option>
                <option value="services">Service</option>
              </select>
            </div>
            <div>
              <label htmlFor="prod-title" className="text-xs font-semibold text-[#171717]">
                Product title
              </label>
              <input
                id="prod-title"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Clear, descriptive product title"
                className="mt-1 h-11 w-full rounded-lg border border-[#E5E7EB] bg-white px-3.5 text-sm text-[#171717] placeholder:text-[#6B6B6B]"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="prod-price" className="text-xs font-semibold text-[#171717]">
                  Price (USD)
                </label>
                <input
                  id="prod-price"
                  type="number"
                  min="1"
                  step="0.01"
                  required
                  value={priceDollars}
                  onChange={(e) => setPriceDollars(e.target.value)}
                  className="mt-1 h-11 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm"
                />
              </div>
              {category !== "digital" ? (
                <div>
                  <label htmlFor="prod-stock" className="text-xs font-semibold text-[#171717]">
                    {category === "services" ? "Monthly slots" : "Stock count"}
                  </label>
                  <input
                    id="prod-stock"
                    type="number"
                    min="1"
                    required
                    value={stock}
                    onChange={(e) => setStock(e.target.value)}
                    className="mt-1 h-11 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm"
                  />
                </div>
              ) : (
                <div className="flex items-end pb-2 text-xs text-[#167A67]">
                  Instant unlimited digital stock
                </div>
              )}
            </div>
            <div>
              <label htmlFor="prod-summary" className="text-xs font-semibold text-[#171717]">
                One-line summary
              </label>
              <input
                id="prod-summary"
                required
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="Key value proposition shown on product cards"
                className="mt-1 h-11 w-full rounded-lg border border-[#E5E7EB] bg-white px-3.5 text-sm text-[#171717] placeholder:text-[#6B6B6B]"
              />
            </div>
            <div>
              <label htmlFor="prod-desc" className="text-xs font-semibold text-[#171717]">
                Full description
              </label>
              <textarea
                id="prod-desc"
                rows={3}
                required
                value={listingDesc}
                onChange={(e) => setListingDesc(e.target.value)}
                placeholder="Specifications, compatibility, deliverables, and what buyers receive..."
                className="mt-1 w-full rounded-lg border border-[#E5E7EB] bg-white p-3 text-sm"
              />
            </div>
            <div>
              <label htmlFor="prod-delivery" className="text-xs font-semibold text-[#171717]">
                {category === "digital"
                  ? "Digital delivery & license format"
                  : category === "services"
                    ? "Turnaround & milestone delivery"
                    : "Shipping & fulfillment timeline"}
              </label>
              <input
                id="prod-delivery"
                value={deliveryInfo}
                onChange={(e) => setDeliveryInfo(e.target.value)}
                placeholder="Optional custom delivery details"
                className="mt-1 h-11 w-full rounded-lg border border-[#E5E7EB] bg-white px-3.5 text-sm text-[#171717] placeholder:text-[#6B6B6B]"
              />
            </div>
            <div>
              <label htmlFor="prod-img" className="text-xs font-medium text-[#171717]">
                Product image URL (optional)
              </label>
              <input
                id="prod-img"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="/catalog/keyboard.webp or https://..."
                className="mt-1 h-10 w-full rounded-lg border border-[#E5E7EB] bg-white px-3.5 text-sm text-[#171717] placeholder:text-[#6B6B6B]"
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="h-10 w-full cursor-pointer rounded-lg bg-[#315FC8] text-sm font-medium text-white hover:bg-[#274EA6]"
            >
              {saving ? "Saving..." : editingId ? "Save Changes" : "Publish Listing"}
            </button>
          </form>

          <div className="space-y-3 lg:col-span-7">
            <h2 className="text-lg font-medium text-[#171717]">
              Your Store Listings ({listings.length})
            </h2>
            {listings.length === 0 ? (
              <div className="rounded-xl border border-[#E5E7EB] bg-white p-8 text-sm text-[#6B6B6B]">
                No listings yet. Use the form on the left to publish your first
                product.
              </div>
            ) : (
              listings.map((prod) => (
                <div
                  key={prod.id}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#E5E7EB] bg-white p-4"
                >
                  <div className="flex items-center gap-3.5">
                    <Image
                      src={prod.imageUrl}
                      alt={prod.title}
                      width={80}
                      height={56}
                      className="h-14 w-20 rounded-lg border border-[#E5E7EB] object-cover"
                    />
                    <div>
                      <Link
                        href={`/products/${prod.slug}`}
                        className="text-sm font-medium text-[#171717] hover:text-[#315FC8]"
                      >
                        {prod.title}
                      </Link>
                      <p className="text-xs text-[#6B6B6B]">
                        {formatUsd(prod.priceCents)} · {formatCategoryLabel(prod.category)} · Status:{" "}
                        <span className="font-medium capitalize text-[#171717]">
                          {prod.status}
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={busyListingId === prod.id}
                      onClick={() => startEditListing(prod)}
                      className="inline-flex h-9 cursor-pointer items-center gap-1 rounded-lg border border-[#E5E7EB] bg-white px-3 text-xs font-medium text-[#171717] hover:border-[#315FC8]/40 disabled:opacity-50"
                    >
                      <Pencil aria-hidden="true" className="h-3.5 w-3.5 text-[#6B6B6B]" />
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={busyListingId === prod.id || prod.status === "moderated"}
                      onClick={() => toggleListingStatus(prod)}
                      className="h-9 cursor-pointer rounded-lg border border-[#E5E7EB] bg-white px-3 text-xs font-medium text-[#171717] hover:border-[#315FC8]/40 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {prod.status === "moderated"
                        ? "Under Review"
                        : prod.status === "published"
                          ? "Pause"
                          : "Publish"}
                    </button>
                    <button
                      type="button"
                      disabled={busyListingId === prod.id}
                      aria-label={`Delete ${prod.title}`}
                      onClick={() => handleDeleteListing(prod)}
                      className={`inline-flex h-9 cursor-pointer items-center justify-center rounded-lg px-2.5 text-xs font-medium transition disabled:opacity-50 ${
                        confirmDeleteId === prod.id
                          ? "bg-[#C81E1E] text-white"
                          : "border border-[#E5E7EB] bg-white text-[#6B6B6B] hover:border-[#C81E1E]/40 hover:text-[#C81E1E]"
                      }`}
                    >
                      {confirmDeleteId === prod.id ? (
                        "Confirm?"
                      ) : (
                        <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Store Reviews Tab */}
      {tab === "reviews" && (
        <div className="space-y-3">
          {storeReviews.length === 0 ? (
            <div className="rounded-xl border border-[#E5E7EB] bg-white p-10 text-center text-sm text-[#6B6B6B]">
              No verified customer reviews yet.
            </div>
          ) : (
            storeReviews.map((rev) => (
              <div
                key={rev.id}
                className="rounded-xl border border-[#E5E7EB] bg-white p-5 text-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-[#171717]">{rev.buyerName}</span>
                  <span className="font-mono-light text-[#315FC8]">{rev.rating} / 5</span>
                </div>
                <p className="mt-1.5 text-sm text-[#6B6B6B]">{rev.comment}</p>
                {rev.sellerReply ? (
                  <p className="mt-3 rounded-lg bg-[#F7F7F5] p-3 text-xs text-[#171717]">
                    <span className="font-medium">Your reply: </span>
                    {rev.sellerReply}
                  </p>
                ) : (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleReplyReview(rev.id);
                    }}
                    className="mt-3 flex gap-2"
                  >
                    <input
                      aria-label={`Reply to ${rev.buyerName}`}
                      value={replyDrafts[rev.id] || ""}
                      onChange={(e) =>
                        setReplyDrafts((prev) => ({ ...prev, [rev.id]: e.target.value }))
                      }
                      placeholder="Write a public seller reply..."
                      className="h-9 flex-1 rounded-lg border border-[#E5E7EB] bg-[#F7F7F5] px-3 text-xs"
                    />
                    <button
                      type="submit"
                      className="h-9 cursor-pointer rounded-lg bg-[#315FC8] px-3.5 text-xs font-medium text-white hover:bg-[#274EA6]"
                    >
                      Reply
                    </button>
                  </form>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Store Orders Tab */}
      {tab === "orders" && (
        <div className="space-y-3">
          {orders.length === 0 ? (
            <div className="rounded-xl border border-[#E5E7EB] bg-white p-10 text-center text-sm text-[#6B6B6B]">
              No incoming store orders yet.
            </div>
          ) : (
            orders.map((order) => (
              <Link
                key={order.id}
                href={`/orders/${order.id}`}
                className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#E5E7EB] bg-white p-5 hover:border-[#315FC8]/40"
              >
                <div>
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono-light text-sm text-[#315FC8]">
                      {order.referenceCode}
                    </span>
                    <EscrowStatusBadge status={order.escrowStatus} />
                  </div>
                  <p className="mt-1 text-sm font-medium text-[#171717]">
                    Buyer: {order.buyerName}
                  </p>
                </div>
                <span className="type-price text-lg">
                  {formatUsd(order.totalCents)}
                </span>
              </Link>
            ))
          )}
        </div>
      )}

      {/* International Seller Payouts Tab */}
      {tab === "payouts" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <form
            onSubmit={handleSavePayout}
            className="space-y-5 rounded-xl border border-[#E5E7EB] bg-white p-6 lg:col-span-7"
          >
            <div>
              <h2 className="text-lg text-[#171717]">Payout Destination</h2>
              <p className="mt-1 text-xs text-[#6B6B6B]">
                Choose where WISERD routes your net earnings (order subtotal minus 3% platform fee) once buyer escrow releases. Kept private — never shown publicly.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {PAYOUT_PROVIDERS.map((prov) => {
                const selected = payoutProvider === prov.id;
                return (
                  <button
                    key={prov.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => {
                      setPayoutProvider(prov.id);
                      if (store.payoutDestination?.provider === prov.id) {
                        setPayoutDestination(store.payoutDestination.destination);
                        setPayoutHolder(store.payoutDestination.accountHolder);
                        if (store.payoutDestination.networkName) {
                          setPayoutNetwork(store.payoutDestination.networkName);
                        }
                        return;
                      }
                      if (prov.id === "crypto_wallet") {
                        setPayoutDestination(
                          payoutDestination.startsWith("0x")
                            ? payoutDestination
                            : wallets[0]?.address || ""
                        );
                        if (!payoutHolder && user) setPayoutHolder(user.displayName);
                      } else if (payoutDestination.startsWith("0x")) {
                        setPayoutDestination("");
                      }
                    }}
                    className={`cursor-pointer rounded-xl border p-3.5 text-left transition ${
                      selected
                        ? "border-[#171717] bg-[#F7F7F5]"
                        : "border-[#E5E7EB] bg-white hover:border-[#171717]/30"
                    }`}
                  >
                    <p className="text-xs font-medium text-[#171717]">{prov.label}</p>
                    <p className="mt-0.5 text-[11px] leading-snug text-[#6B6B6B]">
                      {prov.hint}
                    </p>
                  </button>
                );
              })}
            </div>

            <div className="space-y-4">
              <div>
                <label htmlFor="payout-holder" className="text-xs font-medium text-[#171717]">
                  Account holder or studio beneficiary name
                </label>
                <input
                  id="payout-holder"
                  required
                  value={payoutHolder}
                  onChange={(e) => setPayoutHolder(e.target.value)}
                  placeholder={user.displayName}
                  className="mt-1 h-10 w-full rounded-lg border border-[#E5E7EB] bg-white px-3.5 text-sm text-[#171717]"
                />
              </div>

              <div>
                <div className="flex items-center justify-between gap-2">
                  <label htmlFor="payout-dest" className="text-xs font-medium text-[#171717]">
                    {payoutProvider === "crypto_wallet"
                      ? "EVM payout wallet address (0x...)"
                      : payoutProvider === "wise"
                        ? "Wise email or @wisetag"
                        : `${payoutProviderLabel(payoutProvider)} account email`}
                  </label>
                  {payoutProvider === "crypto_wallet" && wallets[0] && (
                    <button
                      type="button"
                      onClick={() => {
                        setPayoutDestination(wallets[0].address);
                        if (!payoutHolder) setPayoutHolder(user.displayName);
                      }}
                      className="cursor-pointer text-[11px] font-medium text-[#315FC8] hover:underline"
                    >
                      Use connected {wallets[0].walletName}
                    </button>
                  )}
                </div>
                <input
                  id="payout-dest"
                  required
                  value={payoutDestination}
                  onChange={(e) => setPayoutDestination(e.target.value)}
                  placeholder={
                    PAYOUT_PROVIDERS.find((p) => p.id === payoutProvider)?.placeholder
                  }
                  className={`mt-1 h-10 w-full rounded-lg border border-[#E5E7EB] bg-white px-3.5 text-sm text-[#171717] ${
                    payoutProvider === "crypto_wallet" ? "font-mono-light" : ""
                  }`}
                />
                {payoutProvider === "crypto_wallet" && wallets.length === 0 && (
                  <button
                    type="button"
                    onClick={openWalletModal}
                    className="mt-1.5 cursor-pointer text-xs font-medium text-[#315FC8] hover:underline"
                  >
                    Connect MetaMask or Rainbow to auto-verify ownership
                  </button>
                )}
              </div>

              {payoutProvider === "crypto_wallet" && (
                <div>
                  <label htmlFor="payout-net" className="text-xs font-medium text-[#171717]">
                    Preferred settlement network
                  </label>
                  <select
                    id="payout-net"
                    value={payoutNetwork}
                    onChange={(e) => setPayoutNetwork(e.target.value)}
                    className="mt-1 h-10 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm text-[#171717]"
                  >
                    {CRYPTO_NETWORKS.map((net) => (
                      <option key={net} value={net}>
                        {net}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <button
                type="submit"
                disabled={savingPayout}
                className="h-10 cursor-pointer rounded-lg bg-[#315FC8] px-5 text-xs font-medium text-white hover:bg-[#274EA6] disabled:opacity-60"
              >
                {savingPayout ? "Saving..." : "Save Payout Destination"}
              </button>
              {store.payoutDestination && (
                <button
                  type="button"
                  disabled={savingPayout}
                  onClick={handleClearPayout}
                  className="h-10 cursor-pointer rounded-lg border border-[#E5E7EB] bg-white px-4 text-xs font-medium text-[#6B6B6B] hover:border-[#C81E1E]/40 hover:text-[#C81E1E] disabled:opacity-60"
                >
                  Remove
                </button>
              )}
            </div>
          </form>

          <aside className="space-y-4 lg:col-span-5">
            <div className="rounded-xl border border-[#E5E7EB] bg-white p-6 text-xs">
              <p className="type-meta">Current Payout Status</p>
              <p className="mt-1.5 text-base font-medium capitalize text-[#171717]">
                {store.payoutStatus}
              </p>
              {store.payoutDestination ? (
                <dl className="mt-4 space-y-2 border-t border-[#F0F1F2] pt-3.5 text-[#6B6B6B]">
                  <div className="flex justify-between gap-3">
                    <dt>Provider</dt>
                    <dd className="font-medium text-[#171717]">
                      {payoutProviderLabel(store.payoutDestination.provider)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt>Beneficiary</dt>
                    <dd className="truncate font-medium text-[#171717]">
                      {store.payoutDestination.accountHolder}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt>Destination</dt>
                    <dd className="font-mono-light truncate text-[#315FC8]">
                      {store.payoutDestination.destination}
                    </dd>
                  </div>
                  {store.payoutDestination.networkName && (
                    <div className="flex justify-between gap-3">
                      <dt>Network</dt>
                      <dd className="font-medium text-[#171717]">
                        {store.payoutDestination.networkName}
                        {store.payoutDestination.walletVerified ? " · Verified" : ""}
                      </dd>
                    </div>
                  )}
                </dl>
              ) : (
                <p className="mt-2 leading-relaxed text-[#6B6B6B]">
                  No payout method saved yet. Configure an international e-wallet or crypto address on the left so your store is ready for live disbursements.
                </p>
              )}
            </div>

            <div className="rounded-xl border border-[#E5E7EB] bg-[#F7F7F5] p-5 text-xs leading-relaxed text-[#6B6B6B]">
              <p className="font-medium text-[#171717]">How escrow payouts work</p>
              <p className="mt-1.5">
                Buyer payments stay held in escrow until delivery is confirmed. Once released, net seller funds (subtotal minus 3% platform fee) route to your configured destination automatically when live Stripe Connect, PayPal Payouts, or onchain escrow settlement is connected.
              </p>
            </div>
          </aside>
        </div>
      )}

      {/* Store Settings Tab */}
      {tab === "settings" && (
        <form
          onSubmit={handleSaveStore}
          className="max-w-2xl space-y-4 rounded-xl border border-[#E5E7EB] bg-white p-6"
        >
          <h2 className="text-lg text-[#171717]">Store Settings</h2>
          <div>
            <label htmlFor="set-name" className="text-xs font-semibold">
              Store name
            </label>
            <input
              id="set-name"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              className="mt-1 h-11 w-full rounded-lg border border-[#E5E7EB] bg-white px-3.5 text-sm"
            />
          </div>
          <div>
            <label htmlFor="set-tag" className="text-xs font-semibold">
              Tagline
            </label>
            <input
              id="set-tag"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              className="mt-1 h-11 w-full rounded-lg border border-[#E5E7EB] bg-white px-3.5 text-sm"
            />
          </div>
          <div>
            <label htmlFor="set-desc" className="text-xs font-semibold">
              Description
            </label>
            <textarea
              id="set-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#E5E7EB] bg-white p-3 text-sm"
            />
          </div>
          <div>
            <label htmlFor="set-ship" className="text-xs font-semibold">
              Shipping policy
            </label>
            <textarea
              id="set-ship"
              rows={2}
              value={shippingPolicy}
              onChange={(e) => setShippingPolicy(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#E5E7EB] bg-white p-3 text-sm"
            />
          </div>
          <div>
            <label htmlFor="set-refund" className="text-xs font-semibold">
              Refund policy
            </label>
            <textarea
              id="set-refund"
              rows={2}
              value={refundPolicy}
              onChange={(e) => setRefundPolicy(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#E5E7EB] bg-white p-3 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="min-h-[44px] cursor-pointer rounded-lg bg-[#315FC8] px-5 text-sm font-semibold text-white hover:bg-[#274EA6]"
          >
            {saving ? "Saving..." : "Save Store Settings"}
          </button>
        </form>
      )}
    </div>
  );
}
