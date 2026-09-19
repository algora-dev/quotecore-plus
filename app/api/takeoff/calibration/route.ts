// AI-assisted calibration search/refine endpoint (Phase P5; spec continuation
// section 12 + 13-P5). Server-side only; the desktop UI integration is P6.
//
// Security order (fixes the ai-scan-v3 page-ownership gap flagged by the P0
// baseline): authenticate -> verify quote belongs to the company -> verify the
// page belongs to that quote -> feature flag -> image revision -> round token
// -> point charge -> bounded provider work. A client-supplied companyId is
// never trusted.
//
// Round-token rescan budget (stateless, no new tables - documented scheme):
// - Round 0 ('initial') needs no token and, on success, returns an HMAC-signed
//   roundToken authorising exactly one round-1 request for the SAME
//   {pageId, imageRevision} (see calibrationVision signRoundToken/verifyRoundToken).
// - Round 1 ('different_references' or 'refine_reference') requires a valid
//   token; the token is bound to page+imageRevision, expires after 24h and
//   round-1 responses never mint another token - so at most one deliberate
//   rescan per initial search, enforced server-side regardless of UI state.
// - Limitations (honest): with no persistent request ledger the scheme cannot
//   detect a replayed requestId or prove a prior attempt failed; those remain
//   P4-ledger concerns. Replay/retry protection therefore relies on the client
//   contract plus the single-use nature of the token.
//
// Point cost: ONE charge per completed user-visible search round (discovery +
// the bounded refinement batch count as one round, spec 6.3/12.4) via the
// existing check_and_deduct_ai_points RPC called exactly like ai-scan-v3's
// stage-scan1 path (service-role client, p_company_id + p_points_to_spend).
// That RPC has NO idempotency-key parameter, so a linked technical retry cannot
// be de-duplicated by the existing mechanism (noted honestly). Instead of
// double-charging failures: a technical/provider failure refunds the round via
// a service-role read-modify-write of companies.ai_assist_points_used
// (mirroring refund_ai_scan_points' UPDATE, which is otherwise job-table-bound),
// so a retried failed round nets exactly one charge once it completes. A valid
// empty search (no candidates) is a performed search and is NOT refunded.
import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import type { Database } from '@/app/lib/supabase/database.types';
import { createSupabaseServerClient, requireCompanyContext } from '@/app/lib/supabase/server';
import { BUCKETS } from '@/app/lib/storage/buckets';
import { companyHasAiCalibration } from '@/app/lib/takeoff/calibrationFlag';
import { getCalibrationImageRevision } from '@/app/lib/takeoff/calibrationImageRevision';
import {
  CALIBRATION_SEARCH_POINT_COST,
  CalibrationVisionError,
  DETECTOR_VERSION,
  runCalibrationSearch,
  signRoundToken,
  verifyRoundToken,
} from '@/app/lib/takeoff/calibrationVision';

export const runtime = 'nodejs';
export const maxDuration = 300;

function errorResponse(status: number, code: string, error: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ success: false, code, error, ...extra }, { status });
}

function createAdminClient() {
  return createServiceClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

/** Mirror of refund_ai_scan_points' point release for calibration rounds. */
async function refundCalibrationPoint(companyId: string, points: number): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const { data: company, error: readError } = await admin
      .from('companies')
      .select('ai_assist_points_used')
      .eq('id', companyId)
      .single();
    if (readError || !company) return false;
    const used = company.ai_assist_points_used ?? 0;
    const { error: writeError } = await admin
      .from('companies')
      .update({ ai_assist_points_used: Math.max(0, used - points) })
      .eq('id', companyId);
    return !writeError;
  } catch {
    return false;
  }
}

// P6 evidence crops: generated on demand from the SAME immutable source object
// the model analysed (never the annotated canvas). <=320px native crops resized
// to <=600px longest edge jpeg q80 as base64 data-URIs; 3 crops x <=3 candidates
// keeps the payload far below ~2MB. Generation failure degrades honestly to no
// crops (the search already succeeded and was charged) rather than failing the round.
const EVIDENCE_CROP_PX = 320;
const EVIDENCE_MAX_EDGE = 600;

