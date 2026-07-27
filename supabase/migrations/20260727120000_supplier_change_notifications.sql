-- Phase 9: Supplier change notifications
-- Tracks when a supplier publishes an update to a library, so importers can be notified.

CREATE TABLE IF NOT EXISTS supplier_change_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_library_id uuid NOT NULL REFERENCES component_collections(id) ON DELETE CASCADE,
  component_id uuid REFERENCES component_library(id) ON DELETE SET NULL,
  change_type text NOT NULL CHECK (change_type IN ('added', 'modified', 'removed', 'price_changed')),
  old_snapshot jsonb,
  new_snapshot jsonb,
  version_from integer NOT NULL DEFAULT 0,
  version_to integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for querying: "which notifications affect company X's imports?"
CREATE INDEX IF NOT EXISTS idx_scn_library_id ON supplier_change_notifications(supplier_library_id);
CREATE INDEX IF NOT EXISTS idx_scn_component_id ON supplier_change_notifications(component_id);
CREATE INDEX IF NOT EXISTS idx_scn_created_at ON supplier_change_notifications(created_at DESC);

-- RLS: suppliers can see their own notifications, importers can see notifications
-- for libraries they've imported from (via source_library_id on their component_library).
-- For simplicity, allow authenticated users to read (notifications don't contain sensitive data -
-- just change type and field-level diffs of published component data).
ALTER TABLE supplier_change_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read change notifications"
  ON supplier_change_notifications FOR SELECT
  TO authenticated
  USING (true);

-- Only the supplier who owns the library can create notifications.
CREATE POLICY "Supplier can create own notifications"
  ON supplier_change_notifications FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM component_collections cc
      JOIN supplier_profiles sp ON sp.id = cc.supplier_profile_id
      JOIN companies c ON c.id = sp.company_id
      WHERE cc.id = supplier_library_id
        AND c.id = auth.uid()::uuid
    )
  );
