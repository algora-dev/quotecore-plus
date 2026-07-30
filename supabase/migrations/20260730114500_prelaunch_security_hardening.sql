-- Final pre-launch security hardening.
--
-- 1. Keep the existing, battle-tested takeoff implementation private and
--    expose a guarded wrapper that rejects requests without an authenticated
--    Supabase user before any quote lookup or mutation can occur.
-- 2. Reassert tenant-scoped supplier notification policies under a unique
--    migration version so fresh and deployed databases converge even though
--    two earlier repository migrations shared the 20260727160000 prefix.

DO $block$
BEGIN
  IF to_regprocedure('public.save_takeoff_atomic(uuid,jsonb)') IS NULL
     AND to_regprocedure('public.save_takeoff_atomic_internal(uuid,jsonb)') IS NULL THEN
    RAISE EXCEPTION 'save_takeoff_atomic(uuid,jsonb) is missing';
  END IF;

  IF to_regprocedure('public.save_takeoff_atomic_internal(uuid,jsonb)') IS NULL THEN
    ALTER FUNCTION public.save_takeoff_atomic(uuid, jsonb)
      RENAME TO save_takeoff_atomic_internal;
  END IF;
END
$block$;

REVOKE ALL ON FUNCTION public.save_takeoff_atomic_internal(uuid, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_takeoff_atomic_internal(uuid, jsonb)
  TO service_role;

CREATE OR REPLACE FUNCTION public.save_takeoff_atomic(
  p_quote_id uuid,
  p_payload jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;

  PERFORM public.save_takeoff_atomic_internal(p_quote_id, p_payload);
END;
$function$;

REVOKE ALL ON FUNCTION public.save_takeoff_atomic(uuid, jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_takeoff_atomic(uuid, jsonb)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.save_takeoff_atomic(uuid, jsonb) IS
  'Authenticated guard for the private atomic takeoff implementation.';
COMMENT ON FUNCTION public.save_takeoff_atomic_internal(uuid, jsonb) IS
  'Private atomic takeoff implementation. Call save_takeoff_atomic instead.';

DROP POLICY IF EXISTS "Authenticated can read change notifications"
  ON public.supplier_change_notifications;
DROP POLICY IF EXISTS "Suppliers read own notifications"
  ON public.supplier_change_notifications;
DROP POLICY IF EXISTS "Importers read subscribed notifications"
  ON public.supplier_change_notifications;
DROP POLICY IF EXISTS "Supplier can create own notifications"
  ON public.supplier_change_notifications;
DROP POLICY IF EXISTS "Suppliers create own notifications"
  ON public.supplier_change_notifications;

CREATE POLICY "Suppliers read own notifications"
  ON public.supplier_change_notifications FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.component_collections cc
      JOIN public.supplier_profiles sp ON sp.id = cc.supplier_profile_id
      WHERE cc.id = supplier_change_notifications.supplier_library_id
        AND sp.company_id = (
          SELECT company_id FROM public.users WHERE id = auth.uid()
        )
    )
  );

CREATE POLICY "Importers read subscribed notifications"
  ON public.supplier_change_notifications FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.component_library cl
      WHERE cl.source_library_id = supplier_change_notifications.supplier_library_id
        AND cl.company_id = (
          SELECT company_id FROM public.users WHERE id = auth.uid()
        )
    )
  );

CREATE POLICY "Suppliers create own notifications"
  ON public.supplier_change_notifications FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.component_collections cc
      JOIN public.supplier_profiles sp ON sp.id = cc.supplier_profile_id
      WHERE cc.id = supplier_change_notifications.supplier_library_id
        AND sp.company_id = (
          SELECT company_id FROM public.users WHERE id = auth.uid()
        )
    )
  );
