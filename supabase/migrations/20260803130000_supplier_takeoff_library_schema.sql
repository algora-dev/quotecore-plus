-- Migration: 20260803130000_supplier_takeoff_library_schema.sql
-- Phase 1: Library readiness schema for supplier-powered free roof takeoff.
-- All additive, all nullable/defaulted. Existing data is unaffected.

-- ============================================================
-- 1. Supplier profile additions: enquiry + branding + defaults
-- ============================================================
ALTER TABLE public.supplier_profiles
  ADD COLUMN IF NOT EXISTS enquiry_email text,
  ADD COLUMN IF NOT EXISTS enquiries_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS enquiry_cc_emails text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS brand_primary_color text,
  ADD COLUMN IF NOT EXISTS brand_accent_color text,
  ADD COLUMN IF NOT EXISTS default_takeoff_collection_id uuid;

-- FK from supplier_profiles to component_collections (self-referential within same table family)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'supplier_profiles_default_takeoff_collection_fk'
  ) THEN
    ALTER TABLE public.supplier_profiles
      ADD CONSTRAINT supplier_profiles_default_takeoff_collection_fk
      FOREIGN KEY (default_takeoff_collection_id)
      REFERENCES public.component_collections(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================
-- 2. Component collection additions: takeoff library metadata
-- ============================================================
ALTER TABLE public.component_collections
  ADD COLUMN IF NOT EXISTS public_slug text,
  ADD COLUMN IF NOT EXISTS takeoff_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS currency text,
  ADD COLUMN IF NOT EXISTS is_default_takeoff_library boolean NOT NULL DEFAULT false;

-- Unique public_slug per supplier (only when both are set)
CREATE UNIQUE INDEX IF NOT EXISTS idx_component_collections_public_slug
  ON public.component_collections (supplier_profile_id, public_slug)
  WHERE supplier_profile_id IS NOT NULL AND public_slug IS NOT NULL;

-- Only one default takeoff library per supplier
CREATE UNIQUE INDEX IF NOT EXISTS idx_component_collections_default_takeoff
  ON public.component_collections (supplier_profile_id)
  WHERE supplier_profile_id IS NOT NULL AND is_default_takeoff_library = true;

-- ============================================================
-- 3. Component library additions: per-slot default flag
-- ============================================================
ALTER TABLE public.component_library
  ADD COLUMN IF NOT EXISTS is_takeoff_default boolean NOT NULL DEFAULT false;

-- Only one default component per (collection_id, takeoff_slot)
CREATE UNIQUE INDEX IF NOT EXISTS idx_component_library_takeoff_default
  ON public.component_library (collection_id, takeoff_slot)
  WHERE collection_id IS NOT NULL
    AND takeoff_slot IS NOT NULL
    AND is_takeoff_default = true;

-- ============================================================
-- 4. Published library snapshots (immutable pricing provenance)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.supplier_takeoff_library_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_profile_id uuid NOT NULL REFERENCES public.supplier_profiles(id) ON DELETE CASCADE,
  collection_id uuid NOT NULL REFERENCES public.component_collections(id) ON DELETE CASCADE,
  published_version integer NOT NULL,
  currency text NOT NULL,
  components_json jsonb NOT NULL, -- immutable array of active takeoff components at publish time
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (collection_id, published_version)
);

CREATE INDEX IF NOT EXISTS idx_takeoff_snapshots_supplier
  ON public.supplier_takeoff_library_snapshots (supplier_profile_id);

CREATE INDEX IF NOT EXISTS idx_takeoff_snapshots_collection
  ON public.supplier_takeoff_library_snapshots (collection_id, published_version);

