-- Archive instead of delete (rubric swap, 11 Oct 2026). Archived rows keep
-- Vikram's notes and all history, are excluded from runs and the dashboard,
-- and can be un-archived. System-owned; written only via update_vc_identifiers.

alter table public.vcs
  add column if not exists archived boolean not null default false,
  add column if not exists archived_reason text,
  add column if not exists archived_at timestamptz;

grant select (archived, archived_reason, archived_at) on public.vcs to pipeline_writer;
grant update (archived, archived_reason, archived_at) on public.vcs to pipeline_writer;

drop function if exists public.update_vc_identifiers(uuid, text, text, text, text, text, text, text, text, text, text, text, text, text, boolean);

create function public.update_vc_identifiers(
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
  p_needs_review boolean default null,
  p_archived boolean default null,
  p_archived_reason text default null
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
    archived             = coalesce(p_archived, archived),
    -- Un-archiving clears the reason and timestamp; archiving sets them.
    archived_reason      = case when p_archived is null then archived_reason
                                when p_archived then coalesce(p_archived_reason, archived_reason)
                                else null end,
    archived_at          = case when p_archived is null then archived_at
                                when p_archived then coalesce(archived_at, now())
                                else null end,
    updated_by_system_at = now()
  where id = p_id;
$$;

grant create on schema public to pipeline_writer;
alter function public.update_vc_identifiers(uuid, text, text, text, text, text, text, text, text, text, text, text, text, text, boolean, boolean, text)
  owner to pipeline_writer;
revoke create on schema public from pipeline_writer;
revoke all on function public.update_vc_identifiers(uuid, text, text, text, text, text, text, text, text, text, text, text, text, text, boolean, boolean, text) from public;
grant execute on function public.update_vc_identifiers(uuid, text, text, text, text, text, text, text, text, text, text, text, text, text, boolean, boolean, text) to vc_runtime;

-- Dashboard read model shows active rows only.
create or replace view public.v_dashboard_vcs as
select v.id, v.name, v.partner_name, v.firm, v.priority, v.region,
       v.status, v.last_contact_date, v.contact_history, v.personal_notes,
       v.last_signal_date, v.signal_summary, v.follow_up_score,
       v.recommended_action, v.updated_by_system_at,
       p.does_seed, p.b2b_logistics_thesis, p.investor_type, p.typical_check, p.geo_focus,
       (select count(*) from public.signals s
         where s.vc_id = v.id and s.published_date >= current_date - 30) as signals_30d
from public.vcs v
left join public.vc_profiles p on p.vc_id = v.id
where not v.archived;
grant select on public.v_dashboard_vcs to vc_runtime;
