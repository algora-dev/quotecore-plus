-- Supplier Profiles
-- Verified supplier records. Created manually by us after a business applies.
-- One supplier profile per company (1:1), but a company can exist without being a supplier.
-- supplier_name must be unique across the entire system (no duplicates).

CREATE TABLE IF NOT EXISTS public.supplier_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  supplier_name text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'suspended', 'revoked')),
  website_url text,
  service_areas text[] DEFAULT '{}',
  roofing_types text[] DEFAULT '{}',
  product_categories text[] DEFAULT '{}',
  brands text[] DEFAULT '{}',
  keywords text[] DEFAULT '{}',
  logo_url text,
  description text,
  approved_at timestamptz,
  approved_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index for searching by name/slug
CREATE INDEX IF NOT EXISTS idx_supplier_profiles_name_lower
  ON public.supplier_profiles (lower(supplier_name));
CREATE INDEX IF NOT EXISTS idx_supplier_profiles_slug
  ON public.supplier_profiles (slug);
CREATE INDEX IF NOT EXISTS idx_supplier_profiles_status
  ON public.supplier_profiles (status);

-- RLS: public can read approved suppliers only; company owners can read their own
ALTER TABLE public.supplier_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "supplier_profiles_public_read"
  ON public.supplier_profiles
  FOR SELECT
  USING (status = 'approved');

CREATE POLICY "supplier_profiles_owner_read"
  ON public.supplier_profiles
  FOR SELECT
  USING (company_id = auth.uid());

-- Service role bypasses RLS for admin operations

-- Trigger to keep updated_at current
CREATE TRIGGER trg_supplier_profiles_updated_at
  BEFORE UPDATE ON public.supplier_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
