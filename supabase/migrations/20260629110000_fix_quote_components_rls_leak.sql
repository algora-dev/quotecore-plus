-- Fix quote_components RLS policy: null-area component cross-company leak (Gerald H-01)
--
-- The previous quote_components_all policy had a flawed USING predicate:
--   (quote_components.quote_roof_area_id = qra.id OR quote_components.quote_roof_area_id IS NULL)
--   AND q.company_id = current_company_id()
--   AND q.id = qra.quote_id
--
-- When quote_roof_area_id IS NULL, the first branch is true for ANY qra row,
-- and q.id = qra.quote_id only links q to qra — not quote_components to q.
-- Result: null-area components from ANY company were visible to ANY authenticated user.
--
-- Fix: scope directly through quote_components.quote_id → quotes.company_id,
-- with a separate roof-area consistency check.

DROP POLICY IF EXISTS quote_components_all ON public.quote_components;

CREATE POLICY quote_components_all ON public.quote_components
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.quotes q
      WHERE q.id = quote_components.quote_id
        AND q.company_id = current_company_id()
    )
    AND (
      quote_roof_area_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.quote_roof_areas qra
        WHERE qra.id = quote_components.quote_roof_area_id
          AND qra.quote_id = quote_components.quote_id
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.quotes q
      WHERE q.id = quote_components.quote_id
        AND q.company_id = current_company_id()
    )
  );
