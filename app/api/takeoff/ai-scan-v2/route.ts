import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import sharp from 'sharp';
import { createSupabaseServerClient, requireCompanyContext } from '@/app/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import type { Database } from '@/app/lib/supabase/database.types';
import {
  V2_SCAN1_SCHEMA,
  V2_SCAN2_SCHEMA,
  buildV2SkeletonPrompt,
  buildV2Scan2Prompt,
} from '@/app/lib/takeoff/ai-prompt-v2';
import {
  normalizeV2Skeleton,
  buildSegmentTable,
  type V2Node,
  type V2Segment,
  type V2RoofArea,
  type V2NormalizedSkeleton,
} from '@/app/lib/takeoff/v2Geometry';
import { extractRoofOutline } from '@/app/lib/takeoff/v2Outline';
import { generateAdaptiveLinework } from '@/app/lib/takeoff/adaptiveLinework';
import { classifyPolygonCorners } from '@/app/lib/takeoff/aiTopology';
import { perimeterAccountingPass } from '@/app/lib/takeoff/applyAiResults';

export const runtime = 'nodejs';
export const maxDuration = 300;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || 'placeholder' });

// ── Types ───────────────────────────────────────────────────────────────

interface ImagePoint { x: number; y: number }
interface LineEntry { points: ImagePoint[] }
interface RoofAreaEntry { name: string; points: ImagePoint[]; pitch_degrees: number | null }
interface AiScanResult {
  scale: { detected: boolean; ratio: string | null; dimension_line: { p1: ImagePoint; p2: ImagePoint; real_length: number; unit: string } | null };
  pitch: { detected: boolean; global_degrees: number | null };
  roof_areas: RoofAreaEntry[];
  components: {
    ridges: LineEntry[]; hips: LineEntry[]; valleys: LineEntry[];
    broken_hips: LineEntry[]; barges: LineEntry[]; spouting: LineEntry[];
  };
  notes: string[];
  error?: string;
}

// ── Timing helper ───────────────────────────────────────────────────────

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
  console.log(`[ai-scan-v2:${requestId}] stage=${stage} total=${total}ms`, {
    marks: marks.map(m => `${m.label}=${m.ms}ms`).join(', '),
    ...extra,
  });
}

// ── Helpers ─────────────────────────────────────────────────────────────

function emptyComponents(): AiScanResult['components'] {
  return { ridges: [], hips: [], valleys: [], broken_hips: [], barges: [], spouting: [] };
}

function scalePoint(point: ImagePoint, scaleX: number, scaleY: number): ImagePoint {
  return { x: Math.round(point.x * scaleX), y: Math.round(point.y * scaleY) };
}

function scaleResult(result: AiScanResult, scaleX: number, scaleY: number): AiScanResult {
  const scaleLine = (entry: LineEntry): LineEntry => ({
    points: entry.points.map(p => scalePoint(p, scaleX, scaleY)),
  });
  return {
    ...result,
    scale: {
      ...result.scale,
      dimension_line: result.scale.dimension_line ? {
        ...result.scale.dimension_line,
        p1: scalePoint(result.scale.dimension_line.p1, scaleX, scaleY),
        p2: scalePoint(result.scale.dimension_line.p2, scaleX, scaleY),
      } : null,
    },
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
    },
  };
}

// ── Vision call helper ──────────────────────────────────────────────────

async function callVisionModel(
  prompt: string,
  images: Array<{ dataUrl: string; label?: string; detail?: 'high' | 'low' }>,
  schema: typeof V2_SCAN1_SCHEMA | typeof V2_SCAN2_SCHEMA,
  model: string,
  options: { reasoningEffort: 'low' | 'medium' | 'high'; maxCompletionTokens: number },
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

  const response = await openai.chat.completions.create({
    model,
    max_completion_tokens: options.maxCompletionTokens,
    reasoning_effort: options.reasoningEffort,
    messages: [{ role: 'user', content: contentParts }],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'roof_plan_analysis',
        strict: true,
        schema,
      },
    },
  });

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

