# AI Capacity & Queue Implementation Plan

> Source: Gerald audit `05-ai-capacity-implementation-plan.md` (2026-07-24)
> Status: **PLANNING** — not started
> Estimated scope: 2-3 sessions

---

## Current State Summary

The AI takeoff system works but has critical gaps under load:

- **3-scan pipeline** (scan1→scan2→scan3) is **client-driven** — 3 sequential `fetch()` calls from `TakeoffWorkstation.tsx` to `/api/takeoff/ai-scan-v3`
- **Points deducted on scan1** via `check_and_deduct_ai_points` RPC — **no refund** if scan2/3 fail
- **No concurrency control** — N simultaneous users = N simultaneous GPT-5.6 calls
- **No job persistence** — refresh the page mid-scan = lost job, lost points
- **Single `OPENAI_API_KEY`** shared across takeoff, free tools, and document parsing
- **Connection held open** for full pipeline duration (up to 5 min on medium quality)

---

## Implementation Phases

### Phase 1: Database — `ai_scan_jobs` Table + RPC Updates

**Goal:** Persistent job queue with atomic point accounting.

**Migration: `20260724120000_ai_scan_jobs.sql`**

```sql
CREATE TABLE ai_scan_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  user_id UUID NOT REFERENCES auth.users(id),
  quote_id UUID NOT NULL REFERENCES quotes(id),
  page_id UUID REFERENCES takeoff_pages(id),
  plan_priority INT NOT NULL DEFAULT 0,  -- 0=trial, 10=starter, 20=pro, 30=pro_plus
  quality TEXT NOT NULL DEFAULT 'medium', -- low | medium | high
  idempotency_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',  -- queued | running | succeeded | failed | cancelled | refunded
  current_stage TEXT,                     -- scan1 | scan2 | scan3 | applying
  points_cost INT NOT NULL,
  points_state TEXT NOT NULL DEFAULT 'reserved', -- reserved | charged | refunded
  attempt_count INT NOT NULL DEFAULT 0,
  result JSONB,                           -- final AiScanResult data
  failure_code TEXT,
  failure_message TEXT,
  available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Idempotency: same company + key = same job
CREATE UNIQUE INDEX idx_ai_scan_jobs_idempotency ON ai_scan_jobs(company_id, idempotency_key);

-- Active job constraint: one active job per company+page
CREATE UNIQUE INDEX idx_ai_scan_jobs_active_page ON ai_scan_jobs(company_id, page_id) WHERE status IN ('queued', 'running');

-- Queue index: priority DESC, available_at ASC, status
CREATE INDEX idx_ai_scan_jobs_queue ON ai_scan_jobs(status, plan_priority DESC, available_at ASC);

-- Company lookup
CREATE INDEX idx_ai_scan_jobs_company ON ai_scan_jobs(company_id, status);
```

**RPC: `submit_ai_scan_job`** (replaces client-directed scan1 call)

```sql
CREATE OR REPLACE FUNCTION submit_ai_scan_job(
  p_company_id UUID,
  p_user_id UUID,
  p_quote_id UUID,
  p_page_id UUID,
  p_quality TEXT,
  p_idempotency_key TEXT
) RETURNS TABLE (
  job_id UUID,
  status TEXT,
  points_cost INT,
  points_remaining INT,
  is_existing BOOLEAN,
  error TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_existing_job ai_scan_jobs%ROWTYPE;
  v_plan_priority INT;
  v_points_cost INT;
  v_balance INT;
  v_limit INT;
BEGIN
  -- 1. Check for existing job with same idempotency key
  SELECT * INTO v_existing_job FROM ai_scan_jobs
  WHERE company_id = p_company_id AND idempotency_key = p_idempotency_key;
  IF FOUND THEN
    RETURN QUERY SELECT v_existing_job.id, v_existing_job.status, v_existing_job.points_cost,
      (SELECT remaining FROM get_ai_assist_points_status(p_company_id)),
      true, NULL;
    RETURN;
  END IF;

  -- 2. Reject if company already has active job on this page
  PERFORM 1 FROM ai_scan_jobs
  WHERE company_id = p_company_id AND page_id = p_page_id
    AND status IN ('queued', 'running');
  IF FOUND THEN
    RETURN QUERY SELECT NULL::UUID, NULL::TEXT, NULL::INT, NULL::INT, false, 'ACTIVE_JOB_EXISTS';
    RETURN;
  END IF;

  -- 3. Determine priority from effective plan
  SELECT CASE
    WHEN effective_plan_code IN ('pro_plus') THEN 30
    WHEN effective_plan_code IN ('pro') THEN 20
    WHEN effective_plan_code IN ('starter') THEN 10
    ELSE 0  -- trial/free
  END INTO v_plan_priority
  FROM companies WHERE id = p_company_id;

  -- 4. Derive cost
  v_points_cost := CASE p_quality WHEN 'low' THEN 2 WHEN 'medium' THEN 4 WHEN 'high' THEN 8 ELSE 4 END;

  -- 5. Check + deduct points atomically
  SELECT * FROM check_and_deduct_ai_points(p_company_id, v_points_cost);
  -- If that failed (allowed=false), return error
  -- (check_and_deduct_ai_points already handles the atomic check+deduct)

  -- 6. Create job
  INSERT INTO ai_scan_jobs (
    company_id, user_id, quote_id, page_id,
    plan_priority, quality, idempotency_key,
    status, points_cost, points_state, available_at
  ) VALUES (
    p_company_id, p_user_id, p_quote_id, p_page_id,
    v_plan_priority, p_quality, p_idempotency_key,
    'queued', v_points_cost, 'reserved', now()
  ) RETURNING id INTO v_existing_job.id;

  RETURN QUERY SELECT v_existing_job.id, 'queued', v_points_cost,
    (SELECT remaining FROM get_ai_assist_points_status(p_company_id)),
    false, NULL;
END;
$$;
```

