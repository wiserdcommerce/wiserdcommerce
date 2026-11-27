-- WISERD Phase 20 — Community & Public Profile Foundation Migration
-- Extends users with public handles, optional profile links, and privacy controls;
-- adds user-to-user follow graph and post/comment edit timestamps + tags.

alter table public.users
  add column if not exists handle text unique,
  add column if not exists location text,
  add column if not exists website text,
  add column if not exists privacy jsonb not null default '{"showFollowing": true, "showSavedPosts": false, "allowDirectMessages": true}'::jsonb;

create table if not exists public.user_follows (
  follower_id uuid not null references public.users(id) on delete cascade,
  following_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

alter table public.posts
  add column if not exists tags text[] not null default array[]::text[],
  add column if not exists updated_at timestamptz;

alter table public.comments
  add column if not exists updated_at timestamptz;

-- Enable RLS on user_follows and index hot community lookups
alter table public.user_follows enable row level security;

create policy "Public read user follow graph"
  on public.user_follows for select using (true);

create index if not exists idx_users_handle on public.users (handle);
create index if not exists idx_user_follows_following on public.user_follows (following_id);
create index if not exists idx_posts_author_created on public.posts (author_id, created_at desc);
create index if not exists idx_comments_author_id on public.comments (author_id);
