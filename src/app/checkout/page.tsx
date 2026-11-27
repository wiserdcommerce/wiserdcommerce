"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  Wallet,
  CreditCard,
  AlertTriangle,
  Lock,
} from "lucide-react";
import { useWiserd } from "@/components/providers/wiserd-provider";
import { DetailSplitSkeleton, StatusBanner } from "@/components/ui/state-blocks";
import { calculateStoreOrderBreakdowns } from "@/lib/commerce";
import type { EnrichedProduct } from "@/components/marketplace/product-card";
import {
  TransactionApprovalModal,
  type TransactionReviewPayload,
} from "@/components/wallet/transaction-approval-modal";

function formatUsd(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

export default function CheckoutPage() {
  const router = useRouter();
  const {
    user,
    wallets,
    integrations,
    cart,
    clearCart,
    pruneCartToValidIds,
    openGoogleAuthModal,
    openWalletModal,
    refreshSession,
  } = useWiserd();

  const [products, setProducts] = useState<EnrichedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"fiat_escrow" | "wallet_escrow">(
    "fiat_escrow"
  );
  const [recipient, setRecipient] = useState("");
  const [line1, setLine1] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("United States");
  const [postalCode, setPostalCode] = useState("");
  const [hydratedAddrForUser, setHydratedAddrForUser] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [approvalOpen, setApprovalOpen] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/products", { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error("Catalog request failed");
        return r.json();
      })
      .then((d) => {
        if (!active) return;
        const list = (d.products || []) as EnrichedProduct[];
        setProducts(list);
        pruneCartToValidIds(new Set(list.map((p) => p.id)));
      })
      .catch(() => {
        if (active) setLoadError("Could not load catalog prices. Please refresh to retry.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [pruneCartToValidIds]);

  // Hydrate saved shipping address once per user without triggering synchronous setState in effect
  if (user && hydratedAddrForUser !== user.id) {
    setHydratedAddrForUser(user.id);
    if (user.addresses?.[0]) {
      const addr = user.addresses[0];
      if (!recipient) setRecipient(addr.recipient);
      if (!line1) setLine1(addr.line1);
      if (!city) setCity(addr.city);
      if (!postalCode) setPostalCode(addr.postalCode);
      setCountry(addr.country || "United States");
    } else if (!recipient) {
      setRecipient(user.displayName);
    }
  }

  const calcResult = useMemo(() => {
    if (cart.length === 0 || products.length === 0) return null;
    return calculateStoreOrderBreakdowns(cart, products);
  }, [cart, products]);

  const calculation = calcResult && "calculation" in calcResult ? calcResult.calculation : null;
  const calcError = calcResult && "error" in calcResult ? calcResult.error : null;

  const storeNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of products) {
      if (p.store) map.set(p.storeId, p.store.name);
    }
    return map;
  }, [products]);

  const requiresShipping = Boolean(calculation?.anyRequiresShipping);
  const subtotalCents = calculation?.grandSubtotalCents || 0;
  const shippingCents = calculation?.grandShippingCents || 0;
  const platformFeeCents = calculation?.grandPlatformFeeCents || 0;
  const estimatedTotal = calculation?.grandTotalCents || 0;

  const validateShippingFields = (): boolean => {
    if (!requiresShipping) {
      setFieldErrors({});
      return true;
    }
    const errs: Record<string, string> = {};
    if (!recipient.trim()) errs.recipient = "Full name is required.";
    if (!line1.trim()) errs.line1 = "Street address is required for physical delivery.";
    if (!city.trim()) errs.city = "City is required.";
    if (!postalCode.trim()) errs.postalCode = "Postal code is required.";
    if (!country.trim()) errs.country = "Country is required.";
    setFieldErrors(errs);
    const firstKey = Object.keys(errs)[0];
    if (firstKey) {
      const idMap: Record<string, string> = {
        recipient: "ship-recipient",
        line1: "ship-line1",
        city: "ship-city",
        postalCode: "ship-postal",
        country: "ship-country",
      };
      document.getElementById(idMap[firstKey])?.focus();
      setError("Please complete all required shipping fields before continuing.");
      return false;
    }
    return true;
  };

  const submitOrderToBackend = async (): Promise<{ ok: boolean; error?: string }> => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cart,
          paymentMethod,
          shippingAddress: requiresShipping
            ? { recipient, line1, city, country, postalCode }
            : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = data.error || "Checkout could not be completed.";
        setError(msg);
        return { ok: false, error: msg };
      }
      clearCart();
      await refreshSession();
      const createdOrders = Array.isArray(data.orders) ? data.orders : [];
      window.setTimeout(() => {
        if (createdOrders.length > 1) {
          router.push(`/orders?created=${createdOrders.length}`);
        } else {
          router.push(createdOrders[0] ? `/orders/${createdOrders[0].id}` : "/orders");
        }
      }, 350);
      return { ok: true };
    } catch {
      const msg = "Network error while creating order.";
      setError(msg);
      return { ok: false, error: msg };
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!user) {
      openGoogleAuthModal();
      return;
    }
    if (!validateShippingFields()) {
      return;
    }
    if (paymentMethod === "wallet_escrow") {
      if (wallets.length === 0) {
        setError("Connect and verify a wallet first before using wallet-based escrow.");
        openWalletModal();
        return;
      }
      setApprovalOpen(true);
      return;
    }
    await submitOrderToBackend();
  };

  const primaryWallet = wallets[0] || null;
  const storeNames = calculation
    ? calculation.stores.map((s) => storeNameMap.get(s.storeId) || "WISERD Seller").join(", ")
    : "WISERD Seller";

  const txReviewPayload: TransactionReviewPayload | null = primaryWallet
    ? {
        actionType: "Wallet Escrow Order Authorization",
        assetLabel: integrations?.onchainEscrow.tokenSymbol || "USD (Preview Reference)",
        amountDisplay: formatUsd(estimatedTotal),
        recipientLabel: storeNames,
        contractAddress: integrations?.onchainEscrow.contractAddress || null,
        networkName: primaryWallet.networkName,
        chainId: primaryWallet.chainId,
        estimatedFee: null,
        escrowConditions:
          "Funds remain protected until delivery confirmation and buyer inspection complete, or resolved via documented dispute review.",
        walletLabel: primaryWallet.walletName,
        walletAddress: primaryWallet.address,
        isLiveContractConfigured: Boolean(integrations?.onchainEscrow.configured),
      }
    : null;

  if (loading) {
    return <DetailSplitSkeleton />;
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-[900px] px-4 pt-12">
        <StatusBanner
          tone="error"
          message={loadError}
          onRetry={() => window.location.reload()}
        />
      </div>
    );
  }

  if (!calculation || calculation.stores.length === 0) {
    return (
      <div className="mx-auto max-w-[1200px] px-4 py-16 text-center">
        <h1 className="text-2xl font-medium text-[#171717]">Nothing to check out</h1>
        <p className="mt-2 text-sm text-[#6B6B6B]">
          {calcError || "Add an item to your cart first to review checkout and escrow details."}
        </p>
        <Link
          href="/marketplace"
          className="mt-5 inline-flex h-10 items-center rounded-lg bg-[#315FC8] px-6 text-sm font-medium text-white"
        >
          Return to Marketplace
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1200px] px-4 pt-8 sm:px-6 lg:px-8">
      <div className="border-b border-[#E5E7EB] pb-5">
        <p className="type-meta text-[#315FC8]">Server-Validated Checkout</p>
        <h1 className="mt-1 text-3xl font-medium tracking-tight text-[#171717]">
          Review &amp; Create Escrow Order
        </h1>
      </div>

      {!user && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#315FC8]/30 bg-white p-5">
          <div>
            <p className="text-sm font-medium text-[#171717]">
              Sign in to complete your purchase
            </p>
            <p className="text-xs text-[#6B6B6B]">
              Orders, digital downloads, escrow statuses, and seller chats are
              linked to your WISERD account.
            </p>
          </div>
          <button
            type="button"
            onClick={openGoogleAuthModal}
            className="h-10 cursor-pointer rounded-lg bg-[#315FC8] px-5 text-sm font-medium text-white hover:bg-[#274EA6]"
          >
            Continue with Google
          </button>
        </div>
      )}

      <form
        noValidate
        onSubmit={handleCheckoutSubmit}
        className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-12"
      >
        <div className="space-y-6 lg:col-span-7">
          {requiresShipping ? (
            <section className="rounded-xl border border-[#E5E7EB] bg-white p-6">
              <h2 className="text-lg font-medium text-[#171717]">
                Shipping Address
              </h2>
              <p className="mt-1 text-xs text-[#6B6B6B]">
                Required for physical items in your cart.
              </p>
              {user && user.addresses.length > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <span className="type-meta mr-1">Saved:</span>
                  {user.addresses.map((addr) => {
                    const active =
                      addr.line1 === line1 && addr.postalCode === postalCode;
                    return (
                      <button
                        key={addr.id}
                        type="button"
                        onClick={() => {
                          setRecipient(addr.recipient);
                          setLine1(addr.line1);
                          setCity(addr.city);
                          setPostalCode(addr.postalCode);
                          setCountry(addr.country || "United States");
                          setFieldErrors({});
                        }}
                        className={`h-8 cursor-pointer rounded-lg border px-2.5 text-xs transition ${
                          active
                            ? "border-[#171717] bg-[#171717] text-white"
                            : "border-[#E5E7EB] bg-[#F7F7F5] text-[#171717] hover:border-[#171717]/30"
                        }`}
                      >
                        {addr.label} ({addr.city})
                      </button>
                    );
                  })}
                </div>
              )}
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label htmlFor="ship-recipient" className="text-xs font-medium text-[#171717]">
                    Full name
                  </label>
                  <input
                    id="ship-recipient"
                    required
                    aria-invalid={Boolean(fieldErrors.recipient)}
                    aria-describedby={fieldErrors.recipient ? "ship-recipient-err" : undefined}
                    value={recipient}
                    onChange={(e) => {
                      setRecipient(e.target.value);
                      setFieldErrors((prev) => ({ ...prev, recipient: "" }));
                    }}
                    className={`mt-1 h-10 w-full rounded-lg border bg-white px-3.5 text-sm ${
                      fieldErrors.recipient ? "border-[#C81E1E]" : "border-[#E5E7EB]"
                    }`}
                  />
                  {fieldErrors.recipient && (
                    <p id="ship-recipient-err" className="mt-1 text-xs text-[#C81E1E]">
                      {fieldErrors.recipient}
                    </p>
                  )}
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="ship-line1" className="text-xs font-medium text-[#171717]">
                    Street address
                  </label>
                  <input
                    id="ship-line1"
                    required
                    aria-invalid={Boolean(fieldErrors.line1)}
                    aria-describedby={fieldErrors.line1 ? "ship-line1-err" : undefined}
                    value={line1}
                    onChange={(e) => {
                      setLine1(e.target.value);
                      setFieldErrors((prev) => ({ ...prev, line1: "" }));
                    }}
                    placeholder="Street, apartment, or studio suite"
                    className={`mt-1 h-10 w-full rounded-lg border bg-white px-3.5 text-sm ${
                      fieldErrors.line1 ? "border-[#C81E1E]" : "border-[#E5E7EB]"
                    }`}
                  />
                  {fieldErrors.line1 && (
                    <p id="ship-line1-err" className="mt-1 text-xs text-[#C81E1E]">
                      {fieldErrors.line1}
                    </p>
                  )}
                </div>
                <div>
                  <label htmlFor="ship-city" className="text-xs font-medium text-[#171717]">
                    City
                  </label>
                  <input
                    id="ship-city"
                    required
                    aria-invalid={Boolean(fieldErrors.city)}
                    aria-describedby={fieldErrors.city ? "ship-city-err" : undefined}
                    value={city}
                    onChange={(e) => {
                      setCity(e.target.value);
                      setFieldErrors((prev) => ({ ...prev, city: "" }));
                    }}
                    className={`mt-1 h-10 w-full rounded-lg border bg-white px-3.5 text-sm ${
                      fieldErrors.city ? "border-[#C81E1E]" : "border-[#E5E7EB]"
                    }`}
                  />
                  {fieldErrors.city && (
                    <p id="ship-city-err" className="mt-1 text-xs text-[#C81E1E]">
                      {fieldErrors.city}
                    </p>
                  )}
                </div>
                <div>
                  <label htmlFor="ship-postal" className="text-xs font-medium text-[#171717]">
                    Postal code
                  </label>
                  <input
                    id="ship-postal"
                    required
                    aria-invalid={Boolean(fieldErrors.postalCode)}
                    aria-describedby={fieldErrors.postalCode ? "ship-postal-err" : undefined}
                    value={postalCode}
                    onChange={(e) => {
                      setPostalCode(e.target.value);
                      setFieldErrors((prev) => ({ ...prev, postalCode: "" }));
                    }}
                    className={`mt-1 h-10 w-full rounded-lg border bg-white px-3.5 text-sm ${
                      fieldErrors.postalCode ? "border-[#C81E1E]" : "border-[#E5E7EB]"
                    }`}
                  />
                  {fieldErrors.postalCode && (
                    <p id="ship-postal-err" className="mt-1 text-xs text-[#C81E1E]">
                      {fieldErrors.postalCode}
                    </p>
                  )}
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="ship-country" className="text-xs font-medium text-[#171717]">
                    Country
                  </label>
                  <input
                    id="ship-country"
                    required
                    aria-invalid={Boolean(fieldErrors.country)}
                    aria-describedby={fieldErrors.country ? "ship-country-err" : undefined}
                    value={country}
                    onChange={(e) => {
                      setCountry(e.target.value);
                      setFieldErrors((prev) => ({ ...prev, country: "" }));
                    }}
                    className={`mt-1 h-10 w-full rounded-lg border bg-white px-3.5 text-sm ${
                      fieldErrors.country ? "border-[#C81E1E]" : "border-[#E5E7EB]"
                    }`}
                  />
                  {fieldErrors.country && (
                    <p id="ship-country-err" className="mt-1 text-xs text-[#C81E1E]">
                      {fieldErrors.country}
                    </p>
                  )}
                </div>
              </div>
            </section>
          ) : (
            <section className="rounded-xl border border-[#167A67]/25 bg-white p-5">
              <p className="text-sm font-medium text-[#167A67]">
                Digital delivery (no shipping address required)
              </p>
              <p className="mt-1 text-xs text-[#6B6B6B]">
                Your order contains digital deliverables or scheduled services
                only. Delivery happens directly inside WISERD Orders and
                Messages.
              </p>
            </section>
          )}

          {/* Escrow Payment Arrangement Selection */}
          <fieldset className="rounded-xl border border-[#E5E7EB] bg-white p-6">
            <legend className="sr-only">Payment and escrow arrangement</legend>
            <h2 className="text-lg font-medium text-[#171717]">
              Payment &amp; Escrow Arrangement
            </h2>
            <p className="mt-1 text-xs text-[#6B6B6B]">
              Wallet authorization and escrow payment confirmation remain
              strictly separate steps.
            </p>

            <div className="mt-4 space-y-3">
              <label
                htmlFor="pay-fiat-escrow"
                className={`flex cursor-pointer items-start gap-3.5 rounded-xl border p-4 transition ${
                  paymentMethod === "fiat_escrow"
                    ? "border-[#315FC8] bg-[#315FC8]/6"
                    : "border-[#E5E7EB] bg-[#F7F7F5]"
                }`}
              >
                <input
                  id="pay-fiat-escrow"
                  type="radio"
                  name="paymentMethod"
                  aria-label="Fiat Escrow Settlement"
                  checked={paymentMethod === "fiat_escrow"}
                  onChange={() => setPaymentMethod("fiat_escrow")}
                  className="mt-1"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-2 text-sm font-medium text-[#171717]">
                      <CreditCard className="h-4 w-4 text-[#6B6B6B]" />
                      Fiat Escrow Settlement
                    </span>
                    <span className="shrink-0 whitespace-nowrap rounded-md bg-white px-2.5 py-0.5 text-[11px] font-medium text-[#6B6B6B]">
                      {integrations?.fiatPaymentProvider.configured
                        ? integrations.fiatPaymentProvider.providerName
                        : "Preview Mode"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[#6B6B6B]">
                    {integrations?.fiatPaymentProvider.note ||
                      "Creates an auditable escrow order in preview mode until a licensed fiat payment partner is configured."}
                  </p>
                </div>
              </label>

              <label
                htmlFor="pay-wallet-escrow"
                className={`flex cursor-pointer items-start gap-3.5 rounded-xl border p-4 transition ${
                  paymentMethod === "wallet_escrow"
                    ? "border-[#315FC8] bg-[#315FC8]/6"
                    : "border-[#E5E7EB] bg-[#F7F7F5]"
                }`}
              >
                <input
                  id="pay-wallet-escrow"
                  type="radio"
                  name="paymentMethod"
                  aria-label="Wallet-Based Escrow"
                  checked={paymentMethod === "wallet_escrow"}
                  onChange={() => setPaymentMethod("wallet_escrow")}
                  className="mt-1"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-2 text-sm font-medium text-[#171717]">
                      <Wallet className="h-4 w-4 text-[#6B6B6B]" />
                      Wallet-Based Escrow
                    </span>
                    <span className="shrink-0 whitespace-nowrap rounded-md bg-white px-2.5 py-0.5 text-[11px] font-medium text-[#6B6B6B]">
                      {integrations?.onchainEscrow.configured
                        ? integrations.onchainEscrow.chainName
                        : "Contract Unconfigured"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[#6B6B6B]">
                    {primaryWallet
                      ? `Connected: ${primaryWallet.walletName} (${primaryWallet.address.slice(0, 6)}...${primaryWallet.address.slice(-4)} on ${primaryWallet.networkName}). Requires explicit review sheet approval.`
                      : "Requires a connected wallet. Connecting alone never authorizes payment."}
                  </p>
                  {!primaryWallet && (
                    <button
                      type="button"
                      onClick={(ev) => {
                        ev.preventDefault();
                        openWalletModal();
                      }}
                      className="mt-2 cursor-pointer text-xs font-medium text-[#315FC8] underline"
                    >
                      Open Connect Wallet panel
                    </button>
                  )}
                </div>
              </label>
            </div>

            <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-[#B45309]/25 bg-[#B45309]/8 p-4 text-xs leading-relaxed text-[#171717]">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#B45309]" />
              <div>
                <p className="font-medium text-[#B45309]">
                  Preview Settlement Mode
                </p>
                <p className="mt-0.5 text-[#6B6B6B]">
                  Live fiat custody and onchain smart-contract escrow are not
                  configured in this environment yet. Creating this order
                  records a genuine server-verified order without charging any
                  card or moving onchain tokens.
                </p>
              </div>
            </div>
          </fieldset>
        </div>

        {/* Right Summary & Submit (Per-store exact match with POST /api/orders) */}
        <aside className="lg:col-span-5">
          <div className="sticky top-24 rounded-xl border border-[#E5E7EB] bg-white p-6">
            <h2 className="text-lg font-medium text-[#171717]">Order Breakdown</h2>
            {calculation.stores.length > 1 && (
              <p className="mt-1 text-xs text-[#6B6B6B]">
                Split into {calculation.stores.length} separate seller orders with per-store shipping thresholds.
              </p>
            )}

            <div className="mt-4 space-y-4">
              {calculation.stores.map((group) => (
                <div
                  key={group.storeId}
                  className="rounded-lg border border-[#F0F1F2] bg-[#F7F7F5]/60 p-3"
                >
                  <div className="flex items-center justify-between text-xs font-medium text-[#171717]">
                    <span>{storeNameMap.get(group.storeId) || "WISERD Store"}</span>
                    <span className="font-mono-light text-[#6B6B6B]">
                      {group.shippingCents > 0
                        ? `+${formatUsd(group.shippingCents)} shipping`
                        : group.requiresShipping
                          ? "Free tracked shipping"
                          : "Digital delivery"}
                    </span>
                  </div>
                  <ul className="mt-2 divide-y divide-[#E5E7EB]/60">
                    {group.items.map((item) => (
                      <li
                        key={`${item.productId}-${item.variationId || "std"}`}
                        className="flex items-center justify-between gap-3 py-2 text-xs"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium text-[#171717]">
                            {item.productTitle}
                          </p>
                          <p className="text-[#6B6B6B]">
                            {item.variationLabel || "Standard"} × {item.quantity}
                          </p>
                        </div>
                        <span className="font-mono-light shrink-0 text-[#171717]">
                          {formatUsd(item.lineTotalCents)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <dl className="mt-4 space-y-2 border-t border-[#E5E7EB] pt-4 text-sm">
              <div className="flex justify-between text-[#6B6B6B]">
                <dt>Subtotal</dt>
                <dd className="font-mono-light text-[#171717]">
                  {formatUsd(subtotalCents)}
                </dd>
              </div>
              <div className="flex justify-between text-[#6B6B6B]">
                <dt>Shipping</dt>
                <dd className="font-mono-light text-[#171717]">
                  {shippingCents > 0
                    ? formatUsd(shippingCents)
                    : requiresShipping
                      ? "Free tracked shipping"
                      : "Digital delivery"}
                </dd>
              </div>
              <div className="flex justify-between text-[#6B6B6B]">
                <dt>WISERD Platform Fee (3%)</dt>
                <dd className="font-mono-light text-[#171717]">
                  {formatUsd(platformFeeCents)}
                </dd>
              </div>
              <div className="flex justify-between border-t border-[#E5E7EB] pt-3 text-base font-medium text-[#171717]">
                <dt>Server-Verified Total</dt>
                <dd className="font-base-black text-2xl text-[#315FC8]">
                  {formatUsd(estimatedTotal)}
                </dd>
              </div>
            </dl>

            {error && (
              <div
                role="alert"
                className="mt-4 rounded-lg border border-[#C81E1E]/25 bg-[#C81E1E]/8 p-3 text-xs font-medium text-[#C81E1E]"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="mt-5 flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-[#315FC8] px-5 text-sm font-medium text-white transition hover:bg-[#274EA6] disabled:opacity-60"
            >
              <Lock className="h-4 w-4" />
              {submitting
                ? "Creating order..."
                : paymentMethod === "wallet_escrow"
                  ? "Review in Transaction Center"
                  : "Confirm & Create Order"}
            </button>

            <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-[#6B6B6B]">
              <ShieldCheck className="h-3.5 w-3.5 text-[#167A67]" />
              Prices recalculated and validated server-side before order creation
            </p>
          </div>
        </aside>
      </form>

      <TransactionApprovalModal
        open={approvalOpen}
        payload={txReviewPayload}
        onClose={() => setApprovalOpen(false)}
        onApprove={submitOrderToBackend}
      />
    </div>
  );
}
