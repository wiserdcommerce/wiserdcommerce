# Marketplace Page Specification (`/marketplace`)

> **PROJECT:** WISERD
> **Page Type:** Editorial Product Discovery & Faceted Catalog
> **Inherits:** `design-system/wiserd/MASTER.md`

---

## Layout & Grid Rules

- **Container**: `max-w-[1320px]`, responsive horizontal padding `px-4 sm:px-6 lg:px-8`.
- **Desktop Layout (`lg+`)**: 12-column grid — sticky 3-column filter sidebar (`top-20`) + 9-column catalog grid (`1 col` mobile, `2 cols` `sm+`, `3 cols` `xl+`, `gap-4`).
- **Mobile Layout (`< lg`)**: Full-width search bar, side-by-side `Filters` sheet trigger (with active filter count badge) and `Sort` select (`min-h-[40px]`), horizontal wrapping category strip (`gap-2`), and accessible bottom-sheet filter drawer.

---

## Component & UX Overrides

1. **Product Cards (`ProductCard`)**:
   - Aspect ratio strictly reserved at `4:3` (`aspect-[4/3]`) to guarantee `CLS < 0.1`.
   - Maximum 3 metadata rows below media: `Store + Availability` → `Title (line-clamp-2)` → `Price (tabular-nums) + Escrow/Category`.
   - Floating wishlist icon button sized `36×36px` (`h-9 w-9`) with explicit `aria-label` and `aria-pressed`; decorative icons carry `aria-hidden="true"`.
2. **Search, Category & Active Filter Chips**:
   - Search input provides an explicit clear (`X`) button when non-empty.
   - Category pills use `min-h-[36px] whitespace-nowrap` and `gap-2` touch spacing.
   - Applied filter chips cap text width (`max-w-[240px] min-w-0 truncate whitespace-nowrap`) with `shrink-0` dismiss icons (`aria-hidden="true"`) and explicit `aria-label="Remove filter: ..."`.
3. **Price Range Validation**:
   - Preserve user-entered `minPrice` and `maxPrice` values; if `minPrice > maxPrice`, display an inline `role="alert"` notice below the inputs instead of silently showing an empty catalog.
4. **Live Catalog Status & Empty States**:
   - Announce result counts via `<p role="status" aria-live="polite" aria-atomic="true">`.
   - Use shared `EmptyState` / `StatusBanner` blocks for error recovery and zero-result reset actions.
5. **Mobile Filter Bottom Sheet & Quick View Modal**:
   - Both enforce `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, `Escape` key dismissal, backdrop click dismissal, and body scroll lock while open.
   - Quick View displays green `BadgeCheck` ONLY when `store.verificationStatus === "verified"`; pending stores render neutral muted copy.
