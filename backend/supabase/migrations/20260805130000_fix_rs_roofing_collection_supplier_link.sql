-- Fix: RS Roofing Standard Library collection was missing supplier_profile_id link
-- This caused /free-roofing-takeoff-builder/rs-roofing to return 404
-- The collection (a1e00000-0000-0000-0000-000000000001) was published and takeoff_enabled
-- but supplier_profile_id was NULL, so loadPublishedTakeoffLibrary() could not find the supplier.

UPDATE component_collections
SET supplier_profile_id = '304e0049-4503-45cf-80a9-3524ba5b216f'
WHERE id = 'a1e00000-0000-0000-0000-000000000001'
  AND supplier_profile_id IS NULL;

-- Add public read RLS policies for published collections and their components.
-- These allow anon/authenticated users to read published supplier data without
-- needing the service role key. The service role already bypasses RLS
-- (relforcerowsecurity = false on all three tables), so these policies
-- are for client-side queries and as a safety net.

CREATE POLICY component_collections_public_read_published
ON component_collections
FOR SELECT
USING (
  publication_status = 'published'
  AND supplier_profile_id IS NOT NULL
);

CREATE POLICY component_library_public_read_published
ON component_library
FOR SELECT
USING (
  is_active = true
  AND collection_id IN (
    SELECT id FROM component_collections
    WHERE publication_status = 'published'
      AND supplier_profile_id IS NOT NULL
  )
);
