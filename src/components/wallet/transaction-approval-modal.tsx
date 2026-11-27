"use client";

import React, { useEffect, useState } from "react";
import {
  X,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
} from "lucide-react";
import { CenterRevealPanel } from "@/components/motion/motion-primitives";

export interface TransactionReviewPayload {
  actionType: string;
  assetLabel: string;
  amountDisplay: string;
  recipientLabel: string;
  contractAddress: string | null;
  networkName: string;
  chainId: string;
  estimatedFee: string | null;
  escrowConditions: string;
  walletLabel: string;
  walletAddress: string;
  isLiveContractConfigured: boolean;
}

type ApprovalState =
  | "Awaiting User Approval"
  | "Transaction Pending"
  | "Transaction Confirmed"
  | "Transaction Rejected"
  | "Transaction Failed";

/**
 * Connect Wallet 2.0 — Layer 3: Transaction Approval Center Modal.
 * Ensures wallet connection and financial authorization are ALWAYS separate explicit steps.
 * Never signs automatically, never hides contract or fee details, and never fakes live onchain confirmation.
 */
export function TransactionApprovalModal({
  open,
  payload,
  onClose,
  onApprove,
}: {
  open: boolean;
  payload: TransactionReviewPayload | null;
  onClose: () => void;
  onApprove: () => Promise<{ ok: boolean; error?: string }>;
}) {
  const [state, setState] = useState<ApprovalState>("Awaiting User Approval");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let active = true;
    Promise.resolve().then(() => {
      if (!active) return;
      setState("Awaiting User Approval");
      setErrorMsg(null);
    });
    return () => {
      active = false;
    };
  }, [open, payload]);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && state !== "Transaction Pending") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, state]);

  if (!open || !payload) return null;

  const handleReject = () => {
    setState("Transaction Rejected");
    setErrorMsg("You rejected this transaction review. No order or wallet operation was submitted.");
  };

  const handleConfirm = async () => {
    setState("Transaction Pending");
    setErrorMsg(null);
    try {
      const res = await onApprove();
      if (!res.ok) {
        setState("Transaction Failed");
        setErrorMsg(res.error || "Transaction could not be completed.");
      } else {
        setState("Transaction Confirmed");
      }
    } catch {
      setState("Transaction Failed");
      setErrorMsg("Unexpected error while submitting transaction review.");
    }
  };

  const stateTone =
    state === "Transaction Confirmed"
      ? "bg-[#167A67]/12 text-[#167A67]"
      : state === "Transaction Rejected" || state === "Transaction Failed"
        ? "bg-[#C81E1E]/10 text-[#C81E1E]"
        : "bg-[#315FC8]/10 text-[#315FC8]";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[#171717]/25 p-0 backdrop-blur-[3px] sm:items-center sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && state !== "Transaction Pending") onClose();
      }}
    >
      <CenterRevealPanel className="w-full max-w-[460px]">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="tx-approval-title"
          className="max-h-[92dvh] overflow-y-auto rounded-t-[28px] bg-[#EEEEEC] p-1.5 text-[#171717] sm:rounded-[28px]"
        >
          <div className="rounded-[22px] bg-white p-5 shadow-[0_1px_2px_rgba(23,23,23,0.05),0_12px_28px_-16px_rgba(23,23,23,0.22)] sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="type-meta text-[#7853D8]">
                    Transaction approval
                  </span>
                  <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${stateTone}`}>
                    {state}
                  </span>
                </div>
                <h2
                  id="tx-approval-title"
                  className="mt-1 text-lg text-[#171717]"
                >
                  Review &amp; Authorize Action
                </h2>
              </div>
              <button
                type="button"
                disabled={state === "Transaction Pending"}
                onClick={onClose}
                aria-label="Close transaction review"
                className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-[#6B6B6B] transition hover:bg-[#F0F1F2] hover:text-[#171717] disabled:opacity-50"
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </button>
            </div>

            {/* Primary Amount & Action Summary */}
            <div className="mt-4 rounded-2xl bg-[#F7F7F5] p-4">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-xs font-medium text-[#6B6B6B]">
                  {payload.actionType}
                </span>
                <span className="type-price shrink-0 whitespace-nowrap text-2xl">
                  {payload.amountDisplay}
                </span>
              </div>
              <p className="mt-1 text-xs text-[#6B6B6B]">
                Asset: <span className="font-medium text-[#171717]">{payload.assetLabel}</span>
              </p>
            </div>

            {/* Structured Technical Details */}
            <dl className="mt-4 divide-y divide-[#F0F1F2] rounded-2xl border border-[#E5E7EB] bg-white px-4 text-xs">
              <div className="flex items-center justify-between gap-4 py-2.5">
                <dt className="text-[#6B6B6B]">Signing wallet</dt>
                <dd className="font-medium text-[#171717]">
                  {payload.walletLabel} ({payload.walletAddress.slice(0, 6)}...
                  {payload.walletAddress.slice(-4)})
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4 py-2.5">
                <dt className="text-[#6B6B6B]">Recipient / Store</dt>
                <dd className="font-medium text-[#171717]">{payload.recipientLabel}</dd>
              </div>
              <div className="flex items-center justify-between gap-4 py-2.5">
                <dt className="text-[#6B6B6B]">Network</dt>
                <dd className="font-medium text-[#171717]">
                  {payload.networkName} ({payload.chainId})
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4 py-2.5">
                <dt className="text-[#6B6B6B]">Escrow contract</dt>
                <dd className="font-mono-light text-xs text-[#315FC8]">
                  {payload.contractAddress || "Not configured (Preview)"}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4 py-2.5">
                <dt className="text-[#6B6B6B]">Estimated network fee</dt>
                <dd className="text-[#6B6B6B]">
                  {payload.estimatedFee || "Requires configured RPC & contract"}
                </dd>
              </div>
            </dl>

            {/* Escrow Conditions */}
            <div className="mt-4 rounded-2xl bg-[#167A67]/[0.06] p-3.5 text-xs">
              <div className="flex items-center gap-1.5 font-medium text-[#167A67]">
                <ShieldCheck aria-hidden="true" className="h-4 w-4 shrink-0" />
                <span>Escrow release conditions</span>
              </div>
              <p className="mt-1 leading-relaxed text-[#171717]">
                {payload.escrowConditions}
              </p>
            </div>

            {!payload.isLiveContractConfigured && (
              <div className="mt-3 flex items-start gap-2 rounded-xl bg-[#B45309]/[0.08] p-3 text-xs text-[#171717]">
                <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-[#B45309]" />
                <span>
                  <span className="font-medium">Preview mode:</span> Live onchain escrow
                  contract is not configured. Approving creates a server-verified order
                  record without moving real tokens.
                </span>
              </div>
            )}

            {errorMsg && (
              <div
                role="alert"
                className="mt-3 flex items-start gap-2 rounded-xl bg-[#C81E1E]/[0.08] p-3 text-xs font-medium text-[#C81E1E]"
              >
                <XCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {state === "Transaction Confirmed" ? (
              <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-[#167A67]/10 px-4 py-3 text-xs font-medium text-[#167A67]">
                <span className="inline-flex items-center gap-2">
                  <CheckCircle2 aria-hidden="true" className="h-4 w-4 shrink-0" />
                  Approval recorded. Continuing to order tracking...
                </span>
                <button
                  type="button"
                  onClick={onClose}
                  className="cursor-pointer underline"
                >
                  Close
                </button>
              </div>
            ) : state === "Transaction Rejected" ? (
              <div className="mt-5 grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setState("Awaiting User Approval");
                    setErrorMsg(null);
                  }}
                  className="h-11 cursor-pointer rounded-xl border border-[#E5E7EB] bg-white px-4 text-xs font-medium text-[#171717] hover:border-[#171717]/25"
                >
                  Review Again
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="h-11 cursor-pointer rounded-xl bg-[#171717] px-4 text-xs font-medium text-white hover:bg-[#2A2A2A]"
                >
                  Close
                </button>
              </div>
            ) : (
              <div className="mt-5 grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  disabled={state === "Transaction Pending"}
                  onClick={handleReject}
                  className="h-11 cursor-pointer rounded-xl border border-[#E5E7EB] bg-white px-4 text-xs font-medium text-[#171717] transition hover:border-[#C81E1E]/40 hover:text-[#C81E1E] disabled:opacity-50"
                >
                  Reject
                </button>
                <button
                  type="button"
                  disabled={state === "Transaction Pending"}
                  onClick={handleConfirm}
                  className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#315FC8] px-4 text-xs font-medium text-white transition hover:bg-[#274EA6] disabled:opacity-60"
                >
                  {state === "Transaction Pending" ? (
                    <>
                      <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : payload.isLiveContractConfigured ? (
                    "Approve & Sign"
                  ) : (
                    "Approve Preview Order"
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </CenterRevealPanel>
    </div>
  );
}
