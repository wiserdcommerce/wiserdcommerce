"use client";

import React from "react";
import { Check, AlertTriangle, Clock, ShieldCheck, XCircle } from "lucide-react";
import type { EscrowEvent, EscrowStatus } from "@/lib/types";

const STANDARD_STEPS: Array<{ key: string; label: string; caption: string }> = [
  { key: "created", label: "Order Created", caption: "Recorded & totals verified" },
  { key: "payment", label: "Payment Confirmed", caption: "Verified settlement trigger" },
  { key: "escrow", label: "Escrow Active", caption: "Seller fulfillment begins" },
  { key: "delivered", label: "Delivered", caption: "Tracking or digital handoff" },
  { key: "released", label: "Released", caption: "Buyer confirmed / settled" },
];

function getCompletedIndex(status: EscrowStatus): number {
  switch (status) {
    case "Pending Payment":
    case "Payment Processing":
    case "Payment Failed":
    case "Cancelled":
      return 0;
    case "Payment Confirmed":
      return 1;
    case "Escrow Active":
    case "Seller Processing":
      return 2;
    case "Shipped or Delivered":
    case "Awaiting Buyer Confirmation":
    case "Disputed":
      return 3;
    case "Release Processing":
    case "Released":
    case "Payout Processing":
    case "Paid Out":
    case "Refund Processing":
    case "Refund Completed":
      return 4;
    default:
      return 0;
  }
}

export function EscrowStatusBadge({ status }: { status: EscrowStatus }) {
  const tone =
    status === "Released" || status === "Paid Out" || status === "Payment Confirmed"
      ? "bg-[#167A67]/12 text-[#167A67] border-[#167A67]/25"
      : status === "Disputed" || status === "Payment Failed"
        ? "bg-[#C81E1E]/10 text-[#C81E1E] border-[#C81E1E]/25"
        : status === "Cancelled" || status === "Refund Completed"
          ? "bg-[#F0F1F2] text-[#6B6B6B] border-[#E5E7EB]"
          : "bg-[#315FC8]/10 text-[#315FC8] border-[#315FC8]/25";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium ${tone}`}
    >
      {status === "Disputed" ? (
        <AlertTriangle className="h-3.5 w-3.5" />
      ) : status === "Cancelled" ? (
        <XCircle className="h-3.5 w-3.5" />
      ) : status === "Released" || status === "Paid Out" ? (
        <ShieldCheck className="h-3.5 w-3.5" />
      ) : (
        <Clock className="h-3.5 w-3.5" />
      )}
      {status}
    </span>
  );
}

/**
 * Sequential Escrow Step Timeline (Masterplan Sections 17 & 33).
 * Explicitly uses a structured step timeline rather than a numeric Meter.
 */
export function EscrowTimeline({
  status,
  events,
  escrowMode,
}: {
  status: EscrowStatus;
  events: EscrowEvent[];
  escrowMode: "unconfigured_preview" | "fiat_provider" | "onchain_contract";
}) {
  const activeIdx = getCompletedIndex(status);

  return (
    <div className="space-y-5">
      {escrowMode === "unconfigured_preview" && (
        <div className="rounded-xl border border-[#B45309]/25 bg-[#B45309]/[0.06] p-4 text-xs text-[#171717]">
          <p className="font-medium text-[#B45309]">
            Escrow Workflow Preview (External settlement provider not configured)
          </p>
          <p className="mt-1 text-[#6B6B6B]">
            No live payment processor or onchain escrow smart contract is
            connected yet. You can test every escrow, fulfillment, and dispute
            state without moving live customer funds.
          </p>
        </div>
      )}

      {/* Horizontal / Stacked Stepper */}
      <ol
        aria-label="Escrow lifecycle steps"
        className="grid grid-cols-1 gap-3 sm:grid-cols-5"
      >
        {STANDARD_STEPS.map((step, idx) => {
          const isComplete = idx < activeIdx || (idx === 4 && (status === "Released" || status === "Paid Out"));
          const isCurrent = idx === activeIdx && !isComplete;
          return (
            <li
              key={step.key}
              className={`rounded-xl border p-3.5 transition ${
                isComplete
                  ? "border-[#167A67]/35 bg-[#167A67]/6"
                  : isCurrent
                    ? "border-[#315FC8]/45 bg-[#315FC8]/6"
                    : "border-[#E5E7EB] bg-[#F7F7F5]"
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`font-mono-light flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[11px] ${
                    isComplete
                      ? "bg-[#167A67] text-white"
                      : isCurrent
                        ? "bg-[#315FC8] text-white"
                        : "border border-[#E5E7EB] bg-white text-[#6B6B6B]"
                  }`}
                >
                  {isComplete ? <Check className="h-3 w-3" /> : idx + 1}
                </span>
                <span className="text-xs font-medium text-[#171717]">
                  {step.label}
                </span>
              </div>
              <p className="mt-1.5 text-[11px] text-[#6B6B6B]">{step.caption}</p>
            </li>
          );
        })}
      </ol>

      {/* Auditable Event History */}
      <div>
        <h3 className="type-meta">
          Auditable transaction history
        </h3>
        <ul className="mt-3 space-y-2.5">
          {events.map((evt) => (
            <li
              key={evt.id}
              className="flex flex-col justify-between gap-1 rounded-xl border border-[#E5E7EB] bg-[#F7F7F5] px-4 py-3 text-xs sm:flex-row sm:items-center"
            >
              <div>
                <span className="font-medium text-[#171717]">{evt.status}</span>
                <span className="ml-2 text-[#315FC8]">{evt.actor}</span>
                <p className="mt-0.5 text-[#6B6B6B]">{evt.note}</p>
              </div>
              <time className="type-meta shrink-0">
                {new Date(evt.timestamp).toLocaleString()}
              </time>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