**RPC: `refund_ai_scan_points`** (called on terminal failure)

```sql
CREATE OR REPLACE FUNCTION refund_ai_scan_points(p_job_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_job ai_scan_jobs%ROWTYPE;
BEGIN
  SELECT * INTO v_job FROM ai_scan_jobs WHERE id = p_job_id FOR UPDATE;
  IF NOT FOUND OR v_job.points_state != 'reserved' THEN RETURN false; END IF;

  -- Refund points (add back to balance)
  UPDATE company_ai_usage
  SET points_used = points_used - v_job.points_cost
  WHERE company_id = v_job.company_id;

  -- Mark refunded
  UPDATE ai_scan_jobs SET points_state = 'refunded', status = 'refunded', updated_at = now()
  WHERE id = p_job_id;

  RETURN true;
END;
$$;
```

**Files touched:**
- New migration file
- `database.types.ts` regeneration after migration

---

### Phase 2: Server-Side Worker

**Goal:** Durable worker that claims queued jobs and runs the 3-scan pipeline server-side.

**New file: `app/lib/takeoff/scan-worker.ts`**

Worker logic:
1. **Claim:** `SELECT ... FOR UPDATE SKIP LOCKED` on `ai_scan_jobs WHERE status='queued' ORDER BY plan_priority DESC, available_at ASC LIMIT 1`
2. **Concurrency check:** Count active jobs; reject if `>= TAKEOFF_MAX_ACTIVE_JOBS` (env, default 2). Also enforce `TAKEOFF_MAX_ACTIVE_PER_COMPANY=1`.
3. **Run pipeline:** scan1 → scan2 → scan3 using existing `callVisionModel` + prompt logic extracted from `ai-scan-v3/route.ts`
4. **Persist after each stage:** Update `ai_scan_jobs.current_stage` and intermediate `result` JSONB after each scan
5. **Retry:** On 429/5xx/network — exponential backoff + jitter, max 3 attempts (`TAKEOFF_MAX_ATTEMPTS`)
6. **On success:** Set `status='succeeded'`, `points_state='charged'`, store final result in `result` JSONB
7. **On terminal failure:** Call `refund_ai_scan_points`, set `status='failed'` with error details
8. **Timeout:** `TAKEOFF_JOB_TIMEOUT_SECONDS=360` — if exceeded, mark failed + refund

**Worker trigger options (pick one):**

| Option | Pros | Cons |
|---|---|---|
| Vercel Cron (every 30s) | No infra, runs on free tier | Up to 30s delay before job starts |
| Vercel Edge function on-demand | Instant start | Complex to keep alive |
| Client-triggered (lazy) | Simplest — API call checks + runs | Still holds connection partially |

**Recommendation:** Start with **Vercel Cron** (every 30s) for simplicity. The 30s max delay is acceptable for a launch product. Move to a dedicated worker if volume demands it.

**Extract shared scan logic:**
- Move `callVisionModel`, `preprocessImage`, `validatePolygon`, `filterAngleValid`, `validateConnectivity`, `classificationsToComponents`, `perimeterAccountingPass` etc. from `route.ts` into `app/lib/takeoff/scan-engine.ts`
- Both the worker and any legacy endpoints import from `scan-engine.ts`

