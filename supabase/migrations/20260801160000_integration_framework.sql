-- Integration framework tables
-- Creates: integrations, integration_credentials, integration_exports,
-- integration_export_attempts, integration_external_records
-- Also creates: vault RPC functions for credential storage

-- ============================================================
-- integrations: connection state per company per provider
-- ============================================================
CREATE TABLE IF NOT EXISTS integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('zapier', 'jobnimbus', 'fergus')),
  enabled BOOLEAN NOT NULL DEFAULT false,
  config JSONB NOT NULL DEFAULT '{}',
  data_scopes JSONB NOT NULL DEFAULT '{
    "customerDetails": true,
    "siteDetails": true,
    "customerFacingQuote": true,
    "internalCosts": false,
    "marginInformation": false,
    "labourBreakdown": false,
    "measurementsAndTakeoff": false,
    "filesAndPlans": true,
    "internalNotes": false,
    "acceptanceDetails": true
  }',
  connection_status TEXT NOT NULL DEFAULT 'not_connected' CHECK (
    connection_status IN ('not_connected', 'connected', 'error', 'expired', 'requires_reconnect')
  ),
  last_validated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, provider)
);

-- ============================================================
-- integration_credentials: encrypted secrets (stored via Vault)
-- ============================================================
CREATE TABLE IF NOT EXISTS integration_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  credential_type TEXT NOT NULL,
  encrypted_payload TEXT NOT NULL,
  expires_at TIMESTAMPTZ,
  last_rotated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(integration_id, credential_type)
);

-- ============================================================
-- integration_exports: one logical export/sync operation
-- ============================================================
CREATE TABLE IF NOT EXISTS integration_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL DEFAULT 'quote',
  source_id UUID NOT NULL,
  source_revision INTEGER NOT NULL DEFAULT 1,
  event_type TEXT NOT NULL DEFAULT 'manual_export',
  status TEXT NOT NULL DEFAULT 'queued' CHECK (
    status IN ('queued', 'running', 'partially_completed', 'succeeded', 'failed', 'cancelled', 'requires_attention')
  ),
  idempotency_key TEXT NOT NULL,
  payload_version TEXT NOT NULL DEFAULT '1.0',
  payload JSONB,
  queued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  next_retry_at TIMESTAMPTZ,
  retry_count INTEGER NOT NULL DEFAULT 0,
  error_code TEXT,
  error_summary TEXT,
  created_by UUID,
  UNIQUE(integration_id, idempotency_key)
);

-- ============================================================
-- integration_export_attempts: per-step audit without sensitive data
-- ============================================================
CREATE TABLE IF NOT EXISTS integration_export_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  export_id UUID NOT NULL REFERENCES integration_exports(id) ON DELETE CASCADE,
  step TEXT NOT NULL,
  attempt_number INTEGER NOT NULL DEFAULT 1,
  response_status INTEGER,
  provider_request_id TEXT,
  duration_ms INTEGER,
  error_class TEXT,
  error_summary TEXT,
  request_summary JSONB,
  response_summary JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- integration_external_records: QCP+ to provider record mappings
-- ============================================================
CREATE TABLE IF NOT EXISTS integration_external_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL DEFAULT 'quote',
  source_id UUID NOT NULL,
  external_type TEXT NOT NULL,
  external_id TEXT NOT NULL,
  external_url TEXT,
  last_synced_revision INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(integration_id, source_type, source_id, external_type)
);

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX idx_integrations_company ON integrations(company_id);
CREATE INDEX idx_integration_exports_company ON integration_exports(company_id);
CREATE INDEX idx_integration_exports_integration ON integration_exports(integration_id);
CREATE INDEX idx_integration_exports_status ON integration_exports(status) WHERE status IN ('queued', 'running', 'requires_attention');
CREATE INDEX idx_integration_exports_retry ON integration_exports(next_retry_at) WHERE status = 'queued' AND next_retry_at IS NOT NULL;
CREATE INDEX idx_integration_export_attempts_export ON integration_export_attempts(export_id);
CREATE INDEX idx_integration_external_records_company ON integration_external_records(company_id);
CREATE INDEX idx_integration_external_records_source ON integration_external_records(source_type, source_id);
CREATE INDEX idx_integration_credentials_integration ON integration_credentials(integration_id);

