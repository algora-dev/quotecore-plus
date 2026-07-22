/**
 * AI Takeoff V3 — 3-scan pipeline.
 *
 * Scan 1: Outline only (GPT traces roof perimeter)
 * Scan 2: Internal line detection (GPT traces visible lines, angle-snapped)
 * Scan 3: Classification only (GPT names each labeled line)
 *
 * Each scan does ONE thing → simpler prompts → better accuracy.
 *
 * Stages are called sequentially by the client:
 *   POST { stage: 'scan1', image, quoteId, pageId }
 *   POST { stage: 'scan2', image, quoteId, pageId, outlinePoints, analysisDimensions }
 *   POST { stage: 'scan3', image, quoteId, pageId, outlinePoints, lines, analysisDimensions }
 *
 * After Scan 3, post-processing (perimeterAccountingPass etc.) runs
 * and the result is mapped to the existing AiScanData format for client compatibility.
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import sharp from 'sharp';
import { createSupabaseServerClient, requireCompanyContext } from '@/app/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import type { Database } from '@/app/lib/supabase/database.types';
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
import {
  renderOutlineOverlay,
  renderLineOverlay,
  renderCleanOverlay,
  renderScan2AuditOverlay,
  outlineToEdgeLines,
} from '@/app/lib/takeoff/scanOverlay';
import { perimeterAccountingPass } from '@/app/lib/takeoff/applyAiResults';

export const runtime = 'nodejs';
export const maxDuration = 300;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || 'placeholder' });

// ── Types (match existing AiScanData for client compatibility) ──────────

interface LineEntry { points: Array<{ x: number; y: number }> }
interface RoofAreaEntry { name: string; points: Array<{ x: number; y: number }>; pitch_degrees: number | null }
interface AiScanResult {
  scale: { detected: boolean; ratio: string | null; dimension_line: { p1: { x: number; y: number }; p2: { x: number; y: number }; real_length: number; unit: string } | null };
  pitch: { detected: boolean; global_degrees: number | null };
  roof_areas: RoofAreaEntry[];
  components: {
    ridges: LineEntry[]; hips: LineEntry[]; valleys: LineEntry[];
    broken_hips: LineEntry[]; barges: LineEntry[]; spouting: LineEntry[];
    uncertain: LineEntry[];
  };
  notes: string[];
  error?: string;
}

// ── Timing & logging ────────────────────────────────────────────────────

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
      const total = Date.now() - start;
      return { total, marks };
    },
  };
}

function logRequest(params: {
  requestId: string;
  stage: string;
  timer: ReturnType<typeof makeTimer>;
  extra?: Record<string, unknown>;
}) {
  const { requestId, stage, timer, extra } = params;
  const { total, marks } = timer.summary();
  console.log(`[ai-scan-v3:${requestId}] stage=${stage} total=${total}ms`, {
    marks: marks.map(m => `${m.label}=${m.ms}ms`).join(', '),
    ...extra,
  });
}

// ── Helpers ─────────────────────────────────────────────────────────────

function emptyComponents(): AiScanResult['components'] {
  return { ridges: [], hips: [], valleys: [], broken_hips: [], barges: [], spouting: [], uncertain: [] };
}

function scalePoint(point: { x: number; y: number }, scaleX: number, scaleY: number) {
  return { x: Math.round(point.x * scaleX), y: Math.round(point.y * scaleY) };
}

function scaleResult(result: AiScanResult, scaleX: number, scaleY: number): AiScanResult {
  const scaleLine = (entry: LineEntry): LineEntry => ({
    points: entry.points.map(p => scalePoint(p, scaleX, scaleY)),
  });
  return {
    ...result,
    roof_areas: result.roof_areas.map(area => ({
      ...area,
      points: area.points.map(p => scalePoint(p, scaleX, scaleY)),
    })),
    components: {
      ridges: result.components.ridges.map(scaleLine),
      hips: result.components.hips.map(scaleLine),
      valleys: result.components.valleys.map(scaleLine),
      broken_hips: result.components.broken_hips.map(scaleLine),
      barges: result.components.barges.map(scaleLine),
      spouting: result.components.spouting.map(scaleLine),
      uncertain: result.components.uncertain.map(scaleLine),
    },
  };
}

// ── Debug image storage ────────────────────────────────────────────────

async function saveDebugImage(
  buffer: Buffer,
  quoteId: string,
  label: string,
): Promise<string | null> {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return null;
    const client = createServiceClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const path = `scan-debug/${quoteId}/${label}-${Date.now()}.png`;
    const uint8 = new Uint8Array(buffer);
    const { error } = await client.storage
      .from('QUOTE-DOCUMENTS')
      .upload(path, uint8, { contentType: 'image/png', upsert: false });
    if (error) {
      console.warn(`[ai-scan-v3] debug image upload failed: ${error.message}`);
      return null;
    }
    const { data: signedData, error: signedErr } = await client.storage
      .from('QUOTE-DOCUMENTS')
      .createSignedUrl(path, 86400); // 24-hour signed URL
    if (signedErr || !signedData?.signedUrl) {
      console.warn(`[ai-scan-v3] debug signed URL failed: ${signedErr?.message}`);
      return null;
    }
    return signedData.signedUrl;
  } catch (err) {
    console.warn('[ai-scan-v3] debug image save error:', err);
    return null;
  }
}

// ── Vision call helper ──────────────────────────────────────────────────

async function callVisionModel(
  prompt: string,
  images: Array<{ dataUrl: string; label?: string; detail?: 'high' | 'low' }>,
  schema: Record<string, unknown>,
  model: string,
  options: { reasoningEffort?: 'low' | 'medium' | 'high'; maxCompletionTokens: number },
): Promise<{ parsed: unknown; responseId: string | null; usage: { promptTokens: number; completionTokens: number; totalTokens: number } | null }> {
  const contentParts: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
    { type: 'text', text: prompt },
  ];
  for (const img of images) {
    if (img.label) {
      contentParts.push({ type: 'text', text: img.label });
    }
    contentParts.push({
      type: 'image_url',
      image_url: { url: img.dataUrl, detail: img.detail ?? 'high' },
    });
  }

  // reasoning_effort is only supported by o-series and GPT-5.x models.
  // GPT-4.1 / 4o don't accept this parameter.
  const supportsReasoningEffort = /^o\d|^gpt-5/i.test(model);
  const createParams: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
    model,
    max_completion_tokens: options.maxCompletionTokens,
    messages: [{ role: 'user', content: contentParts }],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'roof_plan_analysis',
        strict: true,
        schema,
      },
    },
  };
  if (supportsReasoningEffort && options.reasoningEffort) {
    createParams.reasoning_effort = options.reasoningEffort;
  }

  const response = await openai.chat.completions.create(createParams);

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error('AI returned an empty response.');

  return {
    parsed: JSON.parse(content),
    responseId: response.id ?? null,
    usage: response.usage ? {
      promptTokens: response.usage.prompt_tokens,
      completionTokens: response.usage.completion_tokens,
      totalTokens: response.usage.total_tokens,
    } : null,
  };
}

// ── Image preprocessing ────────────────────────────────────────────────

const MAX_OUTPUT_PX = 2000;

async function preprocessImage(rawBuffer: Buffer): Promise<Buffer> {
  let pipeline = sharp(rawBuffer).rotate();
  const metadata = await pipeline.metadata();
  const longestSide = Math.max(metadata.width ?? 0, metadata.height ?? 0);
  if (longestSide > MAX_OUTPUT_PX) {
    pipeline = pipeline.resize({
      width: MAX_OUTPUT_PX,
      height: MAX_OUTPUT_PX,
      fit: 'inside',
      withoutEnlargement: true,
    });
  }
  return pipeline.png({ compressionLevel: 8 }).toBuffer();
}

// ── Polygon validation ─────────────────────────────────────────────────

interface PolygonValidation {
  valid: boolean;
  cleanedPoints: V3Point[];
  errors: string[];
}

/**
 * Validate and clean a polygon array from AI output.
 * - Filters non-finite/out-of-bounds points
 * - Removes consecutive duplicate points
 * - Removes zero-length edges
 * - Handles explicit closure (first === last) by dropping the duplicate
 * - Requires at least 4 unique vertices for a meaningful polygon
 */
