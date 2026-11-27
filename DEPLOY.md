# Deploying WISERD Marketplace

Concise production launch checklist for deploying WISERD Marketplace to Vercel with Google Identity Services and Supabase.

---

## 1. Vercel Environment Variables Checklist

Configure these in **Vercel Project Settings -> Environment Variables** (Production & Preview as appropriate). Do not commit real values to Git; `.env.example` is the canonical template.

### Core Production Variables (Required)

| Variable | Notes |
| --- | --- |
| `NEXT_PUBLIC_APP_URL` | Canonical production origin (e.g., `https://your-domain.com`) |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Google Cloud OAuth 2.0 Web Client ID for Google Identity Services |
| `WISERD_SESSION_SECRET` | Fresh 32+ byte random string for signing session cookies |
| `WISERD_ENABLE_LOCAL_SANDBOX` | Set to `false` in production (real Google OAuth only) |
| `WISERD_SEED_DEMO` | Set to `false` in production (launch with 0 demo listings/stores) |
| `WISERD_ADMIN_EMAILS` | Comma-separated verified Google emails granted admin access on sign-in |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase server-only service role key (never expose client-side) |

### Optional / Future Settlement Variables (Leave Blank Until Ready)

Unconfigured payment/onchain variables are surfaced honestly in the UI and APIs.

| Variable | Notes |
| --- | --- |
| `WISERD_PAYMENT_PROVIDER` | Fiat payment / licensed escrow provider identifier |
| `WISERD_PAYMENT_API_KEY` | Fiat payment provider API key |
| `WISERD_PAYMENT_WEBHOOK_SECRET` | Fiat payment provider webhook signing secret |
| `NEXT_PUBLIC_WALLET_CHAIN_ID` | Target EVM chain ID for live onchain escrow |
| `NEXT_PUBLIC_WALLET_CHAIN_NAME` | Human-readable EVM chain name |
| `NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS` | Audited escrow smart contract address |
| `NEXT_PUBLIC_ESCROW_TOKEN_SYMBOL` | Settlement token symbol |

---

## 2. Google Cloud OAuth Consent Screen & Credentials

WISERD uses **Google Identity Services (GIS)** with server-side ID token verification.

### OAuth Consent Screen (**Google Cloud Console -> APIs & Services -> OAuth consent screen**)
1. Set **User Type** to **External** and publish to **Production** when ready for public sign-in.
2. Fill in the required public URLs (served by this app):
   - **App home page**: `https://<your-domain>`
   - **Privacy policy link**: `https://<your-domain>/privacy`
   - **Terms of service link**: `https://<your-domain>/terms`
3. Add your production domain under **Authorized domains**.
4. Request only non-sensitive scopes: `openid`, `email`, `profile`.

### OAuth 2.0 Web Client (**APIs & Services -> Credentials -> OAuth 2.0 Client IDs**)
1. **Authorized JavaScript origins** (required for GIS button & One Tap):
   - `https://<your-domain>`
   - `https://<your-vercel-app>.vercel.app` (if testing on the default Vercel domain)
   - `http://localhost:3000` (local development only)
2. **Authorized redirect URIs**:
   - `https://<your-domain>`
   - `https://<your-vercel-app>.vercel.app`
   - `http://localhost:3000` (local development only)
3. Copy the resulting Client ID into `NEXT_PUBLIC_GOOGLE_CLIENT_ID` in Vercel.

---

## 3. Supabase Setup & Clean Day-1 Reset

1. If provisioning a new Supabase project, run `supabase/INSTALL_WISERD_SUPABASE.sql` in the **Supabase SQL Editor**.
2. Before public launch, clear any seeded or staging state so production starts cleanly with **0 demo listings and 0 demo stores** (with `WISERD_SEED_DEMO=false` in Vercel):

```sql
delete from public.wiserd_app_state where id = 'primary';
```

3. Verify the deployment health endpoint returns `supabaseConnected: true`:
   - `GET https://<your-domain>/api/health`

---

## 4. Security Reminder Before Wide Public Launch

- **Rotate `SUPABASE_SERVICE_ROLE_KEY`**: Before opening WISERD to wide public traffic, generate/rotate the `service_role` key in **Supabase Dashboard -> Project Settings -> API**, immediately update `SUPABASE_SERVICE_ROLE_KEY` in **Vercel Environment Variables**, and redeploy.
- Ensure `WISERD_SESSION_SECRET` is a unique, freshly generated 32+ byte random value (e.g., `openssl rand -hex 32`) not shared with local development.
- Confirm `.env.local` and `.wiserd-data/` remain untracked (enforced by `.gitignore`).

---

## 5. Post-Deploy Verification

- [ ] `GET /api/health` returns HTTP 200 with `supabaseConnected: true` and `localSandboxEnabled: false`
- [ ] `GET /privacy`, `GET /terms`, and `GET /sitemap.xml` return HTTP 200
- [ ] Google Sign-In completes on the production domain and sets an authenticated session
- [ ] Marketplace loads with 0 demo listings after running the clean day-1 reset SQL
