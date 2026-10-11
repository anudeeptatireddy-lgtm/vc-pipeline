-- RLS is on for vcs, so the security-definer RPCs (owned by pipeline_writer)
-- need row policies or their UPDATE matches zero rows. Column grants still
-- limit the role to the system-owned columns.
create policy pipeline_writer_select on public.vcs
  for select to pipeline_writer using (true);
create policy pipeline_writer_update on public.vcs
  for update to pipeline_writer using (true) with check (true);
