-- Core schema, column ownership and protected write RPCs (docs/signal-sources.md §DB).

-- vcs: mixed ownership. Comments mark who owns each column.
create table if not exists public.vcs (
  id uuid primary key default gen_random_uuid(),
  -- Vikram-owned (system NEVER writes these)
  name text not null,
  firm text not null,
  thesis text,
  status text check (status in ('waiting_for_response','yet_to_reach_out')),
  last_contact_date date,
  contact_history text,
  personal_notes text,
  -- System-owned signal columns (written ONLY via update_vc_signals)
  last_signal_date date,
  signal_summary text,
  follow_up_score int check (follow_up_score between 0 and 100),
  recommended_action text,
  -- System-owned identifiers (set by scripts/seed-vcs.ts via update_vc_identifiers)
  linkedin_url text,
  x_user_id text,
  bluesky_handle text,
  youtube_channel_id text,
  rss_url text,
  portfolio_url text,
  team_url text,
  sec_cik text,
  updated_by_system_at timestamptz
);

create table if not exists public.signals (
  id bigserial primary key,
  vc_id uuid references public.vcs(id) on delete cascade,
  signal_type text not null,
  summary text not null,
  source_url text not null,
  source_name text not null,
  source_tier text not null check (source_tier in ('A','B','C','D')),
  published_date date not null,
  evidence_quote text,
  company_name text,
  round_stage text,
  sector_fit text,
  customer_type text,
  offering_type text,
  logistics_relevance text not null,   -- derived in lib/score.ts
  confidence numeric not null,
  created_at timestamptz default now(),
  unique (vc_id, source_url)
);
create index if not exists signals_vc_published on public.signals (vc_id, published_date desc);

create table if not exists public.portfolio_snapshots (
  id bigserial primary key,
  vc_id uuid references public.vcs(id) on delete cascade,
  kind text not null check (kind in ('portfolio','team')),
  entries jsonb not null,
  entries_hash text not null,
  captured_at timestamptz default now()
);
create index if not exists portfolio_snapshots_vc_kind on public.portfolio_snapshots (vc_id, kind, captured_at desc);

create table if not exists public.pipeline_runs (
  id bigserial primary key,
  started_at timestamptz default now(),
  finished_at timestamptz,
  trigger text,
  vcs_processed int default 0,
  errors jsonb default '[]'::jsonb,
  usage jsonb default '{}'::jsonb
);

create table if not exists public.vc_profiles (
  vc_id uuid primary key references public.vcs(id) on delete cascade,
  does_seed text check (does_seed in ('leads_seed','participates_seed','series_a_plus_only','unknown')),
  b2b_logistics_thesis text check (b2b_logistics_thesis in ('core','explicit','portfolio_only','none')),
  investor_type text check (investor_type in ('seed_fund','multi_stage','cvc_strategic','angel_syndicate','accelerator')),
  typical_check text,
  geo_focus text,
  evidence_urls text[],
  profiled_at timestamptz default now()
);

create table if not exists public.suggested_vcs (
  id bigserial primary key,
  firm text not null,
  partner_name text,
  reason text,
  evidence_urls text[],
  created_at timestamptz default now(),
  unique (firm, partner_name)
);

-- Dedicated low-privilege role that owns the write functions
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'pipeline_writer') then
    create role pipeline_writer nologin;
  end if;
end $$;
grant pipeline_writer to postgres;
grant usage on schema public to pipeline_writer;
grant select (id) on public.vcs to pipeline_writer;
grant update (last_signal_date, signal_summary, follow_up_score,
              recommended_action, updated_by_system_at,
              linkedin_url, x_user_id, bluesky_handle, youtube_channel_id,
              rss_url, portfolio_url, team_url, sec_cik)
  on public.vcs to pipeline_writer;

create or replace function public.update_vc_signals(
  p_id uuid,
  p_last_signal_date date,
  p_signal_summary text,
  p_follow_up_score int,
  p_recommended_action text
) returns void
language sql
security definer
set search_path = public
as $$
  update public.vcs set
    last_signal_date     = coalesce(p_last_signal_date, last_signal_date), -- keep old date if no new signal
    signal_summary       = p_signal_summary,
    follow_up_score      = p_follow_up_score,
    recommended_action   = p_recommended_action,
    updated_by_system_at = now()
  where id = p_id;
$$;

-- Same pattern for identifiers; null leaves the existing value in place.
create or replace function public.update_vc_identifiers(
  p_id uuid,
  p_linkedin_url text default null,
  p_x_user_id text default null,
  p_bluesky_handle text default null,
  p_youtube_channel_id text default null,
  p_rss_url text default null,
  p_portfolio_url text default null,
  p_team_url text default null,
  p_sec_cik text default null
) returns void
language sql
security definer
set search_path = public
as $$
  update public.vcs set
    linkedin_url         = coalesce(p_linkedin_url, linkedin_url),
    x_user_id            = coalesce(p_x_user_id, x_user_id),
    bluesky_handle       = coalesce(p_bluesky_handle, bluesky_handle),
    youtube_channel_id   = coalesce(p_youtube_channel_id, youtube_channel_id),
    rss_url              = coalesce(p_rss_url, rss_url),
    portfolio_url        = coalesce(p_portfolio_url, portfolio_url),
    team_url             = coalesce(p_team_url, team_url),
    sec_cik              = coalesce(p_sec_cik, sec_cik),
    updated_by_system_at = now()
  where id = p_id;
$$;

-- Postgres requires the new owner to hold CREATE on the schema to take ownership.
-- Grant it only for the transfer, then take it back so the role stays update-only.
grant create on schema public to pipeline_writer;
alter function public.update_vc_signals(uuid, date, text, int, text) owner to pipeline_writer;
alter function public.update_vc_identifiers(uuid, text, text, text, text, text, text, text, text) owner to pipeline_writer;
revoke create on schema public from pipeline_writer;

revoke all on function public.update_vc_signals(uuid, date, text, int, text) from public, anon, authenticated;
grant execute on function public.update_vc_signals(uuid, date, text, int, text) to service_role;
revoke all on function public.update_vc_identifiers(uuid, text, text, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.update_vc_identifiers(uuid, text, text, text, text, text, text, text, text) to service_role;
