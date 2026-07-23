-- Add monthly_ai_parse_limit to subscription_plans
ALTER TABLE subscription_plans
  ADD COLUMN IF NOT EXISTS monthly_ai_parse_limit integer;

-- Set parse limits per plan
UPDATE subscription_plans SET monthly_ai_parse_limit = CASE
  WHEN code = 'trial'   THEN 10
  WHEN code = 'free'    THEN 0
  WHEN code = 'starter' THEN 50
  WHEN code = 'pro'     THEN 150
  WHEN code = 'pro_plus' THEN 300
  WHEN code = 'premium' THEN NULL  -- unlimited
  ELSE monthly_ai_parse_limit
END;

-- Premium gets AI assist points too
UPDATE subscription_plans SET ai_assist_points_limit = 200
  WHERE code = 'premium';

-- Usage tracking table (one row per company per billing period)
CREATE TABLE IF NOT EXISTS company_ai_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  parse_count integer NOT NULL DEFAULT 0,
  ai_assist_points_used integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id, period_start)
);

ALTER TABLE company_ai_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY company_ai_usage_select_own ON company_ai_usage
  FOR SELECT USING (company_id = current_company_id());
CREATE POLICY company_ai_usage_insert_own ON company_ai_usage
  FOR INSERT WITH CHECK (company_id = current_company_id());
CREATE POLICY company_ai_usage_update_own ON company_ai_usage
  FOR UPDATE USING (company_id = current_company_id());