**Files touched:**
- New: `app/lib/takeoff/scan-engine.ts` (extracted from route.ts)
- New: `app/lib/takeoff/scan-worker.ts`
- New: `app/api/cron/process-ai-scan-queue/route.ts` (cron trigger)
- Modified: `app/api/takeoff/ai-scan-v3/route.ts` (simplified or deprecated)

---

### Phase 3: New Submission + Status API

**Goal:** Replace client-driven 3-fetch flow with single submission + polling.

**New: `POST /api/takeoff/scan-jobs`**

Request:
```json
{
  "quoteId": "uuid",
  "pageId": "uuid",
  "qualityLevel": "medium",
  "image": "data:image/png;base64,...",
  "canvasDimensions": { "width": 800, "height": 600 }
}
```

Response (200):
```json
{
  "success": true,
  "jobId": "uuid",
  "status": "queued",
  "pointsCost": 4,
  "pointsRemaining": 16,
  "isExisting": false
}
```

Response (402 — insufficient points):
```json
{
  "success": false,
  "error": "AI Assist points limit reached.",
  "pointsExhausted": true,
  "pointsRemaining": 0
}
```

Response (409 — active job exists):
```json
{
  "success": false,
  "error": "You already have a scan running on this page.",
  "existingJobId": "uuid",
  "status": "running"
}
```

**New: `GET /api/takeoff/scan-jobs?jobId=uuid`**

Returns current job state + result (if succeeded):

```json
{
  "jobId": "uuid",
  "status": "running",
  "currentStage": "scan2",
  "quality": "medium",
  "pointsCost": 4,
  "result": null,
  "error": null
}
```

On success:
```json
{
  "jobId": "uuid",
  "status": "succeeded",
  "currentStage": null,
  "quality": "medium",
  "pointsCost": 4,
  "result": { /* AiScanResult — same shape as current scan3 response */ },
  "error": null
}
```

On failure:
```json
{
  "jobId": "uuid",
  "status": "failed",
  "currentStage": "scan2",
  "quality": "medium",
  "pointsCost": 4,
  "pointsRefunded": true,
  "result": null,
  "error": "Line detection failed: OpenAI timeout"
}
```

**Files touched:**
- New: `app/api/takeoff/scan-jobs/route.ts` (POST = submit, GET = status)
- Modified: `app/api/takeoff/scan-jobs/route.ts` (imports from scan-engine.ts)

---

### Phase 4: Client Refactor — `TakeoffWorkstation.tsx`

**Goal:** Replace 3-fetch sequential flow with submit + poll.

**Changes to `handleAiScan()`:**

1. Generate `idempotencyKey` (UUID v4) client-side
2. `POST /api/takeoff/scan-jobs` with image + quality + key
3. If 402 → show points exhausted (same as current)
4. If 409 → navigate to existing job (start polling)
5. If 200 → start polling `GET /api/takeoff/scan-jobs?jobId=...`
6. Poll every 3 seconds
7. Update `aiScanStage` state from `currentStage` in poll response
8. On `status='succeeded'` → show results modal (same as current)
9. On `status='failed'` → show error + "points refunded" message

**State changes:**
- `aiScanStage` now reflects: `queued | scan1 | scan2 | scan3 | applying | done | failed`
- Add `aiJobId` state for tracking the active job
- On page load / remount: check for existing active job on current page (via `GET /api/takeoff/scan-jobs?quoteId=...&pageId=...`), resume polling if found

**Remove from client:**
- `runRemainingAiScans()` function (3-fetch sequential logic)
- Direct calls to `/api/takeoff/ai-scan-v3` with `stage` param
- Client-side point cost calculation (`const cost = ...`)

**Files touched:**
- Modified: `TakeoffWorkstation.tsx` (significant — ~200 lines of scan logic replaced)
- Modified: `modals/AiResultsModal.tsx` (minimal — same result shape)

---

### Phase 5: Separate OpenAI Keys (Infrastructure)

**Goal:** Three independent OpenAI project credentials.

**Env vars to add (Vercel + .env.local):**
```
AI_TAKEOFF_OPENAI_API_KEY=sk-...
AI_FREE_TOOLS_OPENAI_API_KEY=sk-...
AI_APP_ASSIST_OPENAI_API_KEY=sk-...
```

**Code changes:**
- `app/api/takeoff/ai-scan-v3/route.ts` (or new `scan-engine.ts`): use `AI_TAKEOFF_OPENAI_API_KEY`
- `app/api/free-tools/parse-document/route.ts`: use `AI_FREE_TOOLS_OPENAI_API_KEY`
- `app/api/app/parse-document/route.ts`: use `AI_APP_ASSIST_OPENAI_API_KEY`
- Keep `OPENAI_API_KEY` as fallback for backward compatibility during migration

