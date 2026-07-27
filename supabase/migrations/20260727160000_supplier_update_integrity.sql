-- Phase 0: Supplier Update Notification - Data Integrity & Security
-- Creates durable publication snapshots, alert subscriptions, and persistent resolutions.
-- Fixes RLS on existing notifications table.
-- Company membership resolved via: SELECT company_id FROM public.users WHERE id = auth.uid()

-- ═══════════════════════════════════════════════════════════════
-- 1. supplier_library_publications: durable snapshot per published version
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS supplier_library_publications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_library_id uuid NOT NULL REFERENCES component_collections(id) ON DELETE CASCADE,
  version integer NOT NULL,
  components_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  published_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  published_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (supplier_library_id, version)
);

CREATE INDEX IF NOT EXISTS idx_slp_library_version
  ON supplier_library_publications (supplier_library_id, version DESC);

ALTER TABLE supplier_library_publications ENABLE ROW LEVEL SECURITY;

-- Suppliers can read their own publications
CREATE POLICY "Suppliers read own publications"
  ON supplier_library_publications FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM component_collections cc
      JOIN supplier_profiles sp ON sp.id = cc.supplier_profile_id
      WHERE cc.id = supplier_library_id
        AND sp.company_id = (SELECT company_id FROM public.users WHERE id = auth.uid())
    )
  );

-- Importers can read publications for libraries they've imported from
CREATE POLICY "Importers read subscribed publications"
  ON supplier_library_publications FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM component_library cl
      WHERE cl.source_library_id = supplier_library_id
        AND cl.company_id = (SELECT company_id FROM public.users WHERE id = auth.uid())
    )
  );

-- Only the supplier who owns the library can create publications
CREATE POLICY "Suppliers create own publications"
  ON supplier_library_publications FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM component_collections cc
      JOIN supplier_profiles sp ON sp.id = cc.supplier_profile_id
      WHERE cc.id = supplier_library_id
        AND sp.company_id = (SELECT company_id FROM public.users WHERE id = auth.uid())
    )
  );

-- ═══════════════════════════════════════════════════════════════
-- 2. supplier_library_subscriptions: alert opt-in per company + library
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS supplier_library_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  source_library_id uuid NOT NULL REFERENCES component_collections(id) ON DELETE CASCADE,
  alerts_enabled boolean NOT NULL DEFAULT true,
  field_preferences jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, source_library_id)
);

CREATE INDEX IF NOT EXISTS idx_sls_company
  ON supplier_library_subscriptions (company_id);
CREATE INDEX IF NOT EXISTS idx_sls_library
  ON supplier_library_subscriptions (source_library_id)
  WHERE alerts_enabled = true;

ALTER TABLE supplier_library_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members manage subscriptions"
  ON supplier_library_subscriptions FOR ALL
  TO authenticated
  USING (
    company_id = (SELECT company_id FROM public.users WHERE id = auth.uid())
  )
  WITH CHECK (
    company_id = (SELECT company_id FROM public.users WHERE id = auth.uid())
  );

-- ═══════════════════════════════════════════════════════════════
-- 3. supplier_update_resolutions: persistent per-notification resolution
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS supplier_update_resolutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  notification_id uuid NOT NULL REFERENCES supplier_change_notifications(id) ON DELETE CASCADE,
  imported_component_id uuid REFERENCES component_library(id) ON DELETE SET NULL,
  status text NOT NULL CHECK (status IN ('applied', 'dismissed', 'kept_local', 'archived', 'imported')),
  applied_fields text[] NULL,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, notification_id, imported_component_id)
);

-- Allow one resolution per company+notification when there's no imported component (e.g. "added" notifications)
CREATE UNIQUE INDEX IF NOT EXISTS idx_sur_company_notification_null_comp
  ON supplier_update_resolutions (company_id, notification_id)
  WHERE imported_component_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_sur_company
  ON supplier_update_resolutions (company_id);
CREATE INDEX IF NOT EXISTS idx_sur_notification
  ON supplier_update_resolutions (notification_id);

