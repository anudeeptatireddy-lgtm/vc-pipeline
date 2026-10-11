-- Read model (docs/components-map.md §3.6).

alter table public.vcs
  add column if not exists partner_name text,
  add column if not exists priority text,
  add column if not exists region text,
  add column if not exists needs_review boolean default false;

alter table public.signals add column if not exists corroborated_by text;

alter table public.vcs enable row level security;
alter table public.signals enable row level security;
alter table public.vc_profiles enable row level security;
alter table public.portfolio_snapshots enable row level security;
alter table public.pipeline_runs enable row level security;
alter table public.suggested_vcs enable row level security;
-- No anon/authenticated policies: only the server (service role) reads or writes.

-- Views use security_invoker so they respect RLS; without it a view runs as its
-- owner and would expose personal_notes to the anon key through PostgREST.
create or replace view public.v_dashboard_vcs with (security_invoker = true) as
select v.id, v.name, v.partner_name, v.firm, v.priority, v.region,
       v.status, v.last_contact_date, v.contact_history, v.personal_notes,
       v.last_signal_date, v.signal_summary, v.follow_up_score,
       v.recommended_action, v.updated_by_system_at,
       p.does_seed, p.b2b_logistics_thesis, p.investor_type, p.typical_check, p.geo_focus,
       (select count(*) from public.signals s
         where s.vc_id = v.id and s.published_date >= current_date - 30) as signals_30d
from public.vcs v
left join public.vc_profiles p on p.vc_id = v.id;

create or replace view public.v_signal_feed with (security_invoker = true) as
select s.id, s.vc_id, v.firm, s.signal_type, s.summary, s.source_url, s.source_name,
       s.source_tier, s.published_date, s.evidence_quote, s.company_name,
       s.round_stage, s.sector_fit, s.customer_type, s.offering_type,
       s.logistics_relevance, s.confidence, s.corroborated_by
from public.signals s join public.vcs v on v.id = s.vc_id;

create or replace view public.v_last_run with (security_invoker = true) as
select * from public.pipeline_runs
order by started_at desc limit 1;

revoke all on public.v_dashboard_vcs, public.v_signal_feed, public.v_last_run from anon, authenticated;
