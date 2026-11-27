# WISERD Design System — Master Specification

> **Source of Truth** for WISERD — Independent Ecommerce Marketplace, Seller Storefronts, Escrow Workflows, Community, Direct Messaging, Google Identity, and Wallet Connectivity.
> Synthesized from `ui-ux-pro-max` design intelligence and locked to WISERD's editorial commerce brand identity (Phase 20+).

---

## 1. Visual Direction & Brand Principles

- **Archetype**: Editorial independent commerce (Apple Store clarity, Linear interface precision, Stripe transaction confidence, Aesop restraint).
- **Light Theme Default**: Warm editorial canvas (`#F7F7F5`) with crisp pure-white (`#FFFFFF`) product surfaces and subtle hairline borders (`#E5E7EB`).
- **Avoid**: Decorative gradients, neon glows, glassmorphism over product cards, emoji UI icons, fake counts/badges/reviews, placeholder-only inputs, and hover-only primary actions.

---

## 2. Color System (WCAG 2.2 AA Verified)

| Role | Token | Hex | Contrast / Usage |
|---|---|---|---|
| Canvas Background | `--wiserd-bg` | `#F7F7F5` | Main warm-white page canvas |
| Primary Surface | `--wiserd-surface` | `#FFFFFF` | Product cards, filter sidebar, forms, tables, modals |
| Secondary Surface | `--wiserd-surface-secondary` | `#F0F1F2` | Skeletons, media backdrops, subtle tracks |
| Primary Ink | `--wiserd-text` | `#171717` | Headings, product titles, primary copy (>16:1 on white) |
| Secondary Ink | `--wiserd-text-secondary` | `#6B6B6B` | Supporting copy, store names, metadata (4.7:1+ on `#F7F7F5`) |
| Hairline Border | `--wiserd-border` | `#E5E7EB` | Card borders, section dividers, inputs |
| Primary Interactive | `--wiserd-blue-accessible` | `#315FC8` | Primary CTAs, links, active borders, focus rings (5.68:1 w/ white) |
| Primary Hover | `--wiserd-blue-hover` | `#274EA6` | Primary button hover state |
| Accent Tint | `--wiserd-blue` | `#5278E8` | Selection tint, subtle highlights |
| Escrow / Success | `--wiserd-success` | `#167A67` | Verified store checks, escrow eligibility, in-stock dots (5.26:1) |
| Warning / Limited | `--wiserd-warning` | `#B45309` | Limited stock, pending warnings |
| Danger / Error | `--wiserd-danger` | `#C81E1E` | Validation errors, destructive confirmations |
| Secondary Accent | `--wiserd-violet-accessible` | `#7853D8` | Made-to-order badges, secondary status (5.38:1) |

---

## 3. Typography System

- **Primary Sans (`--font-bricolage`)**: `Bricolage Grotesque` (`400`, `500`, `600`, `700`) — editorial headlines, navigation, product titles, body copy, buttons.
- **Condensed Numeric & Technical (`--font-barlow`)**: `Barlow Condensed` (`400`, `500`, `600`, `700`, `tabular-nums`) — counts, timestamps, escrow tags, technical metadata (`.font-condensed`, `.font-mono-light`, `.type-meta`).

| Token Class | Size | Weight | Tracking | Leading | Usage |
|---|---|---|---|---|---|
| `.type-display` | `clamp(1.75rem, 3vw, 2.5rem)` | `500` | `-0.02em` | `1.1` | Homepage hero headline |
| `.type-page` | `clamp(1.5rem, 2.2vw, 1.875rem)` | `500` | `-0.02em` | `1.1` | Route page `h1` |
| `.type-section` | `1.125rem` (18px) | `500` | `-0.02em` | `1.15` | Section `h2` |
| `.type-card` | `0.9375rem` (15px) | `500` | `0em` | `1.3` | Listing card titles (`line-clamp-2`) |
| `.type-body` | `0.875rem` (14px) | `500` | `0em` | `1.4` | Standard body prose |
| `.type-secondary` | `0.8125rem` (13px) | `500` | `0em` | `1.4` | Helper copy & descriptions |
| `.type-meta` | `0.75rem` (12px) | `500` (Barlow) | `0.01em` | `1.3` | Filter group headings, counts, dates |
| `.type-price` | `1rem`–`1.75rem` | `700`/`900` | `-0.02em` | `1.0` | Tabular prices (`tabular-nums`) |

---

## 4. Spacing, Radius & Elevation

- **Spacing Scale** (`density: 5` balanced commerce): `--space-xs: 4px`, `--space-sm: 8px`, `--space-md: 16px`, `--space-lg: 24px`, `--space-xl: 32px`, `--space-2xl: 48px`, `--space-3xl: 64px`.
- **Container Max Width**: `1320px` (`max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8`).
- **Radii**: Controls/inputs/buttons `8px` (`rounded-lg`), cards/sidebars `12px` (`rounded-xl`), modals/sheets `16px` (`rounded-2xl`).
- **Material Restraint**: Apply `.liquid-glass-*` strictly to sticky navigation, floating icon pills, popovers, and auth/wallet dialogs — never over catalog card bodies or forms.

---

## 5. Iconography & Accessibility Rules (WCAG 2.2 AA)

1. **Single Icon Family**: `lucide-react` exclusively, unified `1.65px` stroke width (`svg.lucide { stroke-width: 1.65; }`), no emoji icons.
2. **Icon Semantics**: Decorative icons beside visible text MUST carry `aria-hidden="true"`. Icon-only buttons MUST carry an explicit `aria-label` (and `aria-pressed` when stateful).
3. **Focus Not Obscured**: `html { scroll-padding-top: 5rem; }` prevents sticky header (`64px`) from hiding focused controls; `:focus-visible` uses a `2px solid #315FC8` outline with `2px` offset.
4. **Touch Targets & Compact Labels**: Minimum `8px` (`gap-2`) spacing between interactive controls; interactive mobile buttons/inputs `>= 36–44px` height; chips/badges stay single-line (`whitespace-nowrap`), bound unpredictable user text (`max-w-[240px] min-w-0 truncate`), and keep dismiss icons `shrink-0`.
5. **Dialogs & Sheets**: Every modal or bottom sheet MUST have `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, `Escape` dismissal, backdrop click dismissal, and body scroll lock while open.
6. **Live Regions**: Dynamic catalog/filter counts announce updates via a single `role="status" aria-live="polite" aria-atomic="true"` region; inline validation alerts use `role="alert"` and preserve entered input values.
7. **Honest Verification**: Never display a green `BadgeCheck` or verified badge for pending/unverified stores or local sandbox users.

---

## 6. Motion & Component Primitives

- **Motion**: Restrained transitions (`150ms–250ms` UI micro-interactions; GSAP reveals `<= 800ms`), fully disabled under `prefers-reduced-motion: reduce`.
- **Shared State Primitives**: Use [state-blocks.tsx](file:///C:/Users/user/.gemini/antigravity/scratch/wiserd/src/components/ui/state-blocks.tsx) (`PageHeader`, `EmptyState`, `StatusBanner`, `CardSkeleton`) for consistent empty, loading, and error states across Phases 21–33.
- **Meter vs. Timeline**: Use `@base-ui/react/meter` only for numeric progress ranges; use explicit step timelines for escrow and order lifecycles.
