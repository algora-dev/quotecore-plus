-- Enable RLS on quote_takeoff_measurements (was missing!)
ALTER TABLE quote_takeoff_measurements ENABLE ROW LEVEL SECURITY;

-- Company members can access only their own measurements
CREATE POLICY "takeoff_measurements_company_access" ON quote_takeoff_measurements
  FOR ALL USING (company_id = current_company_id())
  WITH CHECK (company_id = current_company_id());
