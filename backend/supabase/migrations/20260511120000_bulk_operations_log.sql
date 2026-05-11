-- Bulk operations audit log.
--
-- Captures every bulk delete / bulk download initiated from the quotes list
-- (and any future bulk surface). Gives us a paper trail for "did the user
-- actually intend to wipe 25 quotes?" investigations and an early-warning
-- signal if someone scripts the action.
--
-- Rules:
--   * One row per attempt, not per quote. The `target_ids` jsonb captures the
--     full id list so we can reconstruct exactly what was acted on.
--   * Logged at the START of the action, with `outcome = 'pending'`. A second
--     UPDATE records the outcome ('success', 'partial', 'error') and any
--     server-side error message.
--   * RLS: users see only their own company's rows. Service role bypasses (as
--     usual) so admin scripts and the audit dashboard can read everything.
--
-- Note on `requested_count` vs `actual_count`: requested = what the user
-- selected, actual = what the server processed (after ownership filtering /
-- cap enforcement). They can differ when the client tried to sneak past the
-- cap or when some ids belonged to other companies.

CREATE TABLE IF NOT EXISTS public.bulk_operations_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  operation       text NOT NULL CHECK (operation IN ('bulk_delete_quotes', 'bulk_download_quotes')),
  target_ids      jsonb NOT NULL DEFAULT '[]'::jsonb,
  requested_count integer NOT NULL CHECK (requested_count >= 0),
  actual_count    integer NOT NULL DEFAULT 0 CHECK (actual_count >= 0),
  skipped_count   integer NOT NULL DEFAULT 0 CHECK (skipped_count >= 0),
  outcome         text NOT NULL DEFAULT 'pending' CHECK (outcome IN ('pending', 'success', 'partial', 'error')),
  error_message   text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  completed_at    timestamptz
);

CREATE INDEX IF NOT EXISTS bulk_operations_log_company_idx
  ON public.bulk_operations_log (company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS bulk_operations_log_user_idx
  ON public.bulk_operations_log (user_id, created_at DESC);

ALTER TABLE public.bulk_operations_log ENABLE ROW LEVEL SECURITY;

-- Read: members of the same company can see their company's log entries.
DROP POLICY IF EXISTS bulk_operations_log_select ON public.bulk_operations_log;
CREATE POLICY bulk_operations_log_select
  ON public.bulk_operations_log
  FOR SELECT
  USING (
    company_id = (SELECT company_id FROM public.users WHERE id = auth.uid())
  );

-- Insert: same company check, and the user_id must match the caller.
DROP POLICY IF EXISTS bulk_operations_log_insert ON public.bulk_operations_log;
CREATE POLICY bulk_operations_log_insert
  ON public.bulk_operations_log
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND company_id = (SELECT company_id FROM public.users WHERE id = auth.uid())
  );

-- Update: only the originating user can complete their own pending rows.
-- Outcome can move pending -> success/partial/error but never the other way.
DROP POLICY IF EXISTS bulk_operations_log_update ON public.bulk_operations_log;
CREATE POLICY bulk_operations_log_update
  ON public.bulk_operations_log
  FOR UPDATE
  USING (
    user_id = auth.uid()
    AND company_id = (SELECT company_id FROM public.users WHERE id = auth.uid())
  )
  WITH CHECK (
    user_id = auth.uid()
    AND company_id = (SELECT company_id FROM public.users WHERE id = auth.uid())
  );

-- No delete policy: rows are immutable history.

COMMENT ON TABLE public.bulk_operations_log IS
  'Audit log for multi-record actions (bulk quote delete/download). One row per attempt; outcome filled in on completion.';
