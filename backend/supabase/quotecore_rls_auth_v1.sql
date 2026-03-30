
-- QuoteCore Supabase RLS + auth layer v1
-- Assumes schema from quotecore_schema_v1.sql has already been run.

create extension if not exists pgcrypto;

-- =========================================================
-- 1. Auth linkage assumptions
-- =========================================================
-- This script assumes:
-- - auth.users.id = public.users.id
-- - every public.users row belongs to exactly one company
-- - users should only access rows for their own company
--
-- Run AFTER your base schema.

-- =========================================================
-- 2. Helper functions
-- =========================================================
create or replace function public.current_user_id()
returns uuid
language sql
stable
as $$
  select auth.uid()
$$;

create or replace function public.current_company_id()
returns uuid
language sql
stable
as $$
  select u.company_id
  from public.users u
  where u.id = auth.uid()
  limit 1
$$;

create or replace function public.user_belongs_to_company(target_company_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.company_id = target_company_id
  )
$$;

create or replace function public.user_can_access_quote(target_quote_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.quotes q
    join public.users u on u.company_id = q.company_id
    where q.id = target_quote_id
      and u.id = auth.uid()
  )
$$;

create or replace function public.user_can_access_template(target_template_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.templates t
    join public.users u on u.company_id = t.company_id
    where t.id = target_template_id
      and u.id = auth.uid()
  )
$$;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
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

-- Optional trigger: only enable after your signup flow writes company_id into auth user metadata.
drop trigger if exists on_auth_user_created_quotecore on auth.users;
create trigger on_auth_user_created_quotecore
after insert on auth.users
for each row execute procedure public.handle_new_auth_user();

-- =========================================================
-- 3. Enable RLS
-- =========================================================
alter table public.companies enable row level security;
alter table public.users enable row level security;
alter table public.templates enable row level security;
alter table public.template_measurement_keys enable row level security;
alter table public.template_item_groups enable row level security;
alter table public.template_items enable row level security;
alter table public.template_area_configs enable row level security;
alter table public.template_direct_configs enable row level security;
alter table public.template_fixed_configs enable row level security;
alter table public.template_modifiers enable row level security;
alter table public.template_item_modifier_links enable row level security;
alter table public.template_pitch_bands enable row level security;
alter table public.template_reroof_configs enable row level security;
alter table public.quotes enable row level security;
alter table public.quote_measurements enable row level security;
alter table public.quote_items enable row level security;
alter table public.quote_item_modifiers enable row level security;
alter table public.quote_versions enable row level security;
alter table public.customer_quote_views enable row level security;
alter table public.quote_attachments enable row level security;
alter table public.quote_acceptances enable row level security;
alter table public.notifications enable row level security;

-- =========================================================
-- 4. Policies: companies
-- =========================================================
drop policy if exists "companies_select_own" on public.companies;
create policy "companies_select_own"
on public.companies
for select
to authenticated
using (public.user_belongs_to_company(id));

drop policy if exists "companies_update_own" on public.companies;
create policy "companies_update_own"
on public.companies
for update
to authenticated
using (public.user_belongs_to_company(id))
with check (public.user_belongs_to_company(id));

-- =========================================================
-- 5. Policies: users
-- =========================================================
drop policy if exists "users_select_same_company" on public.users;
create policy "users_select_same_company"
on public.users
for select
to authenticated
using (company_id = public.current_company_id());

drop policy if exists "users_insert_self" on public.users;
create policy "users_insert_self"
on public.users
for insert
to authenticated
with check (
  id = auth.uid()
  and company_id = public.current_company_id()
);

drop policy if exists "users_update_self_or_same_company" on public.users;
create policy "users_update_self_or_same_company"
on public.users
for update
to authenticated
using (company_id = public.current_company_id())
with check (company_id = public.current_company_id());

-- =========================================================
-- 6. Policies: template tree
-- =========================================================
drop policy if exists "templates_all_same_company" on public.templates;
create policy "templates_all_same_company"
on public.templates
for all
to authenticated
using (company_id = public.current_company_id())
with check (company_id = public.current_company_id());

