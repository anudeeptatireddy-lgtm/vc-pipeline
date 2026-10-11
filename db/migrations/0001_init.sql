-- Neon schema (port of supabase/migrations/*, docs/signal-sources.md §DB).
-- Run as the owner (DATABASE_URL_UNPOOLED) by scripts/migrate.ts.
--
-- Roles:
--   neondb_owner     owns tables; migrations only, never used by the app.
--   pipeline_writer  NOLOGIN; owns the two security-definer write functions and
--                    has column-level UPDATE on system columns only.
--   vc_app           the app's runtime login (APP_DATABASE_URL). Reads
--                    everything, writes system tables, can INSERT new vcs rows
--                    for seeding, and can NOT update or delete vcs: every change
--                    to vcs goes through the two functions.

-- ---------- tables ----------

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
  -- System-owned identifiers (written ONLY via update_vc_identifiers)
  linkedin_url text,
  x_user_id text,
  bluesky_handle text,
  youtube_channel_id text,
  rss_url text,
  portfolio_url text,
  team_url text,
  sec_cik text,
  partner_name text,
  priority text,
  region text,
  needs_review boolean default false,
  seed_key text unique,
  website text,
  partner_confidence text check (partner_confidence in ('high','low')),
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
  logistics_relevance text not null,
  confidence numeric not null,
  corroborated_by text,
  opening_line text,
  nudge_line text,
  signal_value numeric,
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

create table if not exists public.vc_score_history (
  id bigserial primary key,
  vc_id uuid not null references public.vcs(id) on delete cascade,
  run_id bigint references public.pipeline_runs(id),
  follow_up_score int not null,
  recommended_action text not null,
  created_at timestamptz default now()
);
create index if not exists vc_score_history_vc_created on public.vc_score_history (vc_id, created_at desc);

-- ---------- protected writes ----------

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'pipeline_writer') then
    create role pipeline_writer nologin;
  end if;
end $$;
grant pipeline_writer to current_user;
grant usage on schema public to pipeline_writer;
-- coalesce(new, old) reads the current value, so SELECT on the same columns.
grant select (id, last_signal_date, linkedin_url, x_user_id, bluesky_handle, youtube_channel_id,
              rss_url, portfolio_url, team_url, sec_cik, website, partner_name, partner_confidence,
              priority, region, needs_review)
  on public.vcs to pipeline_writer;
grant update (last_signal_date, signal_summary, follow_up_score, recommended_action, updated_by_system_at,
              linkedin_url, x_user_id, bluesky_handle, youtube_channel_id, rss_url, portfolio_url, team_url,
              sec_cik, website, partner_name, partner_confidence, priority, region, needs_review)
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

create or replace function public.update_vc_identifiers(
  p_id uuid,
  p_linkedin_url text default null,
  p_x_user_id text default null,
  p_bluesky_handle text default null,
  p_youtube_channel_id text default null,
  p_rss_url text default null,
  p_portfolio_url text default null,
  p_team_url text default null,
  p_sec_cik text default null,
  p_website text default null,
  p_partner_name text default null,
  p_partner_confidence text default null,
  p_priority text default null,
  p_region text default null,
  p_needs_review boolean default null
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
    website              = coalesce(p_website, website),
    partner_name         = coalesce(p_partner_name, partner_name),
    partner_confidence   = coalesce(p_partner_confidence, partner_confidence),
    priority             = coalesce(p_priority, priority),
    region               = coalesce(p_region, region),
    needs_review         = coalesce(p_needs_review, needs_review),
    updated_by_system_at = now()
  where id = p_id;
$$;

-- The new owner needs CREATE on the schema to take ownership; grant it only for the transfer.
grant create on schema public to pipeline_writer;
alter function public.update_vc_signals(uuid, date, text, int, text) owner to pipeline_writer;
alter function public.update_vc_identifiers(uuid, text, text, text, text, text, text, text, text, text, text, text, text, text, boolean)
  owner to pipeline_writer;
revoke create on schema public from pipeline_writer;
revoke all on function public.update_vc_signals(uuid, date, text, int, text) from public;
revoke all on function public.update_vc_identifiers(uuid, text, text, text, text, text, text, text, text, text, text, text, text, text, boolean) from public;

-- ---------- read model (docs/components-map.md §3.6, docs/dashboard-design.md §6) ----------

create or replace view public.v_dashboard_vcs as
select v.id, v.name, v.partner_name, v.firm, v.priority, v.region,
       v.status, v.last_contact_date, v.contact_history, v.personal_notes,
       v.last_signal_date, v.signal_summary, v.follow_up_score,
       v.recommended_action, v.updated_by_system_at,
       p.does_seed, p.b2b_logistics_thesis, p.investor_type, p.typical_check, p.geo_focus,
       (select count(*) from public.signals s
         where s.vc_id = v.id and s.published_date >= current_date - 30) as signals_30d
from public.vcs v
left join public.vc_profiles p on p.vc_id = v.id;

create or replace view public.v_signal_feed as
select s.id, s.vc_id, v.firm, s.signal_type, s.summary, s.source_url, s.source_name,
       s.source_tier, s.published_date, s.evidence_quote, s.company_name,
       s.round_stage, s.sector_fit, s.customer_type, s.offering_type,
       s.logistics_relevance, s.confidence, s.corroborated_by
from public.signals s join public.vcs v on v.id = s.vc_id;

create or replace view public.v_last_run as
select * from public.pipeline_runs order by started_at desc limit 1;

create or replace view public.v_top_signal as
select distinct on (s.vc_id)
  s.vc_id, s.id as signal_id, s.summary, s.published_date, s.source_url, s.source_name,
  s.source_tier, s.evidence_quote, s.sector_fit, s.customer_type, s.offering_type,
  s.round_stage, s.logistics_relevance, s.corroborated_by, s.opening_line, s.nudge_line
from public.signals s
where s.published_date >= current_date - 30
order by s.vc_id, s.signal_value desc nulls last, s.published_date desc;

create or replace view public.v_vc_sources as
select s.vc_id, s.source_name, s.source_url, s.source_tier, s.published_date
from public.signals s
where s.published_date >= current_date - 30;

create or replace view public.v_signal_tape as
select s.vc_id, (current_date - s.published_date) as days_ago
from public.signals s
where s.published_date >= current_date - 30;

create or replace view public.v_score_changes as
with ranked as (
  select vc_id, follow_up_score, recommended_action, created_at,
         row_number() over (partition by vc_id order by created_at desc) as rn
  from public.vc_score_history
)
select cur.vc_id,
       cur.follow_up_score as score_now,
       prev.follow_up_score as score_before,
       cur.follow_up_score - coalesce(prev.follow_up_score, cur.follow_up_score) as delta,
       cur.recommended_action as action_now,
       prev.recommended_action as action_before
from ranked cur
left join ranked prev on prev.vc_id = cur.vc_id and prev.rn = 2
where cur.rn = 1;

-- ---------- app runtime grants ----------

do $$ begin
  if exists (select 1 from pg_roles where rolname = 'vc_app') then
    execute 'grant usage on schema public to vc_app';
    execute 'grant select on all tables in schema public to vc_app';
    execute 'grant insert on public.vcs to vc_app';  -- new rows only (seed); no update/delete
    execute 'grant select, insert, update on public.signals, public.portfolio_snapshots, public.pipeline_runs,
             public.vc_profiles, public.suggested_vcs, public.vc_score_history to vc_app';
    execute 'grant usage, select on all sequences in schema public to vc_app';
    execute 'grant execute on function public.update_vc_signals(uuid, date, text, int, text) to vc_app';
    execute 'grant execute on function public.update_vc_identifiers(uuid, text, text, text, text, text, text, text, text, text, text, text, text, text, boolean) to vc_app';
  end if;
end $$;
