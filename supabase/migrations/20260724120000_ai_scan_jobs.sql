-- AI Scan Jobs — durable queue table + atomic submission/refund RPCs
-- Implements Gerald's capacity plan: server-side job queue with point accounting.
--
-- Point costs per scan: low=2, medium=4, high=8
-- Job lifecycle: queued → running → succeeded | failed | cancelled | refunded
-- Point lifecycle: reserved → charged | refunded

-- ═══════════════════════════════════════════════════════════════════
-- 1. ai_scan_jobs table
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS ai_scan_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  page_id UUID REFERENCES takeoff_pages(id) ON DELETE SET NULL,
  plan_priority INT NOT NULL DEFAULT 0,
  quality TEXT NOT NULL DEFAULT 'medium',
  idempotency_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  current_stage TEXT,
  points_cost INT NOT NULL,
  points_state TEXT NOT NULL DEFAULT 'reserved',
  attempt_count INT NOT NULL DEFAULT 0,
  result JSONB,
  intermediate_result JSONB,
  failure_code TEXT,
  failure_message TEXT,
  available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  image_data TEXT,
  canvas_width INT,
  canvas_height INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Idempotency: same company + key = same job (prevents double-charge on retry/refresh)
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_scan_jobs_idempotency
  ON ai_scan_jobs(company_id, idempotency_key);

-- Active job constraint: one active job per company+page at a time
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_scan_jobs_active_page
  ON ai_scan_jobs(company_id, page_id)
  WHERE status IN ('queued', 'running');

-- Queue index: worker claims by status + priority + available_at
CREATE INDEX IF NOT EXISTS idx_ai_scan_jobs_queue
  ON ai_scan_jobs(status, plan_priority DESC, available_at ASC);

-- Company lookup (for "do I have an active job?" queries)
CREATE INDEX IF NOT EXISTS idx_ai_scan_jobs_company
  ON ai_scan_jobs(company_id, status);

