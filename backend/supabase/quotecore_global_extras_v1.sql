-- QuoteCore global extras schema slice
-- Run this after quotecore_schema_v1.sql

create table if not exists public.global_extras (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  description text,
  category item_category not null,
  item_type item_type not null,
  pricing_unit text,
  base_rate numeric(12,4),
  is_customer_visible_default boolean not null default true,
  supports_quote_override boolean not null default true,
  included_by_default boolean not null default false,
  auto_calculate_quantity boolean not null default true,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.global_extra_area_configs (
  global_extra_id uuid primary key references public.global_extras(id) on delete cascade,
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

create table if not exists public.global_extra_direct_configs (
  global_extra_id uuid primary key references public.global_extras(id) on delete cascade,
  measurement_key text not null,
  input_measurement_mode_default input_measurement_mode not null default 'actual_length',
  pitch_adjustment_type pitch_adjustment_type not null default 'none',
  waste_percent numeric(8,4) default 0,
  default_formula_mode text not null default 'measurement_times_rate',
  notes text
);

create table if not exists public.global_extra_fixed_configs (
  global_extra_id uuid primary key references public.global_extras(id) on delete cascade,
  quantity_default numeric(12,4),
  fixed_value_default numeric(12,4),
  allow_manual_quantity boolean not null default true,
  allow_manual_rate boolean not null default true,
  notes text
);

create index if not exists idx_global_extras_company_id on public.global_extras(company_id);

drop trigger if exists trg_global_extras_updated_at on public.global_extras;
create trigger trg_global_extras_updated_at
before update on public.global_extras
for each row execute function public.set_updated_at();