**This phase can be deferred** — it's infrastructure hardening, not a functional requirement for launch. Do it after the queue is working.

---

### Phase 6: Admin Observability (Post-Launch)

**Goal:** Dashboard for monitoring queue health.

- Query `ai_scan_jobs` for: active count, queue depth, p50/p95 wait time, p50/p95 duration, tokens/cost per scan, failure rate, refund count
- Admin route: `/api/admin/ai-scan-stats`
- Admin UI: add to existing admin panel (or simple page)
- Actions: retry failed job, cancel/refund running job, adjust concurrency limits

**This phase can be deferred** — basic logging via `ai_scan_usage` table already exists.

---

## Execution Order

```
Phase 1 (DB)          ← Foundation, blocks everything
    ↓
Phase 2 (Worker)      ← Core queue processing
    ↓
Phase 3 (API)         ← New endpoints
    ↓
Phase 4 (Client)      ← UI refactor to use new API
    ↓
Phase 5 (Keys)        ← Infrastructure (can parallelize)
    ↓
Phase 6 (Admin)       ← Post-launch
```

**Phases 1-4 are the critical path.** Phases 5-6 can wait.

---

## Risk Assessment

| Risk | Impact | Mitigation |
|---|---|---|
| Worker cron delay (30s) | Users wait longer for scan start | Acceptable for launch; upgrade to dedicated worker if needed |
| Job stuck in `running` | Slot consumed indefinitely | Timeout check in worker: if `started_at + 360s < now()`, mark failed + refund |
| Points race condition | Double charge or free scan | `submit_ai_scan_job` RPC is atomic — single transaction for check+deduct+insert |
| Migration on live DB | Active scans during migration | Additive migration (new table, no changes to existing tables) — safe to apply mid-traffic |
| Client polling overhead | Extra API calls every 3s | Polling interval = 3s, stops on terminal status. Acceptable for launch. |

---

## Key Decisions Needed (from Shaun)

1. **Worker trigger:** Vercel Cron (30s delay, simplest) vs on-demand trigger (instant, more complex)? → **Recommend: Cron for launch**
2. **Keep `ai-scan-v3` endpoint as fallback?** Or fully replace? → **Recommend: Keep temporarily as `scan-engine.ts` import, deprecate after Phase 4 verified**
3. **Phase 5 timing:** Do separate OpenAI keys now or defer? → **Recommend: Defer — single key works, separation is hardening**
4. **Idempotency key generation:** Client-generated UUID v4 (simple) vs server-generated (more control)? → **Recommend: Client UUID v4, matches Gerald's plan**

---

## File Inventory

**New files:**
- `supabase/migrations/20260724120000_ai_scan_jobs.sql`
- `app/lib/takeoff/scan-engine.ts` (extracted from route.ts)
- `app/lib/takeoff/scan-worker.ts`
- `app/api/takeoff/scan-jobs/route.ts`
- `app/api/cron/process-ai-scan-queue/route.ts`

**Modified files:**
- `app/(auth)/[workspaceSlug]/quotes/[id]/takeoff/TakeoffWorkstation.tsx` (Phase 4)
- `app/api/takeoff/ai-scan-v3/route.ts` (Phase 2 — simplified/deprecated)
- `app/api/free-tools/parse-document/route.ts` (Phase 5)
- `app/api/app/parse-document/route.ts` (Phase 5)
- `app/lib/supabase/database.types.ts` (regenerated after migration)

**Unchanged:**
- `app/lib/takeoff/ai-prompt-v3.ts` (prompts stay the same)
- `app/lib/takeoff/scanOverlay.ts` (overlay rendering stays the same)
- `app/lib/takeoff/applyAiResults.ts` (post-processing stays the same)
- `app/lib/takeoff/aiComponentRegistry.ts` (registry stays the same)
- `modals/AiResultsModal.tsx` (result shape stays the same)

---

## Acceptance Tests (from Gerald's plan)

1. ☐ Medium scan charges 4 points exactly once
2. ☐ Same idempotency key returns same job and never double charges
3. ☐ New Rescan key charges 4 points again
4. ☐ Empty balance blocks scan with 402 and no provider call
5. ☐ Three scans: two run, third queues; paid queued job wins when a slot opens
6. ☐ Provider timeout/429 retries the same job without new charge; terminal failure refunds
7. ☐ Direct scan2/scan3 calls cannot execute an unpaid/unowned stage
8. ☐ Load test measures p95 tokens/duration/429s before increasing active jobs
