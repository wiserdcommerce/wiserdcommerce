-- WISERD MASTER DATABASE SCHEMA v1.0 (Supabase PostgreSQL)
-- Matches Dokumen 01 — Database SQL Blueprint

create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  language text not null default 'en' check (language in ('en', 'id')),
  timezone text not null default 'UTC',
  onboarding_completed boolean not null default false,
  subscription_tier text not null default 'free' check (subscription_tier in ('free', 'pro', 'research')),
  wallet_address text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.topics (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  category text not null check (
    category in ('Technology', 'Business', 'Science', 'Finance', 'World', 'Culture', 'Innovation')
  ),
  description text,
  is_emerging boolean not null default false,
  follower_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.entities (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  entity_type text not null check (
    entity_type in ('company', 'technology', 'industry', 'public_figure', 'organization', 'research_subject')
  ),
  topic_id uuid references public.topics(id) on delete set null,
  summary text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_interests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  topic_id uuid references public.topics(id) on delete cascade,
  entity_id uuid references public.entities(id) on delete cascade,
  priority_weight numeric(3,2) not null default 1.00 check (priority_weight between 0.10 and 2.00),
  source text not null default 'onboarding' check (source in ('onboarding', 'manual_follow', 'explicit_feedback')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_interests_target_check check (
    (topic_id is not null and entity_id is null) or
    (topic_id is null and entity_id is not null)
  ),
  constraint user_interests_unique_topic unique nulls not distinct (user_id, topic_id, entity_id)
);

create table if not exists public.sources (
  id uuid primary key default gen_random_uuid(),
  domain text not null unique,
  name text not null,
  source_type text not null check (
    source_type in ('news', 'tech_pub', 'company_announcement', 'research_paper', 'official_site', 'public_report')
  ),
  reliability_score numeric(3,2) not null default 0.85 check (reliability_score between 0.00 and 1.00),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.sources(id) on delete restrict,
  url text not null unique,
  canonical_hash text not null,
  event_cluster_id uuid,
  title text not null,
  publisher text not null,
  published_at timestamptz not null,
  retrieved_at timestamptz not null default now(),
  content_summary text not null,
  raw_excerpt text,
  language text not null default 'en',
  reliability_snapshot numeric(3,2) not null default 0.85,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.article_topics (
  article_id uuid not null references public.articles(id) on delete cascade,
  topic_id uuid not null references public.topics(id) on delete cascade,
  relevance_score numeric(3,2) not null default 0.80,
  created_at timestamptz not null default now(),
  primary key (article_id, topic_id)
);

create table if not exists public.intelligence_updates (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  primary_topic_id uuid not null references public.topics(id) on delete restrict,
  previous_update_id uuid references public.intelligence_updates(id) on delete set null,
  headline text not null,
  what_happened text not null,
  what_is_new text not null,
  what_changed text not null,
  why_it_matters text not null,
  who_is_affected text[] not null default '{}',
  what_to_watch text not null,
  connected_insight text,
  impact_level text not null default 'high' check (impact_level in ('critical', 'high', 'medium', 'watch')),
  verification_status text not null default 'verified' check (
    verification_status in ('verified', 'multi_source_confirmed', 'developing', 'disputed')
  ),
  confidence_score numeric(3,2) not null default 0.90 check (confidence_score between 0.00 and 1.00),
  ai_model text not null,
  prompt_version text not null default 'v1.0',
  generated_at timestamptz not null default now(),
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.update_sources (
  id uuid primary key default gen_random_uuid(),
  update_id uuid not null references public.intelligence_updates(id) on delete cascade,
  article_id uuid not null references public.articles(id) on delete restrict,
  citation_role text not null default 'primary' check (citation_role in ('primary', 'corroborating', 'historical_baseline')),
  supporting_quote text,
  created_at timestamptz not null default now(),
  unique (update_id, article_id)
);

create table if not exists public.daily_briefings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  briefing_type text not null default 'daily' check (briefing_type in ('daily', 'weekly', 'topic', 'custom')),
  briefing_date date not null,
  timezone text not null,
  overview_summary text not null,
  top_story_ids uuid[] not null default '{}',
  what_changed_summary jsonb not null default '[]'::jsonb,
  why_it_matters_summary text not null,
  connected_insights jsonb not null default '[]'::jsonb,
  what_to_watch jsonb not null default '[]'::jsonb,
  ai_model text not null,
  verification_status text not null default 'verified' check (verification_status in ('verified', 'no_new_changes')),
  read_at timestamptz,
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, briefing_type, briefing_date)
);

create table if not exists public.research_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  topic_id uuid references public.topics(id) on delete set null,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.research_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.research_sessions(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  verified_facts jsonb not null default '[]'::jsonb,
  analytical_interpretation text,
  uncertainty_notes text,
  citations jsonb not null default '[]'::jsonb,
  search_provider text check (search_provider in ('tavily', 'exa', 'cached')),
  ai_model text,
  token_usage integer,
  created_at timestamptz not null default now()
);

create table if not exists public.saved_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  item_type text not null check (item_type in ('intelligence_update', 'article', 'briefing', 'research_session')),
  update_id uuid references public.intelligence_updates(id) on delete cascade,
  article_id uuid references public.articles(id) on delete cascade,
  briefing_id uuid references public.daily_briefings(id) on delete cascade,
  research_session_id uuid references public.research_sessions(id) on delete cascade,
  user_note text,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  update_id uuid references public.intelligence_updates(id) on delete cascade,
  research_message_id uuid references public.research_messages(id) on delete cascade,
  signal text not null check (signal in ('more_like_this', 'less_like_this', 'inaccurate', 'high_signal')),
  comment text,
  created_at timestamptz not null default now()
);

create table if not exists public.notification_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  email_daily_briefing boolean not null default true,
  email_weekly_digest boolean not null default true,
  telegram_enabled boolean not null default false,
  telegram_chat_id text,
  delivery_hour smallint not null default 7 check (delivery_hour between 0 and 23),
  critical_alerts_only boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.background_jobs (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique,
  job_type text not null check (
    job_type in ('discovery', 'collection', 'deduplication', 'ai_analysis', 'daily_briefing', 'cleanup')
  ),
  status text not null default 'queued' check (status in ('queued', 'running', 'completed', 'failed')),
  attempt_count smallint not null default 0,
  error_message text,
  metrics jsonb not null default '{}'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_topics_category on public.topics(category);
create index if not exists idx_user_interests_user on public.user_interests(user_id);
create index if not exists idx_articles_published_at on public.articles(published_at desc);
create index if not exists idx_articles_canonical_hash on public.articles(canonical_hash);
create index if not exists idx_articles_event_cluster on public.articles(event_cluster_id);
create index if not exists idx_updates_topic_published on public.intelligence_updates(primary_topic_id, published_at desc);
create index if not exists idx_updates_verification on public.intelligence_updates(verification_status, published_at desc);
create index if not exists idx_briefings_user_date on public.daily_briefings(user_id, briefing_date desc);
create index if not exists idx_research_sessions_user on public.research_sessions(user_id, updated_at desc);
create index if not exists idx_research_messages_session on public.research_messages(session_id, created_at asc);
create index if not exists idx_saved_items_user on public.saved_items(user_id, created_at desc);

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'profiles', 'topics', 'entities', 'user_interests', 'sources',
    'articles', 'intelligence_updates', 'daily_briefings',
    'research_sessions', 'saved_items', 'notification_preferences', 'background_jobs'
  ]
  loop
    execute format('drop trigger if exists trg_%I_updated_at on public.%I;', tbl, tbl);
    execute format(
      'create trigger trg_%I_updated_at before update on public.%I for each row execute function public.set_updated_at();',
      tbl, tbl
    );
  end loop;
end $$;

alter table public.profiles enable row level security;
alter table public.topics enable row level security;
alter table public.entities enable row level security;
alter table public.user_interests enable row level security;
alter table public.sources enable row level security;
alter table public.articles enable row level security;
alter table public.article_topics enable row level security;
alter table public.intelligence_updates enable row level security;
alter table public.update_sources enable row level security;
alter table public.daily_briefings enable row level security;
alter table public.research_sessions enable row level security;
alter table public.research_messages enable row level security;
alter table public.saved_items enable row level security;
alter table public.feedback enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.background_jobs enable row level security;

create policy "Public read topics" on public.topics for select using (true);
create policy "Public read entities" on public.entities for select using (true);
create policy "Public read sources" on public.sources for select using (true);
create policy "Public read articles" on public.articles for select using (true);
create policy "Public read article_topics" on public.article_topics for select using (true);
create policy "Public read intelligence_updates" on public.intelligence_updates for select using (true);
create policy "Public read update_sources" on public.update_sources for select using (true);

create policy "Users manage own profile" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "Users manage own interests" on public.user_interests
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users read own briefings" on public.daily_briefings
  for select using (auth.uid() = user_id);
create policy "Users update own briefing read status" on public.daily_briefings
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage own research sessions" on public.research_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users access own research messages" on public.research_messages
  for all using (
    exists (select 1 from public.research_sessions s where s.id = research_messages.session_id and s.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.research_sessions s where s.id = research_messages.session_id and s.user_id = auth.uid())
  );
create policy "Users manage own saved items" on public.saved_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage own feedback" on public.feedback
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage own notification preferences" on public.notification_preferences
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
