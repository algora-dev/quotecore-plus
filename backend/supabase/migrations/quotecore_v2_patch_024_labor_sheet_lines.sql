-- Create separate labor_sheet_lines table
-- Labor sheets and customer quotes are conceptually different documents

CREATE TABLE IF NOT EXISTS labor_sheet_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  line_type TEXT NOT NULL CHECK (line_type IN ('component', 'custom')),
  quote_component_id UUID REFERENCES quote_components(id) ON DELETE CASCADE,
  custom_text TEXT NOT NULL,
  custom_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  show_price BOOLEAN NOT NULL DEFAULT true,
  show_units BOOLEAN NOT NULL DEFAULT true,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  include_in_total BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS labor_sheet_lines_quote_id_idx ON labor_sheet_lines(quote_id);
CREATE INDEX IF NOT EXISTS labor_sheet_lines_component_id_idx ON labor_sheet_lines(quote_component_id);

-- RLS policies
ALTER TABLE labor_sheet_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view labor sheet lines for their company's quotes"
  ON labor_sheet_lines FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM quotes q
      JOIN profiles p ON p.company_id = q.company_id
      WHERE q.id = labor_sheet_lines.quote_id
        AND p.id = auth.uid()
    )
  );

CREATE POLICY "Users can insert labor sheet lines for their company's quotes"
  ON labor_sheet_lines FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM quotes q
      JOIN profiles p ON p.company_id = q.company_id
      WHERE q.id = labor_sheet_lines.quote_id
        AND p.id = auth.uid()
    )
  );

CREATE POLICY "Users can update labor sheet lines for their company's quotes"
  ON labor_sheet_lines FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM quotes q
      JOIN profiles p ON p.company_id = q.company_id
      WHERE q.id = labor_sheet_lines.quote_id
        AND p.id = auth.uid()
    )
  );

CREATE POLICY "Users can delete labor sheet lines for their company's quotes"
  ON labor_sheet_lines FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM quotes q
      JOIN profiles p ON p.company_id = q.company_id
      WHERE q.id = labor_sheet_lines.quote_id
        AND p.id = auth.uid()
    )
  );

COMMENT ON TABLE labor_sheet_lines IS 'Stores customized line items for labor sheets (separate from customer quotes)';
COMMENT ON COLUMN labor_sheet_lines.line_type IS 'Either component (from quote_components) or custom (user-added)';
COMMENT ON COLUMN labor_sheet_lines.custom_text IS 'Display text for the line (auto-generated for components, editable for custom)';
COMMENT ON COLUMN labor_sheet_lines.custom_amount IS 'Labor-only cost for this line (no materials, no margins)';
COMMENT ON COLUMN labor_sheet_lines.show_price IS 'Whether to display the price for this line';
COMMENT ON COLUMN labor_sheet_lines.show_units IS 'Whether to show unit measurements in the text';
COMMENT ON COLUMN labor_sheet_lines.include_in_total IS 'Whether this line contributes to the total (can be hidden but still add to total)';
