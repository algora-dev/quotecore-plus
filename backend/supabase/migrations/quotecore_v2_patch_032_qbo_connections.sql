-- QuickBooks Online OAuth connections (one row per company + QBO realm).
-- Service-role only, same pattern as xero_connections.
create table if not exists public.qbo_connections (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  realm_id text not null,
  company_name text,
  environment text not null default 'sandbox',
  access_token text not null,
  refresh_token text not null,
  access_expires_at timestamptz not null,
  refresh_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, realm_id)
);

alter table public.qbo_connections enable row level security;
revoke all on public.qbo_connections from anon, authenticated;
grant select, insert, update, delete on public.qbo_connections to service_role;

comment on table public.qbo_connections is 'QuickBooks Online OAuth2 token storage per company/realm. Service-role only - tokens must never be exposed to clients.';
