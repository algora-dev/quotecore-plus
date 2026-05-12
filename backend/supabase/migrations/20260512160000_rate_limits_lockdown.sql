-- Lock down `consume_rate_limit` and schedule cleanup. Closes Gerald H-01
-- and M-01 from the 2026-05-12 audit.
--
-- H-01: the original 20260512100000 migration granted EXECUTE on the RPC
-- to `anon` and `authenticated`. That gives anyone with the public anon
-- key the ability to call the function directly with any bucket key,
-- which means:
--   * Targeted lockouts: increment `recovery-lookup-email:<victim>` until
--     they can't recover their account.
--   * DB bloat: insert arbitrarily many distinct keys.
-- The app-side caller in `app/lib/security/rateLimit.ts` only uses the
-- service-role client, so revoking the public grants is safe.
--
-- M-01: `prune_rate_limits()` exists but had no schedule. We now (1) cap
-- bucket-key length to 256 characters at the function boundary so a
-- compromised service role still can't write unbounded keys, and (2)
-- schedule the prune via pg_cron at 04:17 UTC daily. If pg_cron is not
-- available on this project, the schedule call is wrapped in a DO block
-- that swallows the missing-extension error so the migration still
-- applies; the runbook (memory/MEMORY.md) then carries the cron task.

-- 1. Tighten privileges. service_role retains EXECUTE; everyone else
--    loses it. Drop public default too, just in case.
REVOKE EXECUTE ON FUNCTION public.consume_rate_limit(text, integer, integer)
  FROM anon, authenticated, public;

-- 2. Cap bucket-key length. 256 is comfortably above any legitimate key
--    we generate (longest live shape today is
--    `recovery-lookup-email:<lowercased-email>` ~ 25 + 254 chars; cap at
--    256 because we also lowercase and validate emails upstream so real
--    keys never approach the limit).
CREATE OR REPLACE FUNCTION public.consume_rate_limit(
  p_key text,
  p_max integer,
  p_window_ms integer
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_window_start timestamptz;
  v_count integer;
BEGIN
  IF p_key IS NULL OR length(p_key) = 0 THEN
    RAISE EXCEPTION 'rate_limit: key must be non-empty';
  END IF;
  IF length(p_key) > 256 THEN
    RAISE EXCEPTION 'rate_limit: key length exceeds 256';
  END IF;
  IF p_max IS NULL OR p_max <= 0 THEN
    RAISE EXCEPTION 'rate_limit: max must be positive';
  END IF;
  IF p_window_ms IS NULL OR p_window_ms <= 0 THEN
    RAISE EXCEPTION 'rate_limit: window_ms must be positive';
  END IF;

  v_window_start := to_timestamp(
    (floor(extract(epoch FROM now()) * 1000 / p_window_ms)::bigint) * p_window_ms / 1000.0
  );

  INSERT INTO public.rate_limits (bucket_key, window_start, count)
    VALUES (p_key, v_window_start, 1)
  ON CONFLICT (bucket_key, window_start)
  DO UPDATE SET
    count = public.rate_limits.count + 1,
    updated_at = now()
  RETURNING count INTO v_count;

  RETURN v_count <= p_max;
END;
$$;

-- Re-apply grants explicitly. service_role is the only allowed caller.
REVOKE ALL ON FUNCTION public.consume_rate_limit(text, integer, integer) FROM public;
REVOKE EXECUTE ON FUNCTION public.consume_rate_limit(text, integer, integer)
  FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_rate_limit(text, integer, integer)
  TO service_role;

COMMENT ON FUNCTION public.consume_rate_limit(text, integer, integer) IS
  'Atomic "take one token" for distributed rate limiting; service_role only. Closes Gerald H-01.';

-- 3. Schedule daily prune. pg_cron may not be enabled on every Supabase
--    project tier; wrap in a DO block so the migration is forgiving. If
--    it doesn't schedule, MEMORY.md carries the manual runbook entry.
DO $$
BEGIN
  PERFORM 1
  FROM pg_extension
  WHERE extname = 'pg_cron';

  IF FOUND THEN
    -- Unschedule any previous version of the job (safe if absent).
    BEGIN
      PERFORM cron.unschedule('rate_limits_prune_daily');
    EXCEPTION WHEN OTHERS THEN
      -- ignore: never scheduled
      NULL;
    END;
    PERFORM cron.schedule(
      'rate_limits_prune_daily',
      '17 4 * * *',
      $cron$ SELECT public.prune_rate_limits(); $cron$
    );
  ELSE
    RAISE NOTICE 'pg_cron not installed; rate_limits prune must be scheduled manually (see MEMORY.md).';
  END IF;
END $$;
