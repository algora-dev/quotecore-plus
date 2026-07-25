-- Free Tools Roof Builder component definitions.
-- Admin-managed component catalog for the free roof takeoff builder.
-- Each row = one component option (e.g. "Concrete Ridge Tile", "Colorbond Ridge Flashing")
-- that users can select in the free tool.
--
-- tenant_id: NULL for QuoteCore+ default components. For white-label supplier
-- deployments, this would hold the supplier's identifier.
-- component_kind: maps to the 6 sections in the builder UI
--   (roof_area, ridge, hip, valley, barge, spouting)
-- is_active: soft-delete. Inactive components don't show in the dropdown.

CREATE TABLE IF NOT EXISTS public.free_tool_roof_components (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  -- Tenant (NULL = QuoteCore+ default)
  tenant_id       text,                          -- NULL for our own, supplier slug for white-label

  -- Component classification
  component_kind  text NOT NULL,                 -- 'roof_area' | 'ridge' | 'hip' | 'valley' | 'barge' | 'spouting'

  -- Display
  name            text NOT NULL,                 -- e.g. "Concrete Ridge Tile"
  description     text,                          -- optional description
  unit            text NOT NULL DEFAULT 'm',     -- 'm', 'm²', 'each', etc.

  -- Pricing
  price_per_unit  numeric(10,2) NOT NULL DEFAULT 0,
  currency        text NOT NULL DEFAULT 'GBP',
  pricing_strategy text NOT NULL DEFAULT 'per_unit',  -- 'per_unit' | 'per_pack_length' | 'per_pack_area'
  pack_size       numeric(10,2),                 -- for pack-based pricing
  pack_price      numeric(10,2),                 -- for pack-based pricing

  -- Labour
  labour_rate     numeric(10,2) NOT NULL DEFAULT 0,
  labour_unit     text NOT NULL DEFAULT 'fixed', -- 'fixed' | 'per_unit' | 'hourly'

  -- Waste
  suggested_waste_percent numeric(5,2) NOT NULL DEFAULT 10,

  -- Pitch
  pitch_type      text NOT NULL DEFAULT 'rafter', -- 'rafter' | 'hip_valley' | 'none'

  -- Status
  is_active       boolean NOT NULL DEFAULT true,
  sort_order      integer NOT NULL DEFAULT 0
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ftrc_tenant_kind ON public.free_tool_roof_components (tenant_id, component_kind, is_active, sort_order);
CREATE INDEX IF NOT EXISTS idx_ftrc_active ON public.free_tool_roof_components (is_active) WHERE is_active = true;

-- RLS: public can read active components (the free tool is unauthenticated).
-- Only admins can write.
ALTER TABLE public.free_tool_roof_components ENABLE ROW LEVEL SECURITY;

-- Public read: only active rows, only for the default tenant (NULL)
CREATE POLICY ftrc_public_read ON public.free_tool_roof_components
  FOR SELECT
  USING (is_active = true);

-- Admin write: full CRUD
CREATE POLICY ftrc_admin_all ON public.free_tool_roof_components
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.is_admin = true
    )
  );

-- Seed default components (QuoteCore+ defaults, tenant_id = NULL)
INSERT INTO public.free_tool_roof_components (component_kind, name, description, unit, price_per_unit, pitch_type, suggested_waste_percent, sort_order) VALUES
  ('roof_area',  'Roof Area (default)',  'Standard roof area measurement',           'm²', 0, 'rafter',    10, 0),
  ('ridge',      'Ridge (default)',      'Standard ridge component',                 'm',  0, 'none',      5, 0),
  ('hip',        'Hip (default)',        'Standard hip component',                   'm',  0, 'hip_valley', 5, 0),
  ('valley',     'Valley (default)',     'Standard valley component',                'm',  0, 'hip_valley', 5, 0),
  ('barge',      'Barge (default)',      'Standard barge component',                 'm',  0, 'none',      5, 0),
  ('spouting',   'Spouting (default)',   'Standard spouting component',              'm',  0, 'none',      5, 0)
ON CONFLICT DO NOTHING;
