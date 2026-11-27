import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "Clear rules for buying, selling, escrow workflows, optional wallets, payouts, and community conduct on WISERD Marketplace.",
};

const SECTIONS = [
  {
    id: "overview",
    title: "1. Using WISERD",
    body: [
      "WISERD is an independent third-party marketplace for physical goods, digital products, gaming hardware, and studio services. By creating an account, listing items, or placing an order, you agree to follow these Terms.",
      "You are responsible for keeping your account accurate and for all activity conducted through your signed-in session.",
    ],
  },
  {
    id: "accounts-wallets",
    title: "2. Accounts & Optional Wallets",
    body: [
      "Marketplace identity is authenticated via Google OAuth using your email address. Connecting an EVM wallet is optional and strictly separate from Google sign-in.",
      "You are solely responsible for safeguarding any self-custody wallet you connect and for verifying addresses and network details before signing transactions.",
    ],
  },
  {
    id: "escrow",
    title: "3. Orders & Escrow Workflow",
    body: [
      "Orders follow a structured escrow workflow: checkout creates an order record, the seller fulfills the item or service and provides delivery details, and funds are released once the buyer confirms receipt or after the escrow review window closes.",
      "Checkout clearly indicates whether an order uses fiat or onchain escrow. If an item is not delivered or materially differs from its listing, the buyer may open a dispute before release so WISERD Administration can review the order record and messages.",
    ],
  },
  {
    id: "sellers",
    title: "4. Seller Responsibilities & Payouts",
    body: [
      "Sellers must accurately describe listings, honor stated pricing and fulfillment timelines, and only list goods or services they are legally permitted to sell.",
      "Sellers configure their own private payout destinations (PayPal, Wise, Stripe Connect, Payoneer, or Crypto) and are responsible for keeping payout details accurate and complying with applicable local tax and reporting obligations.",
    ],
  },
  {
    id: "moderation",
    title: "5. Community Conduct & Moderation",
    body: [
      "Fraud, counterfeit or illegal goods, harassment, spam, and attempts to bypass escrow or abuse dispute workflows are prohibited.",
      "WISERD moderators may remove listings, hide community posts, hold disputed payouts during investigation, or suspend accounts that violate these rules.",
    ],
  },
  {
    id: "disclaimers",
    title: "6. Marketplace Role & Liability",
    body: [
      "WISERD provides the marketplace platform and escrow workflow, while independent sellers are responsible for the quality, legality, and fulfillment of their listings. The platform is provided on an \"as is\" basis without warranties beyond those required by applicable law.",
    ],
  },
  {
    id: "contact",
    title: "7. Changes & Contact",
    body: [
      "We may update these Terms as WISERD evolves and will update the date at the top of this page when changes take effect. Questions, dispute escalations, or legal notices can be sent to WISERD Administration via Messages or the support email listed on the Google OAuth consent screen for this deployment.",
    ],
  },
];

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-[820px] px-4 py-10 sm:px-6 lg:px-8">
      <header className="border-b border-[#E5E7EB] pb-6">
        <p className="type-meta uppercase tracking-wider">Legal · WISERD</p>
        <h1 className="type-page mt-2 text-[#171717]">Terms of Service</h1>
        <p className="type-secondary mt-2 max-w-2xl">
          Straightforward terms covering accounts, optional wallets, escrow
          orders, seller payouts, and community moderation on WISERD.
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
          <Link href="/privacy" className="text-[#315FC8] hover:underline">
            Privacy Policy
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
