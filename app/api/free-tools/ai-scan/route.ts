import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { createAdminClient } from '@/app/lib/supabase/admin';
import {
  V3_SCAN1_SCHEMA,
  V3_SCAN2_SCHEMA,
  V3_SCAN3_SCHEMA,
  buildV3OutlinePrompt,
  buildV3LineDetectionPrompt,
  buildV3ClassificationPrompt,
  type V3Point,
  type V3Line,
  type V3Classification,
} from '@/app/lib/takeoff/ai-prompt-v3';
import { renderOutlineOverlay, renderLineOverlay, renderCleanOverlay, outlineToEdgeLines } from '@/app/lib/takeoff/scanOverlay';
import { perimeterAccountingPass } from '@/app/lib/takeoff/applyAiResults';
import { classifyCandidateStrokeStyles, NEAR_EMPTY_DUTY_CYCLE } from '@/app/lib/takeoff/strokeStyle';
import { mergeArtificialCollinearSplits, removeIslandMicroClusters, findIsolatedClosedLoopLineIds } from '@/app/lib/takeoff/scanPostprocess';
import {
  classifyOutlineVertices,
  matchEndpointsToVertices,
  enforceHipValleyVertexRule,
  enforceHipValleyAngleRule,
  type AugmentedLine,
} from '@/app/lib/takeoff/outlineGeometry';
import {
  callVisionModel,
  preprocessImage,
  validatePolygon,
  filterAngleValid,
  validateConnectivity,
  classificationsToComponents,
  mergeCollinearSplitLines,
  scalePoint,
  scaleResult,
  type AiScanResult,
} from '@/app/lib/takeoff/aiScanShared';
import {
  freeAiScanConfig,
  freeAiScanIdentityKey,
  admitFreeAiScan,
  refundFreeAiScan,
} from '@/app/lib/free-tools/aiScanGate';

/**
 * Anonymous AI scan endpoint for the free roof takeoff tool (2026-10-02, Darren).
 *
 * Runs the SAME 3-stage pipeline and geometry post-processing as the paid
 * /api/takeoff/ai-scan-v3 route (shared code in app/lib/takeoff/aiScanShared),
 * minus auth, point billing, quote/page persistence, and debug storage.
 *
 * Gating (see app/lib/free-tools/aiScanGate + migration
 * 20261002090000_free_ai_scan_gate):
 *   - 9 credits per device per UTC day - EVERY model call costs 1 credit
 *     (outline scan = 1, component detection = 2, full job = 3)
 *   - global daily cap across ALL anonymous users - when hit, the tool
 *     degrades to manual-only with a generic message until UTC midnight
 *   - failures after admission are refunded so errors never burn credits
 *   - High quality is rejected server-side (main app only - cost control)
 *   - kill switch: FREE_AI_SCAN_ENABLED=false disables AI for the free tool
 */

export const runtime = 'nodejs';
export const maxDuration = 300;

const MAX_IMAGE_BASE64_LENGTH = 8_000_000; // ~6MB binary

function makeTimer() {
  const marks: Array<{ label: string; ms: number }> = [];
  const start = Date.now();
  let last = start;
  return {
    mark(label: string) {
      const now = Date.now();
      marks.push({ label, ms: now - last });
      last = now;
    },
    summary() {
      return { total: Date.now() - start, marks };
    },
  };
}

/** Fire-and-forget usage log into the shared free-tool ledger (admin panel). */
function logUsage(params: {
  identity: string;
  stage: string;
  qualityLevel: string;
  success: boolean;
  error?: string;
  durationMs?: number;
}) {
  try {
    const admin = createAdminClient();
    admin.from('free_tool_usage').insert({
      tool_code: 'roof-takeoff',
      tool_name: 'Free Roof Takeoff',
      parse_mode: 'ai-scan',
      document_type: `${params.stage}:${params.qualityLevel}`,
      tier: 1,
      user_id: null,
      user_email: null,
      ip_address: params.identity, // opaque HMAC identity, never raw IP
      has_app_account: false,
    }).then(() => {}, (err) => {
      console.warn('[free-ai-scan] usage log failed:', err.message);
    });
  } catch {
    // never block the response on logging
  }
}

