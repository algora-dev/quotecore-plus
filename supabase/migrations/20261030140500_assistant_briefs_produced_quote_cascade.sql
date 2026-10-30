-- QC fix 2026-10-30: assistant_v2_draft_briefs.produced_quote_id was the only
-- FK to quotes without ON DELETE CASCADE / SET NULL. Stale AI draft briefs
-- blocked quote deletion (FK 23503, surfaced client-side as a masked React
-- #441; owner report on RS Roofing quotes #1025/#1023). Briefs are transient
-- assistant drafts and follow their quote (owner decision 2026-10-30).
-- The app-level pre-delete cleanup shipped in 1ce1e754; this migration makes
-- the behavior durable at the schema level. Applied directly via the
-- Management API on 2026-10-30 (constraint verified ON DELETE CASCADE after).
ALTER TABLE assistant_v2_draft_briefs DROP CONSTRAINT assistant_v2_draft_briefs_produced_quote_id_fkey;

ALTER TABLE assistant_v2_draft_briefs
  ADD CONSTRAINT assistant_v2_draft_briefs_produced_quote_id_fkey
  FOREIGN KEY (produced_quote_id) REFERENCES quotes(id) ON DELETE CASCADE;

-- Supporting index for the cascade delete path (was unindexed).
CREATE INDEX IF NOT EXISTS assistant_v2_draft_briefs_produced_quote_idx
  ON assistant_v2_draft_briefs (produced_quote_id)
  WHERE produced_quote_id IS NOT NULL;
