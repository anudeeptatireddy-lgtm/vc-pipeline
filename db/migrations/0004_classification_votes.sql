-- Majority vote over Gemini's classifications of the same page across runs
-- (Gemini 3 has no temperature control). Keys are "sector|customer|offering|stage".
alter table public.signals add column if not exists classification_votes jsonb not null default '{}'::jsonb;
