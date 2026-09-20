// AI-assisted calibration search/refine endpoint (Phase P5 + Phase D hardening
// audit 2026-09-20, P1-1..P1-5).
//
// Phase D changes:
//   P1-1 idempotent ledger: every round is admitted through the cal_admit_run
//       RPC (quotecore_v2_patch_049). clientRequestId is stored, deduplicated
//       per company before quota, payload-hash checked (same id + different
//       payload = 409 request_id_conflict), and the terminal response is
//       persisted for verbatim replay - a lost HTTP response can no longer
//       cause a double charge or double run on retry.
//   P1-2 stateful round budget: the round-1 budget (one second round per
//       page + image revision) is enforced by the LEDGER, not the HMAC token.
//       The HMAC token stays as an additional binding layer but server state
//       is the authority; action=refine requires round 1, round 0 permits only
//       the initial search, and no round-1 response mints anything.
//   P1-3 charge ordering: auth/ownership/flag/revision -> validate request +
//       round token + idempotency -> resolve and orient source bytes ->
//       atomically admit + reserve the point -> provider work -> atomically
//       finalize in the ledger (success stored for replay, or failed +
//       atomic GREATEST refund via cal_finish_run). Unexpected post-charge
//       errors are refunded too; the read-then-write refund is gone.
//   P1-4 evidence crops: source dims come from orientation done BEFORE any
//       crop generation, so a successful paid search always returns valid
//       dims; each crop fails independently and crops are optional UX.
//   P1-5 token secret: CALIBRATION_TOKEN_SECRET in production (clear error
//       when missing); OPENAI_API_KEY is an explicitly dev-only fallback.
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, requireCompanyContext } from '@/app/lib/supabase/server';
import { BUCKETS } from '@/app/lib/storage/buckets';
import { companyHasAiCalibration } from '@/app/lib/takeoff/calibrationFlag';
import { getCalibrationImageRevision } from '@/app/lib/takeoff/calibrationImageRevision';
import { attachEvidenceCrops, orientSource, type OrientedSource } from '@/app/lib/takeoff/calibrationEvidence';
import {
  CALIBRATION_SEARCH_POINT_COST,
  CalibrationVisionError,
  DETECTOR_VERSION,
  runCalibrationSearch,
  runTargetedRefinement,
  signRoundToken,
  verifyRoundToken,
} from '@/app/lib/takeoff/calibrationVision';
import {
  signCandidateRefineToken,
  verifyCandidateRefineToken,
  type CandidateRefinePayload,
} from '@/app/lib/takeoff/calibrationRefine';
import {
  calibrationRefusalHttp,
  computeCalibrationPayloadHash,
  isValidClientRequestId,
  parseCalibrationAdmitRow,
  pointsRemainingAfterRefund,
  type CalibrationAdmitDecision,
} from '@/app/lib/takeoff/calibrationLedger';
import type { SupabaseClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const maxDuration = 300;

function errorResponse(status: number, code: string, error: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ success: false, code, error, ...extra }, { status });
}

/** Narrow typed shim: the generated Database types predate patch_049 RPCs. */
function rpcByName(
  supabase: SupabaseClient,
  fn: 'cal_admit_run' | 'cal_finish_run' | 'cal_verify_refine_parent',
): SupabaseClient['rpc'] {
  return (supabase as unknown as { rpc: (f: string) => SupabaseClient['rpc'] }).rpc(fn);
}

function visionErrorHttp(code: string): number {
  if (code === 'MODEL_TIMEOUT') return 504;
  if (code === 'UNSUPPORTED_IMAGE') return 400;
  if (code === 'TOKEN_SECRET_MISSING') return 500;
  return 502;
}