// ── Mask image outside polygon ──────────────────────────────────────────

async function maskImageOutsidePolygon(
  imageBuffer: Buffer,
  polygon: Array<{ x: number; y: number }>,
  width: number,
  height: number,
): Promise<Buffer> {
  const pts = polygon.map(p => `${p.x},${p.y}`).join(' ');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs><mask id="roofMask"><polygon points="${pts}" fill="white"/></mask></defs>
    <rect width="${width}" height="${height}" fill="white"/>
    <image href="data:image/png;base64,${imageBuffer.toString('base64')}" width="${width}" height="${height}" mask="url(#roofMask)"/>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

// ── Crop to polygon bounding box with padding ──────────────────────────

function cropBounds(
  polygon: Array<{ x: number; y: number }>,
  padding: number,
  width: number,
  height: number,
): { left: number; top: number; w: number; h: number } {
  const xs = polygon.map(p => p.x);
  const ys = polygon.map(p => p.y);
  const left = Math.max(0, Math.floor(Math.min(...xs) - padding));
  const top = Math.max(0, Math.floor(Math.min(...ys) - padding));
  const right = Math.min(width, Math.ceil(Math.max(...xs) + padding));
  const bottom = Math.min(height, Math.ceil(Math.max(...ys) + padding));
  return { left, top, w: right - left, h: bottom - top };
}

// ── Render skeleton overlay images for Scan 2 ──────────────────────────

async function renderSkeletonImage(skeleton: V2NormalizedSkeleton, width: number, height: number): Promise<Buffer> {
  const svgParts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<rect width="${width}" height="${height}" fill="white"/>`,
  ];
  for (const area of skeleton.roof_areas) {
    const pts = area.points.map(p => `${p.x},${p.y}`).join(' ');
    svgParts.push(`<polygon points="${pts}" fill="rgba(59,130,246,0.08)" stroke="#2563eb" stroke-width="2" stroke-dasharray="7 5" fill-opacity="0.5"/>`);
  }
  const nodeLookup = new Map<string, V2Node>();
  for (const n of skeleton.nodes) nodeLookup.set(n.id, n);
  for (const seg of skeleton.segments) {
    const start = nodeLookup.get(seg.start_node_id);
    const end = nodeLookup.get(seg.end_node_id);
    if (!start || !end) continue;
    svgParts.push(`<line x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}" stroke="#FF6B35" stroke-width="3" stroke-linecap="round"/>`);
  }
  for (const node of skeleton.nodes) {
    const fill = node.kind === 'junction' ? '#FF6B35' : '#2563eb';
    const r = node.kind === 'junction' ? 5 : 4;
    svgParts.push(`<circle cx="${node.x}" cy="${node.y}" r="${r}" fill="${fill}" stroke="white" stroke-width="1.5"/>`);
  }
  for (const seg of skeleton.segments) {
    const start = nodeLookup.get(seg.start_node_id);
    const end = nodeLookup.get(seg.end_node_id);
    if (!start || !end) continue;
    const midX = (start.x + end.x) / 2;
    const midY = (start.y + end.y) / 2;
    svgParts.push(`<text x="${midX + 6}" y="${midY - 6}" font-family="monospace" font-size="14" font-weight="bold" fill="#dc2626">${seg.id}</text>`);
  }
  svgParts.push('</svg>');
  return sharp(Buffer.from(svgParts.join('\n'))).png().toBuffer();
}