-- ═══════════════════════════════════════════════════════════════════
-- 2. RPC: submit_ai_scan_job
--    Atomically: idempotency check → active-job check → priority lookup
--    → point deduction → job creation.
--    Returns the existing job if idempotency key matches (no double charge).
-- ═══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.submit_ai_scan_job(
  p_company_id UUID,
  p_user_id UUID,
  p_quote_id UUID,
  p_page_id UUID,
  p_quality TEXT,
  p_idempotency_key TEXT,
  p_image_data TEXT,
  p_canvas_width INT DEFAULT 800,
  p_canvas_height INT DEFAULT 600
) RETURNS TABLE(
  job_id UUID,
  status TEXT,
  points_cost INT,
  points_remaining INT,
  point_limit INT,
  is_existing BOOLEAN,
  error TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_id UUID;
  v_existing_status TEXT;
  v_existing_cost INT;
  v_plan_priority INT;
  v_points_cost INT;
  v_deduct_result RECORD;
  v_remaining INT;
  v_limit INT;
  v_effective_plan TEXT;
BEGIN
  -- 1. Idempotency check: return existing job without charging again
  SELECT id, status, points_cost INTO v_existing_id, v_existing_status, v_existing_cost
  FROM ai_scan_jobs
  WHERE company_id = p_company_id AND idempotency_key = p_idempotency_key;

  IF FOUND THEN
    SELECT remaining INTO v_remaining FROM public.get_ai_assist_points_status(p_company_id);
    SELECT ai_assist_points_limit INTO v_limit
    FROM subscription_plans sp
    WHERE sp.code = public.company_effective_plan_code(p_company_id);

    RETURN QUERY SELECT v_existing_id, v_existing_status, v_existing_cost,
      v_remaining, v_limit, true, NULL::TEXT;
    RETURN;
  END IF;

  -- 2. Reject if company already has an active job on this page
  PERFORM 1 FROM ai_scan_jobs
  WHERE company_id = p_company_id
    AND page_id = p_page_id
    AND status IN ('queued', 'running');

  IF FOUND THEN
    RETURN QUERY SELECT NULL::UUID, NULL::TEXT, NULL::INT, NULL::INT, NULL::INT, false,
      'ACTIVE_JOB_EXISTS'::TEXT;
    RETURN;
  END IF;

  -- 3. Determine plan priority
  v_effective_plan := public.company_effective_plan_code(p_company_id);
  v_plan_priority := CASE
    WHEN v_effective_plan = 'pro_plus' THEN 30
    WHEN v_effective_plan = 'pro' THEN 20
    WHEN v_effective_plan = 'growth' THEN 15
    WHEN v_effective_plan = 'starter' THEN 10
    ELSE 0  -- trial/free
  END;

  -- 4. Derive point cost from quality
  v_points_cost := CASE p_quality
    WHEN 'low' THEN 2
    WHEN 'medium' THEN 4
    WHEN 'high' THEN 8
    ELSE 4
  END;

  -- 5. Atomically check + deduct points
  SELECT * INTO v_deduct_result FROM public.check_and_deduct_ai_points(p_company_id, v_points_cost);

  IF NOT v_deduct_result.allowed THEN
    RETURN QUERY SELECT NULL::UUID, NULL::TEXT, NULL::INT,
      v_deduct_result.remaining, v_deduct_result.point_limit, false,
      v_deduct_result.error;
    RETURN;
  END IF;

  -- 6. Create the queued job
  INSERT INTO ai_scan_jobs (
    company_id, user_id, quote_id, page_id,
    plan_priority, quality, idempotency_key,
    status, points_cost, points_state,
    image_data, canvas_width, canvas_height,
    available_at
  ) VALUES (
    p_company_id, p_user_id, p_quote_id, p_page_id,
    v_plan_priority, p_quality, p_idempotency_key,
    'queued', v_points_cost, 'reserved',
    p_image_data, p_canvas_width, p_canvas_height,
    now()
  )
  RETURNING id, points_cost INTO v_existing_id, v_existing_cost;

  v_remaining := v_deduct_result.remaining;

  RETURN QUERY SELECT v_existing_id, 'queued'::TEXT, v_existing_cost,
    v_remaining, v_deduct_result.point_limit, false, NULL::TEXT;
  RETURN;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- 3. RPC: refund_ai_scan_points
--    Called on terminal failure/timeout/cancel.
--    Adds points back to company balance and marks job as refunded.
--    Idempotent: only refunds if points_state = 'reserved'.
-- ═══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.refund_ai_scan_points(
  p_job_id UUID
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job ai_scan_jobs%ROWTYPE;
BEGIN
  SELECT * INTO v_job FROM ai_scan_jobs WHERE id = p_job_id FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  IF v_job.points_state != 'reserved' THEN RETURN false; END IF;

  -- Refund points back to company balance
  UPDATE companies
  SET ai_assist_points_used = GREATEST(ai_assist_points_used - v_job.points_cost, 0)
  WHERE id = v_job.company_id;

  -- Mark job as refunded
  UPDATE ai_scan_jobs
  SET points_state = 'refunded',
      status = CASE WHEN status = 'running' THEN 'failed' ELSE status END,
      updated_at = now()
  WHERE id = p_job_id;

  RETURN true;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- 4. RPC: claim_ai_scan_job
--    Worker calls this to atomically claim the next queued job.
--    Enforces global active-job limit and per-company limit.
--    Returns the claimed job or NULL if nothing to claim.
-- ═══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.claim_ai_scan_job(
  p_max_active_jobs INT DEFAULT 2,
  p_max_per_company INT DEFAULT 1
) RETURNS TABLE(
  id UUID,
  company_id UUID,
  user_id UUID,
  quote_id UUID,
  page_id UUID,
  quality TEXT,
  points_cost INT,
  attempt_count INT,
  image_data TEXT,
  canvas_width INT,
  canvas_height INT,
  current_stage TEXT,
  intermediate_result JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_active_count INT;
  v_claimed_id UUID;
  v_job RECORD;
BEGIN
  -- Count currently running jobs
  SELECT COUNT(*) INTO v_active_count
  FROM ai_scan_jobs WHERE status = 'running';

  IF v_active_count >= p_max_active_jobs THEN
    -- Queue is full, nothing to claim
    RETURN;
  END IF;

  -- Claim the highest-priority oldest-available job that doesn't exceed per-company limit
  -- Using FOR UPDATE SKIP LOCKED for safe concurrent claiming
  FOR v_job IN
    SELECT * FROM ai_scan_jobs
    WHERE status = 'queued'
      AND available_at <= now()
      AND company_id NOT IN (
        SELECT company_id FROM ai_scan_jobs
        WHERE status = 'running'
        GROUP BY company_id
        HAVING COUNT(*) >= p_max_per_company
      )
    ORDER BY plan_priority DESC, available_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT 1
  LOOP
    -- Claim it
    UPDATE ai_scan_jobs
    SET status = 'running',
        started_at = now(),
        attempt_count = attempt_count + 1,
        updated_at = now()
    WHERE id = v_job.id AND status = 'queued'
    RETURNING id INTO v_claimed_id;

    IF v_claimed_id IS NOT NULL THEN
      RETURN QUERY SELECT
        v_job.id, v_job.company_id, v_job.user_id, v_job.quote_id,
        v_job.page_id, v_job.quality, v_job.points_cost,
        v_job.attempt_count + 1, v_job.image_data,
        v_job.canvas_width, v_job.canvas_height,
        v_job.current_stage, v_job.intermediate_result;
      RETURN;
    END IF;
  END LOOP;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- 5. RPC: complete_ai_scan_job
--    Called by worker on success. Charges points (reserved→charged),
--    stores result, marks succeeded.
-- ═══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.complete_ai_scan_job(
  p_job_id UUID,
  p_result JSONB
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE ai_scan_jobs
  SET status = 'succeeded',
      points_state = 'charged',
      result = p_result,
      current_stage = NULL,
      completed_at = now(),
      updated_at = now()
  WHERE id = p_job_id AND status = 'running';
  RETURN FOUND;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- 6. RPC: fail_ai_scan_job
--    Called by worker on terminal failure. Refunds points, stores error.
-- ═══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.fail_ai_scan_job(
  p_job_id UUID,
  p_failure_code TEXT,
  p_failure_message TEXT,
  p_should_refund BOOLEAN DEFAULT true
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_refunded BOOLEAN := false;
BEGIN
  IF p_should_refund THEN
    SELECT public.refund_ai_scan_points(p_job_id) INTO v_refunded;
  END IF;

  UPDATE ai_scan_jobs
  SET status = 'failed',
      failure_code = p_failure_code,
      failure_message = p_failure_message,
      current_stage = NULL,
      completed_at = now(),
      updated_at = now()
  WHERE id = p_job_id AND status IN ('running', 'queued');

  RETURN FOUND;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- 7. RPC: update_scan_stage
--    Called by worker after each scan stage to persist progress.
--    Enables refresh/retry to resume from the last completed stage.
-- ═══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.update_scan_stage(
  p_job_id UUID,
  p_stage TEXT,
  p_intermediate_result JSONB DEFAULT NULL
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE ai_scan_jobs
  SET current_stage = p_stage,
      intermediate_result = COALESCE(p_intermediate_result, intermediate_result),
      updated_at = now()
  WHERE id = p_job_id AND status = 'running';
  RETURN FOUND;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- 8. RPC: requeue_stale_scan_jobs
--    Called by cron to requeue jobs stuck in 'running' beyond timeout.
--    Refunds points for timed-out jobs and marks them failed.
-- ═══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.requeue_stale_scan_jobs(
  p_timeout_seconds INT DEFAULT 360
) RETURNS TABLE(requeued_count INT, failed_count INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_requeued INT := 0;
  v_failed INT := 0;
  v_job RECORD;
BEGIN
  -- Find jobs stuck in running beyond timeout
  FOR v_job IN
    SELECT id FROM ai_scan_jobs
    WHERE status = 'running'
      AND started_at IS NOT NULL
      AND now() - started_at > (p_timeout_seconds || ' seconds')::INTERVAL
    FOR UPDATE
  LOOP
    -- Refund + fail the stuck job
    PERFORM public.fail_ai_scan_job(v_job.id, 'TIMEOUT', 'Job exceeded timeout limit', true);
    v_failed := v_failed + 1;
  END LOOP;

  -- Requeue jobs in 'queued' that have been waiting too long and have attempt_count < 3
  -- (these were likely abandoned by a crashed worker before processing started)
  UPDATE ai_scan_jobs
  SET available_at = now(),
      updated_at = now()
  WHERE status = 'queued'
    AND attempt_count = 0
    AND available_at < now() - interval '5 minutes';

  GET DIAGNOSTICS v_requeued = ROW_COUNT;

  RETURN QUERY SELECT v_requeued, v_failed;
  RETURN;
END;
$$;
