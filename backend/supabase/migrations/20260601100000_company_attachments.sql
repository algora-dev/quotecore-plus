-- =====================================================================
-- Attachments — company attachment library
-- =====================================================================
-- Adds the reusable company-level Attachment Library: files uploaded once
-- and re-attached across many quote sends / acceptance auto-messages
-- (disclaimers, T&Cs, acceptance forms, spec sheets, etc.).
--
-- One-off, per-quote attachments continue to use quote_files (all tiers,
-- existing plumbing). This migration only adds the REUSABLE library.
--
-- New table:    company_attachments
-- New functions: company_attachment_count, require_attachment_slot
-- Plan changes: attachment_limit + feat_attachment_library on subscription_plans
-- Tiers:        Pro=10, Pro Plus=25, Premium=unlimited, all others=false/0
--
-- Storage: files live in the existing private QUOTE-DOCUMENTS bucket under
-- the path prefix {companyId}/library/. Byte accounting is handled by the
-- existing storage.objects trigger (storage_used_bytes), so no manual
-- adjust_company_storage calls are needed here.
--
-- DO NOT APPLY without explicit Shaun approval — one DB serves dev+prod.
-- =====================================================================

BEGIN;

-- -----------------------------------------------------------------------
-- 1. company_attachments table
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.company_attachments (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name          TEXT        NOT NULL
    CONSTRAINT company_attachments_name_not_blank CHECK (length(trim(name)) > 0),
  file_name     TEXT        NOT NULL,
  -- ^ Original uploaded filename, used as the recipient-facing attachment name.
  storage_path  TEXT        NOT NULL UNIQUE,
  -- ^ Path inside QUOTE-DOCUMENTS bucket, prefix {companyId}/library/.
  file_size     BIGINT      NOT NULL DEFAULT 0
    CONSTRAINT company_attachments_file_size_nonneg CHECK (file_size >= 0),
  mime_type     TEXT,
  archived_at   TIMESTAMPTZ,
  -- ^ NULL = active/selectable. Non-NULL = archived (hidden from picker,
  --   still occupies storage bytes).
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.company_attachments IS
  'Company-owned reusable email attachments (disclaimers, T&Cs, forms). Files stored in QUOTE-DOCUMENTS bucket under {companyId}/library/. Pro+ gated.';
COMMENT ON COLUMN public.company_attachments.name IS
  'User-given display/library name for finding the file. Distinct from file_name.';
COMMENT ON COLUMN public.company_attachments.file_name IS
  'Original uploaded filename; used as the attachment filename the recipient sees.';
COMMENT ON COLUMN public.company_attachments.archived_at IS
  'NULL = active/selectable. Non-NULL = archived: hidden from the attach picker but still counts toward storage_used_bytes (real bytes remain in the bucket).';

CREATE INDEX IF NOT EXISTS idx_company_attachments_company
  ON public.company_attachments (company_id)
  WHERE archived_at IS NULL;

ALTER TABLE public.company_attachments ENABLE ROW LEVEL SECURITY;

-- Company-scoped: any authenticated user whose users.company_id matches.
CREATE POLICY "company_attachments_company_scope" ON public.company_attachments
  FOR ALL
  USING (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()));

-- updated_at auto-stamp
DROP TRIGGER IF EXISTS company_attachments_touch_updated_at ON public.company_attachments;
CREATE TRIGGER company_attachments_touch_updated_at
  BEFORE UPDATE ON public.company_attachments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- -----------------------------------------------------------------------
-- 2. Subscription plan columns
-- -----------------------------------------------------------------------
-- NULL attachment_limit = unlimited (same convention as catalog_limit).
ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS attachment_limit INTEGER
    CHECK (attachment_limit IS NULL OR attachment_limit >= 0),
  ADD COLUMN IF NOT EXISTS feat_attachment_library BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.subscription_plans.attachment_limit IS
  'Active (non-archived) company-attachment cap. NULL = unlimited. Enforced via require_attachment_slot().';
COMMENT ON COLUMN public.subscription_plans.feat_attachment_library IS
  'Whether the reusable company Attachment Library is available on this plan tier. One-off per-quote attachments are NOT gated by this.';

-- Pro: 10 reusable attachments
UPDATE public.subscription_plans
   SET feat_attachment_library = true,
       attachment_limit = 10
 WHERE code = 'pro';

-- Pro Plus: 25
UPDATE public.subscription_plans
   SET feat_attachment_library = true,
       attachment_limit = 25
 WHERE code = 'pro_plus';

