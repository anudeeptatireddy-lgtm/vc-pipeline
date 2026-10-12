-- Data ownership (docs/BRIEF.md requirement 4; docs/INVESTIGATION.md §1-3).
-- Vikram's columns on vcs get two independent locks:
--   1. column grants (0001): no login role can UPDATE them; pipeline_writer, which
--      owns the two security-definer write functions, holds UPDATE on system
--      columns only;
--   2. this trigger: any UPDATE that changes a user-owned column, or any DELETE,
--      is rejected unless it comes from the owner (migrations / manual admin),
--      even if a grant is added by mistake later.
-- Plus: the scan role loses INSERT on vcs (seeding goes through seed_new_vcs),
-- a read-only role for the dashboard (vc_web), RLS on every table, and views
-- that evaluate permissions as the caller.
--
-- User-owned columns (keep in sync with lib/ownership.ts USER_OWNED_VCS_COLUMNS;
-- tests/ownership.int.test.ts checks this): name, firm, thesis, status,
-- last_contact_date, contact_history, personal_notes.
--
-- vc_web must exist first (created with a password outside migrations, like vc_runtime).

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'vc_web') then
    raise exception 'create role vc_web login password ... first';
  end if;
end $$;

-- ---------- 1. Trigger: user-owned columns are owner-only ----------

create or replace function public.guard_vcs_user_columns() returns trigger
language plpgsql as $$
begin
  if current_user = 'neondb_owner' then
    return coalesce(new, old);
  end if;
  if tg_op = 'DELETE' then
    raise exception 'vcs rows cannot be deleted by %', current_user using errcode = '42501';
  end if;
  if new.name              is distinct from old.name
  or new.firm              is distinct from old.firm
  or new.thesis            is distinct from old.thesis
  or new.status            is distinct from old.status
  or new.last_contact_date is distinct from old.last_contact_date
  or new.contact_history   is distinct from old.contact_history
  or new.personal_notes    is distinct from old.personal_notes then
    raise exception 'vcs user-owned columns are read-only for %', current_user using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists vcs_guard_user_columns on public.vcs;
create trigger vcs_guard_user_columns
  before update or delete on public.vcs
  for each row execute function public.guard_vcs_user_columns();

-- ---------- 2. Seeding without INSERT on vcs for the scan role ----------

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'vc_seeder') then
    create role vc_seeder nologin;
  end if;
end $$;
grant vc_seeder to current_user;
grant usage on schema public to vc_seeder;
grant select (seed_key), insert on public.vcs to vc_seeder;

create or replace function public.seed_new_vcs(p_rows jsonb) returns int
language sql
security definer
set search_path = public
as $$
  with ins as (
    insert into public.vcs (seed_key, name, firm, thesis, status, last_contact_date, contact_history, personal_notes)
    select seed_key, name, firm, thesis, status, last_contact_date, contact_history, personal_notes
    from jsonb_populate_recordset(null::public.vcs, p_rows)
    on conflict (seed_key) do nothing
    returning 1
  )
  select count(*)::int from ins;
$$;

grant create on schema public to vc_seeder;
alter function public.seed_new_vcs(jsonb) owner to vc_seeder;
revoke create on schema public from vc_seeder;
revoke all on function public.seed_new_vcs(jsonb) from public;
grant execute on function public.seed_new_vcs(jsonb) to vc_runtime;
revoke insert on public.vcs from vc_runtime;

-- ---------- 3. Read-only dashboard role ----------

grant usage on schema public to vc_web;
grant select on public.vcs, public.signals, public.vc_profiles, public.pipeline_runs, public.vc_score_history,
  public.suggested_vcs, public.vc_contacts, public.vc_channels, public.vc_messages, public.portfolio_snapshots to vc_web;
grant select on public.v_dashboard_vcs, public.v_signal_feed, public.v_last_run, public.v_top_signal,
  public.v_vc_sources, public.v_signal_tape, public.v_score_changes to vc_web;

-- Views are owned by neondb_owner, which bypasses RLS; make them check the caller instead.
alter view public.v_dashboard_vcs set (security_invoker = true);
alter view public.v_signal_feed   set (security_invoker = true);
alter view public.v_last_run      set (security_invoker = true);
alter view public.v_top_signal    set (security_invoker = true);
alter view public.v_vc_sources    set (security_invoker = true);
alter view public.v_signal_tape   set (security_invoker = true);
alter view public.v_score_changes set (security_invoker = true);

-- ---------- 4. RLS on every table ----------
-- Single founder, no login: policies limit which ROLE may do what, not which rows.
-- Per-user rows need authentication (docs/AUDIT.md F7), out of scope here.

do $$
declare t text;
begin
  foreach t in array array['vcs','signals','vc_profiles','pipeline_runs','vc_score_history','suggested_vcs',
                           'vc_contacts','vc_channels','vc_messages','portfolio_snapshots','schema_migrations'] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;

  foreach t in array array['vcs','signals','vc_profiles','pipeline_runs','vc_score_history','suggested_vcs',
                           'vc_contacts','vc_channels','vc_messages','portfolio_snapshots'] loop
    execute format('drop policy if exists read_all on public.%I', t);
    execute format('create policy read_all on public.%I for select to vc_runtime, vc_web, pipeline_writer, vc_seeder using (true)', t);
  end loop;

  foreach t in array array['signals','vc_profiles','pipeline_runs','vc_score_history','suggested_vcs',
                           'vc_contacts','vc_channels','vc_messages','portfolio_snapshots'] loop
    execute format('drop policy if exists scan_insert on public.%I', t);
    execute format('drop policy if exists scan_update on public.%I', t);
    execute format('create policy scan_insert on public.%I for insert to vc_runtime with check (true)', t);
    execute format('create policy scan_update on public.%I for update to vc_runtime using (true) with check (true)', t);
  end loop;

  foreach t in array array['vc_contacts','vc_messages'] loop
    execute format('drop policy if exists scan_delete on public.%I', t);
    execute format('create policy scan_delete on public.%I for delete to vc_runtime using (true)', t);
  end loop;
end $$;

drop policy if exists writer_update on public.vcs;
create policy writer_update on public.vcs for update to pipeline_writer using (true) with check (true);
drop policy if exists seeder_insert on public.vcs;
create policy seeder_insert on public.vcs for insert to vc_seeder with check (true);
-- schema_migrations: no policies, so only the owner (bypassrls) can use it.
