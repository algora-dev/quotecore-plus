
-- QuoteCore backend schema v1
-- Manual-first quoting platform
-- PostgreSQL / Supabase compatible

create extension if not exists pgcrypto;

-- =========================
-- Enums
-- =========================
do $$ begin
  create type template_mode as enum ('simple', 'advanced', 'hybrid');
exception when duplicate_object then null; end $$;

do $$ begin
  create type measurement_type as enum ('area', 'linear', 'count', 'custom');
exception when duplicate_object then null; end $$;

do $$ begin
  create type item_category as enum ('material', 'labour', 'extra', 'reroof', 'allowance');
exception when duplicate_object then null; end $$;

do $$ begin
  create type item_type as enum ('area_derived', 'direct_measurement', 'fixed_custom');
exception when duplicate_object then null; end $$;

do $$ begin
  create type quote_status as enum ('draft', 'sent', 'accepted', 'declined', 'expired', 'archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type version_status as enum ('draft', 'sent', 'accepted', 'superseded');
exception when duplicate_object then null; end $$;

do $$ begin
  create type version_source_type as enum ('manual_save', 'clone', 'template_switch', 'acceptance_lock');
exception when duplicate_object then null; end $$;

do $$ begin
  create type modifier_value_type as enum ('multiplier', 'fixed_amount');
exception when duplicate_object then null; end $$;

do $$ begin
  create type modifier_scope as enum ('item', 'section', 'quote');
exception when duplicate_object then null; end $$;

do $$ begin
  create type acceptance_status as enum ('pending', 'accepted', 'revoked', 'expired');
exception when duplicate_object then null; end $$;

do $$ begin
  create type rounding_rule as enum ('nearest_1dp', 'nearest_2dp', 'whole_up', 'nearest_tenth_up', 'custom_rule_reserved');
exception when duplicate_object then null; end $$;

do $$ begin
  create type conversion_mode as enum ('cover_width', 'cover_area', 'explicit_area_per_unit');
exception when duplicate_object then null; end $$;

do $$ begin
  create type input_measurement_mode as enum ('plan_length', 'actual_length', 'plan_area');
exception when duplicate_object then null; end $$;

do $$ begin
  create type pitch_adjustment_type as enum ('none', 'rafter_pitch', 'diagonal_pitch');
exception when duplicate_object then null; end $$;

do $$ begin
  create type customer_quote_status as enum ('draft', 'published', 'withdrawn');
exception when duplicate_object then null; end $$;

do $$ begin
  create type notification_type as enum ('quote_accepted', 'quote_sent', 'quote_cloned', 'version_created');
exception when duplicate_object then null; end $$;

-- =========================
-- Timestamp helper
-- =========================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =========================
-- Core tables
-- =========================
create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  rounding_precision smallint not null check (rounding_precision in (1, 2)),
  default_currency text not null default 'NZD',
  default_tax_rate numeric(8,4) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.users (
  id uuid primary key,
  company_id uuid not null references public.companies(id) on delete cascade,
  email text not null unique,
  full_name text,
  role text not null default 'owner',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.templates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  description text,
  mode template_mode not null default 'hybrid',
  roofing_profile text,
  is_active boolean not null default true,
  material_margin_default_pct numeric(8,4),
  labour_margin_default_pct numeric(8,4),
  disclaimers_default jsonb not null default '[]'::jsonb,
  exclusions_default jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.template_measurement_keys (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.templates(id) on delete cascade,
  key text not null,
  label text not null,
  measurement_type measurement_type not null,
  unit_label text,
  is_default_key boolean not null default true,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (template_id, key)
);

create table if not exists public.template_item_groups (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.templates(id) on delete cascade,
  name text not null,
  description text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.template_items (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.templates(id) on delete cascade,
  group_id uuid references public.template_item_groups(id) on delete set null,
  name text not null,
  category item_category not null,
  item_type item_type not null,
  pricing_unit text,
  base_rate numeric(12,4),
  is_customer_visible_default boolean not null default true,
  supports_quote_override boolean not null default true,
  included_by_default boolean not null default true,
  auto_calculate_quantity boolean not null default true,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.template_area_configs (
  template_item_id uuid primary key references public.template_items(id) on delete cascade,
  area_source_key text not null,
  conversion_mode conversion_mode not null,
  effective_cover_width_mm numeric(12,4),
  effective_cover_length_mm numeric(12,4),
  effective_cover_area_m2 numeric(12,6),
  waste_percent numeric(8,4) default 0,
  rounding_rule rounding_rule not null,
  applies_material_margin boolean not null default true,
  notes text
);

create table if not exists public.template_direct_configs (
  template_item_id uuid primary key references public.template_items(id) on delete cascade,
  measurement_key text not null,
  input_measurement_mode_default input_measurement_mode not null default 'actual_length',
  pitch_adjustment_type pitch_adjustment_type not null default 'none',
  waste_percent numeric(8,4) default 0,
  default_formula_mode text not null default 'measurement_times_rate',
  notes text
);

create table if not exists public.template_fixed_configs (
  template_item_id uuid primary key references public.template_items(id) on delete cascade,
  quantity_default numeric(12,4),
  fixed_value_default numeric(12,4),
  allow_manual_quantity boolean not null default true,
  allow_manual_rate boolean not null default true,
  notes text
);

create table if not exists public.template_modifiers (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.templates(id) on delete cascade,
  name text not null,
  description text,
  value_type modifier_value_type not null,
  scope modifier_scope not null default 'item',
  classification item_category,
  default_multiplier numeric(12,6),
  default_fixed_amount numeric(12,4),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.template_item_modifier_links (
  id uuid primary key default gen_random_uuid(),
  template_item_id uuid not null references public.template_items(id) on delete cascade,
  template_modifier_id uuid not null references public.template_modifiers(id) on delete cascade,
  applies_by_default boolean not null default true,
  unique (template_item_id, template_modifier_id)
);

create table if not exists public.template_pitch_bands (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.templates(id) on delete cascade,
  label text not null,
  min_pitch_degrees numeric(8,4),
  max_pitch_degrees numeric(8,4),
  multiplier_value numeric(12,6) not null,
  sort_order integer not null default 0
);

create table if not exists public.template_reroof_configs (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null unique references public.templates(id) on delete cascade,
  base_removal_rate_per_m2 numeric(12,4) not null,
  default_pitch_multiplier numeric(12,6),
  default_disposal_multiplier numeric(12,6),
  default_complexity_multiplier numeric(12,6),
  notes text
);

create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  template_id uuid not null references public.templates(id) on delete restrict,
  current_version_number integer not null default 1,
  customer_name text not null,
  customer_email text,
  customer_phone text,
  job_name text,
  site_address text,
  status quote_status not null default 'draft',
  template_name_snapshot text not null,
  material_margin_override_pct numeric(8,4),
  labour_margin_override_pct numeric(8,4),
  tax_rate_override numeric(8,4),
  notes_internal text,
  created_by_user_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.quote_measurements (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  version_number integer not null,
  key text not null,
  value numeric(14,4) not null,
  input_measurement_mode input_measurement_mode,
  pitch_value_degrees numeric(8,4),
  manual_pitch_factor_override numeric(10,6),
  roof_section_label text,
  created_at timestamptz not null default now()
);

create table if not exists public.quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  template_item_id uuid references public.template_items(id) on delete set null,
  version_number integer not null,
  name text not null,
  category item_category not null,
  item_type item_type not null,
  quantity numeric(14,4),
  unit_label text,
  pricing_unit text,
  base_rate numeric(12,4),
  override_rate numeric(12,4),
  override_fixed_value numeric(12,4),
  waste_percent_applied numeric(8,4),
  subtotal_pre_margin numeric(14,4) not null default 0,
  margin_percent_applied numeric(8,4),
  total_after_margin numeric(14,4) not null default 0,
  is_customer_visible boolean not null default true,
  pitch_adjustment_type_used pitch_adjustment_type,
  input_measurement_mode_used input_measurement_mode,
  calculation_meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.quote_item_modifiers (
  id uuid primary key default gen_random_uuid(),
  quote_item_id uuid not null references public.quote_items(id) on delete cascade,
  template_modifier_id uuid references public.template_modifiers(id) on delete set null,
  name text not null,
  value_type modifier_value_type not null,
  classification item_category,
  multiplier_value numeric(12,6),
  fixed_amount_value numeric(12,4),
  applied_by_default boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.quote_versions (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  version_number integer not null,
  parent_version_number integer,
  status version_status not null default 'draft',
  source_type version_source_type not null,
  snapshot_json jsonb not null,
  created_by_user_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (quote_id, version_number)
);

create table if not exists public.customer_quote_views (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  version_number integer not null,
  status customer_quote_status not null default 'draft',
  title text,
  intro_text text,
  disclaimer_blocks jsonb not null default '[]'::jsonb,
  exclusions_blocks jsonb not null default '[]'::jsonb,
  show_tax_breakout boolean not null default true,
  published_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.quote_attachments (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  version_number integer,
  file_path text not null,
  file_name text not null,
  mime_type text,
  file_size_bytes bigint,
  uploaded_by_user_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.quote_acceptances (
  id uuid primary key default gen_random_uuid(),
  quote_version_id uuid not null references public.quote_versions(id) on delete cascade,
  public_token text not null unique,
  status acceptance_status not null default 'pending',
  accepted_at timestamptz,
  accepted_name text,
  accepted_email text,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid references public.users(id) on delete cascade,
  type notification_type not null,
  title text not null,
  body text,
  reference_table text,
  reference_id uuid,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

-- =========================
-- Indexes
-- =========================
create index if not exists idx_templates_company_id on public.templates(company_id);
create index if not exists idx_template_items_template_id on public.template_items(template_id);
create index if not exists idx_quote_measurements_quote_version on public.quote_measurements(quote_id, version_number);
create index if not exists idx_quote_items_quote_version on public.quote_items(quote_id, version_number);
create index if not exists idx_quote_versions_quote_version on public.quote_versions(quote_id, version_number);
create index if not exists idx_quote_acceptances_token on public.quote_acceptances(public_token);
create index if not exists idx_notifications_user_id_read on public.notifications(user_id, is_read);

-- =========================
-- Updated at triggers
-- =========================
drop trigger if exists trg_companies_updated_at on public.companies;
create trigger trg_companies_updated_at
before update on public.companies
for each row execute function public.set_updated_at();

drop trigger if exists trg_users_updated_at on public.users;
create trigger trg_users_updated_at
before update on public.users
for each row execute function public.set_updated_at();

drop trigger if exists trg_templates_updated_at on public.templates;
create trigger trg_templates_updated_at
before update on public.templates
for each row execute function public.set_updated_at();

drop trigger if exists trg_quotes_updated_at on public.quotes;
create trigger trg_quotes_updated_at
before update on public.quotes
for each row execute function public.set_updated_at();

-- =========================
-- Seed comment block
-- =========================
comment on table public.template_area_configs is 'Area-derived covering logic, including primary roof covering, underlay, plywood, membranes, and similar items.';
comment on column public.template_direct_configs.pitch_adjustment_type is 'none, rafter_pitch, or diagonal_pitch.';
comment on column public.quote_measurements.input_measurement_mode is 'Whether entered value is a flat plan measurement or an actual real-world measurement.';
