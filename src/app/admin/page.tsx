"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Shield, Check, ArrowRight } from "lucide-react";
import { useWiserd } from "@/components/providers/wiserd-provider";
import { EscrowStatusBadge } from "@/components/orders/escrow-timeline";
import { CardSkeleton, StatusBanner } from "@/components/ui/state-blocks";
import type {
  AuditLog,
  Dispute,
  IntegrationStatus,
  Order,
  Product,
  Report,
  Store,
  User,
} from "@/lib/types";

interface AdminSnapshot {
  users: User[];
  stores: Store[];
  products: Product[];
  orders: Order[];
  disputes: Dispute[];
  reports: Report[];
  auditLogs: AuditLog[];
  integrations: IntegrationStatus;
}

export default function AdminDashboardPage() {
  const { user, openGoogleAuthModal } = useWiserd();
  const [data, setData] = useState<AdminSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [resolutionNotes, setResolutionNotes] = useState<Record<string, string>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [confirmKey, setConfirmKey] = useState<string | null>(null);
  const [actionBanner, setActionBanner] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);

  const loadAdmin = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/admin", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Administrator access required.");
        setData(null);
      } else {
        setData(json);
      }
    } catch {
      setError("Could not reach the WISERD administration API.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (!active) return;
      if (!user) {
        setData(null);
        setError(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      loadAdmin();
    });
    return () => {
      active = false;
    };
  }, [loadAdmin, user]);

  const performAction = async (
    action: string,
    targetId: string,
    value?: string,
    note?: string,
    requireConfirm = false
  ) => {
    const key = `${action}:${targetId}:${value || ""}`;
    if (requireConfirm && confirmKey !== key) {
      setConfirmKey(key);
      return;
    }
    setConfirmKey(null);
    setBusyKey(key);
    setActionBanner(null);
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, targetId, value, note }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setActionBanner({
          tone: "error",
          message: json.error || "Administrative action failed.",
        });
      } else {
        setActionBanner({
          tone: "success",
          message: "Change saved and recorded in the audit log.",
        });
        await loadAdmin();
      }
    } catch {
      setActionBanner({
        tone: "error",
        message: "Connection lost while applying administrative change.",
      });
    } finally {
      setBusyKey(null);
    }
  };

  if (!user) {
    return (
      <div className="mx-auto max-w-[900px] px-4 pt-12 text-center">
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-10">
          <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl border border-[#E5E7EB] bg-[#F7F7F5] text-[#6B6B6B]">
            <Shield className="h-5 w-5" />
          </span>
          <h1 className="mt-3 text-2xl font-medium text-[#171717]">
            WISERD Administration Workspace
          </h1>
          <p className="mt-2 text-sm text-[#6B6B6B]">
            Sign in with an authorized administrator account to inspect
            verification queues, disputes, moderation reports, and audit logs.
          </p>
          <button
            type="button"
            onClick={openGoogleAuthModal}
            className="mt-5 h-10 cursor-pointer rounded-lg bg-[#315FC8] px-6 text-sm font-semibold text-white"
          >
            Sign In
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

  if (error || !data) {
    return (
      <div className="mx-auto max-w-[900px] px-4 pt-12 text-center">
        <div className="rounded-xl border border-[#C81E1E]/25 bg-white p-8 text-sm text-[#C81E1E]">
          {error || "Access denied."}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1320px] space-y-8 px-4 pt-8 sm:px-6 lg:px-8">
      <div className="border-b border-[#E5E7EB] pb-5">
        <p className="type-meta text-[#7853D8]">
          WISERD Operations &amp; Governance
        </p>
        <h1 className="mt-1 text-3xl font-medium tracking-tight text-[#171717]">
          Administration Dashboard
        </h1>
        <p className="mt-1 text-sm text-[#6B6B6B]">
          Every verification, moderation, and dispute decision is recorded in
          the audit log with administrator attribution and timestamps.
        </p>
      </div>

      {actionBanner && (
        <StatusBanner tone={actionBanner.tone} message={actionBanner.message} />
      )}

      {/* Platform KPI Row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {[
          { label: "Users", val: data.users.length },
          { label: "Stores", val: data.stores.length },
          { label: "Listings", val: data.products.length },
          { label: "Orders", val: data.orders.length },
          { label: "Open Disputes", val: data.disputes.filter((d) => d.status === "open" || d.status === "under_review").length },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-xl border border-[#E5E7EB] bg-white p-4"
          >
            <p className="type-meta">{kpi.label}</p>
            <p className="font-mono-light mt-1 text-3xl text-[#171717]">
              {kpi.val}
            </p>
          </div>
        ))}
      </div>

      {/* Integration & Runtime Readiness Strip */}
      <section className="rounded-xl border border-[#E5E7EB] bg-white px-5 py-4">
        <div className="grid grid-cols-2 gap-4 text-xs sm:grid-cols-4">
          {[
            {
              label: "Google OAuth",
              active: data.integrations.googleIdentityServices.configured,
              text: data.integrations.googleIdentityServices.configured
                ? "Active"
                : data.integrations.localSandboxEnabled
                  ? "Local Preview"
                  : "Not Configured",
            },
            {
              label: "Database",
              active: data.integrations.supabase.configured,
              text: data.integrations.supabase.configured ? "Supabase" : "Local JSON",
            },
            {
              label: "Fiat Escrow",
              active: data.integrations.fiatPaymentProvider.configured,
              text: data.integrations.fiatPaymentProvider.configured
                ? data.integrations.fiatPaymentProvider.providerName || "Active"
                : "Preview Mode",
            },
            {
              label: "Onchain Escrow",
              active: data.integrations.onchainEscrow.configured,
              text: data.integrations.onchainEscrow.configured
                ? data.integrations.onchainEscrow.chainName || "Active"
                : "Not Configured",
            },
          ].map((item) => (
            <div key={item.label} className="min-w-0">
              <p className="type-meta">{item.label}</p>
              <p className="mt-1 inline-flex items-center gap-1.5 font-medium text-[#171717]">
                <span
                  aria-hidden="true"
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                    item.active ? "bg-[#167A67]" : "bg-[#9CA3AF]"
                  }`}
                />
                <span className="truncate">{item.text}</span>
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Seller Verification Queue */}
      <section className="rounded-xl border border-[#E5E7EB] bg-white p-6">
        <h2 className="text-lg text-[#171717]">
          Seller Verification &amp; Store Management
        </h2>
        {data.stores.length === 0 ? (
          <p className="mt-3 text-xs text-[#6B6B6B]">
            No seller stores registered yet.
          </p>
        ) : (
        <div className="mt-4 space-y-3">
          {data.stores.map((s) => (
            <div
              key={s.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#F7F7F5] p-4"
            >
              <div>
                <Link
                  href={`/stores/${s.slug}`}
                  className="text-sm font-medium text-[#171717] hover:text-[#315FC8]"
                >
                  {s.name}
                </Link>
                <p className="text-xs text-[#6B6B6B]">
                  Verification:{" "}
                  <span className="font-medium capitalize text-[#171717]">
                    {s.verificationStatus.replace("_", " ")}
                  </span>{" "}
                  · Payouts:{" "}
                  <span className="capitalize">
                    {s.payoutDestination
                      ? `${s.payoutDestination.provider.replace("_", " ")} (${s.payoutStatus})`
                      : s.payoutStatus}
                  </span>
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={s.verificationStatus === "verified" || busyKey !== null}
                  onClick={() => performAction("verify_store", s.id, "verified")}
                  className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-medium disabled:opacity-60 ${
                    s.verificationStatus === "verified"
                      ? "cursor-default border border-[#167A67]/25 bg-[#167A67]/10 text-[#167A67]"
                      : "cursor-pointer bg-[#167A67] text-white"
                  }`}
                >
                  {s.verificationStatus === "verified" ? (
                    <>
                      <Check aria-hidden="true" className="h-3.5 w-3.5" />
                      Verified
                    </>
                  ) : (
                    "Approve Verified"
                  )}
                </button>
                <button
                  type="button"
                  disabled={busyKey !== null}
                  onClick={() => performAction("verify_store", s.id, "action_required")}
                  className="h-9 cursor-pointer rounded-lg border border-[#E5E7EB] bg-white px-3 text-xs font-medium text-[#B45309] disabled:opacity-60"
                >
                  Action Required
                </button>
              </div>
            </div>
          ))}
        </div>
        )}
      </section>

      {/* Disputes & Reports */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-[#E5E7EB] bg-white p-6">
          <h2 className="flex items-baseline gap-2 text-lg text-[#171717]">
            <span>Escrow Disputes</span>
            <span className="font-mono-light text-sm text-[#6B6B6B]">
              {data.disputes.length}
            </span>
          </h2>
          {data.disputes.length === 0 ? (
            <p className="mt-3 text-xs text-[#6B6B6B]">No active disputes.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {data.disputes.map((d) => (
                <div
                  key={d.id}
                  className="space-y-2 rounded-xl bg-[#F7F7F5] p-4 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <Link
                      href={`/orders/${d.orderId}`}
                      className="font-mono-light text-sm text-[#315FC8] hover:underline"
                    >
                      {d.orderReference}
                    </Link>
                    <span className="font-medium capitalize">{d.status.replace("_", " ")}</span>
                  </div>
                  <p className="font-medium text-[#171717]">{d.reason}</p>
                  <p className="text-[#6B6B6B]">{d.buyerStatement}</p>
                  {(d.status === "open" || d.status === "under_review") && (
                    <div className="space-y-2 pt-2">
                      <input
                        value={resolutionNotes[d.id] || ""}
                        onChange={(e) =>
                          setResolutionNotes((prev) => ({
                            ...prev,
                            [d.id]: e.target.value,
                          }))
                        }
                        placeholder="Resolution note for audit record..."
                        className="h-9 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 text-xs"
                      />
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={busyKey !== null}
                          onClick={() =>
                            performAction(
                              "resolve_dispute",
                              d.id,
                              "refund",
                              resolutionNotes[d.id],
                              true
                            )
                          }
                          className="h-9 cursor-pointer rounded-lg bg-[#C81E1E] px-3 text-xs font-medium text-white disabled:opacity-60"
                        >
                          {confirmKey === `resolve_dispute:${d.id}:refund`
                            ? "Confirm Refund Buyer?"
                            : "Resolve: Refund Buyer"}
                        </button>
                        <button
                          type="button"
                          disabled={busyKey !== null}
                          onClick={() =>
                            performAction(
                              "resolve_dispute",
                              d.id,
                              "release",
                              resolutionNotes[d.id],
                              true
                            )
                          }
                          className="h-9 cursor-pointer rounded-lg bg-[#167A67] px-3 text-xs font-medium text-white disabled:opacity-60"
                        >
                          {confirmKey === `resolve_dispute:${d.id}:release`
                            ? "Confirm Release Seller?"
                            : "Resolve: Release Seller"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-[#E5E7EB] bg-white p-6">
          <h2 className="flex items-baseline gap-2 text-lg text-[#171717]">
            <span>Moderation Reports</span>
            <span className="font-mono-light text-sm text-[#6B6B6B]">
              {data.reports.length}
            </span>
          </h2>
          {data.reports.length === 0 ? (
            <p className="mt-3 text-xs text-[#6B6B6B]">No open user or content reports.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {data.reports.map((r) => (
                <div
                  key={r.id}
                  className="rounded-xl bg-[#F7F7F5] p-4 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-[#171717]">
                      [{r.entityType}] {r.entityLabel}
                    </span>
                    <span className="capitalize text-[#315FC8]">{r.reviewStatus}</span>
                  </div>
                  <p className="mt-1 text-[#6B6B6B]">
                    Reported by {r.reporterName}: {r.reason}
                  </p>
                  {r.reviewStatus === "open" && (
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busyKey !== null}
                        onClick={() =>
                          performAction("update_report", r.id, "action_taken", undefined, true)
                        }
                        className="h-8 cursor-pointer rounded-lg bg-[#315FC8] px-3 text-xs font-medium text-white disabled:opacity-60"
                      >
                        {confirmKey === `update_report:${r.id}:action_taken`
                          ? "Confirm & Enforce?"
                          : "Enforce Action"}
                      </button>
                      <button
                        type="button"
                        disabled={busyKey !== null}
                        onClick={() => performAction("update_report", r.id, "dismissed")}
                        className="h-8 cursor-pointer rounded-lg border border-[#E5E7EB] bg-white px-3 text-xs font-medium text-[#6B6B6B] disabled:opacity-60"
                      >
                        Dismiss
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Orders Monitoring + Audit Logs */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-[#E5E7EB] bg-white p-6">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="flex items-baseline gap-2 text-lg text-[#171717]">
              <span>Orders &amp; Escrow Monitoring</span>
              <span className="font-mono-light text-sm text-[#6B6B6B]">
                {data.orders.length}
              </span>
            </h2>
            {data.orders.length > 20 && (
              <span className="font-mono-light text-[11px] text-[#6B6B6B]">
                Latest 20 of {data.orders.length}
              </span>
            )}
          </div>
          {data.orders.length === 0 ? (
            <p className="mt-3 text-xs text-[#6B6B6B]">No orders recorded yet.</p>
          ) : (
            <div className="mt-4 max-h-72 space-y-2.5 overflow-y-auto">
              {data.orders.slice(0, 20).map((o) => (
                <Link
                  key={o.id}
                  href={`/orders/${o.id}`}
                  className="flex items-center justify-between gap-3 rounded-xl bg-[#F7F7F5] px-4 py-3 text-xs transition hover:bg-[#F0F1F2]"
                >
                  <div className="min-w-0">
                    <span className="font-mono-light block text-sm text-[#315FC8]">
                      {o.referenceCode}
                    </span>
                    <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[#6B6B6B]">
                      <span>{o.buyerName}</span>
                      <ArrowRight aria-hidden="true" className="h-3 w-3 shrink-0" />
                      <span className="truncate">{o.storeName}</span>
                    </p>
                  </div>
                  <EscrowStatusBadge status={o.escrowStatus} />
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-[#E5E7EB] bg-white p-6">
          <h2 className="flex items-baseline gap-2 text-lg text-[#171717]">
            <span>Audit Logs</span>
            <span className="font-mono-light text-sm text-[#6B6B6B]">
              {data.auditLogs.length}
            </span>
          </h2>
          {data.auditLogs.length === 0 ? (
            <p className="mt-3 text-xs text-[#6B6B6B]">No audit events recorded yet.</p>
          ) : (
          <div className="mt-4 max-h-72 divide-y divide-[#F0F1F2] overflow-y-auto">
            {data.auditLogs.map((log) => (
              <div
                key={log.id}
                className="py-2.5 text-xs first:pt-0 last:pb-0"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-[#171717]">{log.action}</span>
                  <span className="type-meta">
                    {new Date(log.createdAt).toLocaleString()}
                  </span>
                </div>
                <p className="mt-0.5 text-[#6B6B6B]">
                  {log.actorName}: {log.details}
                </p>
              </div>
            ))}
          </div>
          )}
        </section>
      </div>

      {/* User Governance & Listing Moderation Controls */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-[#E5E7EB] bg-white p-6">
          <h2 className="flex items-baseline gap-2 text-lg text-[#171717]">
            <span>User Accounts</span>
            <span className="font-mono-light text-sm text-[#6B6B6B]">
              {data.users.length}
            </span>
          </h2>
          {data.users.length === 0 ? (
            <p className="mt-3 text-xs text-[#6B6B6B]">No accounts registered yet.</p>
          ) : (
          <div className="mt-4 max-h-72 space-y-2.5 overflow-y-auto">
            {data.users.map((u) => {
              const isSelf = u.id === user.id;
              const isSuspending = u.status === "active";
              const suspendKey = `toggle_user_status:${u.id}:`;
              return (
                <div
                  key={u.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#F7F7F5] px-4 py-3 text-xs"
                >
                  <div>
                    <p className="font-medium text-[#171717]">
                      {u.displayName} ({u.roles.join(", ")})
                    </p>
                    <p className="text-[#6B6B6B]">
                      {u.email} ·{" "}
                      <span
                        className={`font-medium ${
                          u.status === "suspended" ? "text-[#C81E1E]" : "text-[#167A67]"
                        }`}
                      >
                        {u.status}
                      </span>
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={isSelf || busyKey !== null}
                    onClick={() =>
                      performAction("toggle_user_status", u.id, undefined, undefined, isSuspending)
                    }
                    className={`h-9 rounded-lg px-3 text-xs font-medium disabled:opacity-60 ${
                      isSelf
                        ? "cursor-not-allowed border border-[#E5E7EB] bg-white text-[#6B6B6B]"
                        : isSuspending
                          ? confirmKey === suspendKey
                            ? "cursor-pointer bg-[#C81E1E] text-white"
                            : "cursor-pointer border border-[#C81E1E]/30 bg-white text-[#C81E1E] hover:bg-[#C81E1E] hover:text-white"
                          : "cursor-pointer bg-[#167A67] text-white"
                    }`}
                  >
                    {isSelf
                      ? "Current Admin"
                      : isSuspending
                        ? confirmKey === suspendKey
                          ? "Confirm Suspend?"
                          : "Suspend"
                        : "Reactivate"}
                  </button>
                </div>
              );
            })}
          </div>
          )}
        </section>

        <section className="rounded-xl border border-[#E5E7EB] bg-white p-6">
          <h2 className="flex items-baseline gap-2 text-lg text-[#171717]">
            <span>Listing Moderation</span>
            <span className="font-mono-light text-sm text-[#6B6B6B]">
              {data.products.length}
            </span>
          </h2>
          {data.products.length === 0 ? (
            <p className="mt-3 text-xs text-[#6B6B6B]">No product listings yet.</p>
          ) : (
          <div className="mt-4 max-h-72 space-y-2.5 overflow-y-auto">
            {data.products.map((prod) => (
              <div
                key={prod.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#F7F7F5] px-4 py-3 text-xs"
              >
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/products/${prod.slug}`}
                    className="block truncate font-medium text-[#171717] hover:text-[#315FC8]"
                  >
                    {prod.title}
                  </Link>
                  <p className="text-[#6B6B6B]">
                    Status:{" "}
                    <span className="font-medium capitalize text-[#171717]">{prod.status}</span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={busyKey !== null}
                    onClick={() =>
                      performAction(
                        "moderate_product",
                        prod.id,
                        prod.status === "published" ? "moderated" : "published"
                      )
                    }
                    className={`h-9 cursor-pointer rounded-lg px-3 text-xs font-medium disabled:opacity-60 ${
                      prod.status === "published"
                        ? "border border-[#B45309]/35 bg-white text-[#B45309]"
                        : "bg-[#167A67] text-white"
                    }`}
                  >
                    {prod.status === "published" ? "Hold Listing" : "Restore"}
                  </button>
                </div>
              </div>
            ))}
          </div>
          )}
        </section>
      </div>
    </div>
  );
}
