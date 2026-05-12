-- M-03: distributed rate limit storage.
--
-- Replaces the in-memory rate limiter (app/lib/security/rateLimit.ts) which
-- silently reset on every Vercel cold start. We store one row per
-- (bucket_key, window_start) pair and increment atomically via an
-- INSERT ... ON CONFLICT.
--
-- Callers use the `consume_rate_limit(p_key text, p_max int, p_window_ms int)`
-- RPC, which returns true when the request is within the budget and false
-- when it's over. The function is SECURITY DEFINER so we can lock down
-- direct table access while still letting RLS-bound clients hit the RPC.
--
-- Cleanup: a daily prune job removes rows whose window has been closed for
-- more than 7 days. Kept tiny by the WHERE clause + the unique index.

CREATE TABLE IF NOT EXISTS public.rate_limits (
  bucket_key   text        NOT NULL,
  window_start timestamptz NOT NULL,
  count        integer     NOT NULL DEFAULT 0,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (bucket_key, window_start)
);

-- Helps the prune job and ad-hoc lookups.
CREATE INDEX IF NOT EXISTS rate_limits_window_idx
  ON public.rate_limits (window_start);

-- Lock the table. We only let callers in through the RPC.
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- No SELECT/INSERT/UPDATE/DELETE policies => RLS denies by default for
-- anon/authenticated. The SECURITY DEFINER function below is the only way
-- in for app code; service_role bypasses RLS for ops/backups.

/**
 * consume_rate_limit
 *
 * Atomic "take one token" call. Bucket-by-key, fixed window of p_window_ms.
 *   - p_key:        opaque string the caller composes (e.g. "recovery-lookup-ip:1.2.3.4")
 *   - p_max:        maximum allowed hits inside the window
 *   - p_window_ms:  window size in milliseconds (we anchor the window by
 *                   flooring `now()` to a multiple of the window size, so the
 *                   bucket is shared across all replicas without coordination)
 *
 * Returns true when the caller is within budget, false when the budget for
 * the current window has been spent.
 */
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
  IF p_max IS NULL OR p_max <= 0 THEN
    RAISE EXCEPTION 'rate_limit: max must be positive';
  END IF;
  IF p_window_ms IS NULL OR p_window_ms <= 0 THEN
    RAISE EXCEPTION 'rate_limit: window_ms must be positive';
  END IF;

  -- Anchor the window. floor(epoch_ms / window_ms) * window_ms gives a
  -- stable bucket start that's identical on every replica without needing
  -- a clock-sync round-trip.
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

REVOKE ALL ON FUNCTION public.consume_rate_limit(text, integer, integer) FROM public;
GRANT EXECUTE ON FUNCTION public.consume_rate_limit(text, integer, integer)
  TO anon, authenticated, service_role;

/**
 * prune_rate_limits
 *
 * Deletes rows whose window closed more than 7 days ago. Safe to call from
 * any role with EXECUTE on the function. Returns the number of deleted rows.
 */
CREATE OR REPLACE FUNCTION public.prune_rate_limits()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_deleted integer;
BEGIN
  DELETE FROM public.rate_limits
    WHERE window_start < now() - interval '7 days';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.prune_rate_limits() FROM public;
GRANT EXECUTE ON FUNCTION public.prune_rate_limits() TO service_role;

COMMENT ON TABLE public.rate_limits IS
  'Distributed rate-limit counters. See app/lib/security/rateLimit.ts.';
COMMENT ON FUNCTION public.consume_rate_limit(text, integer, integer) IS
  'Atomic "take one token" for distributed rate limiting; returns true when within budget.';
COMMENT ON FUNCTION public.prune_rate_limits() IS
  'Deletes rate_limits rows whose window closed >7 days ago.';
