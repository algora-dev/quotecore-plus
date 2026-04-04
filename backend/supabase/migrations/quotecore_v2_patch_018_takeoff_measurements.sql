-- Digital Takeoff Measurements Table
-- Stores measurements from the digital takeoff canvas
-- Used to auto-populate the Components page

CREATE TABLE IF NOT EXISTS quote_takeoff_measurements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  component_library_id UUID REFERENCES component_library(id) ON DELETE SET NULL,
  measurement_type TEXT NOT NULL CHECK (measurement_type IN ('line', 'area', 'point')),
  measurement_value NUMERIC NOT NULL,
  measurement_unit TEXT NOT NULL CHECK (measurement_unit IN ('feet', 'meters')),
  canvas_points JSONB,
  is_visible BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_takeoff_quote ON quote_takeoff_measurements(quote_id);
CREATE INDEX idx_takeoff_component ON quote_takeoff_measurements(component_library_id);

-- Note: RLS policies omitted - access controlled via server actions with company_id ownership checks
-- All mutations go through server actions which verify company_id matches the authenticated user's company
