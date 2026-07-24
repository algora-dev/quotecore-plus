-- Migration: add created_at to claim_ai_scan_job return
-- Needed for queue_wait_ms tracking

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
  intermediate_result JSONB,
  created_at TIMESTAMPTZ
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
  SELECT COUNT(*) INTO v_active_count
  FROM ai_scan_jobs WHERE status = 'running';

  IF v_active_count >= p_max_active_jobs THEN
    RETURN;
  END IF;

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
        v_job.current_stage, v_job.intermediate_result,
        v_job.created_at;
      RETURN;
    END IF;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_ai_scan_job(INT, INT) TO authenticated;
