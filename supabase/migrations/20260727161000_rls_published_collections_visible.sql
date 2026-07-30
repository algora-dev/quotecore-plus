-- Allow any authenticated user to read published component collections
-- (needed for supplier directory search to work across companies)
CREATE POLICY component_collections_select_published
  ON public.component_collections
  FOR SELECT
  TO authenticated
  USING (
    visibility = 'published'
    AND supplier_profile_id IS NOT NULL
  );

-- Allow any authenticated user to read components inside published supplier collections
-- (needed for supplier directory library detail page to show components)
CREATE POLICY component_library_select_published
  ON public.component_library
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM component_collections cc
      WHERE cc.id = component_library.collection_id
        AND cc.visibility = 'published'
        AND cc.supplier_profile_id IS NOT NULL
    )
  );