-- RLS: public can read snapshots (they're immutable published data)
ALTER TABLE public.supplier_takeoff_library_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "takeoff_snapshots_public_read"
  ON public.supplier_takeoff_library_snapshots
  FOR SELECT
  USING (true);

-- Only service role can insert (via publish action)
-- No public writes

-- ============================================================
-- 5. Supplier enquiry tables (Phase 6 will populate, schema now)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.supplier_takeoff_enquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_profile_id uuid NOT NULL REFERENCES public.supplier_profiles(id) ON DELETE CASCADE,
  collection_id uuid REFERENCES public.component_collections(id) ON DELETE SET NULL,
  published_version integer,
  sender_name text NOT NULL,
  sender_email text NOT NULL,
  sender_phone text,
  intent text NOT NULL DEFAULT 'general_enquiry'
    CHECK (intent IN ('detailed_quote', 'order_request', 'pricing_question', 'general_enquiry')),
  message text NOT NULL DEFAULT '',
  include_quantities boolean NOT NULL DEFAULT true,
  include_pricing boolean NOT NULL DEFAULT true,
  include_result_link boolean NOT NULL DEFAULT true,
  include_files boolean NOT NULL DEFAULT false,
  result_token text,
  result_snapshot jsonb,
  canonical_url text,
  totals jsonb,
  currency text,
  attribution jsonb,
  marketing_consent boolean NOT NULL DEFAULT false,
  consent_version text NOT NULL DEFAULT 'v1',
  delivery_status text NOT NULL DEFAULT 'pending'
    CHECK (delivery_status IN ('pending', 'queued', 'sent', 'failed', 'retrying')),
  provider_id text,
  provider_error text,
  retry_count integer NOT NULL DEFAULT 0,
  next_retry_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_enquiries_supplier
  ON public.supplier_takeoff_enquiries (supplier_profile_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_enquiries_delivery
  ON public.supplier_takeoff_enquiries (delivery_status, next_retry_at)
  WHERE delivery_status IN ('pending', 'queued', 'retrying');

-- RLS: no public reads. Only service role can read/insert.
ALTER TABLE public.supplier_takeoff_enquiries ENABLE ROW LEVEL SECURITY;
-- No SELECT policy = no public reads. Insert via service role only.

CREATE TRIGGER trg_enquiries_updated_at
  BEFORE UPDATE ON public.supplier_takeoff_enquiries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Enquiry files (attachments)
CREATE TABLE IF NOT EXISTS public.supplier_takeoff_enquiry_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enquiry_id uuid NOT NULL REFERENCES public.supplier_takeoff_enquiries(id) ON DELETE CASCADE,
  filename text NOT NULL,
  storage_path text NOT NULL,
  content_type text NOT NULL,
  size_bytes bigint NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_enquiry_files_enquiry
  ON public.supplier_takeoff_enquiry_files (enquiry_id);

CREATE INDEX IF NOT EXISTS idx_enquiry_files_expiry
  ON public.supplier_takeoff_enquiry_files (expires_at)
  WHERE expires_at IS NOT NULL;

ALTER TABLE public.supplier_takeoff_enquiry_files ENABLE ROW LEVEL SECURITY;
-- No public reads. Service role only.

-- Enquiry delivery attempts (audit log)
CREATE TABLE IF NOT EXISTS public.supplier_takeoff_enquiry_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enquiry_id uuid NOT NULL REFERENCES public.supplier_takeoff_enquiries(id) ON DELETE CASCADE,
  attempt_number integer NOT NULL,
  status text NOT NULL CHECK (status IN ('success', 'failed')),
  provider_id text,
  error text,
  attempted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_enquiry_attempts_enquiry
  ON public.supplier_takeoff_enquiry_attempts (enquiry_id, attempt_number);

ALTER TABLE public.supplier_takeoff_enquiry_attempts ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 6. Readiness validation function
-- ============================================================
CREATE OR REPLACE FUNCTION public.validate_takeoff_library_readiness(
  p_supplier_id uuid,
  p_collection_id uuid
) RETURNS TABLE(
  is_ready boolean,
  issues text[]
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_supplier record;
  v_collection record;
  v_component_count integer;
  v_slots_covered integer;
  v_issues text[] := '{}';
BEGIN
  -- Get supplier
  SELECT * INTO v_supplier FROM public.supplier_profiles WHERE id = p_supplier_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, ARRAY['Supplier not found'];
    RETURN;
  END IF;

  -- Get collection
  SELECT * INTO v_collection FROM public.component_collections
    WHERE id = p_collection_id AND supplier_profile_id = p_supplier_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, ARRAY['Collection not found or not owned by supplier'];
    RETURN;
  END IF;

  -- Check supplier status
  IF v_supplier.status != 'approved' THEN
    v_issues := array_append(v_issues, 'Supplier is not approved');
  END IF;

  -- Check collection is published
  IF v_collection.publication_status != 'published' THEN
    v_issues := array_append(v_issues, 'Collection is not published');
  END IF;

  -- Check takeoff is enabled
  IF NOT v_collection.takeoff_enabled THEN
    v_issues := array_append(v_issues, 'Takeoff is not enabled for this collection');
  END IF;

  -- Check currency
  IF v_collection.currency IS NULL AND v_supplier.currency IS NULL THEN
    v_issues := array_append(v_issues, 'No currency set on collection or supplier');
  END IF;

  -- Count active components with takeoff slots
  SELECT count(*), count(DISTINCT takeoff_slot)
    INTO v_component_count, v_slots_covered
    FROM public.component_library
    WHERE collection_id = p_collection_id
      AND takeoff_slot IS NOT NULL
      AND is_active = true;

  IF v_component_count = 0 THEN
    v_issues := array_append(v_issues, 'No active components with takeoff slots');
  END IF;

  -- Check for non-negative pricing
  PERFORM 1 FROM public.component_library
    WHERE collection_id = p_collection_id
      AND takeoff_slot IS NOT NULL
      AND is_active = true
      AND default_material_rate < 0;
  IF FOUND THEN
    v_issues := array_append(v_issues, 'One or more components have negative material rate');
  END IF;

  -- Check enquiry settings if enquiries_enabled
  IF v_supplier.enquiries_enabled AND v_supplier.enquiry_email IS NULL THEN
    v_issues := array_append(v_issues, 'Enquiries enabled but no enquiry email set');
  END IF;

  RETURN QUERY SELECT (array_length(v_issues, 1) IS NULL), v_issues;
END;
$$;
