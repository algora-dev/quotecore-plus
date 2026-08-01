-- Add scope_overrides column to integration_exports
-- Allows per-send scope overrides (what data to include in this specific export)
ALTER TABLE integration_exports
ADD COLUMN IF NOT EXISTS scope_overrides jsonb DEFAULT NULL;

COMMENT ON COLUMN integration_exports.scope_overrides IS 'Per-export scope overrides that supersede the integration default data_scopes. NULL means use integration defaults.';
