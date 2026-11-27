"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  User as UserIcon,
  LogOut,
  Plus,
  Trash2,
  Check,
} from "lucide-react";
import { useWiserd } from "@/components/providers/wiserd-provider";
import { WiserdMeter } from "@/components/ui/wiserd-meter";
import { ProductCard, type EnrichedProduct } from "@/components/marketplace/product-card";

const MAX_DISPLAY_NAME = 60;
const MAX_BIO = 280;

export default function AccountPage() {
  const {
    user,
    wallets,
    notifications,
    openGoogleAuthModal,
    openWalletModal,
    refreshSession,
    signOut,
    markNotificationRead,
  } = useWiserd();

  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [hydratedUserId, setHydratedUserId] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<EnrichedProduct[]>([]);

  // Form feedback & loading states
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileNotice, setProfileNotice] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  // New Address Form
  const [addrLabel, setAddrLabel] = useState("Studio");
  const [addrRecipient, setAddrRecipient] = useState("");
  const [addrLine1, setAddrLine1] = useState("");
  const [addrCity, setAddrCity] = useState("");
  const [addrPostal, setAddrPostal] = useState("");
  const [savingAddress, setSavingAddress] = useState(false);
  const [addressNotice, setAddressNotice] = useState<string | null>(null);
  const [addressError, setAddressError] = useState<string | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);

  if (user && hydratedUserId !== user.id) {
    setHydratedUserId(user.id);
    setDisplayName(user.displayName);
    setBio(user.bio || "");
    setAddrRecipient(user.displayName);
  }

  useEffect(() => {
    let active = true;
    if (!user || user.favoriteProductIds.length === 0) {
      Promise.resolve().then(() => {
        if (active) setFavorites([]);
      });
      return () => {
        active = false;
      };
    }
    fetch("/api/products", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (!active) return;
        const list = (d.products || []) as EnrichedProduct[];
        setFavorites(list.filter((p) => user.favoriteProductIds.includes(p.id)));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [user]);

  if (!user) {
    return (
      <div className="mx-auto max-w-[960px] px-4 pt-12 sm:px-6 lg:px-8">
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-8 text-center sm:p-10">
          <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl border border-[#E5E7EB] bg-[#F7F7F5] text-[#6B6B6B]">
            <UserIcon aria-hidden="true" className="h-5 w-5" />
          </span>
          <h1 className="mt-4 text-2xl text-[#171717]">
            Sign in to manage your WISERD account
          </h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-[#6B6B6B]">
            Access your profile, connected Google identity, linked wallets,
            saved favorites, shipping addresses, and notifications.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
            <button
              type="button"
              onClick={openGoogleAuthModal}
              className="inline-flex h-10 cursor-pointer items-center justify-center rounded-lg bg-[#315FC8] px-6 text-xs font-medium text-white transition hover:bg-[#274EA6]"
            >
              Continue with Google
            </button>
            <Link
              href="/marketplace"
              className="inline-flex h-10 items-center justify-center rounded-lg border border-[#E5E7EB] bg-white px-5 text-xs font-medium text-[#171717] transition hover:border-[#171717]/30"
            >
              Browse Marketplace
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const unreadCount = notifications.filter((n) => !n.read).length;

  const readinessChecks = [
    Boolean(user.displayName.trim()),
    Boolean(user.bio.trim()),
    user.addresses.length > 0,
    wallets.length > 0,
    user.authMode === "google_verified",
  ];
  const accountCompletion = Math.round(
    (readinessChecks.filter(Boolean).length / readinessChecks.length) * 100
  );

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileNotice(null);
    setProfileError(null);

    if (displayName.trim().length < 2) {
      setProfileError("Display name must be at least 2 characters.");
      return;
    }

    setSavingProfile(true);
    try {
      const res = await fetch("/api/auth/session", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, bio }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setProfileError(data.error || "Could not update profile. Please try again.");
        return;
      }
      setProfileNotice("Profile saved.");
      await refreshSession();
    } catch {
      setProfileError("Network error while saving profile.");
    } finally {
      setSavingProfile(false);
    }
  };

  const addAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddressNotice(null);
    setAddressError(null);

    if (!addrRecipient.trim() || !addrLine1.trim() || !addrCity.trim()) {
      setAddressError("Recipient, street address, and city are required.");
      return;
    }

    setSavingAddress(true);
    try {
      const res = await fetch("/api/auth/session", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_address",
          address: {
            label: addrLabel.trim() || "Shipping Address",
            recipient: addrRecipient.trim(),
            line1: addrLine1.trim(),
            city: addrCity.trim(),
            country: "United States",
            postalCode: addrPostal.trim(),
          },
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setAddressError(data.error || "Could not save shipping address.");
        return;
      }
      setAddrLine1("");
      setAddrCity("");
      setAddrPostal("");
      setAddressNotice("Shipping address added.");
      await refreshSession();
    } catch {
      setAddressError("Network error while saving address.");
    } finally {
      setSavingAddress(false);
    }
  };

  const removeAddress = async (id: string) => {
    setAddressNotice(null);
    setAddressError(null);
    const res = await fetch("/api/auth/session", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "remove_address", removeAddressId: id }),
    });
    setConfirmRemoveId(null);
    if (res.ok) {
      setAddressNotice("Shipping address removed.");
      await refreshSession();
    } else {
      setAddressError("Could not remove shipping address.");
    }
  };

  return (
    <div className="mx-auto max-w-[1320px] space-y-8 px-4 pt-8 pb-12 sm:px-6 lg:px-8">
      {/* Account Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#E5E7EB] pb-5">
        <div className="min-w-0">
          <p className="type-meta text-[#315FC8]">Account &amp; Profile</p>
          <h1 className="mt-1 truncate text-3xl text-[#171717]">
            {user.displayName}
          </h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-[#6B6B6B]">
            {user.handle && (
              <span className="font-mono-light text-xs text-[#171717]">
                @{user.handle}
              </span>
            )}
            <span className="truncate">{user.email}</span>
            <span className="inline-flex items-center rounded-md border border-[#E5E7EB] bg-white px-2 py-0.5 text-xs text-[#6B6B6B] capitalize">
              {user.roles.join(" · ")}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={signOut}
          className="inline-flex h-10 cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg border border-[#E5E7EB] bg-white px-4 text-xs font-medium text-[#171717] transition hover:border-[#C81E1E]/40 hover:text-[#C81E1E]"
        >
          <LogOut aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
          Sign Out
        </button>
      </div>

      {/* Separated Identity & Wallet Architecture Cards */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="flex flex-col rounded-xl border border-[#E5E7EB] bg-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg text-[#171717]">
              Connected Google Account
            </h2>
            <span
              className={`shrink-0 whitespace-nowrap rounded-md px-2.5 py-0.5 text-xs font-medium ${
                user.authMode === "google_verified"
                  ? "bg-[#167A67]/12 text-[#167A67]"
                  : "bg-[#F0F1F2] text-[#6B6B6B]"
              }`}
            >
              {user.authMode === "google_verified"
                ? "Google Verified"
                : "Local Sandbox Session"}
            </span>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-[#6B6B6B]">
            Google authentication manages your WISERD account identity only.
            WISERD never requests Gmail mailbox access or Google passwords.
          </p>
          <div className="mt-auto flex flex-wrap gap-2 pt-4">
            <button
              type="button"
              onClick={openGoogleAuthModal}
              className="h-10 cursor-pointer whitespace-nowrap rounded-lg border border-[#E5E7EB] bg-[#F7F7F5] px-4 text-xs font-medium text-[#171717] transition hover:border-[#315FC8]/40"
            >
              Manage Google Sign-In
            </button>
            <Link
              href="/orders"
              className="inline-flex h-10 items-center whitespace-nowrap rounded-lg bg-[#315FC8] px-4 text-xs font-medium text-white transition hover:bg-[#274EA6]"
            >
              My Orders &amp; Escrow
            </Link>
          </div>
        </section>

        <section className="flex flex-col rounded-xl border border-[#E5E7EB] bg-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg text-[#171717]">
              Connected Blockchain Wallets
            </h2>
            <div className="flex items-center gap-2">
              <Link
                href="/wallet"
                className="inline-flex h-9 items-center whitespace-nowrap rounded-lg border border-[#E5E7EB] bg-white px-3 text-xs font-medium text-[#171717] transition hover:border-[#315FC8]/40"
              >
                Wallet Center
              </Link>
              <button
                type="button"
                onClick={openWalletModal}
                className="h-9 cursor-pointer whitespace-nowrap rounded-lg bg-[#315FC8] px-3.5 text-xs font-medium text-white transition hover:bg-[#274EA6]"
              >
                Connect
              </button>
            </div>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-[#6B6B6B]">
            Wallet connectivity is completely separate from Google login. Link
            addresses via explicit cryptographic ownership signature.
          </p>
          {wallets.length === 0 ? (
            <p className="mt-3 rounded-lg border border-dashed border-[#E5E7EB] bg-[#F7F7F5] px-3.5 py-2.5 text-xs text-[#6B6B6B]">
              No wallet linked yet. You can browse and buy without a wallet.
            </p>
          ) : (
            <div className="mt-3 space-y-2">
              {wallets.map((w) => (
                <div
                  key={w.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-[#E5E7EB] bg-[#F7F7F5] px-3.5 py-2.5 text-xs"
                >
                  <span className="min-w-0 truncate font-medium text-[#171717]">
                    {w.walletName}{" "}
                    <span className="font-mono-light text-[#315FC8]">
                      {w.address.slice(0, 6)}...{w.address.slice(-4)}
                    </span>
                  </span>
                  <span className="shrink-0 whitespace-nowrap text-[#167A67]">
                    {w.networkName}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Profile, Meter, Notifications & Shipping Addresses */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <form
          onSubmit={saveProfile}
          noValidate
          className="space-y-4 rounded-xl border border-[#E5E7EB] bg-white p-6 lg:col-span-5"
        >
          <div>
            <h2 className="text-lg text-[#171717]">Profile Details</h2>
            <p className="mt-0.5 text-xs text-[#6B6B6B]">
              Visible across your community posts, comments, and storefront replies.
            </p>
          </div>

          <WiserdMeter
            label="Account Setup Completion"
            value={accountCompletion}
            max={100}
            tone="blue"
            helperText="Based on profile name, bio, saved address, linked wallet, and verified Google login."
          />

          <div>
            <div className="flex items-baseline justify-between gap-2">
              <label htmlFor="acc-name" className="text-xs font-medium text-[#171717]">
                Display name
              </label>
              <span className="font-mono-light text-[11px] text-[#6B6B6B]">
                {displayName.trim().length}/{MAX_DISPLAY_NAME}
              </span>
            </div>
            <input
              id="acc-name"
              required
              minLength={2}
              maxLength={MAX_DISPLAY_NAME}
              value={displayName}
              onChange={(e) => {
                setDisplayName(e.target.value);
                if (profileError) setProfileError(null);
              }}
              aria-invalid={Boolean(profileError)}
              className={`mt-1.5 h-10 w-full rounded-lg border bg-white px-3 text-sm text-[#171717] focus:border-[#315FC8] focus:outline-none ${
                profileError ? "border-[#C81E1E]" : "border-[#E5E7EB]"
              }`}
            />
          </div>

          <div>
            <div className="flex items-baseline justify-between gap-2">
              <label htmlFor="acc-bio" className="text-xs font-medium text-[#171717]">
                Bio
              </label>
              <span className="font-mono-light text-[11px] text-[#6B6B6B]">
                {bio.length}/{MAX_BIO}
              </span>
            </div>
            <textarea
              id="acc-bio"
              rows={3}
              maxLength={MAX_BIO}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell buyers or community members what you collect or build..."
              className="mt-1.5 w-full rounded-lg border border-[#E5E7EB] bg-white p-3 text-sm text-[#171717] placeholder:text-[#6B6B6B] focus:border-[#315FC8] focus:outline-none"
            />
          </div>

          {profileError && (
            <p role="alert" className="text-xs font-medium text-[#C81E1E]">
              {profileError}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={savingProfile}
              className="inline-flex h-10 cursor-pointer items-center justify-center rounded-lg bg-[#315FC8] px-5 text-xs font-medium text-white transition hover:bg-[#274EA6] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savingProfile ? "Saving..." : "Save Profile"}
            </button>
            {profileNotice && (
              <p
                role="status"
                aria-live="polite"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-[#167A67]"
              >
                <Check aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                {profileNotice}
              </p>
            )}
          </div>
        </form>

        {/* Notifications & Addresses */}
        <div className="space-y-6 lg:col-span-7">
          <section className="rounded-xl border border-[#E5E7EB] bg-white p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-baseline gap-2 text-lg text-[#171717]">
                <span>Notifications</span>
                <span className="font-mono-light text-sm text-[#6B6B6B]">
                  {unreadCount > 0 ? `${unreadCount} unread` : notifications.length}
                </span>
              </h2>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => markNotificationRead()}
                  className="min-h-[32px] cursor-pointer rounded-md px-2 text-xs font-medium text-[#315FC8] transition hover:bg-[#315FC8]/[0.06]"
                >
                  Mark all read
                </button>
              )}
            </div>
            <div className="mt-3 max-h-56 space-y-2 overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="rounded-lg border border-dashed border-[#E5E7EB] bg-[#F7F7F5] px-4 py-5 text-center text-xs text-[#6B6B6B]">
                  No notifications yet. Order updates, messages, and escrow events appear here.
                </p>
              ) : (
                notifications.map((n) => (
                  <Link
                    key={n.id}
                    href={n.href}
                    onClick={() => {
                      if (!n.read) markNotificationRead(n.id);
                    }}
                    className={`block rounded-xl border p-3 text-xs transition ${
                      n.read
                        ? "border-[#E5E7EB] bg-[#F7F7F5] hover:border-[#171717]/20"
                        : "border-[#315FC8]/30 bg-[#315FC8]/[0.05] hover:border-[#315FC8]/50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-[#171717]">{n.title}</p>
                      {!n.read && (
                        <span
                          aria-label="Unread"
                          className="h-2 w-2 shrink-0 rounded-full bg-[#315FC8]"
                        />
                      )}
                    </div>
                    <p className="mt-0.5 text-[#6B6B6B]">{n.body}</p>
                  </Link>
                ))
              )}
            </div>
          </section>

          <section className="rounded-xl border border-[#E5E7EB] bg-white p-6">
            <h2 className="text-lg text-[#171717]">
              Saved Shipping Addresses
            </h2>

            {user.addresses.length === 0 ? (
              <p className="mt-3 rounded-lg border border-dashed border-[#E5E7EB] bg-[#F7F7F5] px-4 py-4 text-xs text-[#6B6B6B]">
                No shipping addresses saved yet. Add one below for faster physical checkout.
              </p>
            ) : (
              <div className="mt-3 space-y-2">
                {user.addresses.map((addr) => (
                  <div
                    key={addr.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E5E7EB] bg-[#F7F7F5] px-4 py-3 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-[#171717]">
                        {addr.label} · {addr.recipient}
                      </p>
                      <p className="mt-0.5 text-[#6B6B6B]">
                        {addr.line1}, {addr.city}
                        {addr.postalCode ? ` ${addr.postalCode}` : ""}
                      </p>
                    </div>

                    {confirmRemoveId === addr.id ? (
                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          type="button"
                          onClick={() => removeAddress(addr.id)}
                          className="h-8 cursor-pointer rounded-md bg-[#C81E1E] px-2.5 text-xs font-medium text-white transition hover:bg-[#A61717]"
                        >
                          Remove
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmRemoveId(null)}
                          className="h-8 cursor-pointer rounded-md border border-[#E5E7EB] bg-white px-2.5 text-xs font-medium text-[#171717]"
                        >
                          Keep
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        aria-label={`Remove ${addr.label} address`}
                        onClick={() => setConfirmRemoveId(addr.id)}
                        className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-transparent text-[#6B6B6B] transition hover:border-[#C81E1E]/25 hover:bg-white hover:text-[#C81E1E]"
                      >
                        <Trash2 aria-hidden="true" className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            <form
              onSubmit={addAddress}
              noValidate
              className="mt-4 space-y-3 border-t border-[#E5E7EB] pt-4"
            >
              <p className="type-meta">Add shipping address</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="addr-label" className="text-xs font-medium text-[#6B6B6B]">
                    Label
                  </label>
                  <input
                    id="addr-label"
                    value={addrLabel}
                    onChange={(e) => setAddrLabel(e.target.value)}
                    placeholder="Home, Studio, Office"
                    className="mt-1 h-10 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 text-xs text-[#171717] focus:border-[#315FC8] focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="addr-recipient" className="text-xs font-medium text-[#6B6B6B]">
                    Recipient
                  </label>
                  <input
                    id="addr-recipient"
                    required
                    value={addrRecipient}
                    onChange={(e) => setAddrRecipient(e.target.value)}
                    placeholder="Full name"
                    className="mt-1 h-10 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 text-xs text-[#171717] focus:border-[#315FC8] focus:outline-none"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="addr-line1" className="text-xs font-medium text-[#6B6B6B]">
                    Street address
                  </label>
                  <input
                    id="addr-line1"
                    required
                    value={addrLine1}
                    onChange={(e) => setAddrLine1(e.target.value)}
                    placeholder="420 Market St, Suite 400"
                    className="mt-1 h-10 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 text-xs text-[#171717] focus:border-[#315FC8] focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="addr-city" className="text-xs font-medium text-[#6B6B6B]">
                    City
                  </label>
                  <input
                    id="addr-city"
                    required
                    value={addrCity}
                    onChange={(e) => setAddrCity(e.target.value)}
                    placeholder="San Francisco"
                    className="mt-1 h-10 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 text-xs text-[#171717] focus:border-[#315FC8] focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="addr-postal" className="text-xs font-medium text-[#6B6B6B]">
                    Postal code
                  </label>
                  <input
                    id="addr-postal"
                    value={addrPostal}
                    onChange={(e) => setAddrPostal(e.target.value)}
                    placeholder="94105"
                    className="mt-1 h-10 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 text-xs text-[#171717] focus:border-[#315FC8] focus:outline-none"
                  />
                </div>
              </div>

              {addressError && (
                <p role="alert" className="text-xs font-medium text-[#C81E1E]">
                  {addressError}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="submit"
                  disabled={savingAddress}
                  className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-lg bg-[#315FC8] px-4 text-xs font-medium text-white transition hover:bg-[#274EA6] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Plus aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                  {savingAddress ? "Adding..." : "Add Address"}
                </button>
                {addressNotice && (
                  <p
                    role="status"
                    aria-live="polite"
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-[#167A67]"
                  >
                    <Check aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                    {addressNotice}
                  </p>
                )}
              </div>
            </form>
          </section>
        </div>
      </div>

      {/* Saved Favorites */}
      <section className="border-t border-[#E5E7EB] pt-8">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="flex items-baseline gap-2 text-xl text-[#171717]">
            <span>Saved Favorites</span>
            <span className="font-mono-light text-sm text-[#6B6B6B]">
              {favorites.length}
            </span>
          </h2>
          {favorites.length > 0 && (
            <Link
              href="/marketplace"
              className="text-xs font-medium text-[#315FC8] hover:underline"
            >
              Explore more
            </Link>
          )}
        </div>
        {favorites.length === 0 ? (
          <div className="mt-4 rounded-xl border border-[#E5E7EB] bg-white px-6 py-10 text-center">
            <p className="text-sm font-medium text-[#171717]">
              No saved listings yet
            </p>
            <p className="mt-1 text-xs text-[#6B6B6B]">
              Save listings from the marketplace using the heart icon to compare them here.
            </p>
            <Link
              href="/marketplace"
              className="mt-4 inline-flex h-9 items-center rounded-lg border border-[#E5E7EB] bg-[#F7F7F5] px-4 text-xs font-medium text-[#171717] transition hover:border-[#171717]/30"
            >
              Browse Marketplace
            </Link>
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {favorites.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