drop policy if exists "template_measurement_keys_all_by_template" on public.template_measurement_keys;
create policy "template_measurement_keys_all_by_template"
on public.template_measurement_keys
for all
to authenticated
using (public.user_can_access_template(template_id))
with check (public.user_can_access_template(template_id));

drop policy if exists "template_item_groups_all_by_template" on public.template_item_groups;
create policy "template_item_groups_all_by_template"
on public.template_item_groups
for all
to authenticated
using (public.user_can_access_template(template_id))
with check (public.user_can_access_template(template_id));

drop policy if exists "template_items_all_by_template" on public.template_items;
create policy "template_items_all_by_template"
on public.template_items
for all
to authenticated
using (public.user_can_access_template(template_id))
with check (public.user_can_access_template(template_id));

drop policy if exists "template_area_configs_all_by_item" on public.template_area_configs;
create policy "template_area_configs_all_by_item"
on public.template_area_configs
for all
to authenticated
using (
  exists (
    select 1
    from public.template_items ti
    join public.templates t on t.id = ti.template_id
    where ti.id = template_item_id
      and t.company_id = public.current_company_id()
  )
)
with check (
  exists (
    select 1
    from public.template_items ti
    join public.templates t on t.id = ti.template_id
    where ti.id = template_item_id
      and t.company_id = public.current_company_id()
  )
);

drop policy if exists "template_direct_configs_all_by_item" on public.template_direct_configs;
create policy "template_direct_configs_all_by_item"
on public.template_direct_configs
for all
to authenticated
using (
  exists (
    select 1
    from public.template_items ti
    join public.templates t on t.id = ti.template_id
    where ti.id = template_item_id
      and t.company_id = public.current_company_id()
  )
)
with check (
  exists (
    select 1
    from public.template_items ti
    join public.templates t on t.id = ti.template_id
    where ti.id = template_item_id
      and t.company_id = public.current_company_id()
  )
);

drop policy if exists "template_fixed_configs_all_by_item" on public.template_fixed_configs;
create policy "template_fixed_configs_all_by_item"
on public.template_fixed_configs
for all
to authenticated
using (
  exists (
    select 1
    from public.template_items ti
    join public.templates t on t.id = ti.template_id
    where ti.id = template_item_id
      and t.company_id = public.current_company_id()
  )
)
with check (
  exists (
    select 1
    from public.template_items ti
    join public.templates t on t.id = ti.template_id
    where ti.id = template_item_id
      and t.company_id = public.current_company_id()
  )
);

drop policy if exists "template_modifiers_all_by_template" on public.template_modifiers;
create policy "template_modifiers_all_by_template"
on public.template_modifiers
for all
to authenticated
using (public.user_can_access_template(template_id))
with check (public.user_can_access_template(template_id));

drop policy if exists "template_item_modifier_links_all_same_company" on public.template_item_modifier_links;
create policy "template_item_modifier_links_all_same_company"
on public.template_item_modifier_links
for all
to authenticated
using (
  exists (
    select 1
    from public.template_items ti
    join public.templates t on t.id = ti.template_id
    where ti.id = template_item_id
      and t.company_id = public.current_company_id()
  )
)
with check (
  exists (
    select 1
    from public.template_items ti
    join public.templates t on t.id = ti.template_id
    where ti.id = template_item_id
      and t.company_id = public.current_company_id()
  )
);

drop policy if exists "template_pitch_bands_all_by_template" on public.template_pitch_bands;
create policy "template_pitch_bands_all_by_template"
on public.template_pitch_bands
for all
to authenticated
using (public.user_can_access_template(template_id))
with check (public.user_can_access_template(template_id));

drop policy if exists "template_reroof_configs_all_by_template" on public.template_reroof_configs;
create policy "template_reroof_configs_all_by_template"
on public.template_reroof_configs
for all
to authenticated
using (public.user_can_access_template(template_id))
with check (public.user_can_access_template(template_id));

-- =========================================================
-- 7. Policies: quote tree
-- =========================================================
drop policy if exists "quotes_all_same_company" on public.quotes;
create policy "quotes_all_same_company"
on public.quotes
for all
to authenticated
using (company_id = public.current_company_id())
with check (company_id = public.current_company_id());

