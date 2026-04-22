-- Email templates for sending customer quotes
CREATE TABLE IF NOT EXISTS email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  subject TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_templates_company ON email_templates(company_id);

-- RLS
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "email_templates_company_access" ON email_templates
  FOR ALL USING (company_id = current_company_id());

COMMENT ON TABLE email_templates IS 'Email templates for sending customer quotes. Supports placeholders: {{customer_name}}, {{quote_number}}, {{job_name}}, {{quote_url}}, {{company_name}}, {{quote_date}}';
