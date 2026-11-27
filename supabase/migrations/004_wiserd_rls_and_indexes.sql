-- WISERD Security & Scalability Migration (Phase 3 — AUD-026)
-- Enables Row Level Security on all tables, adds baseline least-privilege policies,
-- and adds secondary indexes on foreign keys and hot query paths.

-- 1. Enable RLS across all 17 tables
alter table public.users enable row level security;
alter table public.connected_identities enable row level security;
alter table public.wallets enable row level security;
alter table public.stores enable row level security;
alter table public.products enable row level security;
alter table public.product_variations enable row level security;
alter table public.orders enable row level security;
alter table public.payments enable row level security;
alter table public.escrow_transactions enable row level security;
alter table public.payouts enable row level security;
alter table public.reviews enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.discussion_rooms enable row level security;
alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.notifications enable row level security;
alter table public.reports enable row level security;
alter table public.disputes enable row level security;
alter table public.audit_logs enable row level security;

-- 2. Public read policies for intentionally public catalog/storefront/community data
create policy "Public read active stores"
  on public.stores for select using (true);

create policy "Public read published products"
  on public.products for select using (status = 'published');

create policy "Public read product variations"
  on public.product_variations for select using (true);

create policy "Public read reviews"
  on public.reviews for select using (true);

create policy "Public read discussion rooms"
  on public.discussion_rooms for select using (true);

create policy "Public read active community posts"
  on public.posts for select using (status <> 'removed');

create policy "Public read community comments"
  on public.comments for select using (true);

-- 3. Authenticated self-scoped read policies (mutations performed via server service role)
create policy "Users read own profile"
  on public.users for select using (auth.uid() = id);

create policy "Users read own wallets"
  on public.wallets for select using (auth.uid() = user_id);

create policy "Users read own notifications"
  on public.notifications for select using (auth.uid() = recipient_id);

create policy "Order participants read orders"
  on public.orders for select using (
    auth.uid() = buyer_id
    or exists (
      select 1 from public.stores s
      where s.id = orders.store_id and s.owner_id = auth.uid()
    )
  );

create policy "Conversation participants read conversations"
  on public.conversations for select using (auth.uid() = any(participant_ids));

create policy "Conversation participants read messages"
  on public.messages for select using (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id and auth.uid() = any(c.participant_ids)
    )
  );

-- 4. Foreign-key and hot-path indexes
create index if not exists idx_wallets_user_id on public.wallets (user_id);
create index if not exists idx_stores_owner_id on public.stores (owner_id);
create index if not exists idx_products_store_status on public.products (store_id, status);
create index if not exists idx_products_category_status on public.products (category, status);
create index if not exists idx_variations_product_id on public.product_variations (product_id);
create index if not exists idx_orders_buyer_created on public.orders (buyer_id, created_at desc);
create index if not exists idx_orders_store_created on public.orders (store_id, created_at desc);
create index if not exists idx_reviews_product_id on public.reviews (product_id);
create index if not exists idx_reviews_store_id on public.reviews (store_id);
create index if not exists idx_messages_conversation_created on public.messages (conversation_id, created_at);
create index if not exists idx_posts_room_created on public.posts (room_id, created_at desc);
create index if not exists idx_comments_post_id on public.comments (post_id, created_at);
create index if not exists idx_notifications_recipient_unread on public.notifications (recipient_id, read, created_at desc);
create index if not exists idx_reports_status on public.reports (review_status, created_at desc);
create index if not exists idx_disputes_status on public.disputes (status, created_at desc);
create index if not exists idx_audit_logs_created on public.audit_logs (created_at desc);
