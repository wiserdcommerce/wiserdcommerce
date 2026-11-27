"use client";

import React from "react";
import Link from "next/link";

export default function GlobalAppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-[720px] px-4 py-20 text-center sm:px-6">
      <div className="rounded-xl border border-[#E5E7EB] bg-white p-10">
        <p className="type-meta text-[#C81E1E]">Unexpected error</p>
        <h1 className="mt-2 text-2xl font-medium text-[#171717]">
          Something went wrong
        </h1>
        <p className="mt-2 text-sm text-[#6B6B6B]">
          {error.message || "We could not load this section. Try again or return to the marketplace."}
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
          <button
            type="button"
            onClick={() => reset()}
            className="h-10 cursor-pointer rounded-lg bg-[#315FC8] px-5 text-xs font-medium text-white hover:bg-[#274EA6]"
          >
            Try Again
          </button>
          <Link
            href="/marketplace"
            className="inline-flex h-10 items-center rounded-lg border border-[#E5E7EB] bg-white px-5 text-xs font-medium text-[#171717] hover:border-[#171717]/30"
          >
            Marketplace
          </Link>
        </div>
      </div>
    </div>
  );
}
