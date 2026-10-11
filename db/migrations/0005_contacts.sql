-- Who to contact at each firm, the firm's public contact routes, and drafted
-- messages. All system-owned and separate from vcs, so Vikram's columns are
-- never touched. Emails are only ones the firm itself publishes (never guessed).

create table if not exists public.vc_contacts (
  id bigserial primary key,
  vc_id uuid not null references public.vcs(id) on delete cascade,
  name text not null,
  title text,
  poc_level text not null check (poc_level in ('decision_maker','partner','principal','associate','other')),
  focus text,                    -- what they say they invest in (from the team page)
  bio text,                      -- <= 40 words, from the team page
  relevant boolean not null default false,  -- focus mentions B2B / logistics / supply chain / SaaS / mobility
  rank int not null,             -- 1 = best person to contact
  linkedin_url text,
  x_url text,
  email text,                    -- only if published on the firm's own pages
  email_source_url text,
  source_url text not null,      -- the page the person was found on
  updated_at timestamptz not null default now(),
  unique (vc_id, name)
);
create index if not exists vc_contacts_vc_rank on public.vc_contacts (vc_id, rank);

create table if not exists public.vc_channels (
  vc_id uuid primary key references public.vcs(id) on delete cascade,
  pitch_url text,                -- "submit your pitch" / apply form on the firm's site
  emails text[] not null default '{}',        -- published firm emails (pitch@, hello@ ...)
  email_sources text[] not null default '{}',
  x_url text,
  updated_at timestamptz not null default now()
);

create table if not exists public.vc_messages (
  id bigserial primary key,
  vc_id uuid not null references public.vcs(id) on delete cascade,
  contact_id bigint not null references public.vc_contacts(id) on delete cascade,
  signal_id bigint references public.signals(id) on delete set null,  -- the news it's built on
  kind text not null check (kind in ('email','linkedin_note','follow_up')),
  subject text,
  body text not null,
  created_at timestamptz not null default now(),
  unique (contact_id, kind)
);

grant select, insert, update, delete on public.vc_contacts, public.vc_channels, public.vc_messages to vc_runtime;
grant usage, select on public.vc_contacts_id_seq, public.vc_messages_id_seq to vc_runtime;