function validatePolygon(rawPoints: unknown[], imgW: number, imgH: number): PolygonValidation {
  const errors: string[] = [];

  // Parse and filter points
  const parsed: V3Point[] = [];
  for (const p of rawPoints) {
    if (typeof p !== 'object' || p === null) { errors.push('Non-object point rejected'); continue; }
    const obj = p as Record<string, unknown>;
    const x = typeof obj.x === 'number' ? Math.round(obj.x) : NaN;
    const y = typeof obj.y === 'number' ? Math.round(obj.y) : NaN;
    if (!Number.isFinite(x) || !Number.isFinite(y)) { errors.push('Non-finite point rejected'); continue; }
    // Clamp to image bounds with small tolerance
    const clampedX = Math.max(0, Math.min(x, imgW - 1));
    const clampedY = Math.max(0, Math.min(y, imgH - 1));
    parsed.push({ x: clampedX, y: clampedY });
  }

  // Remove consecutive duplicate points
  const deduped: V3Point[] = [];
  for (const p of parsed) {
    const last = deduped[deduped.length - 1];
    if (!last || last.x !== p.x || last.y !== p.y) {
      deduped.push(p);
    }
  }
  // Remove explicit closure point (first === last)
  if (deduped.length >= 2 && deduped[0].x === deduped[deduped.length - 1].x && deduped[0].y === deduped[deduped.length - 1].y) {
    deduped.pop();
  }
  // Remove zero-length edges (consecutive points that are the same after dedup)
  const cleaned: V3Point[] = [];
  for (const p of deduped) {
    const last = cleaned[cleaned.length - 1];
    if (!last || last.x !== p.x || last.y !== p.y) {
      cleaned.push(p);
    }
  }

  // Check for self-intersection (simple O(n²) segment crossing test)
  function segmentsIntersect(a1: V3Point, a2: V3Point, b1: V3Point, b2: V3Point): boolean {
    const d1 = (a2.x - a1.x) * (b1.y - a1.y) - (a2.y - a1.y) * (b1.x - a1.x);
    const d2 = (a2.x - a1.x) * (b2.y - a1.y) - (a2.y - a1.y) * (b2.x - a1.x);
    const d3 = (b2.x - b1.x) * (a1.y - b1.y) - (b2.y - b1.y) * (a1.x - b1.x);
    const d4 = (b2.x - b1.x) * (a2.y - b1.y) - (b2.y - b1.y) * (a2.x - b1.x);
    return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
  }
  let hasSelfIntersection = false;
  for (let i = 0; i < cleaned.length; i++) {
    const a1 = cleaned[i];
    const a2 = cleaned[(i + 1) % cleaned.length];
    for (let j = i + 2; j < cleaned.length; j++) {
      // Skip adjacent edges and the wrap-around edge
      if (j === cleaned.length - 1 && i === 0) continue;
      if (j === i + 1) continue;
      const b1 = cleaned[j];
      const b2 = cleaned[(j + 1) % cleaned.length];
      if (segmentsIntersect(a1, a2, b1, b2)) {
        hasSelfIntersection = true;
        break;
      }
    }
    if (hasSelfIntersection) break;
  }
  if (hasSelfIntersection) {
    errors.push('Polygon self-intersection detected');
  }

  // Need at least 4 unique vertices for a meaningful roof outline
  const uniqueCount = new Set(cleaned.map(p => `${p.x},${p.y}`)).size;
  if (uniqueCount < 4) {
    errors.push(`Polygon has only ${uniqueCount} unique vertices (need ≥ 4)`);
    return { valid: false, cleanedPoints: cleaned, errors };
  }

  const valid = errors.filter(e => e.includes('self-intersection')).length === 0;
  return { valid, cleanedPoints: cleaned, errors: errors.length ? errors : [] };
}

