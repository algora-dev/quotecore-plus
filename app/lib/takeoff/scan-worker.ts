/**
 * Scan Worker — claims queued ai_scan_jobs and runs the 3-scan pipeline.
 *
 * Called by the cron endpoint /api/cron/process-ai-scan-queue.
 * Also handles: stale job cleanup, retry with backoff, point refunds on failure.
 */

import { createClient as createServiceClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/app/lib/supabase/database.types';
import { runScan1, runScan2, runScan3, preprocessImage, type AiScanResult } from '@/app/lib/takeoff/scan-engine';
import sharp from 'sharp';
import type { V3Point, V3Line } from '@/app/lib/takeoff/ai-prompt-v3';

function getServiceClient() {
  return createServiceClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

const MAX_ACTIVE_JOBS = parseInt(process.env.TAKEOFF_MAX_ACTIVE_JOBS || '2', 10);
const MAX_PER_COMPANY = parseInt(process.env.TAKEOFF_MAX_ACTIVE_PER_COMPANY || '1', 10);
const MAX_ATTEMPTS = parseInt(process.env.TAKEOFF_MAX_ATTEMPTS || '3', 10);
const JOB_TIMEOUT_SECONDS = parseInt(process.env.TAKEOFF_JOB_TIMEOUT_SECONDS || '360', 10);

interface ClaimedJob {
  id: string;
  company_id: string;
  user_id: string;
  quote_id: string;
  page_id: string | null;
  quality: string;
  points_cost: number;
  attempt_count: number;
  image_data: string | null;
  canvas_width: number;
  canvas_height: number;
  current_stage: string | null;
  intermediate_result: unknown;
  created_at: string;
}

/**
 * Process the scan queue. Called by cron endpoint.
 * Claims one job at a time, runs the full pipeline, and returns when no more jobs can be claimed.
 */
export async function processScanQueue(maxJobsPerRun = 3): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
  retried: number;
}> {
  const supabase = getServiceClient();
  let processed = 0, succeeded = 0, failed = 0, retried = 0;

  // First, clean up stale jobs
  const { data: cleanupResult } = await supabase.rpc('requeue_stale_scan_jobs', { p_timeout_seconds: JOB_TIMEOUT_SECONDS });
  const staleFailed = (cleanupResult as { failed_count?: number }[] | null)?.[0]?.failed_count ?? 0;
  if (staleFailed > 0) console.log(`[scan-worker] cleaned up ${staleFailed} stale jobs`);

  for (let i = 0; i < maxJobsPerRun; i++) {
    // Claim next job
    const { data: claimedRows, error: claimError } = await supabase.rpc('claim_ai_scan_job', {
      p_max_active_jobs: MAX_ACTIVE_JOBS,
      p_max_per_company: MAX_PER_COMPANY,
    });

    if (claimError) {
      console.error('[scan-worker] claim error:', claimError.message);
      break;
    }

    const claimed = (claimedRows as ClaimedJob[] | null)?.[0];
    if (!claimed) break; // No jobs to claim

    processed++;
    console.log(`[scan-worker] claimed job ${claimed.id} (company=${claimed.company_id}, attempt=${claimed.attempt_count}, quality=${claimed.quality})`);

    // Stamp queue_wait_ms for tracking
    await supabase.from('ai_scan_jobs')
      .update({ queue_wait_ms: Math.round((Date.now() - new Date(claimed.created_at).getTime())) })
      .eq('id', claimed.id);

    try {
      const success = await runPipelineForJob(claimed, supabase);
      if (success) succeeded++;
      else {
        // Check if we should retry
        if (claimed.attempt_count < MAX_ATTEMPTS) {
          // Requeue for retry
          await supabase.from('ai_scan_jobs')
            .update({ status: 'queued', available_at: new Date(Date.now() + backoffMs(claimed.attempt_count)).toISOString(), started_at: null, updated_at: new Date().toISOString() })
            .eq('id', claimed.id);
          retried++;
          console.log(`[scan-worker] job ${claimed.id} requeued for retry (attempt ${claimed.attempt_count + 1})`);
        } else {
          // Terminal failure — refund points
          await supabase.rpc('fail_ai_scan_job', {
            p_job_id: claimed.id,
            p_failure_code: 'MAX_RETRIES_EXCEEDED',
            p_failure_message: `Job failed after ${MAX_ATTEMPTS} attempts`,
            p_should_refund: true,
          });
          failed++;
          console.log(`[scan-worker] job ${claimed.id} failed permanently (max retries)`);
        }
      }
    } catch (err) {
      console.error(`[scan-worker] job ${claimed.id} threw:`, err);
      if (claimed.attempt_count < MAX_ATTEMPTS) {
        await supabase.from('ai_scan_jobs')
          .update({ status: 'queued', available_at: new Date(Date.now() + backoffMs(claimed.attempt_count)).toISOString(), started_at: null, updated_at: new Date().toISOString() })
          .eq('id', claimed.id);
        retried++;
      } else {
        await supabase.rpc('fail_ai_scan_job', {
          p_job_id: claimed.id,
          p_failure_code: 'UNHANDLED_EXCEPTION',
          p_failure_message: err instanceof Error ? err.message : 'Unknown error',
          p_should_refund: true,
        });
        failed++;
      }
    }
  }

  return { processed, succeeded, failed, retried };
}

function backoffMs(attempt: number): number {
  const base = Math.min(1000 * 2 ** attempt, 30000); // cap at 30s
  const jitter = Math.random() * 1000;
  return base + jitter;
}

/**
 * Run the full 3-scan pipeline for a claimed job.
 * Persists progress after each stage. Returns true on success, false on failure.
 */
async function runPipelineForJob(job: ClaimedJob, supabase: ReturnType<typeof getServiceClient>): Promise<boolean> {
  const quality = job.quality as 'low' | 'medium' | 'high';
  const canvasW = job.canvas_width || 800;
  const canvasH = job.canvas_height || 600;
  const imageDataUrl = job.image_data;

  if (!imageDataUrl) {
    console.error(`[scan-worker] job ${job.id} has no image_data`);
    await supabase.rpc('fail_ai_scan_job', {
      p_job_id: job.id, p_failure_code: 'NO_IMAGE', p_failure_message: 'Job has no image data', p_should_refund: true,
    });
    return false;
  }

  // ── Stage: scan1 (or resume from intermediate) ──────────────────
  let processedBuffer: Buffer | null = null;
  let roofAreas: Array<{ name: string; points: V3Point[]; pitch_degrees: number | null }> | null = null;
  let analysisDims: { width: number; height: number } | null = null;

  // Check if we can resume from intermediate result
  const intermediate = job.intermediate_result as Record<string, unknown> | null;
  const resumeStage = job.current_stage;

  if (resumeStage && intermediate) {
    // Resume: we have intermediate results, skip completed stages
    if (intermediate.roofAreas && intermediate.analysisDimensions && intermediate.processedBufferB64) {
      roofAreas = intermediate.roofAreas as unknown as typeof roofAreas;
      analysisDims = intermediate.analysisDimensions as unknown as typeof analysisDims;
      processedBuffer = Buffer.from(intermediate.processedBufferB64 as string, 'base64');
      console.log(`[scan-worker] job ${job.id} resuming from after scan1`);
    }
  }

  if (!processedBuffer || !roofAreas || !analysisDims) {
    // Run scan1
    await supabase.rpc('update_scan_stage', { p_job_id: job.id, p_stage: 'scan1' });

    const scan1 = await runScan1({
      imageDataUrl, canvasWidth: canvasW, canvasHeight: canvasH, quality,
      quoteId: job.quote_id, pageId: job.page_id, companyId: job.company_id, userId: job.user_id,
    });

    if (!scan1.success || !scan1.roofAreas || !scan1.processedBuffer || !scan1.analysisDimensions) {
      console.error(`[scan-worker] job ${job.id} scan1 failed: ${scan1.error}`);
      return false;
    }

    roofAreas = scan1.roofAreas;
    analysisDims = scan1.analysisDimensions;
    processedBuffer = scan1.processedBuffer;

    // Persist intermediate result
    await supabase.rpc('update_scan_stage', {
      p_job_id: job.id, p_stage: 'scan1_done',
      p_intermediate_result: JSON.parse(JSON.stringify({
        roofAreas, analysisDimensions: analysisDims,
        processedBufferB64: processedBuffer.toString('base64'),
      })) as Json,
    });
    console.log(`[scan-worker] job ${job.id} scan1 done: ${roofAreas[0]?.points.length ?? 0} vertices`);
  }

  // ── Stage: scan2 ────────────────────────────────────────────────
  let linesCanvas: V3Line[] | null = null;
  let outlineCanvas: V3Point[] | null = null;

  if (resumeStage === 'scan2_done' && intermediate?.linesCanvas && intermediate?.outlineCanvas) {
    linesCanvas = intermediate.linesCanvas as V3Line[];
    outlineCanvas = intermediate.outlineCanvas as V3Point[];
    console.log(`[scan-worker] job ${job.id} resuming from after scan2`);
  } else {
    await supabase.rpc('update_scan_stage', { p_job_id: job.id, p_stage: 'scan2' });

    const scan2 = await runScan2({
      processedBuffer, canvasWidth: canvasW, canvasHeight: canvasH,
      outlinePointsCanvas: roofAreas[0].points, analysisDimensions: analysisDims, quality,
      quoteId: job.quote_id, pageId: job.page_id, companyId: job.company_id, userId: job.user_id,
    });

    if (!scan2.success || !scan2.linesCanvas || !scan2.outlineCanvas) {
      console.error(`[scan-worker] job ${job.id} scan2 failed: ${scan2.error}`);
      return false;
    }

    linesCanvas = scan2.linesCanvas;
    outlineCanvas = scan2.outlineCanvas;

    await supabase.rpc('update_scan_stage', {
      p_job_id: job.id, p_stage: 'scan2_done',
      p_intermediate_result: JSON.parse(JSON.stringify({
        roofAreas, analysisDimensions: analysisDims,
        processedBufferB64: processedBuffer.toString('base64'),
        linesCanvas, outlineCanvas,
      })) as Json,
    });
    console.log(`[scan-worker] job ${job.id} scan2 done: ${linesCanvas.length} lines`);
  }

  // ── Stage: scan3 ────────────────────────────────────────────────
  await supabase.rpc('update_scan_stage', { p_job_id: job.id, p_stage: 'scan3' });

  const scan3 = await runScan3({
    processedBuffer, canvasWidth: canvasW, canvasHeight: canvasH,
    outlinePointsCanvas: outlineCanvas, linesCanvas, analysisDimensions: analysisDims, quality,
    quoteId: job.quote_id, pageId: job.page_id, companyId: job.company_id, userId: job.user_id,
  });

  if (!scan3.success || !scan3.result) {
    console.error(`[scan-worker] job ${job.id} scan3 failed: ${scan3.error}`);
    return false;
  }

  // ── Complete: persist result ────────────────────────────────────
  const { error: completeError } = await supabase.rpc('complete_ai_scan_job', {
    p_job_id: job.id,
    p_result: JSON.parse(JSON.stringify(scan3.result)) as Json,
  });

  if (completeError) {
    console.error(`[scan-worker] job ${job.id} complete error:`, completeError.message);
    return false;
  }

  // Also persist to takeoff_pages for backward compatibility
  if (job.page_id) {
    await supabase.from('takeoff_pages')
      .update({ ai_scan_result: JSON.parse(JSON.stringify(scan3.result)) as Json })
      .eq('id', job.page_id);
  }

  console.log(`[scan-worker] job ${job.id} completed successfully`);
  return true;
}