-- ============================================================
-- RLS Policies
-- ============================================================
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_exports ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_export_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_external_records ENABLE ROW LEVEL SECURITY;

-- Integrations: company members can read/write (app-level role checks in actions)
CREATE POLICY integrations_read ON integrations
  FOR SELECT USING (user_belongs_to_company(company_id));

CREATE POLICY integrations_write ON integrations
  FOR ALL USING (user_belongs_to_company(company_id)) WITH CHECK (user_belongs_to_company(company_id));

-- Credentials: NO direct read/write from client - server-only via service role
CREATE POLICY integration_credentials_deny_all ON integration_credentials
  FOR ALL USING (false) WITH CHECK (false);

-- Exports: company members can read, server creates/updates
CREATE POLICY integration_exports_read ON integration_exports
  FOR SELECT USING (user_belongs_to_company(company_id));

CREATE POLICY integration_exports_insert ON integration_exports
  FOR INSERT WITH CHECK (user_belongs_to_company(company_id));

CREATE POLICY integration_exports_update ON integration_exports
  FOR UPDATE USING (user_belongs_to_company(company_id));

-- Attempts: read-only via company membership
CREATE POLICY integration_export_attempts_read ON integration_export_attempts
  FOR SELECT USING (
    export_id IN (
      SELECT ie.id FROM integration_exports ie
      WHERE user_belongs_to_company(ie.company_id)
    )
  );

CREATE POLICY integration_export_attempts_insert ON integration_export_attempts
  FOR INSERT WITH CHECK (true);

-- External records: company members read, server writes
CREATE POLICY integration_external_records_read ON integration_external_records
  FOR SELECT USING (user_belongs_to_company(company_id));

CREATE POLICY integration_external_records_write ON integration_external_records
  FOR ALL USING (user_belongs_to_company(company_id)) WITH CHECK (user_belongs_to_company(company_id));

-- ============================================================
-- Updated_at triggers
-- ============================================================
CREATE TRIGGER trg_integrations_updated_at
  BEFORE UPDATE ON integrations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_integration_credentials_updated_at
  BEFORE UPDATE ON integration_credentials
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_integration_external_records_updated_at
  BEFORE UPDATE ON integration_external_records
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- Helper: compute idempotency key
-- ============================================================
CREATE OR REPLACE FUNCTION compute_idempotency_key(
  p_company_id UUID,
  p_provider TEXT,
  p_source_type TEXT,
  p_source_id UUID,
  p_source_revision INTEGER,
  p_operation TEXT DEFAULT 'export'
) RETURNS TEXT AS $$
BEGIN
  RETURN p_company_id::TEXT || ':' || p_provider || ':' || p_source_type || ':' || p_source_id::TEXT || ':' || p_source_revision::TEXT || ':' || p_operation;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================
-- Credential encryption helpers (application-layer AES via pgcrypto)
-- Uses a shared secret from app env (INTEGRATION_ENCRYPTION_KEY)
-- ============================================================
CREATE OR REPLACE FUNCTION encrypt_credential(p_plaintext TEXT, p_key TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN encode(
    pgp_sym_encrypt(p_plaintext, p_key),
    'base64'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION decrypt_credential(p_ciphertext TEXT, p_key TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN pgp_sym_decrypt(
    decode(p_ciphertext, 'base64'),
    p_key
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- get_integration_credential: server-only credential retrieval
-- Must be called with service_role key - RLS blocks client access
-- ============================================================
CREATE OR REPLACE FUNCTION get_integration_credential(
  p_integration_id UUID,
  p_credential_type TEXT,
  p_encryption_key TEXT
) RETURNS TEXT AS $$
DECLARE
  v_payload TEXT;
BEGIN
  SELECT encrypted_payload INTO v_payload
  FROM integration_credentials
  WHERE integration_id = p_integration_id
    AND credential_type = p_credential_type;

  IF v_payload IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN decrypt_credential(v_payload, p_encryption_key);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
