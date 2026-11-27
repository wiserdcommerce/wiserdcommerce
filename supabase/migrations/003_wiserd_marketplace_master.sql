-- WISERD Complete Marketplace Schema (Masterplan Section 37)
-- Covers unified accounts, Google Identity Services (sub), separate linked wallets,
-- seller storefronts, products & variations, orders, payments, auditable escrow,
-- payouts, purchase-gated reviews, messaging, community, discussion rooms, moderation & audit logs.

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  email text not null unique,
  avatar_url text,
  bio text default '',
  roles text[] not null default array['buyer'],
  status text not null default 'active' check (status in ('active', 'suspended', 'deleted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.connected_identities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  provider text not null check (provider in ('google')),
  provider_sub text not null,
  email text not null,
  email_verified boolean not null default false,
  connected_at timestamptz not null default now(),
  unique (provider, provider_sub)
);

create table if not exists public.wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  address text not null,
  wallet_name text not null,
  chain_id text not null,
  network_name text not null,
  ownership_verified boolean not null default false,
  verification_nonce text,
  verification_signature text,
  status text not null default 'connected' check (status in ('connected', 'disconnected')),
  connected_at timestamptz not null default now(),
  unique (user_id, address)
);

create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.users(id) on delete cascade,
  slug text not null unique,
  name text not null,
  tagline text not null default '',
  description text not null default '',
  logo_url text,
  cover_url text,
  verification_status text not null default 'pending' check (verification_status in ('pending', 'verified', 'action_required')),
  shipping_policy text not null default '',
  refund_policy text not null default '',
  payout_status text not null default 'unconfigured' check (payout_status in ('unconfigured', 'pending', 'active')),
  storage_used_mb integer not null default 0,
  storage_limit_mb integer not null default 500,
  monthly_listing_limit integer not null default 25,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  slug text not null unique,
  category text not null check (category in ('physical', 'digital', 'gaming', 'services')),
  product_type text not null,
  title text not null,
  summary text not null,
  description text not null,
  price_cents integer not null check (price_cents >= 0),
  currency text not null default 'USD',
  stock integer not null default 0 check (stock >= 0),
  availability text not null default 'in_stock' check (availability in ('in_stock', 'limited', 'made_to_order', 'out_of_stock')),
  escrow_eligible boolean not null default true,
  delivery_info text not null,
  refund_conditions text not null,
  specs jsonb not null default '{}'::jsonb,
  media jsonb not null default '[]'::jsonb,
  status text not null default 'published' check (status in ('draft', 'published', 'paused', 'moderated')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_variations (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  label text not null,
  price_delta_cents integer not null default 0,
  stock integer not null default 0
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  reference_code text not null unique,
  buyer_id uuid not null references public.users(id),
  store_id uuid not null references public.stores(id),
  items jsonb not null,
  subtotal_cents integer not null,
  shipping_cents integer not null default 0,
  platform_fee_cents integer not null default 0,
  total_cents integer not null,
  currency text not null default 'USD',
  shipping_address jsonb,
  payment_method text not null check (payment_method in ('fiat_escrow', 'wallet_escrow')),
  fulfillment_note text,
  tracking_number text,
  delivery_submitted_at timestamptz,
  buyer_confirmed_at timestamptz,
  status text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  provider text not null,
  provider_reference text,
  amount_cents integer not null,
  verification_status text not null check (verification_status in ('unconfigured_preview', 'pending', 'verified', 'failed', 'refunded')),
  tx_hash text,
  created_at timestamptz not null default now()
);

create table if not exists public.escrow_transactions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  payment_id uuid references public.payments(id),
  escrow_method text not null check (escrow_method in ('fiat_provider', 'onchain_contract', 'unconfigured_preview')),
  status text not null,
  release_conditions text not null,
  events jsonb not null default '[]'::jsonb,
  released_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.payouts (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id),
  order_id uuid not null references public.orders(id),
  amount_cents integer not null,
  settlement_reference text,
  status text not null check (status in ('pending_provider', 'processing', 'paid_out', 'held')),
  created_at timestamptz not null default now()
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  order_id uuid not null references public.orders(id),
  buyer_id uuid not null references public.users(id),
  rating integer not null check (rating between 1 and 5),
  comment text not null,
  seller_reply text,
  created_at timestamptz not null default now(),
  unique (order_id, product_id, buyer_id)
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  participant_ids uuid[] not null,
  product_id uuid references public.products(id),
  order_id uuid references public.orders(id),
  status text not null default 'open' check (status in ('open', 'blocked', 'reported')),
  updated_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.users(id),
  body text not null,
  delivery_state text not null default 'delivered',
  created_at timestamptz not null default now()
);

create table if not exists public.discussion_rooms (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  category text not null,
  description text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.users(id),
  room_id uuid references public.discussion_rooms(id),
  post_type text not null check (post_type in ('discussion', 'product_share', 'question', 'recommendation')),
  title text not null,
  body text not null,
  attached_product_id uuid references public.products(id),
  reaction_count integer not null default 0,
  status text not null default 'active' check (status in ('active', 'flagged', 'removed')),
  created_at timestamptz not null default now()
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  parent_comment_id uuid references public.comments(id),
  author_id uuid not null references public.users(id),
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.users(id) on delete cascade,
  event_type text not null,
  title text not null,
  body text not null,
  href text not null,
  important_transaction boolean not null default false,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.users(id),
  entity_type text not null check (entity_type in ('product', 'store', 'user', 'post', 'message')),
  entity_id text not null,
  reason text not null,
  evidence text default '',
  review_status text not null default 'open' check (review_status in ('open', 'reviewed', 'action_taken', 'dismissed')),
  created_at timestamptz not null default now()
);

create table if not exists public.disputes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id),
  opened_by_id uuid not null references public.users(id),
  reason text not null,
  buyer_statement text not null,
  seller_response text,
  evidence_notes text default '',
  status text not null default 'open' check (status in ('open', 'under_review', 'resolved_refund', 'resolved_release')),
  resolution_note text,
  resolved_by_id uuid references public.users(id),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id text not null,
  action text not null,
  target_type text not null,
  target_id text not null,
  details text not null,
  created_at timestamptz not null default now()
);
