-- Rollback for db/migrations/0008_data_ownership.sql. Run as the owner:
--   psql "$DATABASE_URL_UNPOOLED" -f db/rollback/0008_data_ownership.sql
-- then: delete from schema_migrations where name = '0008_data_ownership.sql';

do $$
declare t text;
begin
  foreach t in array array['vcs','signals','vc_profiles','pipeline_runs','vc_score_history','suggested_vcs',
                           'vc_contacts','vc_channels','vc_messages','portfolio_snapshots'] loop
    execute format('drop policy if exists read_all on public.%I', t);
    execute format('drop policy if exists scan_insert on public.%I', t);
    execute format('drop policy if exists scan_update on public.%I', t);
    execute format('drop policy if exists scan_delete on public.%I', t);
  end loop;
  foreach t in array array['vcs','signals','vc_profiles','pipeline_runs','vc_score_history','suggested_vcs',
                           'vc_contacts','vc_channels','vc_messages','portfolio_snapshots','schema_migrations'] loop
    execute format('alter table public.%I disable row level security', t);
  end loop;
end $$;
drop policy if exists writer_update on public.vcs;
drop policy if exists seeder_insert on public.vcs;

alter view public.v_dashboard_vcs set (security_invoker = false);
alter view public.v_signal_feed   set (security_invoker = false);
alter view public.v_last_run      set (security_invoker = false);
alter view public.v_top_signal    set (security_invoker = false);
alter view public.v_vc_sources    set (security_invoker = false);
alter view public.v_signal_tape   set (security_invoker = false);
alter view public.v_score_changes set (security_invoker = false);

grant insert on public.vcs to vc_runtime;
drop function if exists public.seed_new_vcs(jsonb);

drop trigger if exists vcs_guard_user_columns on public.vcs;
drop function if exists public.guard_vcs_user_columns();
-- vc_web and vc_seeder roles are left in place (harmless without grants).
