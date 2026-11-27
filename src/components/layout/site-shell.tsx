"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  Search,
  ShoppingBag,
  Bell,
  Home,
  Store,
  MessageSquare,
  Users,
  User as UserIcon,
  Shield,
  X,
  Trash2,
  ArrowRight,
  Wallet,
  LogOut,
  Copy,
  Check,
  ChevronDown,
  Settings,
  ReceiptText,
  Unlink,
  Minus,
  Plus,
} from "lucide-react";
import { useWiserd } from "@/components/providers/wiserd-provider";
import { GoogleAuthModal } from "@/components/auth/google-auth-modal";
import { WalletModal } from "@/components/wallet/wallet-modal";
import type { Product } from "@/lib/types";

function shortenAddress(addr: string): string {
  return addr.length < 12 ? addr : `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function formatUsd(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

const DESKTOP_NAV = [
  { href: "/marketplace", label: "Marketplace" },
  { href: "/community", label: "Community" },
  { href: "/messages", label: "Messages" },
  { href: "/orders", label: "Orders" },
  { href: "/sell", label: "Sell" },
];

export function SiteShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const {
    user,
    wallets,
    notifications,
    integrations,
    cart,
    cartCount,
    recentSearches,
    googleModalOpen,
    walletModalOpen,
    cartDrawerOpen,
    openGoogleAuthModal,
    closeGoogleAuthModal,
    openWalletModal,
    closeWalletModal,
    openCartDrawer,
    closeCartDrawer,
    refreshSession,
    signOut,
    removeFromCart,
    updateCartQuantity,
    pruneCartToValidIds,
    recordSearch,
    clearRecentSearches,
    markNotificationRead,
  } = useWiserd();

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchCatalog, setSearchCatalog] = useState<
    Array<Product & { store?: { name: string; slug: string } | null }>
  >([]);
  const [openMenu, setOpenMenu] = useState<"none" | "notif" | "wallet" | "account">("none");
  const [copiedAddr, setCopiedAddr] = useState(false);
  const [drawerProducts, setDrawerProducts] = useState<
    Array<Product & { store?: { name: string; slug: string } | null }>
  >([]);
  const headerRef = useRef<HTMLElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const primaryWallet = wallets[0] || null;
  const unreadNotifs = notifications.filter((n) => !n.read).length;

  // Global Cmd/Ctrl+K and "/" quick-search keyboard shortcuts
  useEffect(() => {
    const onGlobalKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpenMenu("none");
        setSearchOpen((prev) => !prev);
        return;
      }
      if (e.key === "Escape" && searchOpen) {
        setSearchOpen(false);
        return;
      }
      if (
        e.key === "/" &&
        !searchOpen &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey
      ) {
        const tag = (e.target as HTMLElement | null)?.tagName;
        const editable = (e.target as HTMLElement | null)?.isContentEditable;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || editable) return;
        e.preventDefault();
        setOpenMenu("none");
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onGlobalKey);
    return () => window.removeEventListener("keydown", onGlobalKey);
  }, [searchOpen]);

  useEffect(() => {
    if (!searchOpen) return;
    const focusId = window.setTimeout(() => searchInputRef.current?.focus(), 20);
    if (searchCatalog.length > 0) return () => window.clearTimeout(focusId);
    let active = true;
    fetch("/api/products")
      .then((r) => r.json())
      .then((d) => {
        if (active && Array.isArray(d.products)) setSearchCatalog(d.products);
      })
      .catch(() => {});
    return () => {
      active = false;
      window.clearTimeout(focusId);
    };
  }, [searchOpen, searchCatalog.length]);

  useEffect(() => {
    if (openMenu === "none") return;
    const onDown = (e: MouseEvent) => {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) {
        setOpenMenu("none");
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenMenu("none");
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [openMenu]);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (!active) return;
      setOpenMenu("none");
      setSearchOpen(false);
    });
    return () => {
      active = false;
    };
  }, [pathname]);

  useEffect(() => {
    if (!cartDrawerOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeCartDrawer();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [cartDrawerOpen, closeCartDrawer]);

  useEffect(() => {
    if (!cartDrawerOpen || cart.length === 0) return;
    let active = true;
    fetch("/api/products")
      .then((r) => r.json())
      .then((d) => {
        if (active && Array.isArray(d.products)) {
          setDrawerProducts(d.products);
          pruneCartToValidIds(new Set(d.products.map((p: Product) => p.id)));
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [cartDrawerOpen, cart.length, pruneCartToValidIds]);

  const handleQuickSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (q) recordSearch(q);
    setSearchOpen(false);
    router.push(q ? `/marketplace?q=${encodeURIComponent(q)}` : "/marketplace");
  };

  const handleQuickDisconnectWallet = async () => {
    if (!primaryWallet) return;
    await fetch(`/api/wallet?id=${encodeURIComponent(primaryWallet.id)}`, {
      method: "DELETE",
    });
    setOpenMenu("none");
    await refreshSession();
  };

  const handleCopyWallet = async () => {
    if (!primaryWallet) return;
    try {
      await navigator.clipboard.writeText(primaryWallet.address);
      setCopiedAddr(true);
      window.setTimeout(() => setCopiedAddr(false), 1500);
    } catch {
      // ignore
    }
  };

  const cartLines = cart
    .map((item) => {
      const product = drawerProducts.find((p) => p.id === item.productId);
      if (!product) return null;
      const variation = item.variationId
        ? product.variations.find((v) => v.id === item.variationId)
        : product.variations[0];
      const unitCents = product.priceCents + (variation?.priceDeltaCents || 0);
      return { item, product, variation, unitCents };
    })
    .filter((x): x is NonNullable<typeof x> => Boolean(x));

  const drawerSubtotal = cartLines.reduce(
    (sum, line) => sum + line.unitCents * line.item.quantity,
    0
  );

  const trimmedQuery = searchQuery.trim().toLowerCase();
  const instantMatches = trimmedQuery
    ? searchCatalog
        .filter((p) => {
          const hay = `${p.title} ${p.summary} ${p.productType} ${p.category} ${p.store?.name || ""}`.toLowerCase();
          return hay.includes(trimmedQuery);
        })
        .slice(0, 5)
    : [];

  return (
    <div className="flex min-h-dvh flex-col bg-[#F7F7F5] text-[#171717]">
      {/* Quiet, Linear-Precision 56px Liquid Glass Header */}
      <header ref={headerRef} className="liquid-glass-nav sticky top-0 z-40">
        <div className="mx-auto flex h-14 max-w-[1320px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          {/* Left: Brand + Compact Nav */}
          <div className="flex items-center gap-6">
            <Link
              href="/"
              aria-label="WISERD independent commerce"
              className="flex shrink-0 items-center"
            >
              <Image
                src="/brand/wiserd-logo-ui.svg"
                alt="WISERD"
                width={125}
                height={20}
                priority
                unoptimized
                className="h-5 w-auto sm:hidden"
              />
              <Image
                src="/brand/wiserd-web-header.svg"
                alt="WISERD independent commerce"
                width={224}
                height={28}
                priority
                unoptimized
                className="hidden h-7 w-auto sm:block"
              />
            </Link>

            <nav
              aria-label="Primary navigation"
              className="hidden items-center gap-1 lg:flex"
            >
              {DESKTOP_NAV.map((item) => {
                const active =
                  pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`rounded-lg px-2.5 py-1.5 text-[13px] font-medium whitespace-nowrap transition ${
                      active
                        ? "bg-[#171717]/[0.06] text-[#171717]"
                        : "text-[#6B6B6B] hover:bg-[#171717]/[0.04] hover:text-[#171717]"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Right: Consistent 36px Rounded-LG Utility Controls */}
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => {
                setOpenMenu("none");
                setSearchOpen((prev) => !prev);
              }}
              aria-label="Search marketplace (Ctrl+K)"
              aria-expanded={searchOpen}
              className="liquid-glass-control flex h-9 w-9 cursor-pointer items-center justify-center gap-2 rounded-lg text-[#171717] md:w-auto md:px-2.5"
            >
              <Search aria-hidden="true" className="h-4 w-4 shrink-0" />
              <kbd className="font-mono-light hidden rounded border border-[#E5E7EB] bg-[#F7F7F5] px-1.5 py-0.5 text-[10px] text-[#6B6B6B] md:inline">
                Ctrl K
              </kbd>
            </button>

            {/* Connect Wallet Control + Connected Popover */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  if (primaryWallet) {
                    setOpenMenu((prev) => (prev === "wallet" ? "none" : "wallet"));
                  } else {
                    setOpenMenu("none");
                    openWalletModal();
                  }
                }}
                aria-label={
                  primaryWallet
                    ? `Connected wallet ${shortenAddress(primaryWallet.address)}`
                    : "Connect Wallet"
                }
                aria-expanded={primaryWallet ? openMenu === "wallet" : undefined}
                className={`liquid-glass-control inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg text-xs font-medium text-[#171717] ${
                  primaryWallet ? "px-2.5" : "w-9 sm:w-auto sm:px-3"
                }`}
              >
                {primaryWallet ? (
                  <>
                    <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#167A67]" />
                    <Wallet aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-[#171717]" />
                    <span className="font-mono-light hidden text-xs sm:inline">
                      {shortenAddress(primaryWallet.address)}
                    </span>
                    <ChevronDown aria-hidden="true" className="hidden h-3 w-3 text-[#6B6B6B] sm:inline" />
                  </>
                ) : (
                  <>
                    <Wallet aria-hidden="true" className="h-4 w-4 shrink-0 text-[#171717]" />
                    <span className="hidden whitespace-nowrap sm:inline">
                      Connect Wallet
                    </span>
                  </>
                )}
              </button>

              {primaryWallet && openMenu === "wallet" && (
                <div className="liquid-glass-panel absolute right-0 z-50 mt-2 w-72 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <span className="type-meta">
                      WISERD Wallet
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#167A67]">
                      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[#167A67]" />
                      Connected
                    </span>
                  </div>

                  <div className="mt-3 rounded-lg border border-[#E5E7EB] bg-white p-3">
                    <p className="text-xs font-medium text-[#171717]">
                      {primaryWallet.walletName}
                    </p>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <span className="font-mono-light text-xs text-[#315FC8]">
                        {shortenAddress(primaryWallet.address)}
                      </span>
                      <button
                        type="button"
                        onClick={handleCopyWallet}
                        className="inline-flex cursor-pointer items-center gap-1 rounded px-1.5 py-0.5 text-xs text-[#6B6B6B] hover:bg-[#F7F7F5] hover:text-[#171717]"
                      >
                        {copiedAddr ? (
                          <>
                            <Check aria-hidden="true" className="h-3 w-3 text-[#167A67]" /> Copied
                          </>
                        ) : (
                          <>
                            <Copy aria-hidden="true" className="h-3 w-3" /> Copy
                          </>
                        )}
                      </button>
                    </div>
                    <p className="mt-1 text-xs text-[#6B6B6B]">
                      {primaryWallet.networkName}
                    </p>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Link
                      href="/wallet"
                      onClick={() => setOpenMenu("none")}
                      className="flex h-9 items-center justify-center rounded-lg bg-[#315FC8] px-3 text-xs font-medium text-white hover:bg-[#274EA6]"
                    >
                      Manage
                    </Link>
                    <button
                      type="button"
                      onClick={handleQuickDisconnectWallet}
                      className="inline-flex h-9 cursor-pointer items-center justify-center gap-1 rounded-lg border border-[#E5E7EB] bg-white px-3 text-xs font-medium text-[#6B6B6B] hover:border-[#C81E1E]/40 hover:text-[#C81E1E]"
                    >
                      <Unlink aria-hidden="true" className="h-3.5 w-3.5" />
                      Disconnect
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Notifications */}
            {user && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() =>
                    setOpenMenu((prev) => (prev === "notif" ? "none" : "notif"))
                  }
                  aria-label={`Notifications${unreadNotifs ? ` (${unreadNotifs} unread)` : ""}`}
                  aria-expanded={openMenu === "notif"}
                  className="liquid-glass-control relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-[#171717]"
                >
                  <Bell aria-hidden="true" className="h-4 w-4" />
                  {unreadNotifs > 0 && (
                    <span className="font-mono-light absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded bg-[#315FC8] px-1 text-[11px] text-white">
                      {unreadNotifs}
                    </span>
                  )}
                </button>
                {openMenu === "notif" && (
                  <div className="liquid-glass-panel absolute right-0 z-50 mt-2 w-80 rounded-xl p-4">
                    <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-2.5">
                      <p className="text-xs font-medium text-[#171717]">
                        Notifications
                      </p>
                      {unreadNotifs > 0 && (
                        <button
                          type="button"
                          onClick={() => markNotificationRead()}
                          className="cursor-pointer text-xs font-medium text-[#315FC8] hover:underline"
                        >
                          Mark all read
                        </button>
                      )}
                    </div>
                    <div className="mt-2.5 max-h-72 divide-y divide-[#F0F1F2] overflow-y-auto">
                      {notifications.length === 0 ? (
                        <p className="py-5 text-center text-xs text-[#6B6B6B]">
                          No notifications yet.
                        </p>
                      ) : (
                        notifications.slice(0, 8).map((n) => (
                          <Link
                            key={n.id}
                            href={n.href}
                            onClick={() => {
                              markNotificationRead(n.id);
                              setOpenMenu("none");
                            }}
                            className="block py-2.5 text-xs transition hover:text-[#315FC8]"
                          >
                            <p className="font-medium text-[#171717]">{n.title}</p>
                            <p className="mt-0.5 line-clamp-2 text-[#6B6B6B]">
                              {n.body}
                            </p>
                          </Link>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Account Profile Popover or Google Sign-In */}
            {user ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() =>
                    setOpenMenu((prev) => (prev === "account" ? "none" : "account"))
                  }
                  aria-label={`Account menu: ${user.displayName}`}
                  aria-expanded={openMenu === "account"}
                  className="liquid-glass-control inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-xs font-medium text-[#171717] xl:w-auto xl:gap-1.5 xl:px-2"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#315FC8] text-[11px] font-medium text-white">
                    {user.avatarInitials}
                  </span>
                  <span className="hidden max-w-[88px] truncate xl:inline">
                    {user.displayName.split(" ")[0]}
                  </span>
                  <ChevronDown aria-hidden="true" className="hidden h-3 w-3 text-[#6B6B6B] xl:inline" />
                </button>

                {openMenu === "account" && (
                  <div className="liquid-glass-panel absolute right-0 z-50 mt-2 w-60 rounded-xl p-2.5">
                    <div className="border-b border-[#E5E7EB] px-2 pb-2">
                      <p className="truncate text-xs font-medium text-[#171717]">
                        {user.displayName}
                      </p>
                      <p className="truncate text-xs text-[#6B6B6B]">
                        {user.email}
                      </p>
                    </div>
                    <div className="mt-1.5 space-y-0.5 text-xs">
                      <Link
                        href="/account"
                        onClick={() => setOpenMenu("none")}
                        className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[#171717] hover:bg-[#F7F7F5]"
                      >
                        <Settings aria-hidden="true" className="h-3.5 w-3.5 text-[#6B6B6B]" />
                        Account &amp; Profile
                      </Link>
                      <Link
                        href="/wallet"
                        onClick={() => setOpenMenu("none")}
                        className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[#171717] hover:bg-[#F7F7F5]"
                      >
                        <Wallet aria-hidden="true" className="h-3.5 w-3.5 text-[#6B6B6B]" />
                        WISERD Wallet
                      </Link>
                      <Link
                        href="/orders"
                        onClick={() => setOpenMenu("none")}
                        className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[#171717] hover:bg-[#F7F7F5]"
                      >
                        <ReceiptText aria-hidden="true" className="h-3.5 w-3.5 text-[#6B6B6B]" />
                        My Orders
                      </Link>
                      <Link
                        href="/sell"
                        onClick={() => setOpenMenu("none")}
                        className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[#171717] hover:bg-[#F7F7F5]"
                      >
                        <Store aria-hidden="true" className="h-3.5 w-3.5 text-[#6B6B6B]" />
                        My Store
                      </Link>
                      {user.roles.includes("admin") && (
                        <Link
                          href="/admin"
                          onClick={() => setOpenMenu("none")}
                          className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[#7853D8] hover:bg-[#F7F7F5]"
                        >
                          <Shield aria-hidden="true" className="h-3.5 w-3.5" />
                          Administration
                        </Link>
                      )}
                    </div>
                    <div className="mt-1.5 border-t border-[#E5E7EB] pt-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setOpenMenu("none");
                          signOut();
                        }}
                        className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-[#6B6B6B] hover:bg-[#F7F7F5] hover:text-[#C81E1E]"
                      >
                        <LogOut aria-hidden="true" className="h-3.5 w-3.5" />
                        Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={openGoogleAuthModal}
                className="inline-flex h-9 cursor-pointer items-center rounded-lg bg-[#315FC8] px-3 text-xs font-medium whitespace-nowrap text-white transition hover:bg-[#274EA6]"
              >
                <span className="sm:hidden">Sign In</span>
                <span className="hidden sm:inline">Continue with Google</span>
              </button>
            )}

            {/* Cart Button */}
            <button
              type="button"
              onClick={openCartDrawer}
              aria-label={`Shopping cart (${cartCount} items)`}
              className="liquid-glass-control relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-[#171717]"
            >
              <ShoppingBag aria-hidden="true" className="h-4 w-4" />
              {cartCount > 0 && (
                <span className="font-mono-light absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded bg-[#171717] px-1 text-[11px] text-white">
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Quiet Search Overlay */}
        {searchOpen && (
          <div className="border-t border-[#E5E7EB] bg-white/95">
            <div className="mx-auto max-w-[1320px] px-4 py-2.5 sm:px-6 lg:px-8">
              <form
                onSubmit={handleQuickSearchSubmit}
                className="flex items-center gap-2"
              >
                <Search className="h-4 w-4 text-[#6B6B6B]" />
                <label htmlFor="header-quick-search" className="sr-only">
                  Search products, categories, or seller stores
                </label>
                <input
                  ref={searchInputRef}
                  id="header-quick-search"
                  type="search"
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search products, stores, categories..."
                  className="h-9 flex-1 bg-transparent text-sm text-[#171717] placeholder:text-[#6B6B6B] focus:outline-none"
                />
                <button
                  type="submit"
                  className="h-9 cursor-pointer rounded-lg bg-[#315FC8] px-3.5 text-xs font-medium text-white hover:bg-[#274EA6]"
                >
                  Search
                </button>
                <button
                  type="button"
                  onClick={() => setSearchOpen(false)}
                  aria-label="Close search bar"
                  className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-[#6B6B6B] hover:bg-[#F7F7F5]"
                >
                  <X className="h-4 w-4" />
                </button>
              </form>
              {instantMatches.length > 0 && (
                <div className="mt-2 divide-y divide-[#F0F1F2] border-t border-[#F0F1F2] pt-1">
                  {instantMatches.map((item) => (
                    <Link
                      key={item.id}
                      href={`/products/${item.slug}`}
                      onClick={() => {
                        if (searchQuery.trim()) recordSearch(searchQuery.trim());
                        setSearchOpen(false);
                      }}
                      className="flex items-center gap-3 rounded-lg px-2 py-2 transition hover:bg-[#F7F7F5]"
                    >
                      <Image
                        src={item.imageUrl}
                        alt={item.title}
                        width={48}
                        height={36}
                        className="h-9 w-12 shrink-0 rounded-md border border-[#E5E7EB] bg-[#F2F2EF] object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-[#171717]">
                          {item.title}
                        </p>
                        <p className="truncate text-[11px] text-[#6B6B6B]">
                          {item.store?.name || item.productType}
                        </p>
                      </div>
                      <span className="type-price shrink-0 text-xs">
                        {formatUsd(item.priceCents)}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
              {recentSearches.length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-[#F0F1F2] pt-2 text-xs">
                  <span className="type-meta">
                    Recent:
                  </span>
                  {recentSearches.map((term) => (
                    <button
                      key={term}
                      type="button"
                      onClick={() => {
                        setSearchQuery(term);
                        setSearchOpen(false);
                        router.push(`/marketplace?q=${encodeURIComponent(term)}`);
                      }}
                      className="cursor-pointer rounded-md border border-[#E5E7EB] bg-[#F7F7F5] px-2 py-0.5 text-[11px] text-[#171717] hover:border-[#315FC8]/40"
                    >
                      {term}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={clearRecentSearches}
                    className="ml-auto cursor-pointer text-[11px] text-[#6B6B6B] hover:text-[#171717]"
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main id="main-content" className="flex-1 pb-24 lg:pb-16">
        {children}
      </main>

      {/* Quiet Editorial Footer */}
      <footer className="border-t border-[#E5E7EB] bg-white pb-28 lg:pb-10">
        <div className="mx-auto max-w-[1320px] px-4 py-10 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
            <div className="space-y-3">
              <Link
                href="/"
                aria-label="WISERD independent commerce"
                className="inline-flex items-center"
              >
                <Image
                  src="/brand/wiserd-web-header.svg"
                  alt="WISERD independent commerce"
                  width={224}
                  height={28}
                  unoptimized
                  className="h-7 w-auto"
                />
              </Link>
              <p className="text-xs text-[#6B6B6B]">
                Independent third-party marketplace for physical goods, digital
                products, gaming hardware, and studio services.
              </p>
            </div>

            <div>
              <h3 className="type-meta">
                Catalog
              </h3>
              <ul className="mt-2.5 space-y-1.5 text-xs text-[#171717]">
                <li><Link href="/marketplace" className="hover:text-[#315FC8]">All Listings</Link></li>
                <li><Link href="/marketplace?category=physical" className="hover:text-[#315FC8]">Physical Products</Link></li>
                <li><Link href="/marketplace?category=digital" className="hover:text-[#315FC8]">Digital Products</Link></li>
                <li><Link href="/marketplace?category=gaming" className="hover:text-[#315FC8]">Gaming</Link></li>
                <li><Link href="/marketplace?category=services" className="hover:text-[#315FC8]">Services</Link></li>
              </ul>
            </div>

            <div>
              <h3 className="type-meta">
                Workspace
              </h3>
              <ul className="mt-2.5 space-y-1.5 text-xs text-[#171717]">
                <li><Link href="/sell" className="hover:text-[#315FC8]">Sell on WISERD</Link></li>
                <li><Link href="/orders" className="hover:text-[#315FC8]">Orders &amp; Escrow</Link></li>
                <li><Link href="/wallet" className="hover:text-[#315FC8]">Wallet Management</Link></li>
                <li><Link href="/community" className="hover:text-[#315FC8]">Community</Link></li>
                <li><Link href="/messages" className="hover:text-[#315FC8]">Messages</Link></li>
              </ul>
            </div>

            <div>
              <h3 className="type-meta">
                System Status
              </h3>
              <div className="mt-2.5 space-y-1.5 text-xs text-[#6B6B6B]">
                <p>
                  <span className="text-[#171717]">Google Auth:</span>{" "}
                  {integrations?.googleIdentityServices.configured
                    ? "Active"
                    : integrations?.localSandboxEnabled
                      ? "Local Preview"
                      : "Config Required"}
                </p>
                <p>
                  <span className="text-[#171717]">Fiat Escrow:</span>{" "}
                  {integrations?.fiatPaymentProvider.configured
                    ? integrations.fiatPaymentProvider.providerName
                    : "Preview Mode"}
                </p>
                <p>
                  <span className="text-[#171717]">Onchain Escrow:</span>{" "}
                  {integrations?.onchainEscrow.configured
                    ? integrations.onchainEscrow.chainName
                    : "Not Configured"}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-[#E5E7EB] pt-5 text-xs text-[#6B6B6B]">
            <p>© 2026 WISERD. Google sign-in and blockchain wallets remain separate. Product names and logos are trademarks of their owners.</p>
            <div className="flex items-center gap-4">
              <Link href="/privacy" className="hover:text-[#315FC8]">Privacy</Link>
              <Link href="/terms" className="hover:text-[#315FC8]">Terms</Link>
              <Link href="/account" className="hover:text-[#315FC8]">Account</Link>
              <Link href="/cart" className="hover:text-[#315FC8]">Cart</Link>
            </div>
          </div>
        </div>
      </footer>

      {/* Mobile Compact Bottom Navigation */}
      <nav
        aria-label="Mobile bottom navigation"
        className="fixed right-0 bottom-0 left-0 z-40 border-t border-[#E5E7EB] bg-white/[0.98] px-2 py-1.5 backdrop-blur-md lg:hidden"
      >
        <div className="mx-auto grid max-w-md grid-cols-5 gap-1">
          {[
            { href: "/", label: "Home", icon: Home },
            { href: "/marketplace", label: "Market", icon: Store },
            { href: "/community", label: "Community", icon: Users },
            { href: "/messages", label: "Messages", icon: MessageSquare },
            { href: "/account", label: "Account", icon: UserIcon },
          ].map((tab) => {
            const Icon = tab.icon;
            const active =
              tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex min-h-[44px] flex-col items-center justify-center gap-0.5 rounded-lg text-[11px] font-medium transition ${
                  active ? "text-[#315FC8]" : "text-[#6B6B6B] hover:text-[#171717]"
                }`}
              >
                <Icon aria-hidden="true" className="h-4 w-4" />
                <span>{tab.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Slide-Over Cart Drawer */}
      {cartDrawerOpen && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-[#171717]/30 backdrop-blur-[2px]"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeCartDrawer();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Shopping cart"
            className="flex h-full w-full max-w-md flex-col border-l border-[#E5E7EB] bg-white shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-[#E5E7EB] px-5 py-4">
              <div>
                <h2 className="text-sm text-[#171717]">Shopping Cart</h2>
                <p className="font-mono-light text-xs text-[#6B6B6B]">
                  {cartCount} {cartCount === 1 ? "item" : "items"}
                </p>
              </div>
              <button
                type="button"
                onClick={closeCartDrawer}
                aria-label="Close cart drawer"
                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-[#E5E7EB] text-[#6B6B6B] hover:text-[#171717]"
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#E5E7EB] bg-[#F7F7F5] text-[#6B6B6B]">
                    <ShoppingBag aria-hidden="true" className="h-5 w-5" />
                  </span>
                  <p className="mt-4 text-sm font-medium text-[#171717]">
                    Your cart is empty
                  </p>
                  <p className="mt-1 max-w-xs text-xs text-[#6B6B6B]">
                    Browse listings to compare sellers and add items to your cart.
                  </p>
                  <Link
                    href="/marketplace"
                    onClick={closeCartDrawer}
                    className="mt-5 inline-flex h-10 items-center rounded-lg bg-[#315FC8] px-4 text-xs font-medium text-white hover:bg-[#274EA6]"
                  >
                    Browse Marketplace
                  </Link>
                </div>
              ) : (
                <div className="divide-y divide-[#F0F1F2]">
                  {cartLines.map(({ item, product, variation, unitCents }) => (
                    <div
                      key={`${item.productId}-${item.variationId || "default"}`}
                      className="flex gap-3 py-3.5"
                    >
                      <Link
                        href={`/products/${product.slug}`}
                        onClick={closeCartDrawer}
                        className="shrink-0"
                      >
                        <Image
                          src={product.imageUrl}
                          alt={product.title}
                          width={80}
                          height={64}
                          className="h-16 w-20 rounded-lg border border-[#E5E7EB] bg-[#F2F2EF] object-cover"
                        />
                      </Link>
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/products/${product.slug}`}
                          onClick={closeCartDrawer}
                          className="block truncate text-sm text-[#171717] hover:text-[#315FC8]"
                        >
                          {product.title}
                        </Link>
                        {variation && (
                          <p className="text-xs text-[#6B6B6B]">{variation.label}</p>
                        )}
                        <div className="mt-2 flex items-center justify-between">
                          <span className="type-price text-sm">
                            {formatUsd(unitCents * item.quantity)}
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              aria-label="Decrease quantity"
                              onClick={() =>
                                updateCartQuantity(
                                  item.productId,
                                  item.variationId,
                                  item.quantity - 1
                                )
                              }
                              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border border-[#E5E7EB] text-[#6B6B6B] hover:text-[#171717]"
                            >
                              <Minus aria-hidden="true" className="h-3.5 w-3.5" />
                            </button>
                            <span className="font-mono-light min-w-5 text-center text-xs">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              aria-label="Increase quantity"
                              onClick={() =>
                                updateCartQuantity(
                                  item.productId,
                                  item.variationId,
                                  item.quantity + 1
                                )
                              }
                              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border border-[#E5E7EB] text-[#6B6B6B] hover:text-[#171717]"
                            >
                              <Plus aria-hidden="true" className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              aria-label="Remove item"
                              onClick={() =>
                                removeFromCart(item.productId, item.variationId)
                              }
                              className="ml-1 flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-[#6B6B6B] hover:text-[#C81E1E]"
                            >
                              <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {cart.length > 0 && (
              <div className="border-t border-[#E5E7EB] bg-[#F7F7F5] px-5 py-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[#6B6B6B]">Estimated subtotal</span>
                  <span className="type-price text-base">
                    {formatUsd(drawerSubtotal)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-[#6B6B6B]">
                  Shipping and platform fees are verified on the server at checkout.
                </p>
                <div className="mt-3.5 grid grid-cols-2 gap-2">
                  <Link
                    href="/cart"
                    onClick={closeCartDrawer}
                    className="flex h-10 items-center justify-center rounded-lg border border-[#E5E7EB] bg-white text-xs font-medium text-[#171717] hover:border-[#171717]/30"
                  >
                    View Cart
                  </Link>
                  <Link
                    href="/checkout"
                    onClick={closeCartDrawer}
                    className="flex h-10 items-center justify-center gap-1.5 rounded-lg bg-[#315FC8] text-xs font-medium text-white hover:bg-[#274EA6]"
                  >
                    Checkout <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Strictly Separated Google Auth & Connect Wallet 2.0 Modals */}
      <GoogleAuthModal
        open={googleModalOpen}
        onClose={closeGoogleAuthModal}
        integrations={integrations}
        currentUser={user}
        onSignedIn={refreshSession}
        onSwitchToWallet={openWalletModal}
      />

      <WalletModal
        open={walletModalOpen}
        onClose={closeWalletModal}
        user={user}
        wallets={wallets}
        integrations={integrations}
        onWalletUpdated={refreshSession}
        onRequireSignIn={openGoogleAuthModal}
      />
    </div>
  );
}
