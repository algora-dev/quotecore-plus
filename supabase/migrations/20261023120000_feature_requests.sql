-- Feature requests captured by the /feature-request ad landing page (2026-10-23).
-- Rows are written only by the /api/feature-request route using the service
-- role key. RLS is on with no anon/authenticated policies so the public can
-- never read or write the table directly.
create table if not exists public.feature_requests (
  id uuid primary key default gen_random_uuid(),
  current_software text not null,
  wish text not null,
  email text not null,
  email_source text not null default 'manual' check (email_source in ('manual', 'google')),
  source text not null default 'feature-request-page',
  created_at timestamptz not null default now()
);

alter table public.feature_requests enable row level security;

-- Optional convenience for the team: newest first.
create index if not exists feature_requests_created_at_idx
  on public.feature_requests (created_at desc);
