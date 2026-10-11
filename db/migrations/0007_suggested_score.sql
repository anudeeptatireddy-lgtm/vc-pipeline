-- Discover view: the rubric score each suggestion earned (lib/rubric.ts) and
-- copy written for the founder: what the investor did, and the one thing to
-- know before reaching out. Filled by scripts/suggest-from-lookup.ts.
alter table public.suggested_vcs add column if not exists rubric_score numeric;
alter table public.suggested_vcs add column if not exists deal_count int;
alter table public.suggested_vcs add column if not exists summary text;
alter table public.suggested_vcs add column if not exists caveat text;
