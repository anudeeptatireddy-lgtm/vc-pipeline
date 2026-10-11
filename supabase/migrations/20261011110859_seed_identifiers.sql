-- Columns the seed script needs (docs/vc-list.md): a stable key for idempotent
-- re-runs, the verified website, and partner confidence. All system-owned.
alter table public.vcs
  add column if not exists seed_key text unique,
  add column if not exists website text,
  add column if not exists partner_confidence text check (partner_confidence in ('high','low'));

grant select (seed_key, website, partner_name, partner_confidence, priority, region, needs_review)
  on public.vcs to pipeline_writer;
grant update (website, partner_name, partner_confidence, priority, region, needs_review)
  on public.vcs to pipeline_writer;

-- Replace update_vc_identifiers with a version that also covers the seed columns.
drop function if exists public.update_vc_identifiers(uuid, text, text, text, text, text, text, text, text);

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

grant create on schema public to pipeline_writer;
alter function public.update_vc_identifiers(uuid, text, text, text, text, text, text, text, text, text, text, text, text, text, boolean)
  owner to pipeline_writer;
revoke create on schema public from pipeline_writer;

revoke all on function public.update_vc_identifiers(uuid, text, text, text, text, text, text, text, text, text, text, text, text, text, boolean)
  from public, anon, authenticated;
grant execute on function public.update_vc_identifiers(uuid, text, text, text, text, text, text, text, text, text, text, text, text, text, boolean)
  to service_role;
