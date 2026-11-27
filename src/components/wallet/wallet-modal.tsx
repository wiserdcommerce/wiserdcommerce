"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { X, Copy, Check, ArrowUpRight, Ellipsis, ChevronDown } from "lucide-react";
import { CenterRevealPanel } from "@/components/motion/motion-primitives";
import type { IntegrationStatus, User, WalletLink } from "@/lib/types";

export interface Eip1193Provider {
  isMetaMask?: boolean;
  isRainbow?: boolean;
  isRabby?: boolean;
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
}

interface DiscoveredWallet {
  id: string;
  name: string;
  rdns?: string;
  icon?: string;
  provider: Eip1193Provider;
}

declare global {
  interface Window {
    ethereum?: Eip1193Provider;
  }
}

export type WalletUiState =
  | "Not Connected"
  | "Connecting"
  | "Verification Required"
  | "Unsupported Network"
  | "Connected"
  | "Transaction Rejected"
  | "Disconnected";

const CHAIN_LABELS: Record<string, string> = {
  "0x1": "Ethereum Mainnet",
  "0x2105": "Base Mainnet",
  "0x14a34": "Base Sepolia",
  "0xaa36a7": "Ethereum Sepolia",
  "0x89": "Polygon PoS",
  "0xa4b1": "Arbitrum One",
  "0xa": "OP Mainnet",
};

const KNOWN_WALLETS = [
  {
    key: "metamask",
    name: "MetaMask",
    rdns: "io.metamask",
    match: /metamask/i,
    icon: "/brand/metamask.svg" as string | null,
    installUrl: "https://metamask.io/download/",
  },
  {
    key: "rainbow",
    name: "Rainbow",
    rdns: "me.rainbow",
    match: /rainbow/i,
    icon: "/brand/rainbow.svg" as string | null,
    installUrl: "https://rainbow.me/download",
  },
];

