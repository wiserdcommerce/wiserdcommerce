"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { X, Check, ChevronRight } from "lucide-react";
import { CenterRevealPanel } from "@/components/motion/motion-primitives";
import type { IntegrationStatus, User } from "@/lib/types";

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (opts: {
            client_id: string;
            callback: (res: { credential?: string }) => void;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: Record<string, string | number>
          ) => void;
        };
      };
    };
  }
}

interface GoogleAuthModalProps {
  open: boolean;
  onClose: () => void;
  integrations: IntegrationStatus | null;
  currentUser: User | null;
  onSignedIn: () => Promise<void>;
  onSwitchToWallet: () => void;
}

/**
 * Google account sign-in, kept separate from wallet connection.
 * Renders the official Google Identity Services button only when NEXT_PUBLIC_GOOGLE_CLIENT_ID is set;
 * never fakes Google verification without a server-verified ID token.
 */
export function GoogleAuthModal({
  open,
  onClose,
  integrations,
  currentUser,
  onSignedIn,
  onSwitchToWallet,
}: GoogleAuthModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const googleButtonRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const gisConfigured = Boolean(integrations?.googleIdentityServices.configured);
  const clientId = integrations?.googleIdentityServices.clientId || null;
  const sandboxAllowed = Boolean(integrations?.localSandboxEnabled);

  useEffect(() => {
    if (!open) return;
    openerRef.current = document.activeElement as HTMLElement | null;
    const focusTimer = window.setTimeout(() => {
      dialogRef.current?.focus();
    }, 30);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "Tab" && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
      openerRef.current?.focus();
    };
  }, [open, onClose]);

  // Load and render the official Google Identity Services button when configured
  useEffect(() => {
    if (!open || !gisConfigured || !clientId || !googleButtonRef.current) return;

    const mountOfficialButton = () => {
      if (!window.google?.accounts?.id || !googleButtonRef.current) return;
      googleButtonRef.current.innerHTML = "";
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async (response) => {
          if (!response.credential) {
            setError("Google didn't return a sign-in token. Try again.");
            return;
          }
          setBusy(true);
          setError(null);
          try {
            const res = await fetch("/api/auth/google", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ credential: response.credential }),
            });
            const data = await res.json();
            if (!res.ok) {
              setError(data.error || "We couldn't verify your Google sign-in.");
            } else {
              await onSignedIn();
              onClose();
            }
          } catch {
            setError("Connection lost while verifying your Google sign-in.");
          } finally {
            setBusy(false);
          }
        },
      });
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: "outline",
        size: "large",
        shape: "rectangular",
        text: "continue_with",
        width: 340,
      });
    };

    if (window.google?.accounts?.id) {
      mountOfficialButton();
      return;
    }

    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://accounts.google.com/gsi/client"]'
    );
    if (existing) {
      existing.addEventListener("load", mountOfficialButton);
      return () => existing.removeEventListener("load", mountOfficialButton);
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = mountOfficialButton;
    document.head.appendChild(script);
  }, [open, gisConfigured, clientId, onSignedIn, onClose]);

  const handleSandboxSignIn = async (sandboxUserId: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "local_sandbox", sandboxUserId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Couldn't start the local test session.");
      } else {
        await onSignedIn();
        onClose();
      }
    } catch {
      setError("Couldn't reach the WISERD sign-in server.");
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[#171717]/25 p-0 backdrop-blur-[3px] sm:items-center sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <CenterRevealPanel className="w-full max-w-[420px]">
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="wiserd-google-auth-title"
          tabIndex={-1}
          className="max-h-[92dvh] overflow-y-auto rounded-t-[28px] bg-[#EEEEEC] p-1.5 text-[#171717] focus:outline-none sm:rounded-[28px]"
        >
          <div className="rounded-[22px] bg-white px-5 pt-5 pb-5 shadow-[0_1px_2px_rgba(23,23,23,0.05),0_12px_28px_-16px_rgba(23,23,23,0.22)]">
            <div className="relative flex flex-col items-center text-center">
              <Image
                src="/brand/google-icon.svg"
                alt=""
                aria-hidden="true"
                width={28}
                height={28}
                unoptimized
                className="h-7 w-7"
              />
              <h2 id="wiserd-google-auth-title" className="mt-3 text-[17px] text-[#171717]">
                Sign in with Google
              </h2>
              <p className="mt-1 max-w-[290px] text-xs leading-relaxed text-[#6B6B6B]">
                Use your Gmail profile to buy, sell, and track orders on WISERD.
              </p>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="absolute -top-1 -right-1 flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-[#6B6B6B] transition hover:bg-[#F0F1F2] hover:text-[#171717]"
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </button>
            </div>

            {currentUser && (
              <p
                role="status"
                className="mt-5 flex items-center justify-center gap-1.5 rounded-2xl bg-[#F7F7F5] px-4 py-3 text-xs text-[#6B6B6B]"
              >
                <Check aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-[#167A67]" />
                <span className="truncate">
                  Signed in as{" "}
                  <span className="font-medium text-[#171717]">{currentUser.displayName}</span>
                  {currentUser.authMode === "google_verified" ? "" : " (local test account)"}
                </span>
              </p>
            )}

            {gisConfigured ? (
              <div className="mt-5 flex flex-col items-center">
                <div ref={googleButtonRef} className="min-h-[44px]" />
                {busy && (
                  <p className="mt-2 text-xs text-[#6B6B6B]">Verifying with Google...</p>
                )}
              </div>
            ) : sandboxAllowed ? (
              <div className="mt-5 space-y-2">
                <p className="type-meta pb-0.5 text-center">Choose a preview account</p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handleSandboxSignIn("usr_demo_member")}
                  className="group flex min-h-[58px] w-full cursor-pointer items-center gap-3.5 rounded-2xl border border-[#E5E7EB] bg-white px-4 text-left transition hover:border-[#171717]/20 hover:bg-[#FAFAF9] disabled:opacity-60"
                >
                  <span
                    aria-hidden="true"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#315FC8] text-xs font-medium text-white"
                  >
                    AR
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-medium text-[#171717]">
                      Alex Rivera
                    </span>
                    <span className="block truncate text-xs text-[#6B6B6B]">
                      Buyer, seller &amp; admin
                    </span>
                  </span>
                  <ChevronRight
                    aria-hidden="true"
                    className="h-4 w-4 shrink-0 text-[#9CA3AF] transition group-hover:translate-x-0.5 group-hover:text-[#171717]"
                  />
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handleSandboxSignIn("usr_seller_atelier")}
                  className="group flex min-h-[58px] w-full cursor-pointer items-center gap-3.5 rounded-2xl border border-[#E5E7EB] bg-white px-4 text-left transition hover:border-[#171717]/20 hover:bg-[#FAFAF9] disabled:opacity-60"
                >
                  <span
                    aria-hidden="true"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#171717] text-xs font-medium text-white"
                  >
                    NV
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-medium text-[#171717]">
                      Nadia Vance
                    </span>
                    <span className="block truncate text-xs text-[#6B6B6B]">
                      Seller · Atelier Nord Hardware
                    </span>
                  </span>
                  <ChevronRight
                    aria-hidden="true"
                    className="h-4 w-4 shrink-0 text-[#9CA3AF] transition group-hover:translate-x-0.5 group-hover:text-[#171717]"
                  />
                </button>
                <p className="pt-1 text-center text-[11px] text-[#6B6B6B]">
                  {busy
                    ? "Signing in..."
                    : "Local preview mode · Live Google OAuth activates in production."}
                </p>
              </div>
            ) : (
              <div className="mt-5 rounded-2xl bg-[#F7F7F5] px-4 py-3.5 text-center text-xs leading-relaxed text-[#6B6B6B]">
                Google sign-in is not enabled on this environment yet. Connect a wallet below to
                continue.
              </div>
            )}

            {error && (
              <p role="alert" className="mt-4 text-center text-xs font-medium text-[#C81E1E]">
                {error}
              </p>
            )}
          </div>

          <div className="px-5 pt-4 pb-4 text-center text-xs leading-relaxed text-[#6B6B6B]">
            <p>
              WISERD never sees your Gmail inbox or password.{" "}
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onSwitchToWallet();
                }}
                className="cursor-pointer font-medium text-[#171717] underline-offset-2 hover:underline"
              >
                Connect a wallet instead
              </button>
            </p>
          </div>
        </div>
      </CenterRevealPanel>
    </div>
  );
}
