-- Xero OAuth connections (one row per company + Xero tenant).
-- Service-role only: RLS enabled with NO policies means the anon/authenticated
-- roles get denied by default. All reads/writes go through the service client
-- inside API routes that authenticate the user first.
create table if not exists public.xero_connections (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  tenant_id text not null,
  tenant_name text not null,
  tenant_type text,
  access_token text not null,
  refresh_token text not null,
  access_expires_at timestamptz not null,
  token_type text not null default 'Bearer',
  scopes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, tenant_id)
);

alter table public.xero_connections enable row level security;

-- Column-level grants: service role only. No grants to anon/authenticated.
revoke all on public.xero_connections from anon, authenticated;
grant select, insert, update, delete on public.xero_connections to service_role;

comment on table public.xero_connections is 'Xero OAuth2 token storage per company/tenant. Service-role only - tokens must never be exposed to clients.';
