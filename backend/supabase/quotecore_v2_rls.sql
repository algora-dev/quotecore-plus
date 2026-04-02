-- QuoteCore+ v2 RLS Policies
-- Author: Gavin (dev agent)
-- Date: 2026-04-01
-- Run AFTER quotecore_v2_schema.sql

-- =========================
-- Helper functions
-- =========================
create or replace function public.current_user_id()
returns uuid language sql stable as $$
  select auth.uid()
$$;

create or replace function public.current_company_id()
returns uuid language sql stable as $$
  select u.company_id from public.users u where u.id = auth.uid() limit 1
$$;

create or replace function public.user_belongs_to_company(target_company_id uuid)
returns boolean language sql stable as $$
  select exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.company_id = target_company_id
  )
$$;

-- =========================
-- Auth trigger (create user profile on signup)
-- =========================
create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, email, full_name, role, company_id)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'role', 'owner'),
    (new.raw_user_meta_data ->> 'company_id')::uuid
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_quotecore on auth.users;
create trigger on_auth_user_created_quotecore
after insert on auth.users
for each row execute procedure public.handle_new_auth_user();

-- =========================
-- Enable RLS on all tables
-- =========================
alter table public.companies enable row level security;
alter table public.users enable row level security;
alter table public.component_library enable row level security;
alter table public.templates enable row level security;
alter table public.template_roof_areas enable row level security;
alter table public.template_components enable row level security;
alter table public.quotes enable row level security;
alter table public.quote_roof_areas enable row level security;
alter table public.quote_components enable row level security;

-- =========================
-- Companies
-- =========================
drop policy if exists "companies_select_own" on public.companies;
create policy "companies_select_own" on public.companies
  for select to authenticated
  using (public.user_belongs_to_company(id));

drop policy if exists "companies_update_own" on public.companies;
create policy "companies_update_own" on public.companies
  for update to authenticated
  using (public.user_belongs_to_company(id))
  with check (public.user_belongs_to_company(id));

-- =========================
-- Users
-- =========================
drop policy if exists "users_select_same_company" on public.users;
create policy "users_select_same_company" on public.users
  for select to authenticated
  using (company_id = public.current_company_id());

drop policy if exists "users_insert_self" on public.users;
create policy "users_insert_self" on public.users
  for insert to authenticated
  with check (id = auth.uid() and company_id = public.current_company_id());

drop policy if exists "users_update_same_company" on public.users;
create policy "users_update_same_company" on public.users
  for update to authenticated
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

-- =========================
-- Component Library
-- =========================
drop policy if exists "component_library_all_same_company" on public.component_library;
create policy "component_library_all_same_company" on public.component_library
  for all to authenticated
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

-- =========================
-- Templates
-- =========================
drop policy if exists "templates_all_same_company" on public.templates;
create policy "templates_all_same_company" on public.templates
  for all to authenticated
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

-- Template roof areas: access via template ownership
drop policy if exists "template_roof_areas_all" on public.template_roof_areas;
create policy "template_roof_areas_all" on public.template_roof_areas
  for all to authenticated
  using (
    exists (
      select 1 from public.templates t
      where t.id = template_id and t.company_id = public.current_company_id()
    )
  )
  with check (
    exists (
      select 1 from public.templates t
      where t.id = template_id and t.company_id = public.current_company_id()
    )
  );

-- Template components: access via template ownership
drop policy if exists "template_components_all" on public.template_components;
create policy "template_components_all" on public.template_components
  for all to authenticated
  using (
    exists (
      select 1 from public.templates t
      where t.id = template_id and t.company_id = public.current_company_id()
    )
  )
  with check (
    exists (
      select 1 from public.templates t
      where t.id = template_id and t.company_id = public.current_company_id()
    )
  );

-- =========================
-- Quotes
-- =========================
drop policy if exists "quotes_all_same_company" on public.quotes;
create policy "quotes_all_same_company" on public.quotes
  for all to authenticated
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

-- Quote roof areas: access via quote ownership
drop policy if exists "quote_roof_areas_all" on public.quote_roof_areas;
create policy "quote_roof_areas_all" on public.quote_roof_areas
  for all to authenticated
  using (
    exists (
      select 1 from public.quotes q
      where q.id = quote_id and q.company_id = public.current_company_id()
    )
  )
  with check (
    exists (
      select 1 from public.quotes q
      where q.id = quote_id and q.company_id = public.current_company_id()
    )
  );

-- Quote components: access via quote ownership
drop policy if exists "quote_components_all" on public.quote_components;
create policy "quote_components_all" on public.quote_components
  for all to authenticated
  using (
    exists (
      select 1 from public.quotes q
      join public.quote_roof_areas qra on qra.quote_id = q.id
      where (quote_roof_area_id = qra.id or quote_roof_area_id is null)
        and q.company_id = public.current_company_id()
        and q.id = quote_id
    )
  )
  with check (
    exists (
      select 1 from public.quotes q
      where q.id = quote_id and q.company_id = public.current_company_id()
    )
  );
