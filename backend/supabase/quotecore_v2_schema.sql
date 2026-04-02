-- QuoteCore+ v2 Schema — Clean Redesign
-- Author: Gavin (dev agent)
-- Date: 2026-04-01
-- Run this on a FRESH Supabase project.
-- Preserves: companies, users (auth foundation)
-- Replaces: all template/quote/extras tables from v1

create extension if not exists pgcrypto;

-- =========================
-- Enums
-- =========================
do $$ begin
  create type quote_status as enum ('draft', 'sent', 'accepted', 'declined', 'expired', 'archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type component_type as enum ('main', 'extra');
exception when duplicate_object then null; end $$;

do $$ begin
  create type measurement_type as enum ('area', 'lineal', 'quantity', 'fixed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type input_mode as enum ('final', 'calculated');
exception when duplicate_object then null; end $$;

do $$ begin
  create type waste_type as enum ('percent', 'fixed', 'none');
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
-- Core tables (KEEP from v1)
-- =========================
create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  default_currency text not null default 'NZD',
  default_tax_rate numeric(8,4) not null default 0,
  default_language text not null default 'en',
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

-- =========================
-- Component Library
-- =========================
create table if not exists public.component_library (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  component_type component_type not null default 'main',
  measurement_type measurement_type not null,
  pricing_unit text,
  default_material_rate numeric(12,4) not null default 0,
  default_labour_rate numeric(12,4) not null default 0,
  default_waste_type waste_type not null default 'none',
  default_waste_percent numeric(8,4) not null default 0,
  default_waste_fixed numeric(12,4) not null default 0,
  default_pitch_applies boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================
-- Templates (simplified)
-- =========================
create table if not exists public.templates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  description text,
  roofing_profile text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.template_roof_areas (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.templates(id) on delete cascade,
  label text not null,
  default_input_mode input_mode not null default 'calculated',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.template_components (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.templates(id) on delete cascade,
  component_library_id uuid not null references public.component_library(id) on delete restrict,
  template_roof_area_id uuid references public.template_roof_areas(id) on delete set null,
  component_type component_type not null default 'main',
  -- Template-level overrides (null = use library default)
  override_material_rate numeric(12,4),
  override_labour_rate numeric(12,4),
  override_waste_type waste_type,
  override_waste_percent numeric(8,4),
  override_waste_fixed numeric(12,4),
  override_pitch_applies boolean,
  is_included_by_default boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- =========================
-- Quotes (simplified)
-- =========================
create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  template_id uuid references public.templates(id) on delete set null,
  customer_name text not null,
  customer_email text,
  customer_phone text,
  job_name text,
  site_address text,
  status quote_status not null default 'draft',
  material_margin_pct numeric(8,4) not null default 0,
  labour_margin_pct numeric(8,4) not null default 0,
  tax_rate numeric(8,4) not null default 0,
  notes_internal text,
  created_by_user_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.quote_roof_areas (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  template_roof_area_id uuid references public.template_roof_areas(id) on delete set null,
  label text not null,
  -- DUAL INPUT MODEL
  input_mode input_mode not null default 'calculated',
  -- Final input (when input_mode = 'final')
  final_value_sqm numeric(14,4),
  -- Calculated inputs (when input_mode = 'calculated')
  calc_width_m numeric(12,4),
  calc_length_m numeric(12,4),
  calc_plan_sqm numeric(12,4),
  calc_pitch_degrees numeric(8,4),
  -- System-computed result (always populated)
  computed_sqm numeric(14,4),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.quote_components (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  quote_roof_area_id uuid references public.quote_roof_areas(id) on delete set null,
  component_library_id uuid references public.component_library(id) on delete set null,
  template_component_id uuid references public.template_components(id) on delete set null,
  -- Component identity
  name text not null,
  component_type component_type not null default 'main',
  measurement_type measurement_type not null,
  -- DUAL INPUT MODEL
  input_mode input_mode not null default 'final',
  final_value numeric(14,4),
  -- Calculated inputs
  calc_raw_value numeric(14,4),
  calc_pitch_degrees numeric(8,4),
  calc_pitch_factor numeric(10,6),
  -- Waste
  waste_type waste_type not null default 'none',
  waste_percent numeric(8,4) not null default 0,
  waste_fixed numeric(12,4) not null default 0,
  -- Final computed quantity
  final_quantity numeric(14,4),
  -- Pricing
  pricing_unit text,
  material_rate numeric(12,4) not null default 0,
  labour_rate numeric(12,4) not null default 0,
  material_cost numeric(14,4) not null default 0,
  labour_cost numeric(14,4) not null default 0,
  -- Override tracking
  is_rate_overridden boolean not null default false,
  is_quantity_overridden boolean not null default false,
  is_waste_overridden boolean not null default false,
  is_pitch_overridden boolean not null default false,
  -- Display
  is_customer_visible boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================
-- Indexes
-- =========================
create index if not exists idx_component_library_company on public.component_library(company_id);
create index if not exists idx_component_library_type on public.component_library(company_id, component_type);
create index if not exists idx_templates_company on public.templates(company_id);
create index if not exists idx_template_roof_areas_template on public.template_roof_areas(template_id);
create index if not exists idx_template_components_template on public.template_components(template_id);
create index if not exists idx_template_components_library on public.template_components(component_library_id);
create index if not exists idx_quotes_company on public.quotes(company_id);
create index if not exists idx_quotes_template on public.quotes(template_id);
create index if not exists idx_quote_roof_areas_quote on public.quote_roof_areas(quote_id);
create index if not exists idx_quote_components_quote on public.quote_components(quote_id);
create index if not exists idx_quote_components_area on public.quote_components(quote_roof_area_id);

-- =========================
-- Updated-at triggers
-- =========================
drop trigger if exists trg_companies_updated_at on public.companies;
create trigger trg_companies_updated_at
before update on public.companies for each row execute function public.set_updated_at();

drop trigger if exists trg_users_updated_at on public.users;
create trigger trg_users_updated_at
before update on public.users for each row execute function public.set_updated_at();

drop trigger if exists trg_component_library_updated_at on public.component_library;
create trigger trg_component_library_updated_at
before update on public.component_library for each row execute function public.set_updated_at();

drop trigger if exists trg_templates_updated_at on public.templates;
create trigger trg_templates_updated_at
before update on public.templates for each row execute function public.set_updated_at();

drop trigger if exists trg_quotes_updated_at on public.quotes;
create trigger trg_quotes_updated_at
before update on public.quotes for each row execute function public.set_updated_at();

drop trigger if exists trg_quote_roof_areas_updated_at on public.quote_roof_areas;
create trigger trg_quote_roof_areas_updated_at
before update on public.quote_roof_areas for each row execute function public.set_updated_at();

drop trigger if exists trg_quote_components_updated_at on public.quote_components;
create trigger trg_quote_components_updated_at
before update on public.quote_components for each row execute function public.set_updated_at();
