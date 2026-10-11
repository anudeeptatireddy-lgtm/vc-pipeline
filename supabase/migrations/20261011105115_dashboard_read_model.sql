-- Dashboard read model (docs/dashboard-design.md §6). Adds to 20261011105102_read_model.sql.

-- Words Vikram can copy. Live in signals, never in vcs.
alter table public.signals
  add column if not exists opening_line text,
  add column if not exists nudge_line text,
  add column if not exists signal_value numeric;

-- Score history for "since last run" changes. System-owned, written by the pipeline.
create table if not exists public.vc_score_history (
  id bigserial primary key,
  vc_id uuid not null references public.vcs(id) on delete cascade,
  run_id bigint references public.pipeline_runs(id),
  follow_up_score int not null,
  recommended_action text not null,
  created_at timestamptz default now()
);
alter table public.vc_score_history enable row level security;
create index if not exists vc_score_history_vc_created on public.vc_score_history (vc_id, created_at desc);

-- Best signal per VC (drives the why-now sentence, chips, copy lines).
create or replace view public.v_top_signal with (security_invoker = true) as
select distinct on (s.vc_id)
  s.vc_id, s.id as signal_id, s.summary, s.published_date, s.source_url, s.source_name,
  s.source_tier, s.evidence_quote, s.sector_fit, s.customer_type, s.offering_type,
  s.round_stage, s.logistics_relevance, s.corroborated_by, s.opening_line, s.nudge_line
from public.signals s
where s.published_date >= current_date - 30
order by s.vc_id, s.signal_value desc nulls last, s.published_date desc;

-- Source links per VC (all evidence in the window, for chips).
create or replace view public.v_vc_sources with (security_invoker = true) as
select s.vc_id, s.source_name, s.source_url, s.source_tier, s.published_date
from public.signals s
where s.published_date >= current_date - 30;

-- Tape: days-ago for every signal in the window.
create or replace view public.v_signal_tape with (security_invoker = true) as
select s.vc_id, (current_date - s.published_date) as days_ago
from public.signals s
where s.published_date >= current_date - 30;

-- Change since the previous run.
create or replace view public.v_score_changes with (security_invoker = true) as
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

revoke all on public.v_top_signal, public.v_vc_sources, public.v_signal_tape, public.v_score_changes
  from anon, authenticated;
