-- Where a human can reach the firm when there is no pitch form or published
-- email: its contact page, or the page showing an email hidden from bots
-- (e.g. Cloudflare email protection, which we deliberately don't decode).
alter table public.vc_channels add column if not exists contact_url text;
alter table public.vc_channels add column if not exists email_hidden_from_bots boolean not null default false;
