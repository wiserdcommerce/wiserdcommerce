import React from "react";
import type { LucideIcon } from "lucide-react";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#E5E7EB] pb-5">
      <div className="min-w-0">
        {eyebrow && <p className="type-meta text-[#315FC8]">{eyebrow}</p>}
        <h1 className="type-page mt-1 text-[#171717]">{title}</h1>
        {description && (
          <p className="mt-1.5 max-w-2xl text-sm text-[#6B6B6B]">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[#E5E7EB] bg-white px-6 py-12 text-center">
      <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl border border-[#E5E7EB] bg-[#F7F7F5] text-[#6B6B6B]">
        <Icon className="h-5 w-5" />
      </span>
      <p className="mt-3.5 text-base font-medium text-[#171717]">{title}</p>
      <p className="mx-auto mt-1.5 max-w-md text-xs text-[#6B6B6B]">{description}</p>
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

export function StatusBanner({
  tone = "info",
  message,
  onRetry,
}: {
  tone?: "info" | "success" | "error";
  message: string;
  onRetry?: () => void;
}) {
  const styles =
    tone === "error"
      ? "border-[#C81E1E]/25 bg-[#C81E1E]/[0.06] text-[#C81E1E]"
      : tone === "success"
        ? "border-[#167A67]/25 bg-[#167A67]/[0.06] text-[#167A67]"
        : "border-[#315FC8]/25 bg-white text-[#315FC8]";
  const Icon = tone === "error" ? AlertTriangle : tone === "success" ? CheckCircle2 : Info;

  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-xs font-medium ${styles}`}
    >
      <span className="inline-flex items-center gap-2">
        <Icon className="h-4 w-4 shrink-0" />
        <span>{message}</span>
      </span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="cursor-pointer rounded-lg border border-current/25 bg-white px-3 py-1 text-xs font-medium hover:opacity-85"
        >
          Retry
        </button>
      )}
    </div>
  );
}

export function CardSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div aria-hidden="true" className="space-y-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-[#E5E7EB] bg-white p-5"
        >
          <div className="h-3.5 w-32 animate-pulse rounded bg-[#F0F1F2]" />
          <div className="mt-3 h-5 w-2/3 animate-pulse rounded bg-[#F0F1F2]" />
          <div className="mt-2 h-3.5 w-full animate-pulse rounded bg-[#F0F1F2]" />
        </div>
      ))}
    </div>
  );
}

export function CatalogGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div
      aria-hidden="true"
      className="mx-auto max-w-[1320px] px-4 pt-8 sm:px-6 lg:px-8"
    >
      <div className="space-y-2.5 border-b border-[#E5E7EB] pb-5">
        <div className="h-3 w-24 animate-pulse rounded bg-[#E5E7EB]" />
        <div className="h-8 w-64 animate-pulse rounded bg-[#E5E7EB]" />
        <div className="h-4 w-96 max-w-full animate-pulse rounded bg-[#F0F1F2]" />
      </div>
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className="overflow-hidden rounded-xl border border-[#E5E7EB] bg-white"
          >
            <div className="aspect-[4/3] w-full animate-pulse bg-[#F0F1F2]" />
            <div className="space-y-2.5 p-4">
              <div className="h-3 w-24 animate-pulse rounded bg-[#F0F1F2]" />
              <div className="h-4 w-4/5 animate-pulse rounded bg-[#E5E7EB]" />
              <div className="h-4 w-16 animate-pulse rounded bg-[#F0F1F2]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DetailSplitSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="mx-auto max-w-[1320px] px-4 pt-8 sm:px-6 lg:px-8"
    >
      <div className="h-3.5 w-48 animate-pulse rounded bg-[#E5E7EB]" />
      <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div className="space-y-3 lg:col-span-7">
          <div className="aspect-[4/3] w-full animate-pulse rounded-xl bg-[#F0F1F2]" />
          <div className="grid grid-cols-3 gap-3">
            <div className="aspect-[4/3] animate-pulse rounded-lg bg-[#F0F1F2]" />
            <div className="aspect-[4/3] animate-pulse rounded-lg bg-[#F0F1F2]" />
            <div className="aspect-[4/3] animate-pulse rounded-lg bg-[#F0F1F2]" />
          </div>
        </div>
        <div className="space-y-4 rounded-xl border border-[#E5E7EB] bg-white p-6 lg:col-span-5">
          <div className="h-3.5 w-28 animate-pulse rounded bg-[#F0F1F2]" />
          <div className="h-8 w-4/5 animate-pulse rounded bg-[#E5E7EB]" />
          <div className="h-7 w-24 animate-pulse rounded bg-[#F0F1F2]" />
          <div className="h-11 w-full animate-pulse rounded-lg bg-[#E5E7EB]" />
          <div className="h-11 w-full animate-pulse rounded-lg bg-[#F0F1F2]" />
        </div>
      </div>
    </div>
  );
}
