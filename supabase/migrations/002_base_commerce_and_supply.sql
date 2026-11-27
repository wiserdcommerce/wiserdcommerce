-- WISERD EXTENSION MIGRATION 002: Base Third-Party Commerce & Enterprise Supply Ledger

create table if not exists public.commerce_merchants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  category text not null,
  settlement_wallet text not null,
  fee_bps smallint not null default 250 check (fee_bps between 0 and 1000),
  is_verified boolean not null default true,
  webhook_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.commerce_orders (
  id uuid primary key default gen_random_uuid(),
  order_reference text not null unique,
  buyer_user_id uuid references public.profiles(id) on delete set null,
  buyer_wallet text not null,
  merchant_id uuid not null references public.commerce_merchants(id) on delete restrict,
  settlement_currency text not null check (settlement_currency in ('USDC', 'WSRD')),
  gross_amount numeric(20, 6) not null check (gross_amount > 0),
  protocol_fee numeric(20, 6) not null default 0,
  merchant_net numeric(20, 6) not null check (merchant_net >= 0),
  chain_id integer not null default 8453,
  tx_hash text unique,
  status text not null default 'quoted' check (status in ('quoted', 'pending', 'settled', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.enterprise_supply_ledger (
  id uuid primary key default gen_random_uuid(),
  tranche_code text not null unique,
  label text not null,
  allocation_tokens numeric(24, 0) not null check (allocation_tokens >= 0),
  allocation_percent numeric(5, 2) not null check (allocation_percent between 0 and 100),
  vesting_schedule text not null,
  treasury_address text,
  status text not null default 'pre_deploy' check (status in ('pre_deploy', 'testnet_live', 'mainnet_live')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.commerce_merchants enable row level security;
alter table public.commerce_orders enable row level security;
alter table public.enterprise_supply_ledger enable row level security;

create policy "Public read verified merchants" on public.commerce_merchants
  for select using (is_verified = true);

create policy "Users read own commerce orders" on public.commerce_orders
  for select using (auth.uid() = buyer_user_id);

create policy "Public read enterprise supply schedule" on public.enterprise_supply_ledger
  for select using (true);
