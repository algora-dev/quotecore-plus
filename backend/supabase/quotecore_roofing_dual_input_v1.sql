-- QuoteCore roof areas + component schema additions (dual input model)
-- Slice 1 migration

-- =========================
-- Enums
-- =========================
DO $$ BEGIN
  CREATE TYPE input_value_mode AS ENUM ('final', 'calculated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =========================
-- Component library
-- =========================
CREATE TABLE IF NOT EXISTS public.component_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  component_type text NOT NULL DEFAULT 'main' CHECK (component_type IN ('main', 'extra')),
  measurement_type measurement_type NOT NULL,
  default_input_mode input_value_mode NOT NULL DEFAULT 'final',
  default_final_value numeric(14,4),
  default_calculated_inputs jsonb NOT NULL DEFAULT '{}'::jsonb,
  default_pitch numeric(8,4),
  default_waste jsonb NOT NULL DEFAULT '{}'::jsonb,
  material_unit_cost numeric(14,4),
  labour_unit_cost numeric(14,4),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_component_library_company_id ON public.component_library(company_id);

-- =========================
-- Template roof areas + components
-- =========================
CREATE TABLE IF NOT EXISTS public.template_roof_areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.templates(id) ON DELETE CASCADE,
  label text NOT NULL,
  input_mode input_value_mode NOT NULL DEFAULT 'final',
  final_value numeric(14,4),
  calculated_inputs jsonb NOT NULL DEFAULT '{}'::jsonb,
  pitch_input numeric(8,4),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_template_roof_areas_template_id ON public.template_roof_areas(template_id);

CREATE TABLE IF NOT EXISTS public.template_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.templates(id) ON DELETE CASCADE,
  component_library_id uuid NOT NULL REFERENCES public.component_library(id) ON DELETE RESTRICT,
  default_roof_area_label text,
  pricing_overrides jsonb NOT NULL DEFAULT '{}'::jsonb,
  pitch_override numeric(8,4),
  waste_override jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_template_components_template_id ON public.template_components(template_id);

-- =========================
-- Quote roof areas + components (includes extras)
-- =========================
CREATE TABLE IF NOT EXISTS public.quote_roof_areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  label text NOT NULL,
  input_mode input_value_mode NOT NULL DEFAULT 'final',
  final_value numeric(14,4),
  calculated_inputs jsonb NOT NULL DEFAULT '{}'::jsonb,
  pitch_input numeric(8,4),
  computed_value numeric(14,4),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quote_roof_areas_quote_id ON public.quote_roof_areas(quote_id);

CREATE TABLE IF NOT EXISTS public.quote_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  component_library_id uuid REFERENCES public.component_library(id) ON DELETE SET NULL,
  template_component_id uuid REFERENCES public.template_components(id) ON DELETE SET NULL,
  component_type text NOT NULL DEFAULT 'main' CHECK (component_type IN ('main', 'extra')),
  roof_area_id uuid REFERENCES public.quote_roof_areas(id) ON DELETE SET NULL,
  input_mode input_value_mode NOT NULL DEFAULT 'final',
  final_quantity numeric(14,4),
  calculated_inputs jsonb NOT NULL DEFAULT '{}'::jsonb,
  pitch_input numeric(8,4),
  waste_settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  material_cost numeric(14,4),
  labour_cost numeric(14,4),
  override_flags jsonb NOT NULL DEFAULT '{}'::jsonb,
  override_values jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quote_components_quote_id ON public.quote_components(quote_id);
CREATE INDEX IF NOT EXISTS idx_quote_components_roof_area_id ON public.quote_components(roof_area_id);

-- =========================
-- Updated-at triggers
-- =========================
DROP TRIGGER IF EXISTS trg_component_library_updated_at ON public.component_library;
CREATE TRIGGER trg_component_library_updated_at
BEFORE UPDATE ON public.component_library
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_template_roof_areas_updated_at ON public.template_roof_areas;
CREATE TRIGGER trg_template_roof_areas_updated_at
BEFORE UPDATE ON public.template_roof_areas
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_template_components_updated_at ON public.template_components;
CREATE TRIGGER trg_template_components_updated_at
BEFORE UPDATE ON public.template_components
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_quote_roof_areas_updated_at ON public.quote_roof_areas;
CREATE TRIGGER trg_quote_roof_areas_updated_at
BEFORE UPDATE ON public.quote_roof_areas
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_quote_components_updated_at ON public.quote_components;
CREATE TRIGGER trg_quote_components_updated_at
BEFORE UPDATE ON public.quote_components
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
