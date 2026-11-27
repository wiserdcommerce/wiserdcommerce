import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Page Not Found",
};

export default function NotFound() {
  return (
    <div className="mx-auto max-w-[720px] px-4 py-20 text-center sm:px-6">
      <div className="rounded-xl border border-[#E5E7EB] bg-white p-10">
        <p className="type-meta">404</p>
        <h1 className="mt-2 text-2xl font-medium text-[#171717]">
          Page not found
        </h1>
        <p className="mt-2 text-sm text-[#6B6B6B]">
          The listing, storefront, or page you requested could not be found or is
          no longer available.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
          <Link
            href="/marketplace"
            className="inline-flex h-10 items-center rounded-lg bg-[#315FC8] px-5 text-xs font-medium text-white hover:bg-[#274EA6]"
          >
            Browse Marketplace
          </Link>
          <Link
            href="/"
            className="inline-flex h-10 items-center rounded-lg border border-[#E5E7EB] bg-white px-5 text-xs font-medium text-[#171717] hover:border-[#171717]/30"
          >
            Return Home
          </Link>
        </div>
      </div>
    </div>
  );
}