// ── Angle snapping (deterministic post-Scan 2) ──────────────────────────

const ANGLE_TOLERANCE = 5; // degrees — lines within this of 0/45/90/135 are snapped (matches prompt ±5°)
const ALLOWED_ANGLES = [0, 45, 90, 135];

function lineAngle(start: V3Point, end: V3Point): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (dx === 0 && dy === 0) return 0;
  let angle = Math.atan2(-dy, dx) * 180 / Math.PI;
  if (angle < 0) angle += 360;
  return angle;
}

function nearestAllowedAngle(angle: number): number | null {
  let best: number | null = null;
  let bestDiff = 360;
  for (const allowed of ALLOWED_ANGLES) {
    for (const candidate of [allowed, (allowed + 180) % 360]) {
      let diff = Math.abs(angle - candidate);
      if (diff > 180) diff = 360 - diff;
      if (diff < bestDiff) {
        bestDiff = diff;
        best = candidate % 180;
      }
    }
  }
  return bestDiff <= ANGLE_TOLERANCE ? best : null;
}

function snapLineToAngle(line: V3Line): V3Line {
  const angle = lineAngle(line.start, line.end);
  const targetAngle = nearestAllowedAngle(angle);
  if (targetAngle === null) return line;

  const midX = (line.start.x + line.end.x) / 2;
  const midY = (line.start.y + line.end.y) / 2;
  const length = Math.sqrt((line.end.x - line.start.x) ** 2 + (line.end.y - line.start.y) ** 2);
  const halfLen = length / 2;
  const rad = targetAngle * Math.PI / 180;
  const dx = Math.cos(rad);
  const dy = -Math.sin(rad);

  return {
    ...line,
    start: { x: Math.round(midX - dx * halfLen), y: Math.round(midY - dy * halfLen) },
    end: { x: Math.round(midX + dx * halfLen), y: Math.round(midY + dy * halfLen) },
  };
}