export async function POST(req: NextRequest) {
  const requestId = `free_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const timer = makeTimer();
  const cfg = freeAiScanConfig();

  // ── Kill switches ──
  if (!cfg.enabled || process.env.AI_TAKEOFF_ENABLED !== 'true') {
    return NextResponse.json({
      success: false,
      code: 'disabled',
      error: 'AI scan is temporarily unavailable. Manual measurement is still fully available.',
    }, { status: 503 });
  }

  let admitted = false;
  let identity = '';

  try {
    const body = await req.json() as Record<string, unknown>;
    const stage = typeof body.stage === 'string' ? body.stage : null;
    if (stage !== 'scan1' && stage !== 'scan2' && stage !== 'scan3') {
      return NextResponse.json({ success: false, error: 'Invalid stage.' }, { status: 400 });
    }

    identity = freeAiScanIdentityKey(req);

    // Quality level from client (low / medium / high). Default: medium.
    const qualityLevel = typeof body.qualityLevel === 'string' && ['low', 'medium', 'high'].includes(body.qualityLevel)
      ? body.qualityLevel
      : 'medium';

    // High quality is main-app only on the free tool (cost control + upsell).
    // The UI greys the button out; this is the server-side backstop.
    if (qualityLevel === 'high') {
      return NextResponse.json({
        success: false,
        code: 'quality_restricted',
        error: 'High quality is only available in the main QuoteCore+ app.',
      }, { status: 400 });
    }

    // Model per quality level - identical to the paid route:
    // low = GPT-5.6 Luna (fastest), medium = GPT-6 Astra on low reasoning,
    // high = GPT-6 Astra on medium reasoning (complex plans).
    const MODEL_BY_QUALITY: Record<string, string> = {
      low: 'gpt-5.6-luna',
      medium: 'gpt-6-astra',
      high: 'gpt-6-astra',
    };
    const model = MODEL_BY_QUALITY[qualityLevel] || process.env.AI_TAKEOFF_MODEL || 'gpt-5.6-luna';
    const effortMap = { low: 'low', medium: 'low', high: 'medium' } as const;
    const userReasoningEffort = effortMap[qualityLevel as keyof typeof effortMap] || 'medium';
    const tokenLimits = qualityLevel === 'high'
      ? { scan1: 8000, scan2: 12000, scan3: 12000 }
      : { scan1: 5000, scan2: 8000, scan3: 8000 };

    const canvasDims = body.canvasDimensions as { width?: number; height?: number } | undefined;
    const canvasW = typeof canvasDims?.width === 'number' ? canvasDims.width : 800;
    const canvasH = typeof canvasDims?.height === 'number' ? canvasDims.height : 600;

    const usage = (success: boolean, error?: string) => logUsage({
      identity, stage, qualityLevel, success, error,
      durationMs: timer.summary().total,
    });

    const base64Image = typeof body.image === 'string' ? body.image : null;
    if (!base64Image || base64Image.length > MAX_IMAGE_BASE64_LENGTH) {
      return NextResponse.json({ success: false, error: 'Missing or oversized image (max ~6MB).' }, { status: 400 });
    }

    // ── Shared decode + preprocess ──
    timer.mark('image_decode_start');
    const rawBuffer = Buffer.from(base64Image.replace(/^data:[^;]+;base64,/, ''), 'base64');
    const processedBuffer = await preprocessImage(rawBuffer);
    const meta = await sharp(processedBuffer).metadata();
    const imgW = meta.width ?? 800;
    const imgH = meta.height ?? 600;
    timer.mark('image_decode_done');

    if (imgW < 200 || imgH < 200) {
      return NextResponse.json({ success: false, error: 'Image is too small for analysis.' }, { status: 400 });
    }

    const originalDataUrl = `data:image/png;base64,${processedBuffer.toString('base64')}`;

    // ── Per-stage param pre-check (BEFORE charging a credit) ──
    if (stage === 'scan2') {
      const preOutline = body.outlinePoints as V3Point[] | undefined;
      const preDims = body.analysisDimensions as { width: number; height: number } | undefined;
      if (!preOutline || !preDims) {
        return NextResponse.json({ success: false, error: 'Missing outlinePoints or analysisDimensions.' }, { status: 400 });
      }
    }
    if (stage === 'scan3') {
      const preOutline = body.outlinePoints as V3Point[] | undefined;
      const preLines = body.lines as V3Line[] | undefined;
      const preDims = body.analysisDimensions as { width: number; height: number } | undefined;
      if (!preOutline || !preLines || !preDims) {
        return NextResponse.json({ success: false, error: 'Missing outlinePoints, lines, or analysisDimensions.' }, { status: 400 });
      }
    }

    // ── Credit admission: EVERY model call costs 1 credit ──
    const admission = await admitFreeAiScan(identity);
    if (admission === null) {
      return NextResponse.json({
        success: false,
        code: 'gate_error',
        error: 'Could not verify scan availability. Please try again.',
      }, { status: 500 });
    }
    if (!admission.allowed) {
      if (admission.reason === 'global_cap') {
        usage(false, 'global_cap');
        return NextResponse.json({
          success: false,
          code: 'global_cap',
          error: 'AI scan is temporarily unavailable right now. Manual measurement is still fully available.',
        }, { status: 429 });
      }
      usage(false, 'identity_cap');
      return NextResponse.json({
        success: false,
        code: 'identity_cap',
        error: `You've used all ${admission.identityCap} free AI scans for today. Create a free account for full AI takeoffs, or continue with manual measurement.`,
        limit: admission.identityCap,
        remaining: Math.max(0, admission.identityCap - (admission.identityUsed ?? admission.identityCap)),
      }, { status: 429 });
    }
    admitted = true;
    const usedCreditsNow = admission.identityUsed ?? admission.identityCap;
    const creditsPayload = {
      used: usedCreditsNow,
      limit: admission.identityCap,
      remaining: Math.max(0, admission.identityCap - usedCreditsNow),
    };

    // ════════════════════════════════════════════════════════════════════
    // SCAN 1: OUTLINE ONLY
    // ════════════════════════════════════════════════════════════════════
    if (stage === 'scan1') {

      timer.mark('scan1_call_start');
      let result;
      try {
        result = await callVisionModel(
          buildV3OutlinePrompt(imgW, imgH),
          [
            { dataUrl: originalDataUrl, label: 'IMAGE 1: ORIGINAL PLAN (the raw architectural roof plan)' },
          ],
          V3_SCAN1_SCHEMA,
          model,
          { reasoningEffort: userReasoningEffort, maxCompletionTokens: tokenLimits.scan1 },
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        usage(false, message);
        await refundFreeAiScan(identity); // failed scan - credit back
        return NextResponse.json({ success: false, error: `Outline detection failed: ${message}` }, { status: 502 });
      }
      timer.mark('scan1_call_done');

      console.log(`[free-ai-scan:${requestId}] scan1: responseId=${result.responseId} usage=`, result.usage);

      const raw = result.parsed as Record<string, unknown>;
      const roofAreasRaw = (Array.isArray(raw.roof_areas) ? raw.roof_areas : [])
        .filter((a): a is Record<string, unknown> => typeof a === 'object' && a !== null)
        .map((a, idx) => {
          const points = (Array.isArray(a.points) ? a.points : [])
            .filter((p): p is Record<string, unknown> => typeof p === 'object' && p !== null)
            .map(p => ({
              x: typeof p.x === 'number' ? Math.round(p.x) : 0,
              y: typeof p.y === 'number' ? Math.round(p.y) : 0,
            }));
          return {
            name: typeof a.name === 'string' ? a.name : `Area ${idx + 1}`,
            points,
            pitch_degrees: typeof a.pitch_degrees === 'number' ? a.pitch_degrees : null,
          };
        });

      // Validate polygon
      const polygonRaw = roofAreasRaw[0]?.points ?? [];
      const validation = validatePolygon(polygonRaw, imgW, imgH);

      if (!validation.valid || validation.cleanedPoints.length < 4) {
        usage(false, `Scan 1 polygon invalid: ${validation.errors.join('; ')}`);
        await refundFreeAiScan(identity); // failed scan - credit back
        return NextResponse.json({ success: false, error: 'AI could not detect a valid roof outline.' }, { status: 422 });
      }

      const finalPolygon = validation.cleanedPoints;
      const notes = Array.isArray(raw.notes) ? raw.notes.filter((n): n is string => typeof n === 'string') : [];
      console.log(`[free-ai-scan:${requestId}] scan1: ${finalPolygon.length} vertices after validation`);

      const roofAreaName = roofAreasRaw[0]?.name ?? 'Area 1';
      const pitchDegrees = roofAreasRaw[0]?.pitch_degrees ?? null;

      const scaleX = canvasW / imgW;
      const scaleY = canvasH / imgH;
      const roofAreasCanvas = [{
        name: roofAreaName,
        points: finalPolygon.map(p => scalePoint(p, scaleX, scaleY)),
        pitch_degrees: pitchDegrees,
      }];

      usage(true);
      const usedCredits = admission.identityUsed ?? admission.identityCap;
      console.log(`[free-ai-scan:${requestId}] scan1 complete: identity=${identity.slice(0, 10)}… credits=${usedCredits}/${admission.identityCap} global=${admission.globalUsed}/${admission.globalCap}${admission.warn ? ' [WARN]' : ''}`);

      return NextResponse.json({
        success: true,
        stage: 'scan1',
        data: { roof_areas: roofAreasCanvas, notes },
        analysisDimensions: { width: imgW, height: imgH },
        canvasDimensions: { width: canvasW, height: canvasH },
        summary: { areas: roofAreasCanvas.length, vertices: roofAreasCanvas[0]?.points.length ?? 0, notes },
        credits: creditsPayload,
      });
    }

    // ════════════════════════════════════════════════════════════════════
    // SCAN 2: INTERNAL LINE DETECTION
    // ════════════════════════════════════════════════════════════════════
    if (stage === 'scan2') {
      const outlinePointsCanvas = body.outlinePoints as V3Point[] | undefined;
      const analysisDims = body.analysisDimensions as { width: number; height: number } | undefined;

      if (!outlinePointsCanvas || !analysisDims) {
        return NextResponse.json({ success: false, error: 'Missing outlinePoints or analysisDimensions.' }, { status: 400 });
      }

      const scaleX = imgW / canvasW;
      const scaleY = imgH / canvasH;
      const outlinePoints: V3Point[] = outlinePointsCanvas.map(p => ({
        x: Math.round(p.x * scaleX),
        y: Math.round(p.y * scaleY),
      }));

      const outlineOverlayBuffer = await renderOutlineOverlay(processedBuffer, outlinePoints, imgW, imgH);
      timer.mark('overlay_done');

      timer.mark('scan2_call_start');
      const overlayDataUrl = `data:image/png;base64,${outlineOverlayBuffer.toString('base64')}`;

      let result;
      try {
        result = await callVisionModel(
          buildV3LineDetectionPrompt({ width: imgW, height: imgH, outlinePoints }),
          [
            { dataUrl: overlayDataUrl, label: 'IMAGE 1: OUTLINE OVERLAY (original plan with confirmed roof outline drawn as a thick blue line)' },
            { dataUrl: originalDataUrl, label: 'IMAGE 2: ORIGINAL PLAN (for context)' },
          ],
          V3_SCAN2_SCHEMA,
          model,
          { reasoningEffort: userReasoningEffort, maxCompletionTokens: tokenLimits.scan2 },
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        usage(false, message);
        await refundFreeAiScan(identity); // failed call - credit back
        return NextResponse.json({ success: false, error: `Line detection failed: ${message}` }, { status: 502 });
      }
      timer.mark('scan2_call_done');

      console.log(`[free-ai-scan:${requestId}] scan2: responseId=${result.responseId} usage=`, result.usage);

      const raw = result.parsed as Record<string, unknown>;
      const rawLines = (Array.isArray(raw.lines) ? raw.lines : [])
        .filter((l): l is Record<string, unknown> => typeof l === 'object' && l !== null)
        .map((l, idx) => {
          const start = l.start as Record<string, unknown> | undefined;
          const end = l.end as Record<string, unknown> | undefined;
          return {
            id: `L${idx + 1}`,
            start: { x: typeof start?.x === 'number' ? Math.round(start.x) : 0, y: typeof start?.y === 'number' ? Math.round(start.y) : 0 },
            end: { x: typeof end?.x === 'number' ? Math.round(end.x) : 0, y: typeof end?.y === 'number' ? Math.round(end.y) : 0 },
            confidence: 0.5,
          } as V3Line;
        })
        .filter(l => {
          const len = Math.sqrt((l.end.x - l.start.x) ** 2 + (l.end.y - l.start.y) ** 2);
          return len >= 5 && l.start.x >= 0 && l.start.x < imgW && l.start.y >= 0 && l.start.y < imgH
            && l.end.x >= 0 && l.end.x < imgW && l.end.y >= 0 && l.end.y < imgH;
        });

      const notes = Array.isArray(raw.notes) ? raw.notes.filter((n): n is string => typeof n === 'string') : [];

      timer.mark('postprocess_start');
      // Early stroke-style classification (BEFORE angle snap / connectivity):
      // dotted/dashed plan lines are never roof components.
      const strokeMap = await classifyCandidateStrokeStyles(processedBuffer, rawLines);
      const dashedRawIds = new Set([...strokeMap.entries()].filter(([, e]) => e.style === 'dashed').map(([id]) => id));
      const ambiguousStrokeCount = [...strokeMap.values()].filter(e => e.style === 'ambiguous').length;
      if (dashedRawIds.size > 0) {
        console.log(`[free-ai-scan:${requestId}] scan2 stroke-style: removed ${dashedRawIds.size} dashed candidate(s)`);
      }
      const strokeFilteredLines = rawLines.filter(l => !dashedRawIds.has(l.id));

      const { valid: angleValidLines, rejected: angleRejectedLines } = filterAngleValid(strokeFilteredLines);
      const { connected: connectedLines, floating: floatingLines } = validateConnectivity(angleValidLines, outlinePoints);

      // Pre-Scan-3 artificial split healing (classification-independent)
      const healResult = mergeArtificialCollinearSplits(connectedLines, outlinePoints);
      if (healResult.merges.length > 0) {
        console.log(`[free-ai-scan:${requestId}] scan2 pre-heal: ${healResult.merges.length} collinear merge(s)`);
      }

      // Island micro-cluster removal
      const clusterResult = removeIslandMicroClusters(healResult.lines, outlinePoints);
      const finalLines: V3Line[] = clusterResult.lines.map((l, i) => ({ ...l, id: `L${i + 1}` }));
      timer.mark('postprocess_done');

      console.log(`[free-ai-scan:${requestId}] scan2 postprocess: raw=${rawLines.length} dashedRemoved=${dashedRawIds.size} ambiguous=${ambiguousStrokeCount} angleValid=${angleValidLines.length} connected=${connectedLines.length} preHealed=${healResult.merges.length} rejected(angle)=${angleRejectedLines.length} floating=${floatingLines.length}`);

      const canvasScaleX = canvasW / imgW;
      const canvasScaleY = canvasH / imgH;
      const linesCanvas = finalLines.map(l => ({
        ...l,
        start: scalePoint(l.start, canvasScaleX, canvasScaleY),
        end: scalePoint(l.end, canvasScaleX, canvasScaleY),
      }));
      const outlineCanvas = outlinePoints.map(p => scalePoint(p, canvasScaleX, canvasScaleY));

      usage(true);

      return NextResponse.json({
        success: true,
        stage: 'scan2',
        data: { lines: linesCanvas, outlinePoints: outlineCanvas, notes },
        analysisDimensions: { width: imgW, height: imgH },
        canvasDimensions: { width: canvasW, height: canvasH },
        summary: { rawLines: rawLines.length, finalLines: finalLines.length, dashedRemoved: dashedRawIds.size, preHealedMerges: healResult.merges.length, angleRejected: angleRejectedLines.length, floating: floatingLines.length, notes },
        credits: creditsPayload,
      });
    }

    // ════════════════════════════════════════════════════════════════════
    // SCAN 3: CLASSIFICATION ONLY
    // ════════════════════════════════════════════════════════════════════
    if (stage === 'scan3') {
      const outlinePointsCanvas = body.outlinePoints as V3Point[] | undefined;
      const linesCanvas = body.lines as V3Line[] | undefined;
      const analysisDims = body.analysisDimensions as { width: number; height: number } | undefined;

      if (!outlinePointsCanvas || !linesCanvas || !analysisDims) {
        return NextResponse.json({ success: false, error: 'Missing outlinePoints, lines, or analysisDimensions.' }, { status: 400 });
      }

      const scaleX = imgW / canvasW;
      const scaleY = imgH / canvasH;
      const outlinePoints: V3Point[] = outlinePointsCanvas.map(p => ({
        x: Math.round(p.x * scaleX), y: Math.round(p.y * scaleY),
      }));
      let lines: V3Line[] = linesCanvas.map(l => ({
        id: l.id,
        start: { x: Math.round(l.start.x * scaleX), y: Math.round(l.start.y * scaleY) },
        end: { x: Math.round(l.end.x * scaleX), y: Math.round(l.end.y * scaleY) },
        confidence: l.confidence,
      }));

      const edgeLines = outlineToEdgeLines(outlinePoints);
      const allLines = [...lines, ...edgeLines];

      // Backend vertex classification + endpoint matching (authoritative metadata)
      let vertexMetadata: Array<{ id: string; index: number; x: number; y: number; cornerType: string }> = [];
      let augmentedLines: AugmentedLine[] = [];
      try {
        const classifiedVertices = classifyOutlineVertices(outlinePoints);
        vertexMetadata = classifiedVertices.map(v => ({
          id: v.id, index: v.index, x: v.x, y: v.y, cornerType: v.cornerType,
        }));
        augmentedLines = matchEndpointsToVertices(allLines, classifiedVertices, 15);
        console.log(`[free-ai-scan:${requestId}] scan3: vertex classification: ${classifiedVertices.length} vertices`);
      } catch (vertexError) {
        console.warn(`[free-ai-scan:${requestId}] scan3: vertex classification failed:`, vertexError instanceof Error ? vertexError.message : vertexError);
      }

      timer.mark('overlay_start');
      const annotatedBuffer = await renderLineOverlay(processedBuffer, outlinePoints, lines, imgW, imgH);
      const cleanBuffer = await renderCleanOverlay(outlinePoints, lines, imgW, imgH);
      timer.mark('overlay_done');

      timer.mark('scan3_call_start');
      const annotatedDataUrl = `data:image/png;base64,${annotatedBuffer.toString('base64')}`;
      const cleanDataUrl = `data:image/png;base64,${cleanBuffer.toString('base64')}`;

      let result;
      try {
        result = await callVisionModel(
          buildV3ClassificationPrompt({ outlinePoints, lines: allLines, vertexMetadata, augmentedLines }),
          [
            { dataUrl: annotatedDataUrl, label: 'IMAGE 1: ANNOTATED ORIGINAL (original plan with outline and labeled lines)' },
            { dataUrl: cleanDataUrl, label: 'IMAGE 2: CLEAN OVERLAY (outline + labeled lines only, no plan)' },
            { dataUrl: originalDataUrl, label: 'IMAGE 3: ORIGINAL PLAN (for reference)' },
          ],
          V3_SCAN3_SCHEMA,
          model,
          { reasoningEffort: userReasoningEffort, maxCompletionTokens: tokenLimits.scan3 },
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        usage(false, message);
        await refundFreeAiScan(identity); // failed call - credit back
        return NextResponse.json({ success: false, error: `Classification failed: ${message}` }, { status: 502 });
      }
      timer.mark('scan3_call_done');

      console.log(`[free-ai-scan:${requestId}] scan3: responseId=${result.responseId} usage=`, result.usage);

      const raw = result.parsed as Record<string, unknown>;
      const classifications = (Array.isArray(raw.classifications) ? raw.classifications : [])
        .filter((c): c is Record<string, unknown> => typeof c === 'object' && c !== null)
        .map(c => ({
          line_id: typeof c.line_id === 'string' ? c.line_id : '',
          type: (['ridge', 'hip', 'valley', 'barge', 'spouting', 'broken_hip', 'broken_barge', 'uncertain'].includes(c.type as string) ? c.type : 'uncertain') as V3Classification['type'],
          confidence: typeof c.confidence === 'number' ? c.confidence : 0.5,
          reason: typeof c.reason === 'string' ? c.reason : '',
        }))
        .filter(c => c.line_id);

      // Backend hip/valley enforcement (vertex rule + angle gate)
      let enforcementCorrections: Array<{ line_id: string; from: string; to: string; reason: string }> = [];
      let finalClassifications = classifications;
      if (augmentedLines.length > 0 && vertexMetadata.length > 0) {
        const enforcement = enforceHipValleyVertexRule(classifications, augmentedLines);
        finalClassifications = enforcement.classifications as typeof classifications;
        enforcementCorrections = enforcement.corrections;
        try {
          const classified = classifyOutlineVertices(outlinePoints);
          const angleGate = enforceHipValleyAngleRule(finalClassifications, augmentedLines, classified);
          finalClassifications = angleGate.classifications as typeof finalClassifications;
          if (angleGate.corrections.length > 0) {
            enforcementCorrections.push(...angleGate.corrections);
          }
        } catch (angleErr) {
          console.warn(`[free-ai-scan:${requestId}] angle gate skipped:`, angleErr instanceof Error ? angleErr.message : angleErr);
        }
      }

      // Floating-line safety net: force uncertain, never silently trust or lose.
      const { floating: scan3Floating } = validateConnectivity(allLines, outlinePoints);
      if (scan3Floating.length > 0) {
        const floatingIds = new Set(scan3Floating.map(l => l.id));
        finalClassifications = finalClassifications.map(c =>
          floatingIds.has(c.line_id) && c.type !== 'uncertain'
            ? { ...c, type: 'uncertain' as const, reason: `Backend: line is not connected to the roof network - marked uncertain for manual review` }
            : c
        );
      }

      // Stroke-style raster safety net: drop raster-proven dashed lines;
      // demote near-empty ambiguous traces to uncertain.
      const strokeMap3 = await classifyCandidateStrokeStyles(processedBuffer, lines);
      const dashedIds = new Set([...strokeMap3.entries()].filter(([, e]) => e.style === 'dashed').map(([id]) => id));
      const nearEmptyIds = new Set([...strokeMap3.entries()]
        .filter(([, e]) => e.style === 'ambiguous' && e.dutyCycle <= NEAR_EMPTY_DUTY_CYCLE)
        .map(([id]) => id));
      if (nearEmptyIds.size > 0) {
        finalClassifications = finalClassifications.map(c =>
          nearEmptyIds.has(c.line_id) && c.type !== 'uncertain'
            ? { ...c, type: 'uncertain' as const, reason: `Backend: stroke shows almost no ink (duty<=${NEAR_EMPTY_DUTY_CYCLE}) - likely fine dotted plan line, marked uncertain for review` }
            : c
        );
      }
      if (dashedIds.size > 0) {
        console.log(`[free-ai-scan:${requestId}] scan3: dropped ${dashedIds.size} dashed line(s)`);
        lines = lines.filter(l => !dashedIds.has(l.id));
        finalClassifications = finalClassifications.filter(c => !dashedIds.has(c.line_id));
      }

      // Isolated closed-loop demotion (annotation-box suspicion)
      const loopDemotions = findIsolatedClosedLoopLineIds(lines);
      if (loopDemotions.ids.size > 0) {
        finalClassifications = finalClassifications.map(c =>
          loopDemotions.ids.has(c.line_id) && c.type !== 'uncertain'
            ? { ...c, type: 'uncertain' as const, reason: 'Backend: part of an isolated closed loop with no junction to the roof network - likely a traced annotation box, marked uncertain for review' }
            : c
        );
      }

      // Collinear split merge
      const mergeResult = mergeCollinearSplitLines(lines, outlinePoints, finalClassifications);
      if (mergeResult.merges.length > 0) {
        console.log(`[free-ai-scan:${requestId}] scan3: collinear merges: ${mergeResult.merges.length}`);
        lines = mergeResult.lines;
        finalClassifications = mergeResult.classifications as typeof finalClassifications;
      }

      const notes = Array.isArray(raw.notes) ? raw.notes.filter((n): n is string => typeof n === 'string') : [];

      // Build AiScanResult
      const components = classificationsToComponents(lines, outlinePoints, finalClassifications);

      const aiResult: AiScanResult = {
        scale: { detected: false, ratio: null, dimension_line: null },
        pitch: { detected: false, global_degrees: null },
        roof_areas: [{ name: 'Area 1', points: outlinePoints, pitch_degrees: null }],
        components,
        notes,
      };

      // Run perimeter accounting pass (barge/spouting correction)
      const perimeterCorrected = perimeterAccountingPass(aiResult);
      const correctedResult: AiScanResult = { ...aiResult, components: perimeterCorrected };

      // Scale to canvas dimensions
      const canvasResult = scaleResult(correctedResult, canvasW / imgW, canvasH / imgH);
      canvasResult.roof_areas = [{ name: 'Area 1', points: outlinePointsCanvas, pitch_degrees: null }];

      usage(true);
      console.log(`[free-ai-scan:${requestId}] scan3 complete: ridges=${canvasResult.components.ridges.length} hips=${canvasResult.components.hips.length} valleys=${canvasResult.components.valleys.length} uncertain=${canvasResult.components.uncertain.length}`);

      return NextResponse.json({
        success: true,
        stage: 'scan3',
        data: canvasResult,
        summary: {
          areas: canvasResult.roof_areas.length,
          components: canvasResult.components.ridges.length + canvasResult.components.hips.length + canvasResult.components.valleys.length + canvasResult.components.broken_hips.length + canvasResult.components.barges.length + canvasResult.components.spouting.length + canvasResult.components.uncertain.length,
          ridges: canvasResult.components.ridges.length,
          hips: canvasResult.components.hips.length,
          valleys: canvasResult.components.valleys.length,
          broken_hips: canvasResult.components.broken_hips.length,
          barges: canvasResult.components.barges.length,
          spouting: canvasResult.components.spouting.length,
          uncertain: canvasResult.components.uncertain.length,
          notes: canvasResult.notes,
        },
        classificationDetails: finalClassifications,
        enforcementCorrections: enforcementCorrections.length > 0 ? enforcementCorrections : undefined,
        credits: creditsPayload,
      });
    }

    return NextResponse.json({ success: false, error: `Unknown stage: ${stage}` }, { status: 400 });
  } catch (error) {
    console.error('[free-ai-scan] unhandled error:', error);
    if (admitted && identity) {
      await refundFreeAiScan(identity); // never burn a credit on our failure
    }
    return NextResponse.json({
      success: false,
      error: `Server error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }, { status: 500 });
  }
}
