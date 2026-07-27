-- Add master_email to supplier_profiles
-- Allows admin to assign a specific email address that will grant supplier
-- abilities when that user logs into QuoteCore+. This decouples supplier
-- access from company_id, so a supplier can be created before the user
-- has a company, and only the master-email user gets supplier features.

-- Make company_id nullable (supplier may be created before user has a company)
ALTER TABLE public.supplier_profiles ALTER COLUMN company_id DROP NOT NULL;

-- Add master_email column
ALTER TABLE public.supplier_profiles
  ADD COLUMN IF NOT EXISTS master_email text;

-- Unique index on master_email (partial - only for non-null values)
CREATE UNIQUE INDEX IF NOT EXISTS idx_supplier_profiles_master_email
  ON public.supplier_profiles (lower(master_email))
  WHERE master_email IS NOT NULL;

-- Update RLS: allow a user to read their own supplier profile by master_email
CREATE POLICY "supplier_profiles_master_email_read"
  ON public.supplier_profiles
  FOR SELECT
  USING (
    master_email IS NOT NULL
    AND lower(master_email) = lower(
      COALESCE(
        (SELECT email FROM public.users WHERE id = auth.uid()),
        ''
      )
    )
  );
