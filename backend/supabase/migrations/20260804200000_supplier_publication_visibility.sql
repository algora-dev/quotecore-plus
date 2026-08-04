-- 20260804200000_supplier_publication_visibility.sql
-- G1: Public supplier publication contract
-- Adds granular visibility/publication controls to supplier_profiles so suppliers
-- can manage their public presence independently (page, indexing, catalogue, prices, contacts, calculator).

ALTER TABLE supplier_profiles
  -- Public page: can this supplier have a public detail page at /suppliers/[slug]?
  ADD COLUMN IF NOT EXISTS public_page_enabled boolean NOT NULL DEFAULT false,
  -- Search engine indexing: can the public page be indexed?
  ADD COLUMN IF NOT EXISTS search_indexing_enabled boolean NOT NULL DEFAULT false,
  -- Public catalogue: can the public see this supplier's catalogue categories/products?
  ADD COLUMN IF NOT EXISTS public_catalogue_enabled boolean NOT NULL DEFAULT false,
  -- Price visibility: 'hidden' (no prices anywhere), 'web_only' (web page shows prices, API doesn't), 'full' (web + API/agent)
  ADD COLUMN IF NOT EXISTS public_price_visibility text NOT NULL DEFAULT 'hidden',
  -- Contact visibility: 'hidden', 'page_only' (shown on supplier page), 'full' (page + calculator + results)
  ADD COLUMN IF NOT EXISTS public_contact_visibility text NOT NULL DEFAULT 'hidden',
  -- Publication state: 'unready' (missing required data), 'ready' (all checks pass), 'published' (publicly visible), 'unlisted' (accessible via direct link but not in directory), 'suspended' (admin revoked)
  -- Note: 'status' column already tracks pending/approved/suspended/revoked for admin flow.
  -- This column tracks the supplier's own publication state after approval.
  ADD COLUMN IF NOT EXISTS publication_state text NOT NULL DEFAULT 'unready',
  -- Audit: who last changed publication state and when
  ADD COLUMN IF NOT EXISTS publication_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS publication_updated_by uuid;

-- Constraints for enum-like columns
ALTER TABLE supplier_profiles DROP CONSTRAINT IF EXISTS supplier_public_price_visibility_check;
ALTER TABLE supplier_profiles ADD CONSTRAINT supplier_public_price_visibility_check
  CHECK (public_price_visibility IN ('hidden', 'web_only', 'full'));

ALTER TABLE supplier_profiles DROP CONSTRAINT IF EXISTS supplier_public_contact_visibility_check;
ALTER TABLE supplier_profiles ADD CONSTRAINT supplier_public_contact_visibility_check
  CHECK (public_contact_visibility IN ('hidden', 'page_only', 'full'));

ALTER TABLE supplier_profiles DROP CONSTRAINT IF EXISTS supplier_publication_state_check;
ALTER TABLE supplier_profiles ADD CONSTRAINT supplier_publication_state_check
  CHECK (publication_state IN ('unready', 'ready', 'published', 'unlisted', 'suspended'));

-- Update trigger for publication_updated_at
CREATE OR REPLACE FUNCTION set_publication_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.publication_updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS supplier_profiles_publication_updated ON supplier_profiles;
CREATE TRIGGER supplier_profiles_publication_updated
  BEFORE UPDATE OF publication_state, public_page_enabled, search_indexing_enabled,
                    public_catalogue_enabled, public_price_visibility, public_contact_visibility
  ON supplier_profiles
  FOR EACH ROW
  EXECUTE FUNCTION set_publication_updated_at();

-- Comment
COMMENT ON COLUMN supplier_profiles.publication_state IS
  'Supplier-controlled publication state after admin approval. unready=missing data, ready=checks pass, published=publicly visible, unlisted=direct-link only, suspended=admin override.';
COMMENT ON COLUMN supplier_profiles.public_price_visibility IS
  'hidden=no prices visible publicly, web_only=prices on supplier page but not via API/agent, full=prices everywhere.';