function filterAngleValid(lines: V3Line[]): { valid: V3Line[]; rejected: V3Line[] } {
  // Keep snap for near-canonical lines, but accept ALL angles (no hard reject).
  // Previously rejected lines >5° from 0/45/90/135, which silently dropped broken hips.
  const valid: V3Line[] = [];
  const rejected: V3Line[] = [];
  for (const line of lines) {
    const angle = lineAngle(line.start, line.end);
    const target = nearestAllowedAngle(angle);
    if (target !== null) {
      valid.push(snapLineToAngle(line));
    } else {
      // Non-canonical angle — keep the line as-is, don't reject it
      valid.push(line);
    }
  }
  return { valid, rejected };
}

// ── Connectivity validation ─────────────────────────────────────────────

function pointToSegmentDistance(p: V3Point, a: V3Point, b: V3Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (dx === 0 && dy === 0) return Math.sqrt((p.x - a.x) ** 2 + (p.y - a.y) ** 2);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
  const projX = a.x + t * dx;
  const projY = a.y + t * dy;
  return Math.sqrt((p.x - projX) ** 2 + (p.y - projY) ** 2);
}

function validateConnectivity(
  lines: V3Line[],
  outlinePoints: V3Point[],
  tolerance = 10,
): { connected: V3Line[]; floating: V3Line[] } {
  const connected: V3Line[] = [];
  const floating: V3Line[] = [];

  const endpoints: Array<{ x: number; y: number; lineId: string; isStart: boolean }> = [];
  for (const line of lines) {
    endpoints.push({ x: line.start.x, y: line.start.y, lineId: line.id, isStart: true });
    endpoints.push({ x: line.end.x, y: line.end.y, lineId: line.id, isStart: false });
  }

  function pointNearOutline(p: V3Point): boolean {
    for (let i = 0; i < outlinePoints.length; i++) {
      const a = outlinePoints[i];
      const b = outlinePoints[(i + 1) % outlinePoints.length];
      if (pointToSegmentDistance(p, a, b) <= tolerance) return true;
    }
    return false;
  }

  function pointNearOtherEndpoint(p: V3Point, ownLineId: string, ownIsStart: boolean): boolean {
    for (const ep of endpoints) {
      if (ep.lineId === ownLineId && ep.isStart === ownIsStart) continue;
      if (Math.sqrt((ep.x - p.x) ** 2 + (ep.y - p.y) ** 2) <= tolerance) return true;
    }
    return false;
  }

  for (const line of lines) {
    const startConnected = pointNearOutline(line.start) || pointNearOtherEndpoint(line.start, line.id, true);
    const endConnected = pointNearOutline(line.end) || pointNearOtherEndpoint(line.end, line.id, false);
    if (startConnected || endConnected) {
      connected.push(line);
    } else {
      floating.push(line);
    }
  }

  return { connected, floating };
}

// ── Convert classifications → AiScanResult components ───────────────────