function shortenAddress(addr: string): string {
  if (addr.length < 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function knownIconFor(name: string): string | null {
  return KNOWN_WALLETS.find((k) => k.match.test(name))?.icon || null;
}

function WalletMark({ name, src }: { name: string; src?: string | null }) {
  if (src) {
    return (
      <Image
        src={src}
        alt=""
        aria-hidden="true"
        width={32}
        height={32}
        unoptimized
        className="h-8 w-8 shrink-0 rounded-lg object-contain"
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#F0F1F2] text-[13px] font-medium text-[#171717]"
    >
      {name.charAt(0)}
    </span>
  );
}

const ROW =
  "flex min-h-[56px] w-full items-center gap-3.5 rounded-2xl border border-[#E5E7EB] bg-white px-4 text-left transition hover:border-[#171717]/20 hover:bg-[#FAFAF9] disabled:cursor-not-allowed disabled:opacity-60";

interface WalletModalProps {
  open: boolean;
  onClose: () => void;
  user: User | null;
  wallets: WalletLink[];
  integrations: IntegrationStatus | null;
  onWalletUpdated: () => Promise<void>;
  onRequireSignIn: () => void;
}

/**
 * Connect Wallet modal: one list of wallets on a white card, Google sign-in on the layer beneath.
 * Real EIP-6963 / EIP-1193 discovery; a wallet that is not installed links to its official download page.
 */
export function WalletModal({
  open,
  onClose,
  user,
  wallets,
  integrations,
  onWalletUpdated,
  onRequireSignIn,
}: WalletModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const [discovered, setDiscovered] = useState<DiscoveredWallet[]>([]);
  const [uiState, setUiState] = useState<WalletUiState>(
    wallets.length > 0 ? "Connected" : "Not Connected"
  );
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showOthers, setShowOthers] = useState(false);
  const [pendingSign, setPendingSign] = useState<{
    walletName: string;
    address: string;
    chainId: string;
    message: string;
    provider: Eip1193Provider;
  } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const requiredChainId = integrations?.onchainEscrow.chainId?.toLowerCase() || null;

  useEffect(() => {
    if (pendingSign) return;
    let active = true;
    Promise.resolve().then(() => {
      if (!active) return;
      if (wallets.length > 0) {
        const primaryChain = wallets[0].chainId.toLowerCase();
        if (requiredChainId && primaryChain !== requiredChainId) {
          setUiState("Unsupported Network");
        } else {
          setUiState("Connected");
        }
      } else if (uiState !== "Disconnected" && uiState !== "Connecting") {
        setUiState("Not Connected");
      }
    });
    return () => {
      active = false;
    };
  }, [wallets, pendingSign, requiredChainId, uiState]);

  useEffect(() => {
    if (!open) return;
    openerRef.current = document.activeElement as HTMLElement | null;
    const focusTimer = window.setTimeout(() => dialogRef.current?.focus(), 30);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const found = new Map<string, DiscoveredWallet>();

    const onAnnounce = (event: Event) => {
      const custom = event as CustomEvent<{
        info: { uuid: string; name: string; rdns?: string; icon?: string };
        provider: Eip1193Provider;
      }>;
      if (custom.detail?.provider && custom.detail?.info?.name) {
        // A real EIP-6963 announcement supersedes the legacy window.ethereum entry
        found.delete("injected-ethereum");
        found.set(custom.detail.info.uuid, {
          id: custom.detail.info.uuid,
          name: custom.detail.info.name,
          rdns: custom.detail.info.rdns,
          icon: custom.detail.info.icon,
          provider: custom.detail.provider,
        });
        setDiscovered(Array.from(found.values()));
      }
    };

    window.addEventListener("eip6963:announceProvider", onAnnounce);
    window.dispatchEvent(new Event("eip6963:requestProvider"));

    if (window.ethereum && typeof window.ethereum.request === "function" && found.size === 0) {
      const fallbackName = window.ethereum.isRabby
        ? "Rabby Wallet"
        : window.ethereum.isRainbow
          ? "Rainbow"
          : window.ethereum.isMetaMask
            ? "MetaMask"
            : "Browser Wallet";
      found.set("injected-ethereum", {
        id: "injected-ethereum",
        name: fallbackName,
        provider: window.ethereum,
      });
      Promise.resolve().then(() => setDiscovered(Array.from(found.values())));
    }

    const eth = window.ethereum;
    const handleChainChanged = async (chainHex: unknown) => {
      if (typeof chainHex === "string" && wallets.length > 0) {
        await fetch("/api/wallet", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "update_network", chainId: chainHex }),
        });
        await onWalletUpdated();
      }
    };
    const handleAccountsChanged = (accounts: unknown) => {
      if (Array.isArray(accounts) && accounts.length === 0) {
        setUiState("Disconnected");
      }
    };
    eth?.on?.("chainChanged", handleChainChanged);
    eth?.on?.("accountsChanged", handleAccountsChanged);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = prevOverflow;
      setPendingSign(null);
      window.removeEventListener("eip6963:announceProvider", onAnnounce);
      window.removeEventListener("keydown", onKeyDown);
      eth?.removeListener?.("chainChanged", handleChainChanged);
      eth?.removeListener?.("accountsChanged", handleAccountsChanged);
      openerRef.current?.focus();
    };
  }, [open, onClose, wallets.length, onWalletUpdated]);

  const handleRequestWallet = async (wallet: DiscoveredWallet) => {
    setError(null);
    setStatusMessage(null);
    if (!user) {
      setError("Sign in with Google first, then link your wallet to that account.");
      return;
    }

    setBusyId(wallet.id);
    setUiState("Connecting");
    try {
      const accounts = (await wallet.provider.request({
        method: "eth_requestAccounts",
      })) as string[];

      if (!Array.isArray(accounts) || !accounts[0]) {
        setUiState("Not Connected");
        setError("Your wallet didn't return an account.");
        return;
      }

      const address = accounts[0];
      const chainId = String(
        (await wallet.provider.request({ method: "eth_chainId" })) || "0x1"
      );

      const nonceRes = await fetch("/api/wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "nonce",
          address,
          walletName: wallet.name,
          chainId,
        }),
      });
      const nonceData = await nonceRes.json();
      if (!nonceRes.ok) {
        setUiState("Not Connected");
        setError(nonceData.error || "Couldn't prepare the verification message.");
        return;
      }

      setUiState("Verification Required");
      setPendingSign({
        walletName: wallet.name,
        address,
        chainId,
        message: nonceData.message,
        provider: wallet.provider,
      });
    } catch (err) {
      setUiState("Transaction Rejected");
      const msg =
        err instanceof Error && err.message.toLowerCase().includes("reject")
          ? "You declined the request in your wallet. Nothing was linked."
          : "The wallet connection didn't complete. Unlock your wallet and try again.";
      setError(msg);
    } finally {
      setBusyId(null);
    }
  };

  const handleConfirmOwnershipSignature = async () => {
    if (!pendingSign) return;
    setError(null);
    setBusyId("signing");
    try {
      const signature = (await pendingSign.provider.request({
        method: "personal_sign",
        params: [pendingSign.message, pendingSign.address],
      })) as string;

      const verifyRes = await fetch("/api/wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "verify",
          address: pendingSign.address,
          walletName: pendingSign.walletName,
          chainId: pendingSign.chainId,
          signature,
        }),
      });
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok) {
        setError(verifyData.error || "Signature verification failed.");
        return;
      }

      setPendingSign(null);
      setUiState(
        requiredChainId && pendingSign.chainId.toLowerCase() !== requiredChainId
          ? "Unsupported Network"
          : "Connected"
      );
      setStatusMessage(
        `${pendingSign.walletName} ${shortenAddress(pendingSign.address)} is linked to your account.`
      );
      await onWalletUpdated();
    } catch {
      setUiState("Transaction Rejected");
      setError("You declined the signature. Your address wasn't linked.");
    } finally {
      setBusyId(null);
    }
  };

  const handleDisconnect = async (walletId: string) => {
    setError(null);
    setBusyId(walletId);
    try {
      await fetch(`/api/wallet?id=${encodeURIComponent(walletId)}`, {
        method: "DELETE",
      });
      setUiState("Disconnected");
      setStatusMessage("Wallet disconnected.");
      await onWalletUpdated();
    } catch {
      setError("Couldn't disconnect the wallet. Try again.");
    } finally {
      setBusyId(null);
    }
  };

  const handleSwitchRequiredNetwork = async () => {
    if (!requiredChainId || !window.ethereum?.request) return;
    setError(null);
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: requiredChainId }],
      });
      await fetch("/api/wallet", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_network", chainId: requiredChainId }),
      });
      setUiState("Connected");
      await onWalletUpdated();
    } catch {
      setError("The network switch was declined or isn't supported by this wallet.");
    }
  };

  const copyAddress = async (w: WalletLink) => {
    try {
      await navigator.clipboard.writeText(w.address);
      setCopiedId(w.id);
      window.setTimeout(() => setCopiedId(null), 1500);
    } catch {
      // clipboard unavailable
    }
  };

  if (!open) return null;

  const matchedIds = new Set<string>();
  const knownRows = KNOWN_WALLETS.map((k) => {
    const hit = discovered.find(
      (d) => !matchedIds.has(d.id) && (d.rdns === k.rdns || k.match.test(d.name))
    );
    if (hit) matchedIds.add(hit.id);
    return { known: k, hit };
  });
  const otherWallets = discovered.filter((d) => !matchedIds.has(d.id));

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
          aria-labelledby="wiserd-wallet-modal-title"
          tabIndex={-1}
          className="max-h-[92dvh] overflow-y-auto rounded-t-[28px] bg-[#EEEEEC] p-1.5 text-[#171717] focus:outline-none sm:rounded-[28px]"
        >
          {/* Top layer: wallets */}
          <div className="rounded-[22px] bg-white px-5 pt-5 pb-5 shadow-[0_1px_2px_rgba(23,23,23,0.05),0_12px_28px_-16px_rgba(23,23,23,0.22)]">
            <div className="relative flex items-center justify-center">
              <h2 id="wiserd-wallet-modal-title" className="text-[17px] text-[#171717]">
                {pendingSign ? "Verify your wallet" : "Connect your wallet"}
              </h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="absolute -top-1 -right-1 flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-[#6B6B6B] transition hover:bg-[#F0F1F2] hover:text-[#171717]"
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </button>
            </div>

            {/* Linked wallets */}
            {wallets.length > 0 && !pendingSign && (
              <div className="mt-5 space-y-2">
                {wallets.map((w, idx) => (
                  <div key={w.id} className="rounded-2xl bg-[#F7F7F5] px-4 py-3">
                    <div className="flex items-center gap-3.5">
                      <WalletMark name={w.walletName} src={knownIconFor(w.walletName)} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-[#171717]">
                          {w.walletName}
                        </p>
                        <p className="font-mono-light truncate text-xs text-[#6B6B6B]">
                          {shortenAddress(w.address)} · {w.networkName}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => copyAddress(w)}
                        aria-label={copiedId === w.id ? "Address copied" : "Copy address"}
                        className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-[#6B6B6B] transition hover:bg-white hover:text-[#171717]"
                      >
                        {copiedId === w.id ? (
                          <Check aria-hidden="true" className="h-4 w-4 text-[#167A67]" />
                        ) : (
                          <Copy aria-hidden="true" className="h-4 w-4" />
                        )}
                      </button>
                      <button
                        type="button"
                        disabled={busyId === w.id}
                        onClick={() => handleDisconnect(w.id)}
                        className="h-9 shrink-0 cursor-pointer rounded-lg px-2.5 text-xs font-medium text-[#6B6B6B] transition hover:bg-white hover:text-[#C81E1E] disabled:opacity-60"
                      >
                        Disconnect
                      </button>
                    </div>

                    {uiState === "Unsupported Network" && requiredChainId && idx === 0 && (
                      <div className="mt-3 flex items-center justify-between gap-2 border-t border-[#E5E7EB] pt-3 text-xs">
                        <span className="text-[#B45309]">
                          Escrow runs on {integrations?.onchainEscrow.chainName || requiredChainId}.
                        </span>
                        <button
                          type="button"
                          onClick={handleSwitchRequiredNetwork}
                          className="h-8 shrink-0 cursor-pointer rounded-lg bg-[#171717] px-3 text-xs font-medium text-white"
                        >
                          Switch network
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                <p className="type-meta pt-3">Add another wallet</p>
              </div>
            )}

            {/* Ownership signature review */}
            {pendingSign ? (
              <div className="mt-4">
                <p className="text-center text-xs leading-relaxed text-[#6B6B6B]">
                  Sign this message in {pendingSign.walletName} to prove you own{" "}
                  <span className="font-mono-light text-[#171717]">
                    {shortenAddress(pendingSign.address)}
                  </span>{" "}
                  on {CHAIN_LABELS[pendingSign.chainId.toLowerCase()] || pendingSign.chainId}.
                  It costs no gas and approves no payment.
                </p>
                <pre className="mt-4 max-h-32 overflow-y-auto rounded-2xl bg-[#F7F7F5] p-3.5 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-[#171717]">
                  {pendingSign.message}
                </pre>
                <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
                  <button
                    type="button"
                    disabled={busyId === "signing"}
                    onClick={handleConfirmOwnershipSignature}
                    className="h-11 cursor-pointer rounded-xl bg-[#171717] px-4 text-sm font-medium text-white transition hover:bg-[#2A2A2A] disabled:opacity-60"
                  >
                    {busyId === "signing" ? "Waiting for signature..." : "Sign message"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPendingSign(null);
                      setUiState(wallets.length > 0 ? "Connected" : "Not Connected");
                    }}
                    className="h-11 cursor-pointer rounded-xl border border-[#E5E7EB] px-4 text-sm font-medium text-[#6B6B6B] transition hover:text-[#171717]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <ul className={`${wallets.length > 0 ? "mt-2" : "mt-5"} space-y-2`}>
                {knownRows.map(({ known, hit }) => (
                  <li key={known.key}>
                    {hit ? (
                      <button
                        type="button"
                        disabled={busyId !== null}
                        onClick={() => handleRequestWallet(hit)}
                        className={`${ROW} cursor-pointer`}
                      >
                        <WalletMark name={known.name} src={hit.icon || known.icon} />
                        <span className="flex-1 text-[15px] font-medium text-[#171717]">
                          {known.name}
                        </span>
                        <span className="text-xs text-[#167A67]">
                          {busyId === hit.id ? "Connecting..." : "Detected"}
                        </span>
                      </button>
                    ) : (
                      <a
                        href={known.installUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={ROW}
                      >
                        <WalletMark name={known.name} src={known.icon} />
                        <span className="flex-1 text-[15px] font-medium text-[#171717]">
                          {known.name}
                        </span>
                        <span className="inline-flex items-center gap-1 text-xs text-[#6B6B6B]">
                          Install
                          <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" />
                        </span>
                      </a>
                    )}
                  </li>
                ))}

                <li>
                  <button
                    type="button"
                    aria-expanded={showOthers}
                    onClick={() => setShowOthers((v) => !v)}
                    className={`${ROW} cursor-pointer`}
                  >
                    <span
                      aria-hidden="true"
                      className="flex h-8 w-8 shrink-0 items-center justify-center text-[#9CA3AF]"
                    >
                      <Ellipsis className="h-6 w-6" />
                    </span>
                    <span className="flex-1 text-[15px] font-medium text-[#171717]">
                      Other wallets
                    </span>
                    {otherWallets.length > 0 && (
                      <span className="font-mono-light text-xs text-[#6B6B6B]">
                        {otherWallets.length}
                      </span>
                    )}
                    <ChevronDown
                      aria-hidden="true"
                      className={`h-4 w-4 text-[#6B6B6B] transition ${showOthers ? "rotate-180" : ""}`}
                    />
                  </button>
                </li>

                {showOthers && (
                  <>
                    {otherWallets.map((w) => (
                      <li key={w.id}>
                        <button
                          type="button"
                          disabled={busyId !== null}
                          onClick={() => handleRequestWallet(w)}
                          className={`${ROW} cursor-pointer`}
                        >
                          <WalletMark name={w.name} src={w.icon} />
                          <span className="flex-1 truncate text-[15px] font-medium text-[#171717]">
                            {w.name}
                          </span>
                          <span className="text-xs text-[#167A67]">
                            {busyId === w.id ? "Connecting..." : "Detected"}
                          </span>
                        </button>
                      </li>
                    ))}
                    <li>
                      <div className={`${ROW} cursor-default hover:border-[#E5E7EB] hover:bg-white`}>
                        <WalletMark name="WalletConnect" src="/brand/walletconnect.svg" />
                        <span className="flex-1">
                          <span className="block text-[15px] font-medium text-[#171717]">
                            WalletConnect
                          </span>
                          <span className="block text-xs text-[#6B6B6B]">
                            QR pairing for mobile wallets isn&apos;t set up yet
                          </span>
                        </span>
                      </div>
                    </li>
                  </>
                )}
              </ul>
            )}

            {statusMessage && (
              <p
                role="status"
                className="mt-4 flex items-center justify-center gap-1.5 text-center text-xs font-medium text-[#167A67]"
              >
                <Check aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                {statusMessage}
              </p>
            )}
            {error && (
              <p role="alert" className="mt-4 text-center text-xs font-medium text-[#C81E1E]">
                {error}
              </p>
            )}
          </div>

          {/* Bottom layer: Google account */}
          <div className="px-5 pt-4 pb-4">
            {user ? (
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="min-w-0 truncate text-[#6B6B6B]">
                  Signed in as{" "}
                  <span className="font-medium text-[#171717]">{user.displayName}</span>
                </span>
                <Link
                  href="/wallet"
                  onClick={onClose}
                  className="shrink-0 font-medium text-[#171717] underline-offset-2 hover:underline"
                >
                  Manage wallets
                </Link>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 text-xs text-[#6B6B6B]">
                  <span className="h-px flex-1 bg-[#DADAD7]" />
                  <span>No wallet? Sign in with Gmail</span>
                  <span className="h-px flex-1 bg-[#DADAD7]" />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onRequireSignIn();
                  }}
                  className="mt-3 flex h-12 w-full cursor-pointer items-center justify-center gap-2.5 rounded-2xl border border-[#E5E7EB] bg-white text-[15px] font-medium text-[#171717] transition hover:border-[#171717]/20"
                >
                  <Image
                    src="/brand/google-icon.svg"
                    alt=""
                    aria-hidden="true"
                    width={18}
                    height={18}
                    unoptimized
                    className="h-[18px] w-[18px]"
                  />
                  Continue with Google
                </button>
              </>
            )}

            <p className="mt-4 text-center text-xs leading-relaxed text-[#6B6B6B]">
              Connecting proves you own an address. WISERD never asks for your{" "}
              <span className="font-medium text-[#171717]">seed phrase</span> or{" "}
              <span className="font-medium text-[#171717]">private keys</span>.
            </p>
          </div>
        </div>
      </CenterRevealPanel>
    </div>
  );
}
