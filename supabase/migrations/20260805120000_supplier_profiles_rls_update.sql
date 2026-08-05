-- Add UPDATE RLS policy on supplier_profiles
-- Problem: supplier_profiles had SELECT-only RLS policies. Suppliers could read
-- their profile (via master_email match) but could not UPDATE it — every save
-- from the dashboard silently succeeded (HTTP 200) but updated 0 rows.
-- This was the root cause of "filled everything out but it won't save".

CREATE POLICY supplier_profiles_owner_update
ON supplier_profiles
FOR UPDATE
USING (
  company_id IS NOT NULL
  AND company_id IN (
    SELECT company_id FROM users WHERE id = auth.uid()
  )
)
WITH CHECK (
  company_id IS NOT NULL
  AND company_id IN (
    SELECT company_id FROM users WHERE id = auth.uid()
  )
);

-- Also fix the owner_read policy to use the same company_id lookup
-- (was comparing company_id = auth.uid() which is the user's auth UID, not company_id)
DROP POLICY IF EXISTS supplier_profiles_owner_read ON supplier_profiles;
CREATE POLICY supplier_profiles_owner_read
ON supplier_profiles
FOR SELECT
USING (
  company_id IS NOT NULL
  AND company_id IN (
    SELECT company_id FROM users WHERE id = auth.uid()
  )
);