function classificationsToComponents(
  lines: V3Line[],
  outlinePoints: V3Point[],
  classifications: V3Classification[],
): AiScanResult['components'] {
  const components = emptyComponents();
  const lineMap = new Map<string, V3Line>();
  for (const l of lines) lineMap.set(l.id, l);

  const edgeLines = outlineToEdgeLines(outlinePoints);
  for (const e of edgeLines) lineMap.set(e.id, e);

  for (const c of classifications) {
    const line = lineMap.get(c.line_id);
    if (!line) continue;

    const lineEntry: LineEntry = {
      points: [{ x: line.start.x, y: line.start.y }, { x: line.end.x, y: line.end.y }],
    };

    switch (c.type) {
      case 'ridge': components.ridges.push(lineEntry); break;
      case 'hip': components.hips.push(lineEntry); break;
      case 'valley': components.valleys.push(lineEntry); break;
      case 'broken_hip': components.broken_hips.push(lineEntry); break;
      case 'broken_barge': components.barges.push(lineEntry); break;
      case 'barge': components.barges.push(lineEntry); break;
      case 'spouting': components.spouting.push(lineEntry); break;
      case 'uncertain': components.uncertain.push(lineEntry); break;
    }
  }

  return components;
}

// ── Usage logging ───────────────────────────────────────────────────────

function logScanUsage(params: { companyId: string; quoteId: string; userId: string; pageId?: string | null; success: boolean; model: string; error?: string }) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  const client = createServiceClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  client.from('ai_scan_usage').insert({
    company_id: params.companyId, quote_id: params.quoteId, user_id: params.userId,
    page_id: params.pageId ?? null, success: params.success, model: params.model, error: params.error,
  }).then(() => {}, (err) => console.warn('[ai-scan-v3] usage log failed:', err.message));
}