-- Premium: unlimited (NULL)
UPDATE public.subscription_plans
   SET feat_attachment_library = true,
       attachment_limit = NULL
 WHERE code = 'premium';

-- All other tiers: no library access. Explicit so future plan adds default correctly.
UPDATE public.subscription_plans
   SET feat_attachment_library = false,
       attachment_limit = 0
 WHERE code NOT IN ('pro', 'pro_plus', 'premium');

-- -----------------------------------------------------------------------
-- 3. Extend company_has_feature() with 'attachment_library' arm
-- -----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.company_has_feature(p_company_id uuid, p_feature text)
  RETURNS boolean
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_effective_code text;
  v_allowed boolean;
BEGIN
  v_effective_code := public.company_effective_plan_code(p_company_id);

  SELECT CASE p_feature
    WHEN 'digital_takeoff'    THEN sp.feat_digital_takeoff
    WHEN 'flashings'          THEN sp.feat_flashings
    WHEN 'material_orders'    THEN sp.feat_material_orders
    WHEN 'followups'          THEN sp.feat_followups
    WHEN 'email_send'         THEN sp.feat_email_send
    WHEN 'activity_card'      THEN sp.feat_activity_card
    WHEN 'catalogs'           THEN sp.feat_catalogs
    WHEN 'attachment_library' THEN sp.feat_attachment_library  -- ← new
    ELSE false
  END
  INTO v_allowed
  FROM public.subscription_plans sp
  WHERE sp.code = v_effective_code;

  RETURN COALESCE(v_allowed, false);
END $$;

COMMENT ON FUNCTION public.company_has_feature IS
  'Single feature-check function used by app code AND RLS policies. Extend the CASE arm + add a column to subscription_plans when introducing a new gated feature.';

-- -----------------------------------------------------------------------
-- 4. company_attachment_count()
-- -----------------------------------------------------------------------
-- Active (non-archived) attachment count for tier-cap enforcement.
CREATE OR REPLACE FUNCTION public.company_attachment_count(p_company_id uuid)
  RETURNS integer
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT COUNT(*)::integer
    FROM public.company_attachments
   WHERE company_id = p_company_id
     AND archived_at IS NULL;
$$;

COMMENT ON FUNCTION public.company_attachment_count IS
  'Count of active (non-archived) company attachments for tier-cap enforcement.';

-- -----------------------------------------------------------------------
-- 5. require_attachment_slot()
-- -----------------------------------------------------------------------
-- Raises on inactive subscription, missing feature, or exceeded limit.
-- Call inside the same transaction as the company_attachments INSERT.
-- Error codes:
--   P0001 = subscription_inactive (shared)
--   P0012 = feature_not_available:attachment_library (shared convention)
--   P0014 = attachment_limit_reached (new)
CREATE OR REPLACE FUNCTION public.require_attachment_slot(p_company_id uuid)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_used        integer;
  v_limit       integer;
  v_code        text;
  v_active      boolean;
  v_has_feature boolean;
BEGIN
  v_active := public.company_effective_plan_active(p_company_id);
  IF NOT v_active THEN
    RAISE EXCEPTION 'subscription_inactive' USING ERRCODE = 'P0001';
  END IF;

  v_has_feature := public.company_has_feature(p_company_id, 'attachment_library');
  IF NOT v_has_feature THEN
    RAISE EXCEPTION 'feature_not_available:attachment_library'
      USING ERRCODE = 'P0012';
  END IF;

  v_code := public.company_effective_plan_code(p_company_id);

  SELECT sp.attachment_limit
    INTO v_limit
    FROM public.subscription_plans sp
   WHERE sp.code = v_code;

  -- NULL = unlimited
  IF v_limit IS NULL THEN
    RETURN;
  END IF;

  v_used := public.company_attachment_count(p_company_id);

  IF v_used >= v_limit THEN
    RAISE EXCEPTION 'attachment_limit_reached'
      USING ERRCODE = 'P0014',
            DETAIL  = format('used=%s limit=%s plan=%s', v_used, v_limit, v_code);
  END IF;
END $$;

COMMENT ON FUNCTION public.require_attachment_slot IS
  'Raises subscription_inactive (P0001), feature_not_available (P0012), or attachment_limit_reached (P0014). Call before the company_attachments INSERT.';

-- -----------------------------------------------------------------------
-- 6. Permissions
-- -----------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.company_attachment_count(uuid)  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.require_attachment_slot(uuid)   TO authenticated, service_role;

COMMIT;