ALTER TABLE supplier_update_resolutions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members manage resolutions"
  ON supplier_update_resolutions FOR ALL
  TO authenticated
  USING (
    company_id = (SELECT company_id FROM public.users WHERE id = auth.uid())
  )
  WITH CHECK (
    company_id = (SELECT company_id FROM public.users WHERE id = auth.uid())
  );

-- ═══════════════════════════════════════════════════════════════
-- 4. Fix RLS on supplier_change_notifications
--    Replace broad authenticated-read with company-membership-based access
-- ═══════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Authenticated can read change notifications"
  ON supplier_change_notifications;

-- Suppliers can read notifications for their own libraries
CREATE POLICY "Suppliers read own notifications"
  ON supplier_change_notifications FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM component_collections cc
      JOIN supplier_profiles sp ON sp.id = cc.supplier_profile_id
      WHERE cc.id = supplier_change_notifications.supplier_library_id
        AND sp.company_id = (SELECT company_id FROM public.users WHERE id = auth.uid())
    )
  );

-- Importers can read notifications for libraries they've imported from
CREATE POLICY "Importers read subscribed notifications"
  ON supplier_change_notifications FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM component_library cl
      WHERE cl.source_library_id = supplier_change_notifications.supplier_library_id
        AND cl.company_id = (SELECT company_id FROM public.users WHERE id = auth.uid())
    )
  );

-- Fix INSERT policy to use users table instead of auth.uid()::uuid direct compare
DROP POLICY IF EXISTS "Supplier can create own notifications"
  ON supplier_change_notifications;

CREATE POLICY "Suppliers create own notifications"
  ON supplier_change_notifications FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM component_collections cc
      JOIN supplier_profiles sp ON sp.id = cc.supplier_profile_id
      WHERE cc.id = supplier_library_id
        AND sp.company_id = (SELECT company_id FROM public.users WHERE id = auth.uid())
    )
  );

