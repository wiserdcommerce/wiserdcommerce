-- WISERD Migration 006 — International Seller Payouts, DM Block Guard,
-- Server App-State Persistence, Storage Bucket, and Realtime Publications.
-- Safe to run multiple times (idempotent).

-- 1. Store private payout destination & conversation block owner
alter table public.stores
  add column if not exists payout_destination jsonb;

alter table public.conversations
  add column if not exists blocked_by uuid references public.users(id) on delete set null;

-- 2. Private server-only app state table (RLS enabled with ZERO public/anon policies;
--    accessible strictly via SUPABASE_SERVICE_ROLE_KEY from Next.js server routes)
create table if not exists public.wiserd_app_state (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.wiserd_app_state enable row level security;
revoke all on table public.wiserd_app_state from anon, authenticated;
grant all on table public.wiserd_app_state to service_role;

-- 3. Public media storage bucket for product & community uploads
insert into storage.buckets (id, name, public)
values ('wiserd-media', 'wiserd-media', true)
on conflict (id) do nothing;

do $$
begin
  create policy "Public read wiserd-media"
    on storage.objects for select
    using (bucket_id = 'wiserd-media');
exception
  when duplicate_object then null;
end $$;

-- 4. Enable Supabase Realtime on live messaging & notification tables
do $$
begin
  alter publication supabase_realtime add table public.messages;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.conversations;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.notifications;
exception
  when duplicate_object then null;
end $$;
