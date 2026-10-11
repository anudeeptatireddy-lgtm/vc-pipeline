-- The RPCs' coalesce(new, old) reads the current value, which needs SELECT on
-- those columns. System-owned columns only; Vikram's stay unreadable to the role.
grant select (id, last_signal_date,
              linkedin_url, x_user_id, bluesky_handle, youtube_channel_id,
              rss_url, portfolio_url, team_url, sec_cik)
  on public.vcs to pipeline_writer;