// ── Route handler ───────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const requestId = `v3_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const timer = makeTimer();
  timer.mark('auth_start');

  try {
    const profile = await requireCompanyContext();
    const supabase = await createSupabaseServerClient();

    if (process.env.AI_TAKEOFF_ENABLED !== 'true') {
      return NextResponse.json({ success: false, error: 'AI Takeoff is not enabled.' }, { status: 403 });
    }

    const body = await req.json() as Record<string, unknown>;
    const stage = typeof body.stage === 'string' ? body.stage : null;
    const quoteId = typeof body.quoteId === 'string' ? body.quoteId : null;
    const pageId = typeof body.pageId === 'string' ? body.pageId : null;
    const canvasDims = body.canvasDimensions as { width?: number; height?: number } | undefined;
    const canvasW = typeof canvasDims?.width === 'number' ? canvasDims.width : 800;
    const canvasH = typeof canvasDims?.height === 'number' ? canvasDims.height : 600;

    if (!quoteId) {
      return NextResponse.json({ success: false, error: 'Missing required field: quoteId.' }, { status: 400 });
    }

    const { data: quote, error: quoteError } = await supabase.from('quotes')
      .select('id, company_id').eq('id', quoteId).eq('company_id', profile.company_id).single();
    if (quoteError || !quote) {
      return NextResponse.json({ success: false, error: 'Quote not found.' }, { status: 404 });
    }
    const { data: company } = await supabase.from('companies')
      .select('default_trade').eq('id', profile.company_id).single();
    if (company?.default_trade !== 'roofing') {
      return NextResponse.json({ success: false, error: 'AI Takeoff is available for roofing companies only.' }, { status: 403 });
    }

    timer.mark('auth_done');

    const model = process.env.AI_TAKEOFF_MODEL || 'gpt-5.6';

    // Quality level from client (low / medium / high). Default: medium.
    const qualityLevel = typeof body.qualityLevel === 'string' ? body.qualityLevel : 'medium';
    const effortMap = { low: 'low', medium: 'medium', high: 'high' } as const;
    const userReasoningEffort = effortMap[qualityLevel as keyof typeof effortMap] || 'medium';
    // Token limits: low/medium stay as-is, high gets bumped to avoid reasoning-eats-output bug.
    const tokenLimits = userReasoningEffort === 'high'
      ? { scan1: 8000, scan2: 12000, scan3: 12000 }
      : { scan1: 5000, scan2: 8000, scan3: 8000 };
    const usage = (success: boolean, error?: string) => logScanUsage({
      companyId: profile.company_id, quoteId, userId: profile.id,
      pageId, success, model, error: error ? `${stage}: ${error}` : undefined,
    });

    // ══════════════════════════════════════════════════════════════════
    // SCAN 1: OUTLINE ONLY
    // ══════════════════════════════════════════════════════════════════
    if (stage === 'scan1') {
      const base64Image = typeof body.image === 'string' ? body.image : null;
      if (!base64Image) {
        return NextResponse.json({ success: false, error: 'Missing required field: image.' }, { status: 400 });
      }

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

      timer.mark('scan1_call_start');
      const originalDataUrl = `data:image/png;base64,${processedBuffer.toString('base64')}`;

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
        return NextResponse.json({ success: false, error: `Outline detection failed: ${message}` }, { status: 502 });
      }
      timer.mark('scan1_call_done');

      console.log(`[ai-scan-v3:${requestId}] scan1: responseId=${result.responseId} usage=`, result.usage);

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
        return NextResponse.json({ success: false, error: 'AI could not detect a valid roof outline.' }, { status: 422 });
      }

      const finalPolygon = validation.cleanedPoints;
      const notes = Array.isArray(raw.notes) ? raw.notes.filter((n): n is string => typeof n === 'string') : [];
      console.log(`[ai-scan-v3:${requestId}] scan1: ${finalPolygon.length} vertices after validation`);

      const roofAreaName = roofAreasRaw[0]?.name ?? 'Area 1';
      const pitchDegrees = roofAreasRaw[0]?.pitch_degrees ?? null;

      const scaleX = canvasW / imgW;
      const scaleY = canvasH / imgH;
      const roofAreasCanvas = [{
        name: roofAreaName,
        points: finalPolygon.map(p => scalePoint(p, scaleX, scaleY)),
        pitch_degrees: pitchDegrees,
      }];

      if (pageId) {
        const scan1Data = {
          roof_areas: roofAreasCanvas,
          analysisDimensions: { width: imgW, height: imgH },
          canvasDimensions: { width: canvasW, height: canvasH },
          notes,
        };
        await supabase.from('takeoff_pages')
          .update({ ai_scan_result: JSON.parse(JSON.stringify(scan1Data)) })
          .eq('id', pageId).eq('quote_id', quoteId);
      }

      usage(true);
      logRequest({
        requestId, stage: 'scan1_complete', timer,
        extra: { areas: roofAreasCanvas.length, vertices: roofAreasCanvas[0]?.points.length ?? 0, modelUsage: result.usage },
      });

      // Debug: save scan images to storage for inspection
      const scan1OutlineOverlayBuf = await renderOutlineOverlay(processedBuffer, finalPolygon, imgW, imgH);
      const scan1DebugUrls: Record<string, string> = {};
      const s1Original = await saveDebugImage(processedBuffer, quoteId, 'scan1-original');
      const s1Outline = await saveDebugImage(scan1OutlineOverlayBuf, quoteId, 'scan1-outline-overlay');
      if (s1Original) scan1DebugUrls.original = s1Original;
      if (s1Outline) scan1DebugUrls.outlineOverlay = s1Outline;

      return NextResponse.json({
        success: true,
        stage: 'scan1',
        data: { roof_areas: roofAreasCanvas, notes },
        analysisDimensions: { width: imgW, height: imgH },
        canvasDimensions: { width: canvasW, height: canvasH },
        summary: { areas: roofAreasCanvas.length, vertices: roofAreasCanvas[0]?.points.length ?? 0, notes },
        debugImages: scan1DebugUrls,
      });
    }

    // ══════════════════════════════════════════════════════════════════
    // SCAN 2: INTERNAL LINE DETECTION
    // ══════════════════════════════════════════════════════════════════
    if (stage === 'scan2') {
      const base64Image = typeof body.image === 'string' ? body.image : null;
      const outlinePointsCanvas = body.outlinePoints as V3Point[] | undefined;
      const analysisDims = body.analysisDimensions as { width: number; height: number } | undefined;

      if (!base64Image || !outlinePointsCanvas || !analysisDims) {
        return NextResponse.json({ success: false, error: 'Missing image, outlinePoints, or analysisDimensions.' }, { status: 400 });
      }

      timer.mark('image_decode_start');
      const rawBuffer = Buffer.from(base64Image.replace(/^data:[^;]+;base64,/, ''), 'base64');
      const processedBuffer = await preprocessImage(rawBuffer);
      const meta = await sharp(processedBuffer).metadata();
      const imgW = meta.width ?? analysisDims.width;
      const imgH = meta.height ?? analysisDims.height;
      timer.mark('image_decode_done');

      const scaleX = imgW / canvasW;
      const scaleY = imgH / canvasH;
      const outlinePoints: V3Point[] = outlinePointsCanvas.map(p => ({
        x: Math.round(p.x * scaleX),
        y: Math.round(p.y * scaleY),
      }));

      const outlineOverlayBuffer = await renderOutlineOverlay(processedBuffer, outlinePoints, imgW, imgH);
      timer.mark('overlay_done');

      timer.mark('scan2_call_start');
      const originalDataUrl = `data:image/png;base64,${processedBuffer.toString('base64')}`;
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
        return NextResponse.json({ success: false, error: `Line detection failed: ${message}` }, { status: 502 });
      }
      timer.mark('scan2_call_done');

      console.log(`[ai-scan-v3:${requestId}] scan2: responseId=${result.responseId} usage=`, result.usage);

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
      const { valid: angleValidLines, rejected: angleRejectedLines } = filterAngleValid(rawLines);
      const { connected: connectedLines, floating: floatingLines } = validateConnectivity(angleValidLines, outlinePoints);
      const scan2aLines: V3Line[] = connectedLines.map((l, i) => ({ ...l, id: `L${i + 1}` }));
      const finalLines: V3Line[] = scan2aLines;
      timer.mark('postprocess_done');

      console.log(`[ai-scan-v3:${requestId}] scan2 postprocess: raw=${rawLines.length} angleValid=${angleValidLines.length} connected=${connectedLines.length} rejected(angle)=${angleRejectedLines.length} floating=${floatingLines.length}`);

      const canvasScaleX = canvasW / imgW;
      const canvasScaleY = canvasH / imgH;
      const linesCanvas = finalLines.map(l => ({
        ...l,
        start: scalePoint(l.start, canvasScaleX, canvasScaleY),
        end: scalePoint(l.end, canvasScaleX, canvasScaleY),
      }));
      const outlineCanvas = outlinePoints.map(p => scalePoint(p, canvasScaleX, canvasScaleY));

      if (pageId) {
        const scan2Data = {
          roof_areas: [{ name: 'Area 1', points: outlineCanvas, pitch_degrees: null }],
          lines: linesCanvas,
          analysisDimensions: { width: imgW, height: imgH },
          canvasDimensions: { width: canvasW, height: canvasH },
          notes,
          stats: { rawLines: rawLines.length, angleValid: angleValidLines.length, connected: connectedLines.length, angleRejected: angleRejectedLines.length, floating: floatingLines.length },
        };
        await supabase.from('takeoff_pages')
          .update({ ai_scan_result: JSON.parse(JSON.stringify(scan2Data)) })
          .eq('id', pageId).eq('quote_id', quoteId);
      }

      usage(true);
      logRequest({
        requestId, stage: 'scan2_complete', timer,
        extra: { rawLines: rawLines.length, finalLines: finalLines.length, angleRejected: angleRejectedLines.length, floating: floatingLines.length, modelUsage: result.usage },
      });

      // Debug: save scan images to storage for inspection
      const scan2DebugUrls: Record<string, string> = {};
      try {
        const auditOverlayBuf = await renderScan2AuditOverlay(processedBuffer, outlinePoints, finalLines, imgW, imgH);
        const s2Audit = await saveDebugImage(auditOverlayBuf, quoteId, 'scan2-audit-overlay');
        if (s2Audit) scan2DebugUrls.scan2AuditOverlay = s2Audit;
      } catch (debugErr) {
        console.warn(`[ai-scan-v3:${requestId}] debug image render failed:`, debugErr);
      }

      return NextResponse.json({
        success: true,
        stage: 'scan2',
        data: { lines: linesCanvas, outlinePoints: outlineCanvas, notes },
        analysisDimensions: { width: imgW, height: imgH },
        canvasDimensions: { width: canvasW, height: canvasH },
        summary: { rawLines: rawLines.length, finalLines: finalLines.length, angleRejected: angleRejectedLines.length, floating: floatingLines.length, notes },
        debugImages: scan2DebugUrls,
      });
    }

    // ══════════════════════════════════════════════════════════════════
    // SCAN 3: CLASSIFICATION ONLY
    // ══════════════════════════════════════════════════════════════════
    if (stage === 'scan3') {
      const base64Image = typeof body.image === 'string' ? body.image : null;
      const outlinePointsCanvas = body.outlinePoints as V3Point[] | undefined;
      const linesCanvas = body.lines as V3Line[] | undefined;
      const analysisDims = body.analysisDimensions as { width: number; height: number } | undefined;

      if (!base64Image || !outlinePointsCanvas || !linesCanvas || !analysisDims) {
        return NextResponse.json({ success: false, error: 'Missing image, outlinePoints, lines, or analysisDimensions.' }, { status: 400 });
      }

      timer.mark('image_decode_start');
      const rawBuffer = Buffer.from(base64Image.replace(/^data:[^;]+;base64,/, ''), 'base64');
      const processedBuffer = await preprocessImage(rawBuffer);
      const meta = await sharp(processedBuffer).metadata();
      const imgW = meta.width ?? analysisDims.width;
      const imgH = meta.height ?? analysisDims.height;
      timer.mark('image_decode_done');

      const scaleX = imgW / canvasW;
      const scaleY = imgH / canvasH;
      const outlinePoints: V3Point[] = outlinePointsCanvas.map(p => ({
        x: Math.round(p.x * scaleX), y: Math.round(p.y * scaleY),
      }));
      const lines: V3Line[] = linesCanvas.map(l => ({
        id: l.id,
        start: { x: Math.round(l.start.x * scaleX), y: Math.round(l.start.y * scaleY) },
        end: { x: Math.round(l.end.x * scaleX), y: Math.round(l.end.y * scaleY) },
        confidence: l.confidence,
      }));

      const edgeLines = outlineToEdgeLines(outlinePoints);
      const allLines = [...lines, ...edgeLines];

      timer.mark('overlay_start');
      const annotatedBuffer = await renderLineOverlay(processedBuffer, outlinePoints, lines, imgW, imgH);
      const cleanBuffer = await renderCleanOverlay(outlinePoints, lines, imgW, imgH);
      timer.mark('overlay_done');

      timer.mark('scan3_call_start');
      const annotatedDataUrl = `data:image/png;base64,${annotatedBuffer.toString('base64')}`;
      const cleanDataUrl = `data:image/png;base64,${cleanBuffer.toString('base64')}`;
      const originalDataUrl = `data:image/png;base64,${processedBuffer.toString('base64')}`;

      let result;
      try {
        result = await callVisionModel(
          buildV3ClassificationPrompt({ outlinePoints, lines: allLines }),
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
        return NextResponse.json({ success: false, error: `Classification failed: ${message}` }, { status: 502 });
      }
      timer.mark('scan3_call_done');

      console.log(`[ai-scan-v3:${requestId}] scan3: responseId=${result.responseId} usage=`, result.usage);

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

      const notes = Array.isArray(raw.notes) ? raw.notes.filter((n): n is string => typeof n === 'string') : [];

      // Build AiScanResult
      const components = classificationsToComponents(lines, outlinePoints, classifications);

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

      // Persist final result
      if (pageId) {
        await supabase.from('takeoff_pages')
          .update({ ai_scan_result: JSON.parse(JSON.stringify(canvasResult)) })
          .eq('id', pageId).eq('quote_id', quoteId);
      }

      usage(true);
      logRequest({
        requestId, stage: 'scan3_complete', timer,
        extra: {
          totalLines: allLines.length,
          classified: classifications.length,
          ridges: canvasResult.components.ridges.length,
          hips: canvasResult.components.hips.length,
          valleys: canvasResult.components.valleys.length,
          broken_hips: canvasResult.components.broken_hips.length,
          barges: canvasResult.components.barges.length,
          spouting: canvasResult.components.spouting.length,
          uncertain: canvasResult.components.uncertain.length,
          modelUsage: result.usage,
        },
      });

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
        classificationDetails: classifications,
      });
    }

    return NextResponse.json({ success: false, error: `Unknown stage: ${stage}` }, { status: 400 });
  } catch (error) {
    console.error('[ai-scan-v3] unhandled error:', error);
    return NextResponse.json({
      success: false,
      error: `Server error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }, { status: 500 });
  }
}