-- Migration: queue tracking + cancel support
-- Adds queue_wait_ms to ai_scan_jobs for tracking how long jobs wait before processing
-- Adds cancel_ai_scan_job RPC for user-initiated cancellation (only works on queued jobs)

-- Track how long a job sat in the queue before being claimed
ALTER TABLE public.ai_scan_jobs
  ADD COLUMN IF NOT EXISTS queue_wait_ms integer;

-- Index for quick queue analytics queries
CREATE INDEX IF NOT EXISTS idx_ai_scan_jobs_was_queued
  ON public.ai_scan_jobs (created_at)
  WHERE queue_wait_ms IS NOT NULL;

-- ── cancel_ai_scan_job ──────────────────────────────────────────────
-- Allows a user to cancel their queued job. Only works if status = 'queued'.
-- Returns points refund automatically.
CREATE OR REPLACE FUNCTION public.cancel_ai_scan_job(
  p_job_id uuid,
  p_company_id uuid
)
RETURNS TABLE(
  success boolean,
  status text,
  points_refunded boolean,
  points_remaining integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job RECORD;
  v_remaining integer;
BEGIN
  SELECT id, status, company_id, points_cost, points_state
    INTO v_job
    FROM ai_scan_jobs
    WHERE id = p_job_id AND company_id = p_company_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'NOT_FOUND'::text, false, 0;
    RETURN;
  END IF;

  -- Only allow cancellation of queued jobs (not running ones)
  IF v_job.status <> 'queued' THEN
    RETURN QUERY SELECT false, v_job.status, false, 0;
    RETURN;
  END IF;

  -- Mark as cancelled
  UPDATE ai_scan_jobs
    SET status = 'cancelled',
        completed_at = now(),
        points_state = CASE WHEN v_job.points_state = 'deducted' THEN 'refunded' ELSE v_job.points_state END
    WHERE id = p_job_id;

  -- Refund points if they were deducted
  IF v_job.points_state = 'deducted' THEN
    UPDATE company_ai_usage
      SET points_used = GREATEST(points_used - v_job.points_cost, 0)
      WHERE company_id = p_company_id;

    SELECT COALESCE(points_limit - points_used, 0)
      INTO v_remaining
      FROM company_ai_usage
      WHERE company_id = p_company_id;

    RETURN QUERY SELECT true, 'cancelled'::text, true, v_remaining;
  ELSE
    RETURN QUERY SELECT true, 'cancelled'::text, false, 0;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_ai_scan_job(uuid, uuid) TO authenticated;