-- ═══════════════════════════════════════════════════════════════
-- 5. Atomic publish RPC: supplier_publish_update
--    Replaces non-atomic JS-side version bump + notification insert.
--    SECURITY DEFINER so it can write to all tables in one transaction.
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION supplier_publish_update(
  p_library_id uuid,
  p_snapshot jsonb,
  p_publishing_user uuid DEFAULT NULL
) RETURNS TABLE (
  ok boolean,
  new_version integer,
  changes_recorded integer,
  message text
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_current_version integer;
  v_new_version integer;
  v_prev_snapshot jsonb;
  v_changes jsonb := '[]'::jsonb;
  v_change_count integer := 0;
  v_comp_id text;
  v_prev_val jsonb;
  v_new_val jsonb;
  v_change_type text;
  v_prev_ids text[];
  v_new_ids text[];
  v_removed_ids text[];
  v_added_ids text[];
  v_is_baseline boolean;
BEGIN
  -- Lock the library row to prevent concurrent publishes
  SELECT published_version INTO v_current_version
  FROM component_collections
  WHERE id = p_library_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0, 0, 'Library not found.';
    RETURN;
  END IF;

  v_is_baseline := (v_current_version IS NULL OR v_current_version = 0);

  IF v_is_baseline THEN
    v_new_version := 1;
    -- Store baseline snapshot without generating notifications
    INSERT INTO supplier_library_publications (supplier_library_id, version, components_snapshot, published_by)
    VALUES (p_library_id, v_new_version, p_snapshot, p_publishing_user);

    UPDATE component_collections SET published_version = v_new_version WHERE id = p_library_id;

    RETURN QUERY SELECT true, v_new_version, 0, 'Baseline published.';
    RETURN;
  END IF;

  -- Get previous publication snapshot
  SELECT components_snapshot INTO v_prev_snapshot
  FROM supplier_library_publications
  WHERE supplier_library_id = p_library_id AND version = v_current_version
  LIMIT 1;

  IF v_prev_snapshot IS NULL THEN
    -- No previous snapshot despite version > 0 - record it for current version
    INSERT INTO supplier_library_publications (supplier_library_id, version, components_snapshot, published_by)
    VALUES (p_library_id, v_current_version, p_snapshot, p_publishing_user)
    ON CONFLICT (supplier_library_id, version) DO NOTHING;

    RETURN QUERY SELECT true, v_current_version, 0, 'Snapshot recorded for existing version.';
    RETURN;
  END IF;

  v_new_version := v_current_version + 1;

  -- Build component ID arrays from both snapshots
  SELECT array_agg(elem->>'id') INTO v_prev_ids
  FROM jsonb_array_elements(v_prev_snapshot) AS elem;

  SELECT array_agg(elem->>'id') INTO v_new_ids
  FROM jsonb_array_elements(p_snapshot) AS elem;

  -- Find removed and added
  v_removed_ids := ARRAY(SELECT unnest(v_prev_ids) EXCEPT SELECT unnest(v_new_ids));
  v_added_ids := ARRAY(SELECT unnest(v_new_ids) EXCEPT SELECT unnest(v_prev_ids));

  -- Detect modifications (same ID, different fields)
  FOR v_comp_id IN SELECT unnest(v_prev_ids) INTERSECT SELECT unnest(v_new_ids) LOOP
    SELECT elem INTO v_prev_val
    FROM jsonb_array_elements(v_prev_snapshot) AS elem
    WHERE elem->>'id' = v_comp_id LIMIT 1;

    SELECT elem INTO v_new_val
    FROM jsonb_array_elements(p_snapshot) AS elem
    WHERE elem->>'id' = v_comp_id LIMIT 1;

    -- Compare by removing the id field and comparing the rest
    IF v_prev_val - 'id' != v_new_val - 'id' THEN
      -- Determine if only price-related fields changed
      IF
        (v_prev_val - 'id' - 'default_material_rate' - 'default_labour_rate' - 'pack_price')
        =
        (v_new_val - 'id' - 'default_material_rate' - 'default_labour_rate' - 'pack_price')
      THEN
        v_change_type := 'price_changed';
      ELSE
        v_change_type := 'modified';
      END IF;

      v_changes := v_changes || jsonb_build_array(jsonb_build_object(
        'component_id', v_comp_id,
        'change_type', v_change_type,
        'old_snapshot', v_prev_val,
        'new_snapshot', v_new_val
      ));
    END IF;
  END LOOP;

  -- Added components
  FOR v_comp_id IN SELECT unnest(v_added_ids) LOOP
    SELECT elem INTO v_new_val
    FROM jsonb_array_elements(p_snapshot) AS elem
    WHERE elem->>'id' = v_comp_id LIMIT 1;

    v_changes := v_changes || jsonb_build_array(jsonb_build_object(
      'component_id', v_comp_id,
      'change_type', 'added',
      'old_snapshot', null,
      'new_snapshot', v_new_val
    ));
  END LOOP;

  -- Removed components
  FOR v_comp_id IN SELECT unnest(v_removed_ids) LOOP
    SELECT elem INTO v_prev_val
    FROM jsonb_array_elements(v_prev_snapshot) AS elem
    WHERE elem->>'id' = v_comp_id LIMIT 1;

    v_changes := v_changes || jsonb_build_array(jsonb_build_object(
      'component_id', v_comp_id,
      'change_type', 'removed',
      'old_snapshot', v_prev_val,
      'new_snapshot', null
    ));
  END LOOP;

  v_change_count := jsonb_array_length(v_changes);

  -- No changes? Don't bump version
  IF v_change_count = 0 THEN
    RETURN QUERY SELECT true, v_current_version, 0, 'No changes to publish.';
    RETURN;
  END IF;

  -- Insert new publication snapshot
  INSERT INTO supplier_library_publications (supplier_library_id, version, components_snapshot, published_by)
  VALUES (p_library_id, v_new_version, p_snapshot, p_publishing_user);

  -- Insert notifications from the diff
  INSERT INTO supplier_change_notifications (
    supplier_library_id, component_id, change_type,
    old_snapshot, new_snapshot, version_from, version_to
  )
  SELECT
    p_library_id,
    (change->>'component_id')::uuid,
    change->>'change_type',
    change->'old_snapshot',
    change->'new_snapshot',
    v_current_version,
    v_new_version
  FROM jsonb_array_elements(v_changes) AS change;

  -- Bump published_version
  UPDATE component_collections SET published_version = v_new_version WHERE id = p_library_id;

  RETURN QUERY SELECT true, v_new_version, v_change_count, 'Published successfully.';
END;
$$;