export async function POST(req: NextRequest) {
  // Track the admitted run so EVERY post-charge failure path can finalize +
  // refund in the ledger, including unexpected ones.
  let admitted: { runId: string; pointsRemaining: number } | null = null;
  let supabaseUser: Awaited<ReturnType<typeof createSupabaseServerClient>> | null = null;

  try {
    // 1) Authentication.
    let profile;
    try {
      profile = await requireCompanyContext();
    } catch {
      return errorResponse(401, 'UNAUTHORISED', 'Unauthorized');
    }
    supabaseUser = await createSupabaseServerClient();

    const body = await req.json() as Record<string, unknown>;
    const action = body.action === 'refine' ? 'refine' : body.action === 'search' ? 'search' : null;
    const quoteId = typeof body.quoteId === 'string' ? body.quoteId : null;
    const pageId = typeof body.pageId === 'string' ? body.pageId : null;
    const requestId = body.requestId;
    if (!action || !quoteId || !pageId || !isValidClientRequestId(requestId)) {
      return errorResponse(400, 'BAD_REQUEST', 'Missing or invalid required fields: action, quoteId, pageId, requestId (8-128 chars).');
    }

    // 2) Ownership: quote belongs to the company, page belongs to the quote.
    const { data: quote, error: quoteError } = await supabaseUser
      .from('quotes')
      .select('id, company_id')
      .eq('id', quoteId)
      .eq('company_id', profile.company_id)
      .single();
    if (quoteError || !quote) {
      return errorResponse(404, 'NOT_FOUND', 'Quote not found.');
    }
    const { data: page, error: pageError } = await supabaseUser
      .from('takeoff_pages')
      .select('id, image_storage_path')
      .eq('id', pageId)
      .eq('quote_id', quoteId)
      .maybeSingle();
    if (pageError || !page) {
      return errorResponse(404, 'PAGE_NOT_FOUND', 'Calibration page not found for this quote.');
    }
    let storagePath = (page as { image_storage_path?: string | null }).image_storage_path;
    if (!storagePath) {
      // Page-1 fallback: the first plan page stores its image in the quote's
      // uploaded plan files, not takeoff_pages.image_storage_path (app
      // convention since 2026-07-06). Use the OLDEST plan file, matching
      // the build page's thumbnail resolution.
      const { data: firstPlan } = await supabaseUser
        .from('quote_files')
        .select('storage_path')
        .eq('quote_id', quoteId)
        .eq('file_type', 'plan')
        .order('uploaded_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      storagePath = (firstPlan as { storage_path?: string | null } | null)?.storage_path ?? null;
    }
    if (!storagePath) {
      return errorResponse(409, 'UNSUPPORTED_IMAGE', 'This page has no calibrated source image.');
    }

    // 3) Calibration-specific feature flag.
    if (!(await companyHasAiCalibration(profile.company_id))) {
      return errorResponse(403, 'FORBIDDEN', 'AI calibration is not enabled for this company.');
    }

    // 4) Immutable image revision (server-established; never a signed URL).
    const imageRevision = await getCalibrationImageRevision(pageId);
    if (!imageRevision) {
      return errorResponse(503, 'UNSUPPORTED_IMAGE', 'Source image is currently unavailable.');
    }

    // 5) Request shape + round contract (pure, before any IO on charge paths).
    const round: 0 | 1 = body.round === 1 ? 1 : 0;
    if (round === 0 && action !== 'search') {
      return errorResponse(409, 'REQUEST_CONFLICT', 'Round 0 permits only the initial search.');
    }
    const strategy = round === 0
      ? 'initial'
      : body.strategy === 'refine_reference' ? 'refine_reference' : 'different_references';
    if (round === 1 && action === 'refine' && strategy !== 'refine_reference') {
      return errorResponse(409, 'REQUEST_CONFLICT', 'action=refine requires strategy=refine_reference.');
    }
    const refineReferenceIds = Array.isArray(body.refineReferenceIds)
      ? body.refineReferenceIds.filter((v): v is string => typeof v === 'string').slice(0, 3)
      : undefined;
    const excludeReferenceIds = Array.isArray(body.excludeReferenceIds)
      ? body.excludeReferenceIds.filter((v): v is string => typeof v === 'string').slice(0, 10)
      : undefined;
    const refineTokens = Array.isArray(body.refineTokens)
      ? body.refineTokens.filter((v): v is string => typeof v === 'string' && v.length <= 2048).slice(0, 3)
      : undefined;

    // P1-9: targeted refine uses server-signed candidate tokens (bound to the
    // ledger run). Verified BEFORE any charge: pure signature + page/revision
    // binding, then the ledger run must exist and have succeeded for this
    // company (cal_verify_refine_parent, patch_050).
    let targetedParents: Array<{ token: string; payload: CandidateRefinePayload }> | null = null;
    if (action === 'refine' && refineTokens && refineTokens.length > 0) {
      targetedParents = [];
      for (const token of refineTokens) {
        const verdict = verifyCandidateRefineToken(token, pageId, imageRevision);
        if (!verdict.valid) {
          return errorResponse(409, 'REQUEST_CONFLICT', `Refine not authorised (${verdict.reason}). Start a new calibration search.`);
        }
        targetedParents.push({ token, payload: verdict.payload });
      }
    }

    // 6) HMAC round token: additional binding layer for round 1 / refine
    //    (P1-5: dedicated secret in production). The LEDGER remains the
    //    single-use authority (P1-2).
    let roundToken = '';
    if (round === 1 || action === 'refine') {
      roundToken = typeof body.roundToken === 'string' ? body.roundToken : '';
      const verdict = verifyRoundToken(roundToken, pageId, imageRevision);
      if (!verdict.valid) {
        console.warn(`[calibration:${pageId}] round_token_rejected reason=${verdict.reason} round=${round} action=${action}`);
        return errorResponse(409, 'REQUEST_CONFLICT', `Rescan not authorised (${verdict.reason}). Start a new calibration search.`);
      }
    }

    const payloadHash = computeCalibrationPayloadHash({
      quoteId, pageId, action, round, strategy, imageRevision,
      refineReferenceIds, excludeReferenceIds, refineTokens,
    });

    // 7) Resolve + orient the authorised source bytes BEFORE any charge
    //    (P1-3: a storage failure must cost nothing). Dims come from the
    //    oriented output, never metadata.
    let oriented: OrientedSource;
    try {
      const { data: blob, error: dlError } = await supabaseUser.storage
        .from(BUCKETS.QUOTE_DOCUMENTS)
        .download(storagePath);
      if (dlError || !blob) {
        return errorResponse(503, 'UNSUPPORTED_IMAGE', 'Source image could not be read.');
      }
      oriented = await orientSource(Buffer.from(await blob.arrayBuffer()));
      if (!oriented.width || !oriented.height) {
        return errorResponse(503, 'UNSUPPORTED_IMAGE', 'Source image could not be read.');
      }
    } catch {
      return errorResponse(503, 'UNSUPPORTED_IMAGE', 'Source image could not be read.');
    }

    // 8) Atomic admission + point reservation in the ledger (P1-1/P1-2/P1-3).
    console.log(`[calibration:${pageId}] search_start action=${action} round=${round} strategy=${strategy} requestId=${requestId}`);

    // P1-9 ledger binding: every refine token's parent run must exist, belong
    // to this company, and have succeeded (pre-charge, so a bad token costs
    // nothing).
    if (targetedParents) {
      for (const runId of [...new Set(targetedParents.map((p) => p.payload.runId))]) {
        const { data: okRun, error: verifyError } = await rpcByName(supabaseUser, 'cal_verify_refine_parent')({ p_run_id: runId } as never);
        if (verifyError || okRun !== true) {
          console.warn(`[calibration:${pageId}] refine_parent_rejected run=${runId} err=${verifyError?.message ?? 'not found'}`);
          return errorResponse(409, 'REQUEST_CONFLICT', 'Refine not authorised (parent run). Start a new calibration search.');
        }
      }
    }

    const { data: admitData, error: admitError } = await rpcByName(supabaseUser, 'cal_admit_run')({
      p_quote_id: quoteId,
      p_page_id: pageId,
      p_client_request_id: requestId,
      p_action: action,
      p_round: round,
      p_strategy: strategy,
      p_image_revision: imageRevision,
      p_payload_hash: payloadHash,
      p_round_token: roundToken || null,
      p_points: CALIBRATION_SEARCH_POINT_COST,
    } as never);
    if (admitError) {
      console.error('[calibration] admit error:', admitError.message);
      return errorResponse(500, 'INTERNAL_ERROR', 'Failed to admit calibration request.');
    }
    const decision: CalibrationAdmitDecision = parseCalibrationAdmitRow((admitData as unknown[])[0]);

    if (decision.kind === 'refused') {
      if (decision.errorCode === 'insufficient_points') {
        return errorResponse(402, 'INSUFFICIENT_POINTS', 'AI Assist points limit reached.', {
          pointsRemaining: 0,
        });
      }
      const http = calibrationRefusalHttp(decision.errorCode);
      if (http.code === 'INSUFFICIENT_POINTS') {
        return errorResponse(402, http.code, 'AI Assist points limit reached.', { pointsRemaining: 0 });
      }
      return errorResponse(http.status, http.code, `Calibration request refused (${decision.errorCode}).`);
    }

    if (decision.kind === 'replay') {
      // Idempotent replay: the original terminal response, verbatim, no new charge.
      console.log(`[calibration:${pageId}] replay run=${decision.runId}`);
      return NextResponse.json(decision.responsePayload as Record<string, unknown>);
    }

    if (decision.kind === 'in_flight') {
      return errorResponse(409, 'REQUEST_IN_FLIGHT', 'The original attempt for this request is still running.');
    }

    if (decision.kind === 'duplicate_failed') {
      return errorResponse(409, 'REQUEST_FAILED', `The original attempt for this request already failed (code ${decision.errorCode ?? 'unknown'}). No points were charged; retry with a new request id.`);
    }

    // accepted
    const admittedRunId = decision.runId;
    admitted = { runId: decision.runId, pointsRemaining: decision.pointsRemaining };
    console.log(`[calibration:${pageId}] points_charged points=${CALIBRATION_SEARCH_POINT_COST} remaining_after=${admitted.pointsRemaining} run=${admitted.runId}`);

    // 9) Provider work + terminalization. ANY failure below finalizes the
    //    ledger row and refunds atomically (P1-3).
    const finalize = async (status: 'succeeded' | 'failed_refunded', response: Record<string, unknown> | null, errorCode: string | null) => {
      try {
        const { error } = await rpcByName(supabaseUser!, 'cal_finish_run')({
          p_run_id: admitted!.runId,
          p_status: status,
          p_response: response,
          p_error_code: errorCode,
        } as never);
        if (error) console.error(`[calibration:${pageId}] finish error: ${error.message}`);
        return !error;
      } catch (err) {
        console.error(`[calibration:${pageId}] finish threw:`, err instanceof Error ? err.message : err);
        return false;
      }
    };

    try {
      // P1-9: targeted refine = ONE refinement call against the ORIGINAL
      // geometry from the signed token; no discovery rediscovery.
      const result = targetedParents
        ? await runTargetedRefinement({
          sourceBuffer: oriented.buffer,
          pageId,
          imageRevision,
          parents: targetedParents.map((p) => ({
            sourceP1: p.payload.sourceP1,
            sourceP2: p.payload.sourceP2,
            labelCentre: p.payload.labelCentre,
            revision: p.payload.revision,
          })),
        })
        : await runCalibrationSearch({
          sourceBuffer: oriented.buffer,
          pageId,
          imageRevision,
          round,
          strategy: action === 'refine' ? 'refine_reference' : strategy,
          refineReferenceIds,
          excludeReferenceIds,
        });

      // Round-0 success mints the HMAC binding token; round-1 never does
      // (and even a replayed round-0 token cannot beat the ledger budget).
      const roundTokenOut = round === 0 ? signRoundToken(pageId, imageRevision) : undefined;

      // P1-9: round-0 candidates carry server-signed refine tokens binding
      // the original geometry to this ledger run, so a targeted "improve these
      // points" never has to rediscover or re-match by quantised id.
      if (round === 0 && result.candidates.length > 0) {
        result.candidates = result.candidates.map((c, i) => ({
          ...c,
          refineToken: signCandidateRefineToken({
            runId: admittedRunId,
            idx: i,
            pageId,
            imageRevision,
            sourceP1: c.sourceP1,
            sourceP2: c.sourceP2,
            labelCentre: c.evidence.sourceLabelCentre ?? {
              x: (c.sourceP1.x + c.sourceP2.x) / 2,
              y: (c.sourceP1.y + c.sourceP2.y) / 2,
            },
            revision: c.revision,
          }),
        }));
      }

      // P1-4: crops are optional UX built from the already-oriented source;
      // dims are always valid because orientation happened pre-charge.
      const withCrops = await attachEvidenceCrops(
        oriented,
        result.candidates as never as Array<{ sourceP1: { x: number; y: number }; sourceP2: { x: number; y: number } } & Record<string, unknown>>,
      );
      if (withCrops.cropFailures > 0) {
        console.warn(`[calibration:${pageId}] evidence_crop_failures=${withCrops.cropFailures}`);
      }

      console.log(`[calibration:${pageId}] search_success action=${action} round=${round} status=${result.status} candidates=${result.candidates.length} strategy=${strategy} tokens=${result.modelUsage?.totalTokens ?? 'n/a'}`);
      if (result.status === 'unsuitable_image') {
        console.log(`[calibration:${pageId}] unsuitable reason=${JSON.stringify(result.notes[0] ?? 'none')}`);
      }

      const responseBody = {
        success: true,
        action,
        status: result.status,
        round,
        pageId,
        imageRevision,
        sourceWidth: withCrops.sourceWidth,
        sourceHeight: withCrops.sourceHeight,
        candidates: withCrops.candidates,
        notes: result.notes,
        completedSearchRounds: round + 1,
        rescanAvailable: round === 0,
        roundToken: roundTokenOut,
        pointsCharged: CALIBRATION_SEARCH_POINT_COST,
        pointsRemaining: admitted.pointsRemaining,
        detectorVersion: DETECTOR_VERSION,
      };

      await finalize('succeeded', responseBody as Record<string, unknown>, null);
      return NextResponse.json(responseBody);
    } catch (err) {
      const code = err instanceof CalibrationVisionError ? err.code : 'INTERNAL_ERROR';
      const finalized = await finalize('failed_refunded', null, code);
      const refunded = finalized;
      const pointsRemaining = pointsRemainingAfterRefund(admitted.pointsRemaining, CALIBRATION_SEARCH_POINT_COST);
      if (err instanceof CalibrationVisionError) {
        console.warn(`[calibration:${pageId}] vision failure code=${err.code} refunded=${refunded}`);
        return errorResponse(visionErrorHttp(err.code), err.code, 'AI calibration search failed. No points were charged for this attempt.', {
          pointsRemaining,
          refunded,
        });
      }
      console.error('[calibration] unexpected post-charge error:', err instanceof Error ? err.message : err);
      return errorResponse(500, 'INTERNAL_ERROR', 'Unexpected server error. The point charge for this attempt was refunded.', {
        pointsRemaining,
        refunded,
      });
    }
  } catch (err) {
    // Pre-admission unexpected error OR (defensively) anything post-charge
    // that escaped above: refund if a run was admitted.
    if (admitted && supabaseUser) {
      try {
        await rpcByName(supabaseUser, 'cal_finish_run')({
          p_run_id: admitted.runId,
          p_status: 'failed_refunded',
          p_response: null,
          p_error_code: 'INTERNAL_ERROR',
        } as never);
      } catch {
        console.error('[calibration] refund-on-outer-error failed for run', admitted.runId);
      }
    }
    console.error('[calibration] unexpected error:', err instanceof Error ? err.message : err);
    return errorResponse(500, 'INTERNAL_ERROR', 'Unexpected server error.');
  }
}
