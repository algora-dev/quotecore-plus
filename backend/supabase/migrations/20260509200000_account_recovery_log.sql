-- Audit trail for self-service account recovery (Flow 2 — "lost email access").
--
-- Every recovery attempt — successful or not — writes a row here. This gives
-- support an after-the-fact view to:
--   * detect brute-force patterns
--   * confirm a user's claim that they recovered ("yes, we have a row")
--   * spot suspicious recoveries (e.g. unfamiliar IPs, multiple in a day)
--
-- We log the OLD email and the NEW email (when applicable). We DO NOT log the
-- typed answers — only whether they matched. A failure row is still useful
-- for rate-limit / abuse signals.
--
-- Rows are kept indefinitely for now; we can add a retention policy later.

CREATE TABLE IF NOT EXISTS public.account_recovery_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  old_email text,
  new_email text,
  -- Outcome of this attempt: which step the flow reached and whether it succeeded.
  -- 'lookup_no_match'    : email not found / not eligible (returned generic UX)
  -- 'verify_failed'      : answer(s) did not match
  -- 'verify_succeeded'   : answers OK, awaiting new email
  -- 'finalised'          : email + sessions reset, password-reset email sent
  -- 'rate_limited'       : request hit the per-IP or per-account cap
  outcome text NOT NULL CHECK (outcome IN ('lookup_no_match','verify_failed','verify_succeeded','finalised','rate_limited')),
  ip text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_account_recovery_log_user_id
  ON public.account_recovery_log (user_id);
CREATE INDEX IF NOT EXISTS idx_account_recovery_log_created_at
  ON public.account_recovery_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_account_recovery_log_old_email
  ON public.account_recovery_log (old_email);

-- No client-side reads. RLS denies everything by default; only the service
-- role (used by server actions) can write or read.
ALTER TABLE public.account_recovery_log ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.account_recovery_log IS
  'Audit trail of self-service account recovery attempts (Flow 2: lost email). Service-role only; RLS denies all client access.';