async function renderAnnotatedOriginal(originalBuffer: Buffer, skeleton: V2NormalizedSkeleton, width: number, height: number): Promise<Buffer> {
  const svgParts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
  ];
  for (const area of skeleton.roof_areas) {
    const pts = area.points.map(p => `${p.x},${p.y}`).join(' ');
    svgParts.push(`<polygon points="${pts}" fill="rgba(59,130,246,0.12)" stroke="#2563eb" stroke-width="2" stroke-dasharray="7 5"/>`);
  }
  const nodeLookup = new Map<string, V2Node>();
  for (const n of skeleton.nodes) nodeLookup.set(n.id, n);
  for (const seg of skeleton.segments) {
    const start = nodeLookup.get(seg.start_node_id);
    const end = nodeLookup.get(seg.end_node_id);
    if (!start || !end) continue;
    svgParts.push(`<line x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}" stroke="#FF6B35" stroke-width="3" stroke-linecap="round" opacity="0.85"/>`);
  }
  for (const node of skeleton.nodes) {
    const fill = node.kind === 'junction' ? '#FF6B35' : '#2563eb';
    const r = node.kind === 'junction' ? 5 : 4;
    svgParts.push(`<circle cx="${node.x}" cy="${node.y}" r="${r}" fill="${fill}" stroke="white" stroke-width="1.5"/>`);
  }
  for (const seg of skeleton.segments) {
    const start = nodeLookup.get(seg.start_node_id);
    const end = nodeLookup.get(seg.end_node_id);
    if (!start || !end) continue;
    const midX = (start.x + end.x) / 2;
    const midY = (start.y + end.y) / 2;
    svgParts.push(`<text x="${midX + 6}" y="${midY - 6}" font-family="monospace" font-size="14" font-weight="bold" fill="#dc2626">${seg.id}</text>`);
  }
  svgParts.push('</svg>');
  const svgBuffer = Buffer.from(svgParts.join('\n'));
  return sharp(originalBuffer).composite([{ input: svgBuffer, blend: 'over' }]).png().toBuffer();
}

// ── Convert V2 classification → AiScanResult components ─────────────────

function classificationsToComponents(skeleton: V2NormalizedSkeleton, classifications: Array<{ segment_id: string; classification: string }>): AiScanResult['components'] {
  const nodeLookup = new Map<string, V2Node>();
  for (const n of skeleton.nodes) nodeLookup.set(n.id, n);
  const components = emptyComponents();
  const segMap = new Map<string, V2Segment>();
  for (const s of skeleton.segments) segMap.set(s.id, s);
  for (const c of classifications) {
    if (c.classification === 'reject' || c.classification === 'unresolved') continue;
    const seg = segMap.get(c.segment_id);
    if (!seg) continue;
    const start = nodeLookup.get(seg.start_node_id);
    const end = nodeLookup.get(seg.end_node_id);
    if (!start || !end) continue;
    const lineEntry: LineEntry = { points: [{ x: start.x, y: start.y }, { x: end.x, y: end.y }] };
    switch (c.classification) {
      case 'ridge': components.ridges.push(lineEntry); break;
      case 'hip': components.hips.push(lineEntry); break;
      case 'valley': components.valleys.push(lineEntry); break;
      case 'broken_hip': components.broken_hips.push(lineEntry); break;
      case 'broken_barge': components.barges.push(lineEntry); break;
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
  }).then(() => {}, (err) => console.warn('[ai-scan-v2] usage log failed:', err.message));
}