drop policy if exists "quote_measurements_all_by_quote" on public.quote_measurements;
create policy "quote_measurements_all_by_quote"
on public.quote_measurements
for all
to authenticated
using (public.user_can_access_quote(quote_id))
with check (public.user_can_access_quote(quote_id));

drop policy if exists "quote_items_all_by_quote" on public.quote_items;
create policy "quote_items_all_by_quote"
on public.quote_items
for all
to authenticated
using (public.user_can_access_quote(quote_id))
with check (public.user_can_access_quote(quote_id));

drop policy if exists "quote_item_modifiers_all_by_quote_item" on public.quote_item_modifiers;
create policy "quote_item_modifiers_all_by_quote_item"
on public.quote_item_modifiers
for all
to authenticated
using (
  exists (
    select 1
    from public.quote_items qi
    join public.quotes q on q.id = qi.quote_id
    where qi.id = quote_item_id
      and q.company_id = public.current_company_id()
  )
)
with check (
  exists (
    select 1
    from public.quote_items qi
    join public.quotes q on q.id = qi.quote_id
    where qi.id = quote_item_id
      and q.company_id = public.current_company_id()
  )
);

drop policy if exists "quote_versions_all_by_quote" on public.quote_versions;
create policy "quote_versions_all_by_quote"
on public.quote_versions
for all
to authenticated
using (public.user_can_access_quote(quote_id))
with check (public.user_can_access_quote(quote_id));

drop policy if exists "customer_quote_views_all_by_quote" on public.customer_quote_views;
create policy "customer_quote_views_all_by_quote"
on public.customer_quote_views
for all
to authenticated
using (public.user_can_access_quote(quote_id))
with check (public.user_can_access_quote(quote_id));

drop policy if exists "quote_attachments_all_by_quote" on public.quote_attachments;
create policy "quote_attachments_all_by_quote"
on public.quote_attachments
for all
to authenticated
using (public.user_can_access_quote(quote_id))
with check (public.user_can_access_quote(quote_id));

drop policy if exists "quote_acceptances_select_same_company" on public.quote_acceptances;
create policy "quote_acceptances_select_same_company"
on public.quote_acceptances
for select
to authenticated
using (
  exists (
    select 1
    from public.quote_versions qv
    join public.quotes q on q.id = qv.quote_id
    where qv.id = quote_version_id
      and q.company_id = public.current_company_id()
  )
);

drop policy if exists "quote_acceptances_insert_same_company" on public.quote_acceptances;
create policy "quote_acceptances_insert_same_company"
on public.quote_acceptances
for insert
to authenticated
with check (
  exists (
    select 1
    from public.quote_versions qv
    join public.quotes q on q.id = qv.quote_id
    where qv.id = quote_version_id
      and q.company_id = public.current_company_id()
  )
);

drop policy if exists "quote_acceptances_update_same_company" on public.quote_acceptances;
create policy "quote_acceptances_update_same_company"
on public.quote_acceptances
for update
to authenticated
using (
  exists (
    select 1
    from public.quote_versions qv
    join public.quotes q on q.id = qv.quote_id
    where qv.id = quote_version_id
      and q.company_id = public.current_company_id()
  )
)
with check (
  exists (
    select 1
    from public.quote_versions qv
    join public.quotes q on q.id = qv.quote_id
    where qv.id = quote_version_id
      and q.company_id = public.current_company_id()
  )
);

drop policy if exists "notifications_all_same_company" on public.notifications;
create policy "notifications_all_same_company"
on public.notifications
for all
to authenticated
using (company_id = public.current_company_id())
with check (company_id = public.current_company_id());

-- =========================================================
-- 8. Public quote acceptance access
-- =========================================================
-- Hosted quote acceptance needs public read/update access by token.
-- Safer approach: do NOT expose direct anon table access.
-- Instead, use a server route or edge function with the service role key.
--
-- So: no anon policies added here for quote_acceptances.

-- =========================================================
-- 9. Recommended storage bucket policies
-- =========================================================
-- Suggested bucket: quote-attachments
-- Path convention: company_id/quote_id/filename
--
-- Add these in the Supabase dashboard or as storage SQL after bucket creation:
--
-- select storage.create_bucket('quote-attachments', public => false);
--
-- Then add policies so authenticated users only access files under their company path.
