import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How WISERD handles Google sign-in, optional EVM wallets, private seller payout details, escrow order records, and community moderation.",
};

const SECTIONS = [
  {
    id: "identity",
    title: "1. Google Sign-In (Email-Only Identity)",
    body: [
      "WISERD uses Google OAuth solely to verify your identity and maintain your marketplace account. During sign-in, we request only your basic profile information (name, email address, and Google account identifier).",
      "We do not request access to your Gmail messages, Google Drive files, Calendar, Contacts, or any other Google Workspace data. Your email is used for account identification, order notifications, and support—never sold to third parties.",
    ],
  },
  {
    id: "wallets",
    title: "2. Optional EVM Wallet Connection",
    body: [
      "Blockchain wallets are strictly separated from Google sign-in. You can browse, buy with fiat methods, and participate in the community without ever connecting a wallet.",
      "If you choose to link an EVM wallet (such as MetaMask or another browser-injected wallet), WISERD stores only your public wallet address, network label, and signature verification record. We never have access to your private keys, recovery phrases, or wallet balances.",
    ],
  },
  {
    id: "payouts",
    title: "3. Private Seller Payout Destinations",
    body: [
      "Sellers may configure payout destinations—including PayPal, Wise, Stripe Connect, Payoneer, or a self-custody crypto address—to receive settled order proceeds.",
      "Payout details are stored privately for settlement and accounting purposes. They are visible only to the store owner and authorized platform administrators, and are never displayed on public storefronts, product pages, or buyer receipts.",
    ],
  },
  {
    id: "orders",
    title: "4. Orders, Escrow & Direct Messages",
    body: [
      "When you place or fulfill an order, WISERD retains order line items, shipping or delivery notes, escrow state transitions, and buyer-seller messages so both parties have a clear record of the transaction.",
      "If a dispute is opened, platform moderators review the order timeline, delivery proof, and related messages to resolve the escrow hold.",
    ],
  },
  {
    id: "community",
    title: "5. Public Content & Moderation",
    body: [
      "Storefront profiles, product listings, product reviews, and community posts you publish are visible to other visitors. We log moderation actions taken to prevent fraud, spam, or abusive behavior.",
    ],
  },
  {
    id: "retention",
    title: "6. Cookies, Storage & Your Choices",
    body: [
      "WISERD uses an HTTP-only session cookie to keep you signed in and minimal browser storage for cart items and recent searches. We do not run third-party advertising trackers.",
      "You can disconnect linked wallets at any time from Wallet Management, update profile details in Account settings, or request account and data deletion by contacting us.",
    ],
  },
  {
    id: "contact",
    title: "7. Contact",
    body: [
      "For privacy questions, data export requests, or account deletion, reach WISERD Administration through Messages once signed in, or via the support email listed on the Google OAuth consent screen for this deployment.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-[820px] px-4 py-10 sm:px-6 lg:px-8">
      <header className="border-b border-[#E5E7EB] pb-6">
        <p className="type-meta uppercase tracking-wider">Legal · WISERD</p>
        <h1 className="type-page mt-2 text-[#171717]">Privacy Policy</h1>
        <p className="type-secondary mt-2 max-w-2xl">
          Plain-language summary of what WISERD collects, what stays private,
          and how your account, wallet, and order data are handled.
        </p>
        <p className="type-meta mt-3">Last updated: November 2026</p>
      </header>

      <article className="mt-8 space-y-6">
        {SECTIONS.map((section) => (
          <section
            key={section.id}
            id={section.id}
            className="rounded-xl border border-[#E5E7EB] bg-white p-5 sm:p-6"
          >
            <h2 className="type-section text-[#171717]">{section.title}</h2>
            <div className="mt-2.5 space-y-2.5">
              {section.body.map((paragraph, index) => (
                <p
                  key={index}
                  className="type-body text-[#6B6B6B] leading-relaxed"
                >
                  {paragraph}
                </p>
              ))}
            </div>
          </section>
        ))}
      </article>

      <footer className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-[#E5E7EB] pt-5 text-xs text-[#6B6B6B]">
        <div className="flex items-center gap-4">
          <Link href="/terms" className="text-[#315FC8] hover:underline">
            Terms of Service
          </Link>
          <Link href="/marketplace" className="hover:text-[#171717]">
            Back to Marketplace
          </Link>
        </div>
        <Link href="/messages" className="hover:text-[#171717]">
          Contact Support
        </Link>
      </footer>
    </div>
  );
}