interface OrientedSource {
  buffer: Buffer;
  width: number;
  height: number;
}

async function orientSource(sourceBuffer: Buffer): Promise<OrientedSource> {
  const oriented = await sharp(sourceBuffer).rotate().toBuffer({ resolveWithObject: true });
  return { buffer: oriented.data, width: oriented.info.width, height: oriented.info.height };
}

async function evidenceCropDataUri(
  src: OrientedSource,
  centreX: number,
  centreY: number,
): Promise<string> {
  const half = Math.floor(EVIDENCE_CROP_PX / 2);
  const cropX = Math.max(0, Math.min(Math.round(centreX) - half, src.width - 1));
  const cropY = Math.max(0, Math.min(Math.round(centreY) - half, src.height - 1));
  const cropW = Math.max(1, Math.min(EVIDENCE_CROP_PX, src.width - cropX));
  const cropH = Math.max(1, Math.min(EVIDENCE_CROP_PX, src.height - cropY));
  const jpeg = await sharp(src.buffer)
    .extract({ left: cropX, top: cropY, width: cropW, height: cropH })
    .resize({ width: EVIDENCE_MAX_EDGE, height: EVIDENCE_MAX_EDGE, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toBuffer();
  return `data:image/jpeg;base64,${jpeg.toString('base64')}`;
}

async function attachEvidenceCrops(
  sourceBuffer: Buffer,
  candidates: Array<{ sourceP1: { x: number; y: number }; sourceP2: { x: number; y: number } } & Record<string, unknown>>,
): Promise<{
  candidates: Array<Record<string, unknown>>;
  sourceWidth: number | null;
  sourceHeight: number | null;
}> {
  try {
    const oriented = await orientSource(sourceBuffer);
    const out: Array<Record<string, unknown>> = [];
    for (const c of candidates) {
      const [endpointA, endpointB, label] = await Promise.all([
        evidenceCropDataUri(oriented, c.sourceP1.x, c.sourceP1.y),
        evidenceCropDataUri(oriented, c.sourceP2.x, c.sourceP2.y),
        evidenceCropDataUri(oriented, (c.sourceP1.x + c.sourceP2.x) / 2, (c.sourceP1.y + c.sourceP2.y) / 2),
      ]);
      out.push({
        ...c,
        evidence: {
          ...(c.evidence as Record<string, unknown>),
          crops: [
            { kind: 'endpoint-a', dataUri: endpointA },
            { kind: 'endpoint-b', dataUri: endpointB },
            { kind: 'label', dataUri: label },
          ],
        },
      });
    }
    return { candidates: out, sourceWidth: oriented.width, sourceHeight: oriented.height };
  } catch (err) {
    console.warn('[calibration] evidence crop generation failed:', err instanceof Error ? err.message : err);
    return { candidates, sourceWidth: null, sourceHeight: null };
  }
}

export async function POST(req: NextRequest) {
  try {
    // 1) Authentication.
    let profile;
    try {
      profile = await requireCompanyContext();
    } catch {
      return errorResponse(401, 'UNAUTHORISED', 'Unauthorized');
    }
    const supabase = await createSupabaseServerClient();

    const body = await req.json() as Record<string, unknown>;
    const action = body.action === 'refine' ? 'refine' : body.action === 'search' ? 'search' : null;
    const quoteId = typeof body.quoteId === 'string' ? body.quoteId : null;
    const pageId = typeof body.pageId === 'string' ? body.pageId : null;
    if (!action || !quoteId || !pageId) {
      return errorResponse(400, 'BAD_REQUEST', 'Missing required fields: action, quoteId, pageId.');
    }

    // 2) Ownership: quote belongs to the company, page belongs to the quote.
    //    BOTH verified before the feature flag, quota or any provider work.
    const { data: quote, error: quoteError } = await supabase
      .from('quotes')
      .select('id, company_id')
      .eq('id', quoteId)
      .eq('company_id', profile.company_id)
      .single();
    if (quoteError || !quote) {
      return errorResponse(404, 'NOT_FOUND', 'Quote not found.');
    }
    const { data: page, error: pageError } = await supabase
      .from('takeoff_pages')
      .select('id, image_storage_path')
      .eq('id', pageId)
      .eq('quote_id', quoteId)
      .maybeSingle();
    if (pageError || !page) {
      return errorResponse(404, 'PAGE_NOT_FOUND', 'Calibration page not found for this quote.');
    }
    const storagePath = (page as { image_storage_path?: string | null }).image_storage_path;
    if (!storagePath) {
      return errorResponse(409, 'UNSUPPORTED_IMAGE', 'This page has no calibrated source image.');
    }

    // 3) Calibration-specific feature flag (separate from the full-scan flag).
    if (!(await companyHasAiCalibration(profile.company_id))) {
      return errorResponse(403, 'FORBIDDEN', 'AI calibration is not enabled for this company.');
    }

    // 4) Immutable image revision (server-established; never a signed URL).
    const imageRevision = await getCalibrationImageRevision(pageId);
    if (!imageRevision) {
      return errorResponse(503, 'UNSUPPORTED_IMAGE', 'Source image is currently unavailable.');
    }

    // 5) Round + round-token budget enforcement.
    const round = body.round === 1 ? 1 : 0;
    const strategy = round === 0
      ? 'initial'
      : body.strategy === 'refine_reference' ? 'refine_reference' : 'different_references';
    if (round === 1 || action === 'refine') {
      const token = typeof body.roundToken === 'string' ? body.roundToken : '';
      const verdict = verifyRoundToken(token, pageId, imageRevision);
      if (!verdict.valid) {
        console.warn(`[calibration:${pageId}] round_token_rejected reason=${verdict.reason} round=${round} action=${action}`);
        return errorResponse(409, 'REQUEST_CONFLICT', `Rescan not authorised (${verdict.reason}). Start a new calibration search.`);
      }
    }

    // 6) One point charge for this search round (check_and_deduct_ai_points,
    //    identical call shape to ai-scan-v3 stage scan1).
    console.log(`[calibration:${pageId}] search_start action=${action} round=${round} strategy=${strategy} requestId=${typeof body.requestId === 'string' ? body.requestId : 'none'}`);

    const admin = createAdminClient();
    const { data: pointsResult, error: pointsError } = await admin
      .rpc('check_and_deduct_ai_points', {
        p_company_id: profile.company_id,
        p_points_to_spend: CALIBRATION_SEARCH_POINT_COST,
      });
    if (pointsError) {
      console.error('[calibration] points check error:', pointsError.message);
      return errorResponse(500, 'INSUFFICIENT_POINTS', 'Failed to verify AI Assist quota. Please try again.');
    }
    const pointsRow = (pointsResult as { allowed: boolean; remaining: number; point_limit: number | null; error: string | null }[] | null)?.[0] ?? null;
    if (!pointsRow?.allowed) {
      console.warn(`[calibration:${pageId}] points_denied remaining=${pointsRow?.remaining ?? 0}`);
      return errorResponse(402, 'INSUFFICIENT_POINTS', pointsRow?.error || 'AI Assist points limit reached.', {
        pointsRemaining: pointsRow?.remaining ?? 0,
      });
    }
    const pointsRemaining = pointsRow.remaining;
    console.log(`[calibration:${pageId}] points_charged points=${CALIBRATION_SEARCH_POINT_COST} remaining_after=${pointsRemaining}`);

    // 7) Resolve authorised source bytes server-side (no arbitrary client URLs).
    let sourceBuffer: Buffer;
    try {
      const { data: blob, error: dlError } = await supabase.storage
        .from(BUCKETS.QUOTE_DOCUMENTS)
        .download(storagePath);
      if (dlError || !blob) {
        return errorResponse(503, 'UNSUPPORTED_IMAGE', 'Source image could not be read.');
      }
      sourceBuffer = Buffer.from(await blob.arrayBuffer());
    } catch {
      return errorResponse(503, 'UNSUPPORTED_IMAGE', 'Source image could not be read.');
    }

    // 8) Bounded provider work (ONE discovery + ONE refinement call).
    const refineReferenceIds = Array.isArray(body.refineReferenceIds)
      ? body.refineReferenceIds.filter((v): v is string => typeof v === 'string').slice(0, 3)
      : undefined;
    const excludeReferenceIds = Array.isArray(body.excludeReferenceIds)
      ? body.excludeReferenceIds.filter((v): v is string => typeof v === 'string').slice(0, 10)
      : undefined;

    try {
      const result = await runCalibrationSearch({
        sourceBuffer,
        pageId,
        imageRevision,
        round: round === 1 ? 1 : 0,
        strategy: action === 'refine' ? 'refine_reference' : (strategy as 'initial' | 'different_references' | 'refine_reference'),
        refineReferenceIds,
        excludeReferenceIds,
      });

      // Round-0 success mints the single rescan authorisation; round-1 does not.
      const roundToken = round === 0 ? signRoundToken(pageId, imageRevision) : undefined;

      // P6: attach real evidence crops (endpoint/label close-ups) generated from
      // the immutable source, plus the server source dims the client needs to map
      // candidates into its own scene frame. Skipped entirely for empty results.
      let payloadCandidates: Array<Record<string, unknown>> = result.candidates as unknown as Array<Record<string, unknown>>;
      let sourceWidth: number | null = null;
      let sourceHeight: number | null = null;
      if (result.candidates.length > 0) {
        const withCrops = await attachEvidenceCrops(sourceBuffer, result.candidates as never);
        payloadCandidates = withCrops.candidates;
        sourceWidth = withCrops.sourceWidth;
        sourceHeight = withCrops.sourceHeight;
      }

      console.log(`[calibration:${pageId}] search_success action=${action} round=${round} status=${result.status} candidates=${result.candidates.length} strategy=${strategy} tokens=${result.modelUsage?.totalTokens ?? 'n/a'}`);
      if (result.status === 'unsuitable_image') {
        console.log(`[calibration:${pageId}] unsuitable reason=${JSON.stringify(result.notes[0] ?? 'none')}`);
      }

      return NextResponse.json({
        success: true,
        action,
        status: result.status,
        round,
        pageId,
        imageRevision,
        sourceWidth,
        sourceHeight,
        candidates: payloadCandidates,
        notes: result.notes,
        completedSearchRounds: round + 1,
        rescanAvailable: round === 0,
        roundToken,
        pointsCharged: CALIBRATION_SEARCH_POINT_COST,
        pointsRemaining,
        detectorVersion: DETECTOR_VERSION,
      });
    } catch (err) {
      // Technical failure: refund the round's charge; never return fake success.
      if (err instanceof CalibrationVisionError) {
        const refunded = await refundCalibrationPoint(profile.company_id, CALIBRATION_SEARCH_POINT_COST);
        console.warn(`[calibration:${pageId}] vision failure code=${err.code} refunded=${refunded}`);
        const status = err.code === 'MODEL_TIMEOUT' ? 504 : err.code === 'UNSUPPORTED_IMAGE' ? 400 : 502;
        return errorResponse(status, err.code, 'AI calibration search failed. No points were charged for this attempt.', {
          pointsRemaining: refunded ? pointsRemaining + CALIBRATION_SEARCH_POINT_COST : pointsRemaining,
          refunded,
        });
      }
      throw err;
    }
  } catch (err) {
    console.error('[calibration] unexpected error:', err instanceof Error ? err.message : err);
    return errorResponse(500, 'INTERNAL_ERROR', 'Unexpected server error.');
  }
}
