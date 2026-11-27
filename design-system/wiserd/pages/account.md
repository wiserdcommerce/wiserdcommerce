# Account Page Specification (`/account`)

> **PROJECT:** WISERD
> **Page Type:** Unified Account, Identity, Wallet, Addresses & Saved Items
> **Inherits:** `design-system/wiserd/MASTER.md`

---

## Layout & Grid Rules

- **Container**: `max-w-[1320px]`, `px-4 sm:px-6 lg:px-8`.
- **Top Identity Row**: 2-column split (`lg:grid-cols-2`) clearly separating **Google Account Identity** from **Connected Blockchain Wallets** (never conflated).
- **Main Management Grid**: 12-column split (`lg:grid-cols-12`) — Profile Details + Setup Meter (`lg:col-span-5`) alongside Notifications & Shipping Addresses (`lg:col-span-7`).
- **Saved Favorites Shelf**: 4-column responsive `ProductCard` grid (`sm:grid-cols-2 lg:grid-cols-4`).

---

## Component & UX Overrides

1. **Form Labels & Validation (`ui-ux-pro-max` + `ui-styling`)**:
   - Every form field (Profile Display Name, Bio, and every Shipping Address input: Label, Recipient, Street Address, City, Postal Code) MUST have an explicit visible `<label htmlFor="...">` — never placeholder-only inputs.
   - Bio displays live character count (`X / 280`, `tabular-nums`) matching backend limit.
   - Profile & Address submit buttons show disabled loading states (`Saving...` / `Adding...`) and announce success (`role="status"`) or inline error (`role="alert"`) while preserving entered values.
2. **Safe Destructive Action**:
   - Removing a saved shipping address uses a `36×36px` (`h-9 w-9`) trigger (`aria-label="Remove <label> address"`) with inline two-step confirmation (`Remove` / `Keep`) to prevent accidental deletion.
3. **Notifications & Icons**:
   - Clicking a notification marks it read; `"Mark all read"` only appears when unread notifications exist.
   - All decorative Lucide icons carry `aria-hidden="true"` and consistent `1.65px` stroke weight.
4. **Honest Identity Display**:
   - Show `Google Verified` badge ONLY when `user.authMode === "google_verified"`; show neutral `"Local Sandbox Session"` otherwise. Surface `@handle` cleanly in the account header.