// ── Route handler ───────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const requestId = `req_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const timer = makeTimer();
  timer.mark('auth_start');

  try {
    const profile = await requireCompanyContext();
    const supabase = await createSupabaseServerClient();

    if (process.env.AI_TAKEOFF_ENABLED !== 'true') {
      return NextResponse.json({ success: false, error: 'AI Takeoff is not enabled.' }, { status: 403 });
    }

    const body = await req.json() as Record<string, unknown>;
    const base64Image = typeof body.image === 'string' ? body.image : null;
    const quoteId = typeof body.quoteId === 'string' ? body.quoteId : null;
    const pageId = typeof body.pageId === 'string' ? body.pageId : null;
    const canvasDims = body.canvasDimensions as { width?: number; height?: number } | undefined;
    const canvasW = typeof canvasDims?.width === 'number' ? canvasDims.width : 800;
    const canvasH = typeof canvasDims?.height === 'number' ? canvasDims.height : 600;

    if (!base64Image || !quoteId) {
      return NextResponse.json({ success: false, error: 'Missing required fields: image, quoteId.' }, { status: 400 });
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
    const usage = (success: boolean, error?: string) => logScanUsage({
      companyId: profile.company_id, quoteId, userId: profile.id,
      pageId, success, model, error: error ? `${body.stage}: ${error}` : undefined,
    });

    const stage = body.stage as string;

    // ══════════════════════════════════════════════════════════════════
    // STAGE 1: OUTLINE + SKELETON
    // ══════════════════════════════════════════════════════════════════
    if (stage === 'outline_skeleton') {
      timer.mark('image_decode_start');
      const rawBuffer = Buffer.from(base64Image.replace(/^data:[^;]+;base64,/, ''), 'base64');
      const processedBuffer = await preprocessImage(rawBuffer);
      const meta = await sharp(processedBuffer).metadata();
      const imgW = meta.width ?? 800;
      const imgH = meta.height ?? 600;
      timer.mark('image_decode_done');

      if (imgW < 200 || imgH < 200) {
        return NextResponse.json({ success: false, error: 'Analysis image is too small.' }, { status: 400 });
      }

      // ── Step 2: Deterministic outline extraction ─────────────────────
      timer.mark('outline_start');
      const outlineResult = await extractRoofOutline(processedBuffer);
      timer.mark('outline_done');

      console.log(`[ai-scan-v2:${requestId}] outline: method=${outlineResult.method} success=${outlineResult.success} vertices=${outlineResult.vertexCount} coverage=${outlineResult.coverage.toFixed(3)} spill=${outlineResult.spill.toFixed(3)} ms=${outlineResult.processingMs}`);

      if (!outlineResult.success) {
        console.warn(`[ai-scan-v2:${requestId}] Deterministic outline failed: ${outlineResult.error}`);
        usage(false, `Outline extraction failed: ${outlineResult.error}`);
        return NextResponse.json({
          success: false,
          error: `Could not extract roof outline: ${outlineResult.error}`,
          diagnostic: { outlineResult },
        }, { status: 422 });
      }

      const outlinePolygon = outlineResult.polygon;

      // ── Step 3: Mask image outside polygon ───────────────────────────
      timer.mark('mask_start');
      const maskedBuffer = await maskImageOutsidePolygon(processedBuffer, outlinePolygon, imgW, imgH);
      const crop = cropBounds(outlinePolygon, 20, imgW, imgH);
      const maskedCropped = await sharp(maskedBuffer)
        .extract({ left: crop.left, top: crop.top, width: crop.w, height: crop.h })
        .png().toBuffer();

      let lineworkBuffer: Buffer;
      try {
        lineworkBuffer = await generateAdaptiveLinework(maskedCropped, { windowSize: 25, sensitivity: 10 });
      } catch {
        lineworkBuffer = maskedCropped;
      }
      timer.mark('mask_done');

      // Adjust outline vertices to crop-relative coordinates
      const croppedVertices = outlinePolygon.map(p => ({ x: p.x - crop.left, y: p.y - crop.top }));
      const outlineVertexIds = croppedVertices.map((_, i) => `a0v${i}`);

      // ── Step 4: Skeleton-only GPT call ───────────────────────────────
      timer.mark('skeleton_call_start');
      const maskedDataUrl = `data:image/png;base64,${maskedCropped.toString('base64')}`;
      const lineworkDataUrl = `data:image/png;base64,${lineworkBuffer.toString('base64')}`;

      let skeletonResult: { parsed: unknown; responseId: string | null; usage: { promptTokens: number; completionTokens: number; totalTokens: number } | null };
      try {
        skeletonResult = await callVisionModel(
          buildV2SkeletonPrompt({
            width: crop.w, height: crop.h,
            outlineVertices: croppedVertices, outlineVertexIds,
          }),
          [
            { dataUrl: lineworkDataUrl, label: 'IMAGE 1: MASKED LINEWORK (primary geometry evidence, inside validated outline)' },
            { dataUrl: maskedDataUrl, label: 'IMAGE 2: MASKED ORIGINAL PLAN (context, inside validated outline)' },
          ],
          V2_SCAN1_SCHEMA, model,
          { reasoningEffort: 'low', maxCompletionTokens: 4000 },
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        timer.mark('skeleton_call_done');
        logRequest({ requestId, stage: 'skeleton_call_failed', timer, extra: { error: message } });
        usage(false, message);
        return NextResponse.json({ success: false, error: `Skeleton detection failed: ${message}` }, { status: 502 });
      }
      timer.mark('skeleton_call_done');

      console.log(`[ai-scan-v2:${requestId}] skeleton: responseId=${skeletonResult.responseId} usage=`, skeletonResult.usage);

      // ── Step 5: Parse skeleton response ──────────────────────────────
      timer.mark('parse_start');
      const raw = skeletonResult.parsed as Record<string, unknown>;

      // Adjust node coordinates from crop-relative back to image-absolute
      const internalNodes: V2Node[] = (Array.isArray(raw.internal_nodes) ? raw.internal_nodes : [])
        .filter((n): n is Record<string, unknown> => typeof n === 'object' && n !== null)
        .map(n => {
          const x = typeof n.x === 'number' ? Math.round(n.x) + crop.left : -1;
          const y = typeof n.y === 'number' ? Math.round(n.y) + crop.top : -1;
          if (x < 0 || x >= imgW || y < 0 || y >= imgH) return null;
          return {
            id: typeof n.id === 'string' ? n.id : `n${Math.random().toString(36).slice(2, 8)}`,
            area_index: 0,
            kind: n.kind === 'junction' ? 'junction' : 'perimeter_point',
            x, y,
            confidence: typeof n.confidence === 'number' ? n.confidence : 0.5,
          } as V2Node;
        })
        .filter((n): n is V2Node => n !== null);

      const segments: V2Segment[] = (Array.isArray(raw.segments) ? raw.segments : [])
        .filter((s): s is Record<string, unknown> => typeof s === 'object' && s !== null)
        .map(s => ({
          id: typeof s.id === 'string' ? s.id : `s${Math.random().toString(36).slice(2, 8)}`,
          area_index: 0,
          start_node_id: typeof s.start_node_id === 'string' ? s.start_node_id : '',
          end_node_id: typeof s.end_node_id === 'string' ? s.end_node_id : '',
          confidence: typeof s.confidence === 'number' ? s.confidence : 0.5,
          inferred: s.inferred === true,
        }))
        .filter(s => s.start_node_id && s.end_node_id);

      const unresolvedGeometry: string[] = Array.isArray(raw.unresolved_geometry)
        ? raw.unresolved_geometry.filter((g): g is string => typeof g === 'string') : [];
      const notes: string[] = Array.isArray(raw.notes)
        ? raw.notes.filter((n): n is string => typeof n === 'string') : [];

      const roofAreas: V2RoofArea[] = [{ name: 'Area 1', points: outlinePolygon, pitch_degrees: null }];

      const normalized = normalizeV2Skeleton(
        { roof_areas: roofAreas, internal_nodes: internalNodes, segments, unresolved_geometry: unresolvedGeometry, notes },
        imgW, imgH,
      );
      timer.mark('parse_done');

      // ── Step 6: Scale to canvas dimensions ───────────────────────────
      timer.mark('scale_start');
      const scaleX = canvasW / imgW;
      const scaleY = canvasH / imgH;
      const scaledRoofAreas = normalized.roof_areas.map(a => ({
        ...a, points: a.points.map(p => scalePoint(p, scaleX, scaleY)),
      }));
      const scaledNodes = normalized.nodes.map(n => ({
        ...n, x: Math.round(n.x * scaleX), y: Math.round(n.y * scaleY),
      }));
      const scaledSegments = normalized.segments;
      const cornerCandidates = classifyPolygonCorners(scaledRoofAreas);
      timer.mark('scale_done');

      // ── Step 7: Persist Scan 1 data ──────────────────────────────────
      timer.mark('persist_start');
      const scan1Data = JSON.parse(JSON.stringify({
        roof_areas: scaledRoofAreas,
        internal_nodes: scaledNodes,
        segments: scaledSegments,
        unresolved_geometry: normalized.unresolved_geometry,
        notes: normalized.notes,
        rejected_segment_count: normalized.rejected_segments.length,
        analysisDimensions: { width: imgW, height: imgH },
        canvasDimensions: { width: canvasW, height: canvasH },
      }));

      if (pageId) {
        const { error: persistError } = await supabase.from('takeoff_pages')
          .update({ ai_scan_result: scan1Data })
          .eq('id', pageId).eq('quote_id', quoteId);
        if (persistError) {
          console.error(`[ai-scan-v2:${requestId}] persist failed:`, persistError.message);
        } else {
          console.log(`[ai-scan-v2:${requestId}] scan1 data persisted to page ${pageId}`);
        }
      }
      timer.mark('persist_done');

      logRequest({
        requestId, stage: 'outline_skeleton_complete', timer,
        extra: {
          outlineVertices: outlinePolygon.length,
          skeletonNodes: scaledNodes.filter(n => n.kind === 'junction').length,
          skeletonSegments: scaledSegments.length,
          rejectedSegments: normalized.rejected_segments.length,
          modelUsage: skeletonResult.usage,
        },
      });

      usage(true);

      return NextResponse.json({
        success: true,
        stage: 'outline_skeleton',
        data: scan1Data,
        cornerCandidates,
        analysisDimensions: { width: imgW, height: imgH },
        canvasDimensions: { width: canvasW, height: canvasH },
        summary: {
          areas: scaledRoofAreas.length,
          skeletonNodes: scaledNodes.filter(n => n.kind === 'junction').length,
          skeletonSegments: scaledSegments.length,
          rejectedSegments: normalized.rejected_segments.length,
          outlineMethod: outlineResult.method,
          outlineCoverage: outlineResult.coverage,
          outlineMs: outlineResult.processingMs,
          notes: normalized.notes,
        },
      });
    }

    // ══════════════════════════════════════════════════════════════════
    // STAGE 2: CLASSIFY SEGMENTS
    // ══════════════════════════════════════════════════════════════════
    if (stage === 'classify') {
      const confirmedAreas = body.confirmedAreas as V2RoofArea[];
      const skeletonData = body.skeletonData as V2NormalizedSkeleton;
      const originalImageBase64 = body.originalImage as string;

      if (!confirmedAreas || !skeletonData || !originalImageBase64) {
        return NextResponse.json({ success: false, error: 'Missing skeleton data, confirmed areas, or original image.' }, { status: 400 });
      }

      const rawBuffer = Buffer.from(originalImageBase64.replace(/^data:[^;]+;base64,/, ''), 'base64');
      const processedBuffer = await preprocessImage(rawBuffer);
      const meta = await sharp(processedBuffer).metadata();
      const width = meta.width ?? 800;
      const height = meta.height ?? 600;

      const scaleX = width / canvasW;
      const scaleY = height / canvasH;
      const pixelSkeleton: V2NormalizedSkeleton = {
        roof_areas: confirmedAreas.map(a => ({
          ...a,
          points: a.points.map(p => ({ x: Math.round(p.x * scaleX), y: Math.round(p.y * scaleY) })),
        })),
        nodes: skeletonData.nodes.map(n => ({
          ...n, x: Math.round(n.x * scaleX), y: Math.round(n.y * scaleY),
        })),
        segments: skeletonData.segments,
        unresolved_geometry: skeletonData.unresolved_geometry,
        notes: skeletonData.notes,
        rejected_segments: [],
      };

      const { text: segmentTable } = buildSegmentTable(pixelSkeleton);

      const cleanSkeletonBuffer = await renderSkeletonImage(pixelSkeleton, width, height);
      const cleanSkeletonDataUrl = `data:image/png;base64,${cleanSkeletonBuffer.toString('base64')}`;

      const annotatedBuffer = await renderAnnotatedOriginal(processedBuffer, pixelSkeleton, width, height);
      const annotatedDataUrl = `data:image/png;base64,${annotatedBuffer.toString('base64')}`;

      let result: { parsed: unknown; responseId: string | null; usage: { promptTokens: number; completionTokens: number; totalTokens: number } | null };
      try {
        result = await callVisionModel(
          buildV2Scan2Prompt({ width, height, segmentTable }),
          [
            { dataUrl: annotatedDataUrl, label: 'IMAGE 1: ANNOTATED ORIGINAL (original plan with skeleton overlay)' },
            { dataUrl: cleanSkeletonDataUrl, label: 'IMAGE 2: CLEAN SKELETON (outline + numbered segments only)' },
          ],
          V2_SCAN2_SCHEMA, model,
          { reasoningEffort: 'low', maxCompletionTokens: 3000 },
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        usage(false, message);
        return NextResponse.json({ success: false, error: `AI classification failed: ${message}` }, { status: 502 });
      }

      console.log(`[ai-scan-v2:${requestId}] Scan 2: responseId=${result.responseId} usage=`, result.usage);

      const raw = result.parsed as Record<string, unknown>;
      const classifications = (Array.isArray(raw.classifications) ? raw.classifications : [])
        .filter((c): c is Record<string, unknown> => typeof c === 'object' && c !== null)
        .map(c => ({
          segment_id: typeof c.segment_id === 'string' ? c.segment_id : '',
          classification: typeof c.classification === 'string' ? c.classification : 'unresolved',
          confidence: typeof c.confidence === 'number' ? c.confidence : 0.5,
          reason_code: typeof c.reason_code === 'string' ? c.reason_code : 'ambiguous',
        }));

      const components = classificationsToComponents(pixelSkeleton, classifications);

      const aiResult: AiScanResult = {
        scale: { detected: false, ratio: null, dimension_line: null },
        pitch: { detected: false, global_degrees: null },
        roof_areas: pixelSkeleton.roof_areas,
        components,
        notes: Array.isArray(raw.notes) ? raw.notes.filter((n): n is string => typeof n === 'string') : [],
      };

      const perimeterCorrected = perimeterAccountingPass(aiResult);
      const correctedResult: AiScanResult = { ...aiResult, components: perimeterCorrected };

      const canvasResult = scaleResult(correctedResult, canvasW / width, canvasH / height);
      canvasResult.roof_areas = confirmedAreas;

      if (pageId) {
        const { error: persistError } = await supabase.from('takeoff_pages')
          .update({ ai_scan_result: JSON.parse(JSON.stringify(canvasResult)) })
          .eq('id', pageId).eq('quote_id', quoteId);
        if (persistError) {
          console.error(`[ai-scan-v2:${requestId}] Scan 2 persist failed:`, persistError.message);
        }
      }

      usage(true);

      return NextResponse.json({
        success: true,
        stage: 'classify',
        data: canvasResult,
        summary: {
          areas: canvasResult.roof_areas.length,
          components: canvasResult.components.ridges.length + canvasResult.components.hips.length + canvasResult.components.valleys.length + canvasResult.components.broken_hips.length + canvasResult.components.barges.length + canvasResult.components.spouting.length,
          ridges: canvasResult.components.ridges.length,
          hips: canvasResult.components.hips.length,
          valleys: canvasResult.components.valleys.length,
          broken_hips: canvasResult.components.broken_hips.length,
          barges: canvasResult.components.barges.length,
          spouting: canvasResult.components.spouting.length,
          notes: canvasResult.notes,
        },
        classificationDetails: classifications,
      });
    }

    return NextResponse.json({ success: false, error: `Unknown stage: ${stage}` }, { status: 400 });
  } catch (error) {
    console.error('[ai-scan-v2] unhandled error:', error);
    return NextResponse.json({
      success: false,
      error: `Server error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }, { status: 500 });
  }
}
