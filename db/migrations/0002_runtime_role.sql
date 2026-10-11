-- The app's runtime login is vc_runtime, created in SQL by the owner so it is
-- NOT a member of neon_superuser. (Roles made through the Neon API/console,
-- like vc_app, join neon_superuser and inherit full table privileges, which
-- would let the app UPDATE/DELETE vcs directly. vc_app was deleted on 11 Oct 2026.)
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'vc_runtime') then
    raise exception 'create role vc_runtime first (it needs a password, so it is not created here)';
  end if;
end $$;

grant usage on schema public to vc_runtime;
grant select on all tables in schema public to vc_runtime;
grant insert on public.vcs to vc_runtime;  -- new rows only (seed); no update/delete
grant select, insert, update on public.signals, public.portfolio_snapshots, public.pipeline_runs,
  public.vc_profiles, public.suggested_vcs, public.vc_score_history to vc_runtime;
grant usage, select on all sequences in schema public to vc_runtime;
grant execute on function public.update_vc_signals(uuid, date, text, int, text) to vc_runtime;
grant execute on function public.update_vc_identifiers(uuid, text, text, text, text, text, text, text, text, text, text, text, text, text, boolean) to vc_runtime;
revoke all on public.schema_migrations from vc_runtime;
