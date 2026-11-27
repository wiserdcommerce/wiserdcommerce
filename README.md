<div align="center">

<img src="public/brand/wiserd-web-header.svg" alt="WISERD" height="44" />

<h3>Modern Multi-Category Marketplace &amp; Creator Commerce</h3>

<p>
  Escrow-backed commerce for physical goods, digital products, gaming assets, and studio services — built with separated Google identity, optional EVM wallet settlement, international seller payouts, real-time messaging, and community rooms.
</p>

<p>
  <img src="https://img.shields.io/badge/Next.js-16.4-000000?style=flat-square&logo=nextdotjs&logoColor=white" alt="Next.js 16" />
  <img src="https://img.shields.io/badge/React-19-149ECA?style=flat-square&logo=react&logoColor=white" alt="React 19" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript 5" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white" alt="Tailwind CSS 4" />
  <img src="https://img.shields.io/badge/Supabase-Postgres_%2B_Realtime-3ECF8E?style=flat-square&logo=supabase&logoColor=white" alt="Supabase" />
  <img src="https://img.shields.io/badge/EVM-viem-111111?style=flat-square" alt="viem" />
</p>

</div>

---

## Overview

**WISERD** is a full-stack marketplace and seller storefront platform engineered around clean separation of concerns:

- **Identity is separate from settlement**: Users authenticate with verified **Google Identity Services (OAuth 2.0)** accounts; connecting an EVM wallet (MetaMask, Rainbow, WalletConnect, or injected EIP-1193 wallets) is optional and never replaces account identity.
- **Escrow-tracked order lifecycle**: Every order moves through an auditable state machine from funding and fulfillment to buyer confirmation, dispute resolution, and payout release.
- **International seller payouts**: Store owners configure private payout destinations (**PayPal**, **Wise**, **Stripe Connect**, **Payoneer**, or **Crypto Wallet USDC/ETH**) stored server-side and never exposed on public storefront APIs.
- **Zero-demo production boot**: Production launches cleanly with `0` demo products and `0` demo stores (`WISERD_SEED_DEMO=false`), ready for real sellers from day one.

---

## Core Capabilities

| Module | Highlights |
| --- | --- |
| **Marketplace & Storefronts** | Multi-category catalog (`physical`, `digital`, `gaming`, `services`), instant global quick search (`Cmd/Ctrl + K`), quick-view modal, adaptive seller storefronts, and verified buyer reviews |
| **Checkout & Escrow** | Saved shipping addresses, stock-capped cart, escrow timeline tracking, dispute filing, and idempotent admin resolution |
| **Seller Studio (`/sell`)** | Store creation, listing management, inventory control, and validated international payout routing |
| **Real-Time Messaging (`/messages`)** | Buyer-seller direct messages powered by Supabase Realtime broadcast with polling fallback, block controls, and privacy enforcement |
| **Community (`/community`)** | Topic rooms, nested comment replies, saves/follows feed, and moderation reporting |
| **Operations Console (`/admin`)** | Founder-scoped (`WISERD_ADMIN_EMAILS`) dispute resolution, report enforcement, and live integration readiness checks |
| **Compliance & SEO** | Dedicated `/privacy` and `/terms` pages for Google OAuth approval, dynamic `sitemap.xml`, `robots.txt`, and `noindex` admin routes |

---

## Tech Stack

- **Framework**: Next.js 16 (App Router), React 19, TypeScript 5
- **Styling & Motion**: Tailwind CSS 4, Base UI (`@base-ui/react`), Lucide Icons, GSAP
- **Database & Realtime**: Supabase Postgres (RLS-hardened schema) + Supabase Realtime
- **Web3 / EVM**: `viem` + Solidity commerce & escrow contracts (`contracts/`)
- **Verification**: Automated API, auth, commerce, and security test suite (`scripts/verify-wiserd.mjs`)

---

## Project Structure

```text
wiserd/
├── contracts/                 # Solidity token & commerce router contracts
├── design-system/wiserd/      # Design tokens & page specifications
├── docs/                      # Brand guidelines
├── public/brand/              # Vector UI marks & wallet icons
├── scripts/                   # Verification & security test runners
├── src/
│   ├── app/                   # App Router pages & REST API route handlers
│   ├── components/            # Auth, wallet, marketplace, storefront & motion UI
│   └── lib/                   # Session auth, Supabase DB layer, commerce logic & types
├── supabase/
│   ├── migrations/            # Incremental SQL migrations (001 - 006)
│   └── INSTALL_WISERD_SUPABASE.sql
├── .env.example               # Environment variable template
└── DEPLOY.md                  # Production deployment & Google OAuth checklist
```

---

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env.local` and fill in your credentials:

```bash
cp .env.example .env.local
```

Key variables:
- `WISERD_SESSION_SECRET` — 32+ byte random string for HMAC-signed HTTP-only sessions
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` — Supabase Postgres & Realtime
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID` — Google Cloud OAuth 2.0 Web Client ID
- `WISERD_ADMIN_EMAILS` — Comma-separated verified Google emails granted admin access

### 3. Initialize Supabase Schema

Run [`supabase/INSTALL_WISERD_SUPABASE.sql`](supabase/INSTALL_WISERD_SUPABASE.sql) once in the **Supabase SQL Editor** to provision tables, RLS policies, storage bucket, and Realtime publications.

### 4. Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and check `/api/health` to confirm `"supabaseConnected": true`.

---

## Verification

```bash
npm run lint
npm run build
node scripts/verify-wiserd.mjs
```

---

## Deployment

See **[DEPLOY.md](DEPLOY.md)** for the complete production launch guide covering environment variables (Netlify / Vercel), Google Cloud OAuth Consent Screen setup (`/privacy` and `/terms`), clean day-1 Supabase reset SQL, and key-rotation hygiene.
