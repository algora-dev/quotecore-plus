-- Migration: allow renaming bootstrap component collections
--
-- The component_collections UPDATE policy previously had `AND (is_bootstrap = false)`
-- in the USING clause, which silently blocked users from renaming their default
-- "My Components" bootstrap collection.
--
-- is_bootstrap is already protected at the column-grant level:
--   authenticated has SELECT/INSERT/REFERENCES on is_bootstrap but NOT UPDATE.
-- So widening the RLS policy to allow updates on any company collection is safe -
-- the column-level grant ensures is_bootstrap can never be changed by the client.

DROP POLICY IF EXISTS component_collections_update ON public.component_collections;

CREATE POLICY component_collections_update
  ON public.component_collections
  FOR UPDATE
  USING (
    company_id = (
      SELECT users.company_id FROM users WHERE users.id = auth.uid()
    )
  )
  WITH CHECK (
    company_id = (
      SELECT users.company_id FROM users WHERE users.id = auth.uid()
    )
  );
