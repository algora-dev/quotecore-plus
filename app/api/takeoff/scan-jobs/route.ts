/**
 * Scan Jobs API — submit new scans and poll status.
 *
 * POST /api/takeoff/scan-jobs     — submit a new scan (replaces client-directed scan1)
 * GET  /api/takeoff/scan-jobs     — poll job status (by jobId, or quoteId+pageId)
 *
 * The server-side worker (cron-triggered) processes the actual 3-scan pipeline.
 * The client polls GET until status = succeeded | failed.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, requireCompanyContext } from '@/app/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import type { Database } from '@/app/lib/supabase/database.types';
import { processScanQueue } from '@/app/lib/takeoff/scan-worker';

export const runtime = 'nodejs';
export const maxDuration = 60;

// ── POST: Submit a new scan job ─────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const profile = await requireCompanyContext();
    const supabase = await createSupabaseServerClient();

    if (process.env.AI_TAKEOFF_ENABLED !== 'true') {
      return NextResponse.json({ success: false, error: 'AI Takeoff is not enabled.' }, { status: 403 });
    }

    const body = await req.json() as Record<string, unknown>;
    const quoteId = typeof body.quoteId === 'string' ? body.quoteId : null;
    const pageId = typeof body.pageId === 'string' ? body.pageId : null;
    const qualityLevel = typeof body.qualityLevel === 'string' ? body.qualityLevel : 'medium';
    const imageDataUrl = typeof body.image === 'string' ? body.image : null;
    const canvasDims = body.canvasDimensions as { width?: number; height?: number } | undefined;
    const canvasW = typeof canvasDims?.width === 'number' ? canvasDims.width : 800;
    const canvasH = typeof canvasDims?.height === 'number' ? canvasDims.height : 600;

    if (!quoteId || !imageDataUrl) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: quoteId, image.' },
        { status: 400 }
      );
    }

    // Verify quote ownership
    const { data: quote, error: quoteError } = await supabase.from('quotes')
      .select('id, company_id').eq('id', quoteId).eq('company_id', profile.company_id).single();
    if (quoteError || !quote) {
      return NextResponse.json({ success: false, error: 'Quote not found.' }, { status: 404 });
    }

    // Verify roofing company
    const { data: company } = await supabase.from('companies')
      .select('default_trade').eq('id', profile.company_id).single();
    if (company?.default_trade !== 'roofing') {
      return NextResponse.json({ success: false, error: 'AI Takeoff is available for roofing companies only.' }, { status: 403 });
    }

    // Generate idempotency key (client can also send one)
    const idempotencyKey = typeof body.idempotencyKey === 'string'
      ? body.idempotencyKey
      : `${quoteId}-${pageId || 'no-page'}-${Date.now()}`;

    // Submit job atomically via RPC
    const admin = createServiceClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    const { data: submitResult, error: submitError } = await admin.rpc('submit_ai_scan_job', {
      p_company_id: profile.company_id,
      p_user_id: profile.id,
      p_quote_id: quoteId,
      p_page_id: pageId || '',
      p_quality: qualityLevel,
      p_idempotency_key: idempotencyKey,
      p_image_data: imageDataUrl,
      p_canvas_width: canvasW,
      p_canvas_height: canvasH,
    });

    if (submitError) {
      console.error('[scan-jobs] submit error:', submitError.message);
      return NextResponse.json(
        { success: false, error: 'Failed to submit scan job. Please try again.' },
        { status: 500 }
      );
    }

    const result = (submitResult as {
      job_id: string | null; status: string | null; points_cost: number;
      points_remaining: number; point_limit: number | null;
      is_existing: boolean; error: string | null;
    }[] | null)?.[0];

    if (!result) {
      return NextResponse.json(
        { success: false, error: 'Failed to submit scan job.' },
        { status: 500 }
      );
    }

    // Handle active job exists (409)
    if (result.error === 'ACTIVE_JOB_EXISTS') {
      return NextResponse.json(
        { success: false, error: 'You already have a scan running on this page.', existingJob: true },
        { status: 409 }
      );
    }

    // Handle insufficient points (402)
    if (!result.job_id && result.error) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          pointsExhausted: result.point_limit !== null,
          pointsRemaining: result.points_remaining,
          pointsLimit: result.point_limit,
        },
        { status: 402 }
      );
    }

    // Job submitted successfully — try to process immediately (don't wait for cron)
    // Fire and forget; the cron will pick it up if this doesn't finish
    processScanQueue(1).catch(err => {
      console.warn('[scan-jobs] immediate processing failed (cron will pick up):', err);
    });

    return NextResponse.json({
      success: true,
      jobId: result.job_id,
      status: result.status,
      pointsCost: result.points_cost,
      pointsRemaining: result.points_remaining,
      pointsLimit: result.point_limit,
      isExisting: result.is_existing,
      idempotencyKey,
    });

  } catch (error) {
    console.error('[scan-jobs] POST error:', error);
    return NextResponse.json(
      { success: false, error: `Server error: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}

// ── DELETE: Cancel a queued job ────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  try {
    const profile = await requireCompanyContext();
    const supabase = await createSupabaseServerClient();

    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get('jobId');

    if (!jobId) {
      return NextResponse.json({ success: false, error: 'Missing jobId.' }, { status: 400 });
    }

    const { data: cancelResult, error: cancelError } = await supabase.rpc('cancel_ai_scan_job', {
      p_job_id: jobId,
      p_company_id: profile.company_id,
    });

    if (cancelError) {
      console.error('[scan-jobs] cancel error:', cancelError.message);
      return NextResponse.json({ success: false, error: 'Failed to cancel job.' }, { status: 500 });
    }

    const result = (cancelResult as { success: boolean; status: string; points_refunded: boolean; points_remaining: number }[] | null)?.[0];

    if (!result?.success) {
      return NextResponse.json({ success: false, error: `Cannot cancel: job is ${result?.status ?? 'unknown'}.` }, { status: 409 });
    }

    return NextResponse.json({
      success: true,
      status: 'cancelled',
      pointsRefunded: result.points_refunded,
      pointsRemaining: result.points_remaining,
    });

  } catch (error) {
    console.error('[scan-jobs] DELETE error:', error);
    return NextResponse.json({ success: false, error: 'Server error.' }, { status: 500 });
  }
}

// ── GET: Poll job status ────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const profile = await requireCompanyContext();
    const supabase = await createSupabaseServerClient();

    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get('jobId');
    const quoteId = searchParams.get('quoteId');
    const pageId = searchParams.get('pageId');

    if (jobId) {
      // Poll specific job
      const { data: job, error } = await supabase.from('ai_scan_jobs')
        .select('id, status, current_stage, quality, points_cost, points_state, result, failure_code, failure_message, created_at, started_at, completed_at')
        .eq('id', jobId)
        .eq('company_id', profile.company_id)
        .single();

      if (error || !job) {
        return NextResponse.json({ success: false, error: 'Job not found.' }, { status: 404 });
      }

      const response: Record<string, unknown> = {
        success: true,
        jobId: job.id,
        status: job.status,
        currentStage: job.current_stage,
        quality: job.quality,
        pointsCost: job.points_cost,
        pointsRefunded: job.points_state === 'refunded',
      };

      if (job.status === 'succeeded' && job.result) {
        response.result = job.result;
      }

      if (job.status === 'failed') {
        response.error = job.failure_message || job.failure_code || 'Scan failed.';
        response.failureCode = job.failure_code;
      }

      return NextResponse.json(response);

    } else if (quoteId && pageId) {
      // Check for active job on this quote+page
      const { data: activeJob, error } = await supabase.from('ai_scan_jobs')
        .select('id, status, current_stage, quality, points_cost, result, failure_code, failure_message')
        .eq('company_id', profile.company_id)
        .eq('quote_id', quoteId)
        .eq('page_id', pageId)
        .in('status', ['queued', 'running', 'succeeded', 'failed'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error || !activeJob) {
        return NextResponse.json({ success: true, activeJob: false });
      }

      const response: Record<string, unknown> = {
        success: true,
        activeJob: true,
        jobId: activeJob.id,
        status: activeJob.status,
        currentStage: activeJob.current_stage,
        quality: activeJob.quality,
        pointsCost: activeJob.points_cost,
      };

      if (activeJob.status === 'succeeded' && activeJob.result) {
        response.result = activeJob.result;
      }

      if (activeJob.status === 'failed') {
        response.error = activeJob.failure_message || activeJob.failure_code || 'Scan failed.';
      }

      return NextResponse.json(response);

    } else {
      return NextResponse.json(
        { success: false, error: 'Provide jobId or quoteId+pageId.' },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('[scan-jobs] GET error:', error);
    return NextResponse.json(
      { success: false, error: `Server error: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}
