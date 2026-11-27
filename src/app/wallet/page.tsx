"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Copy,
  Check,
  Unlink,
  Plus,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
} from "lucide-react";
import { useWiserd } from "@/components/providers/wiserd-provider";
import {
  TransactionApprovalModal,
  type TransactionReviewPayload,
} from "@/components/wallet/transaction-approval-modal";

function shortenAddress(addr: string): string {
  return addr.length < 12 ? addr : `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

/**
 * Connect Wallet 2.0 — Layer 2 (Wallet Management) & Layer 3 (Transaction Approval Center)
 * Inspired by Apple Wallet clarity & Linear precision inside WISERD's warm-white palette.
 */
export default function WalletManagementPage() {
  const {
    user,
    wallets,
    integrations,
    openWalletModal,
    openGoogleAuthModal,
    refreshSession,
  } = useWiserd();

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [previewReviewOpen, setPreviewReviewOpen] = useState(false);

  const activeWallet = wallets[0] || null;
  const requiredChainId = integrations?.onchainEscrow.chainId?.toLowerCase() || null;
  const networkSupported =
    !activeWallet ||
    !requiredChainId ||
    activeWallet.chainId.toLowerCase() === requiredChainId;

  const copyAddress = async (id: string, addr: string) => {
    try {
      await navigator.clipboard.writeText(addr);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId(null), 1500);
    } catch {
      // ignore
    }
  };

  const setActiveWallet = async (walletId: string) => {
    setBusyId(walletId);
    setNotice(null);
    try {
      const res = await fetch("/api/wallet", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_active", walletId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setNotice(data.error || "Could not switch active wallet.");
      } else {
        await refreshSession();
        setNotice("Active wallet switched.");
      }
    } catch {
      setNotice("Connection lost while switching wallet.");
    } finally {
      setBusyId(null);
    }
  };

  const removeWallet = async (walletId?: string) => {
    setBusyId(walletId || "all");
    setNotice(null);
    const url = walletId ? `/api/wallet?id=${encodeURIComponent(walletId)}` : "/api/wallet";
    try {
      const res = await fetch(url, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setNotice(data.error || "Could not disconnect wallet.");
      } else {
        await refreshSession();
        setNotice(
          walletId
            ? "Wallet disconnected and unlinked."
            : "All connected wallets have been disconnected."
        );
      }
    } catch {
      setNotice("Connection lost while disconnecting wallet.");
    } finally {
      setBusyId(null);
    }
  };

  const requestNetworkSwitch = async () => {
    if (!requiredChainId || typeof window === "undefined" || !window.ethereum?.request) {
      setNotice("Open your browser wallet extension to switch networks.");
      return;
    }
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
      await refreshSession();
      setNotice("Network updated.");
    } catch {
      setNotice("Network switch was rejected or is unsupported by your wallet.");
    }
  };

  const demoPreviewPayload: TransactionReviewPayload = {
    actionType: "Escrow Deposit Review (Preview)",
    assetLabel: integrations?.onchainEscrow.tokenSymbol || "Unconfigured Token",
    amountDisplay: "$0.00",
    recipientLabel: "WISERD Seller Escrow Vault",
    contractAddress: integrations?.onchainEscrow.contractAddress || null,
    networkName:
      activeWallet?.networkName ||
      integrations?.onchainEscrow.chainName ||
      "No active network",
    chainId: activeWallet?.chainId || integrations?.onchainEscrow.chainId || "Not configured",
    estimatedFee: null,
    escrowConditions:
      "Demonstrates WISERD's explicit transaction review center. Live fund transfers remain disabled until an audited escrow contract and network are configured.",
    walletLabel: activeWallet?.walletName || "No wallet connected",
    walletAddress: activeWallet?.address || "0x0000000000000000000000000000000000000000",
    isLiveContractConfigured: Boolean(integrations?.onchainEscrow.configured),
  };

  return (
    <div className="mx-auto max-w-[1280px] space-y-8 px-4 pt-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#E5E7EB] pb-5">
        <div>
          <span className="type-meta">
            WISERD Wallet
          </span>
          <h1 className="mt-1 text-3xl text-[#171717]">
            Your wallet, <span className="font-base-italic">your control.</span>
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm text-[#6B6B6B]">
            Manage your connected addresses, ownership verification, network
            status, and transaction approvals separately from Google sign-in.
          </p>
        </div>

        <button
          type="button"
          onClick={openWalletModal}
          className={`inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg px-4 text-xs font-medium transition ${
            activeWallet
              ? "bg-[#315FC8] text-white hover:bg-[#274EA6]"
              : "border border-[#E5E7EB] bg-white text-[#171717] hover:border-[#171717]/30"
          }`}
        >
          <Plus aria-hidden="true" className="h-4 w-4" />
          Connect Wallet
        </button>
      </div>

      {notice && (
        <div
          role="status"
          className="rounded-xl border border-[#315FC8]/25 bg-white px-4 py-3 text-xs font-medium text-[#315FC8]"
        >
          {notice}
        </div>
      )}

      {/* Active Wallet Pass — Quiet Flat Structure */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <section className="lg:col-span-7">
          <div className="rounded-xl border border-[#E5E7EB] bg-white p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="type-meta">Active wallet</p>
                <h2 className="mt-1 text-lg text-[#171717]">
                  {activeWallet ? activeWallet.walletName : "Not Connected"}
                </h2>
              </div>
              <span
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium ${
                  activeWallet
                    ? networkSupported
                      ? "bg-[#167A67]/12 text-[#167A67]"
                      : "bg-[#B45309]/12 text-[#B45309]"
                    : "bg-[#F0F1F2] text-[#6B6B6B]"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`h-1.5 w-1.5 rounded-full ${
                    activeWallet
                      ? networkSupported
                        ? "bg-[#167A67]"
                        : "bg-[#B45309]"
                      : "bg-[#6B6B6B]"
                  }`}
                />
                {activeWallet
                  ? networkSupported
                    ? "Connected & Verified"
                    : "Unsupported Network"
                  : "Not Connected"}
              </span>
            </div>

            {activeWallet ? (
              <div className="mt-6 space-y-4">
                <div className="rounded-lg bg-[#F7F7F5] p-4">
                  <p className="type-meta">Public address</p>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <span className="font-mono-light break-all text-base text-[#315FC8]">
                      {activeWallet.address}
                    </span>
                    <button
                      type="button"
                      onClick={() => copyAddress(activeWallet.id, activeWallet.address)}
                      className="inline-flex h-8 shrink-0 cursor-pointer items-center gap-1 rounded-lg border border-[#E5E7EB] bg-white px-2.5 text-xs font-medium text-[#171717]"
                    >
                      {copiedId === activeWallet.id ? (
                        <>
                          <Check aria-hidden="true" className="h-3.5 w-3.5 text-[#167A67]" /> Copied
                        </>
                      ) : (
                        <>
                          <Copy aria-hidden="true" className="h-3.5 w-3.5" /> Copy
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-lg bg-[#F7F7F5] p-4">
                    <p className="type-meta">Active network</p>
                    <p className="mt-1 text-sm font-medium text-[#171717]">
                      {activeWallet.networkName}
                    </p>
                    <p className="font-mono-light text-xs text-[#6B6B6B]">
                      Chain ID: {activeWallet.chainId}
                    </p>
                  </div>
                  <div className="rounded-lg bg-[#F7F7F5] p-4">
                    <p className="type-meta">Balance feed</p>
                    <p className="mt-1 text-sm font-medium text-[#171717]">
                      Not connected
                    </p>
                    <p className="text-xs text-[#6B6B6B]">
                      Displays once a verified RPC provider is configured.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={openWalletModal}
                    className="h-10 cursor-pointer rounded-lg bg-[#315FC8] px-4 text-xs font-medium text-white hover:bg-[#274EA6]"
                  >
                    Link Another Wallet
                  </button>
                  <button
                    type="button"
                    disabled={busyId === activeWallet.id}
                    onClick={() => removeWallet(activeWallet.id)}
                    className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-4 text-xs font-medium text-[#6B6B6B] hover:border-[#C81E1E]/40 hover:text-[#C81E1E]"
                  >
                    <Unlink aria-hidden="true" className="h-3.5 w-3.5" />
                    Disconnect Active Wallet
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-5 border-t border-[#E5E7EB] pt-5">
                <p className="text-sm font-medium text-[#171717]">
                  No wallet connected yet
                </p>
                <p className="mt-1.5 text-xs text-[#6B6B6B]">
                  Connect a compatible EIP-1193 browser wallet to verify address
                  ownership or review supported wallet-based escrow actions. You
                  can browse and shop WISERD freely without connecting a wallet.
                </p>
                <div className="mt-4 flex flex-wrap gap-2.5">
                  <button
                    type="button"
                    onClick={openWalletModal}
                    className="h-10 cursor-pointer rounded-lg bg-[#315FC8] px-4 text-xs font-medium text-white hover:bg-[#274EA6]"
                  >
                    Connect Your Wallet
                  </button>
                  {!user && (
                    <button
                      type="button"
                      onClick={openGoogleAuthModal}
                      className="h-10 cursor-pointer rounded-lg border border-[#E5E7EB] bg-white px-4 text-xs font-medium text-[#171717] hover:border-[#171717]/30"
                    >
                      Sign In with Google First
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Right: Network Management & Security Posture */}
        <div className="space-y-5 lg:col-span-5">
          <section className="rounded-xl border border-[#E5E7EB] bg-white p-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base text-[#171717]">Network Management</h2>
              <span
                className={`shrink-0 whitespace-nowrap rounded-md px-2.5 py-0.5 text-xs font-medium ${
                  integrations?.onchainEscrow.configured
                    ? "bg-[#167A67]/12 text-[#167A67]"
                    : "bg-[#F0F1F2] text-[#6B6B6B]"
                }`}
              >
                {integrations?.onchainEscrow.configured
                  ? integrations.onchainEscrow.chainName
                  : "Network Unconfigured"}
              </span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-[#6B6B6B]">
              {integrations?.onchainEscrow.note ||
                "Target blockchain network, supported token, and escrow smart contract have not been configured yet."}
            </p>
            {!networkSupported && (
              <button
                type="button"
                onClick={requestNetworkSwitch}
                className="mt-3 inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-[#B45309] px-3.5 text-xs font-medium text-white"
              >
                <RefreshCw aria-hidden="true" className="h-3.5 w-3.5" />
                Switch to Supported Network
              </button>
            )}
          </section>

          <section className="rounded-xl border border-[#E5E7EB] bg-white p-5">
            <h2 className="text-base text-[#171717]">Wallet Security Boundaries</h2>
            <ul className="mt-3 space-y-2 text-xs text-[#6B6B6B]">
              <li className="flex items-start gap-2">
                <Check aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#167A67]" />
                <span>
                  <span className="font-medium text-[#171717]">Separate from Google sign-in:</span>{" "}
                  Google identifies your WISERD account; wallets prove address
                  ownership only.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Check aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#167A67]" />
                <span>
                  <span className="font-medium text-[#171717]">Zero hidden signing:</span>{" "}
                  Connecting a wallet never authorizes a payment or contract
                  interaction automatically.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Check aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#167A67]" />
                <span>
                  <span className="font-medium text-[#171717]">No private keys:</span>{" "}
                  WISERD never requests seed phrases or private keys.
                </span>
              </li>
            </ul>
          </section>
        </div>
      </div>

      {/* Linked Wallets List */}
      <section className="rounded-xl border border-[#E5E7EB] bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg text-[#171717]">
              Linked Wallets{" "}
              <span className="font-mono-light text-sm text-[#6B6B6B]">
                {wallets.length}
              </span>
            </h2>
            <p className="mt-0.5 text-xs text-[#6B6B6B]">
              Switch your active address or revoke any linked wallet from your
              account.
            </p>
          </div>
          {wallets.length > 0 && (
            <button
              type="button"
              disabled={busyId === "all"}
              onClick={() => removeWallet()}
              className="cursor-pointer text-xs font-medium text-[#C81E1E] hover:underline"
            >
              Disconnect All
            </button>
          )}
        </div>

        {wallets.length === 0 ? (
          <p className="mt-4 text-xs text-[#6B6B6B]">
            No linked addresses recorded for this account.
          </p>
        ) : (
          <div className="mt-4 space-y-2.5">
            {wallets.map((w, idx) => (
              <div
                key={w.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-[#F7F7F5] px-4 py-3 text-xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-[#171717]">{w.walletName}</span>
                    <span className="font-mono-light text-xs text-[#315FC8]">
                      {shortenAddress(w.address)}
                    </span>
                    {idx === 0 && (
                      <span className="rounded-md bg-[#315FC8]/10 px-2 py-0.5 text-xs font-medium text-[#315FC8]">
                        Active
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[#6B6B6B]">
                    {w.networkName} · ownership{" "}
                    {w.ownershipVerified ? "verified" : "pending"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {idx > 0 && (
                    <button
                      type="button"
                      disabled={busyId === w.id}
                      onClick={() => setActiveWallet(w.id)}
                      className="h-9 cursor-pointer rounded-lg border border-[#E5E7EB] bg-white px-3 font-medium text-[#171717] hover:border-[#315FC8]/40"
                    >
                      Set Active
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={busyId === w.id}
                    onClick={() => removeWallet(w.id)}
                    className="h-9 cursor-pointer rounded-lg border border-[#E5E7EB] bg-white px-3 font-medium text-[#6B6B6B] hover:text-[#C81E1E]"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Transaction Approval Center */}
      <section className="rounded-xl border border-[#E5E7EB] bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="type-meta text-[#7853D8]">Explicit approval</p>
            <h2 className="type-section mt-1 text-[#171717]">
              Transaction Approval Center
            </h2>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-[#6B6B6B]">
              Every financial operation opens a dedicated Transaction Approval
              sheet showing action type, asset, amount, recipient, contract
              address, network, fee estimate, and escrow release terms before
              requesting explicit approval.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setPreviewReviewOpen(true)}
              className="h-10 cursor-pointer rounded-lg border border-[#7853D8]/35 bg-[#7853D8]/8 px-4 text-xs font-medium text-[#7853D8] transition hover:bg-[#7853D8] hover:text-white"
            >
              Inspect Approval Sheet
            </button>
            <Link
              href="/orders"
              className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-[#315FC8] px-4 text-xs font-medium text-white hover:bg-[#274EA6]"
            >
              View Order History <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-[#B45309]/25 bg-[#B45309]/8 p-3.5 text-xs text-[#171717]">
          <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-[#B45309]" />
          <span>
            Live onchain settlement activates only after your blockchain
            network, token, backend verification, and audited escrow smart
            contract are configured.
          </span>
        </div>
      </section>

      <TransactionApprovalModal
        open={previewReviewOpen}
        payload={demoPreviewPayload}
        onClose={() => setPreviewReviewOpen(false)}
        onApprove={async () => {
          setNotice(
            "Preview approval recorded. No onchain transaction was broadcast because live contract integration is not configured."
          );
          return { ok: true };
        }}
      />
    </div>
  );
}
