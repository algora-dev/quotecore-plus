-- 20260804210000_result_snapshots.sql
-- G3: Immutable result provenance
-- Stores a complete snapshot of a calculation result so that republishing
-- a catalogue never changes old result URLs.

CREATE TABLE IF NOT EXISTS result_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The signed token (deterministic, from result-token.ts)
  token text NOT NULL UNIQUE,
  -- The complete calculation result as JSON
  result jsonb NOT NULL,
  -- Library provenance
  supplier_id uuid REFERENCES supplier_profiles(id) ON DELETE SET NULL,
  collection_id uuid REFERENCES component_collections(id) ON DELETE SET NULL,
  published_version integer,
  -- Calculation metadata
  calculation_version text NOT NULL,
  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Check if a newer version exists (for stale disclosure)
  -- This is computed on read, not stored
  -- No PII is stored in the snapshot
  contains_pii boolean NOT NULL DEFAULT false
);

-- Index for fast lookups by token
CREATE INDEX IF NOT EXISTS result_snapshots_token_idx ON result_snapshots(token);

-- Index for stale version checks
CREATE INDEX IF NOT EXISTS result_snapshots_collection_idx ON result_snapshots(collection_id, published_version);

-- Grant access to anon (result pages are public)
GRANT SELECT ON result_snapshots TO anon, authenticated;

-- No INSERT/UPDATE/DELETE for anon - only the server (service role) writes
REVOKE INSERT, UPDATE, DELETE ON result_snapshots FROM anon, authenticated;

COMMENT ON TABLE result_snapshots IS
  'Immutable calculation result snapshots. Pinned to a specific published library version so republishing a catalogue never changes old results.';
