import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import sharp from 'sharp';
import { createSupabaseServerClient, requireCompanyContext } from '@/app/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import type { Database } from '@/app/lib/supabase/database.types';
import {
  V2_SCAN1_SCHEMA,
  V2_SCAN2_SCHEMA,
  buildV2Scan1Prompt,
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

function buildSummary(result: AiScanResult) {
  const components = result.components.ridges.length + result.components.hips.length
    + result.components.valleys.length
    + result.components.barges.length + result.components.spouting.length;
  return {
    areas: result.roof_areas.length,
    components,
    ridges: result.components.ridges.length,
    hips: result.components.hips.length,
    valleys: result.components.valleys.length,
    broken_hips: result.components.broken_hips.length,
    barges: result.components.barges.length,
    spouting: result.components.spouting.length,
    notes: result.notes,
    unreadable: result.error === 'unreadable',
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

// ── Render clean skeleton image for Scan 2 ──────────────────────────────

async function renderSkeletonImage(
  skeleton: V2NormalizedSkeleton,
  width: number,
  height: number,
): Promise<Buffer> {
  // Create an SVG with white background, outline polygons, nodes, and segments
  const svgParts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<rect width="${width}" height="${height}" fill="white"/>`,
  ];

  // Draw outline polygons (blue, dashed)
  for (const area of skeleton.roof_areas) {
    const pts = area.points.map(p => `${p.x},${p.y}`).join(' ');
    svgParts.push(`<polygon points="${pts}" fill="rgba(59,130,246,0.08)" stroke="#2563eb" stroke-width="2" stroke-dasharray="7 5" fill-opacity="0.5"/>`);
  }

  // Draw segments (orange, solid)
  const nodeLookup = new Map<string, V2Node>();
  for (const n of skeleton.nodes) nodeLookup.set(n.id, n);
  for (const seg of skeleton.segments) {
    const start = nodeLookup.get(seg.start_node_id);
    const end = nodeLookup.get(seg.end_node_id);
    if (!start || !end) continue;
    svgParts.push(`<line x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}" stroke="#FF6B35" stroke-width="3" stroke-linecap="round"/>`);
  }

  // Draw nodes (orange dots for junctions, blue dots for perimeter)
  for (const node of skeleton.nodes) {
    const fill = node.kind === 'junction' ? '#FF6B35' : '#2563eb';
    const r = node.kind === 'junction' ? 5 : 4;
    svgParts.push(`<circle cx="${node.x}" cy="${node.y}" r="${r}" fill="${fill}" stroke="white" stroke-width="1.5"/>`);
  }

  // Draw segment labels
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

  return sharp(svgBuffer).png().toBuffer();
}

// ── Render annotated original (original + skeleton overlay) ─────────────

async function renderAnnotatedOriginal(
  originalBuffer: Buffer,
  skeleton: V2NormalizedSkeleton,
  width: number,
  height: number,
): Promise<Buffer> {
  // Build SVG overlay (same as clean skeleton but with transparent bg)
  const svgParts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
  ];

  // Outline polygons
  for (const area of skeleton.roof_areas) {
    const pts = area.points.map(p => `${p.x},${p.y}`).join(' ');
    svgParts.push(`<polygon points="${pts}" fill="rgba(59,130,246,0.12)" stroke="#2563eb" stroke-width="2" stroke-dasharray="7 5"/>`);
  }

  // Segments
  const nodeLookup = new Map<string, V2Node>();
  for (const n of skeleton.nodes) nodeLookup.set(n.id, n);
  for (const seg of skeleton.segments) {
    const start = nodeLookup.get(seg.start_node_id);
    const end = nodeLookup.get(seg.end_node_id);
    if (!start || !end) continue;
    svgParts.push(`<line x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}" stroke="#FF6B35" stroke-width="3" stroke-linecap="round" opacity="0.85"/>`);
  }

  // Nodes
  for (const node of skeleton.nodes) {
    const fill = node.kind === 'junction' ? '#FF6B35' : '#2563eb';
    const r = node.kind === 'junction' ? 5 : 4;
    svgParts.push(`<circle cx="${node.x}" cy="${node.y}" r="${r}" fill="${fill}" stroke="white" stroke-width="1.5"/>`);
  }

  // Segment IDs
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

  // Composite the SVG overlay on top of the original image
  return sharp(originalBuffer)
    .composite([{ input: svgBuffer, blend: 'over' }])
    .png()
    .toBuffer();
}

// ── Convert V2 classification → AiScanResult components ─────────────────

function classificationsToComponents(
  skeleton: V2NormalizedSkeleton,
  classifications: Array<{ segment_id: string; classification: string }>,
): AiScanResult['components'] {
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

    const lineEntry: LineEntry = {
      points: [
        { x: start.x, y: start.y },
        { x: end.x, y: end.y },
      ],
    };

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

function logScanUsage(params: {
  companyId: string; quoteId: string; userId: string; pageId?: string | null;
  success: boolean; model: string; error?: string;
}) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  const client = createServiceClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  client.from('ai_scan_usage').insert({
    company_id: params.companyId, quote_id: params.quoteId, user_id: params.userId,
    page_id: params.pageId ?? null, success: params.success, model: params.model,
    error: params.error,
  }).then(() => {}, (err) => console.warn('[ai-scan-v2] usage log failed:', err.message));
}

// ── Validation helpers ──────────────────────────────────────────────────

function validatePoint(obj: unknown, width: number, height: number): ImagePoint | null {
  if (typeof obj !== 'object' || obj === null) return null;
  const p = obj as Record<string, unknown>;
  if (typeof p.x !== 'number' || !Number.isFinite(p.x) || p.x < 0 || p.x >= width
    || typeof p.y !== 'number' || !Number.isFinite(p.y) || p.y < 0 || p.y >= height) return null;
  return { x: Math.round(p.x), y: Math.round(p.y) };
}

function validateRoofArea(obj: unknown, width: number, height: number): RoofAreaEntry | null {
  if (typeof obj !== 'object' || obj === null) return null;
  const area = obj as Record<string, unknown>;
  const name = typeof area.name === 'string' ? area.name : 'Area';
  const points = Array.isArray(area.points) ? area.points : [];
  const validated = points.map(p => validatePoint(p, width, height))
    .filter((p): p is ImagePoint => p !== null);
  if (validated.length < 3) return null;
  const pitch = area.pitch_degrees;
  const pitchDegrees = (typeof pitch === 'number' && Number.isFinite(pitch) && pitch >= 0 && pitch <= 89)
    ? pitch : null;
  return { name, points: validated, pitch_degrees: pitchDegrees };
}

// ── Route handler ───────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
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
    const providedMime = typeof body.imageMime === 'string' ? body.imageMime : null;
    const stage = body.stage as string; // 'outline_skeleton' | 'classify'

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

    const model = process.env.AI_TAKEOFF_MODEL || 'gpt-5.6';
    const usage = (success: boolean, error?: string) => logScanUsage({
      companyId: profile.company_id, quoteId, userId: profile.id,
      pageId, success, model, error: error ? `${stage}: ${error}` : undefined,
    });

    // ── Stage 1: Outline + Skeleton ─────────────────────────────────────
    if (stage === 'outline_skeleton') {
      const rawBuffer = Buffer.from(base64Image.replace(/^data:[^;]+;base64,/, ''), 'base64');
      const processedBuffer = await preprocessImage(rawBuffer);
      const { data: grayscalePixels, info } = await sharp(processedBuffer)
        .greyscale().raw().toBuffer({ resolveWithObject: true });
      const width = info.width;
      const height = info.height;

      if (width < 200 || height < 200) {
        return NextResponse.json({ success: false, error: 'Analysis image is too small.' }, { status: 400 });
      }

      // Generate linework
      let lineworkBuffer: Buffer;
      try {
        lineworkBuffer = await generateAdaptiveLinework(processedBuffer, { windowSize: 25, sensitivity: 10 });
      } catch {
        lineworkBuffer = processedBuffer;
      }
      const dataUrl = `data:image/png;base64,${processedBuffer.toString('base64')}`;
      const lineworkDataUrl = `data:image/png;base64,${lineworkBuffer.toString('base64')}`;

      let result: { parsed: unknown; responseId: string | null; usage: { promptTokens: number; completionTokens: number; totalTokens: number } | null };
      try {
        result = await callVisionModel(
          buildV2Scan1Prompt(width, height),
          [
            { dataUrl: lineworkDataUrl, label: 'IMAGE 1: CONSERVATIVE LINEWORK (primary geometry evidence)' },
            { dataUrl: dataUrl, label: 'IMAGE 2: ORIGINAL PLAN (context only)' },
          ],
          V2_SCAN1_SCHEMA,
          model,
          { reasoningEffort: 'medium', maxCompletionTokens: 8192 },
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        usage(false, message);
        return NextResponse.json({ success: false, error: `AI scan failed: ${message}` }, { status: 502 });
      }

      console.log('[ai-scan-v2] Scan 1 trace:', { responseId: result.responseId, usage: result.usage });

      // Parse and validate
      const raw = result.parsed as Record<string, unknown>;
      if (typeof raw.error === 'string' && raw.error === 'unreadable') {
        usage(false, 'Image unreadable');
        return NextResponse.json({ success: false, error: 'Image was unreadable.' }, { status: 422 });
      }

      const roofAreas: V2RoofArea[] = (Array.isArray(raw.roof_areas) ? raw.roof_areas : [])
        .map(a => validateRoofArea(a, width, height))
        .filter((a): a is RoofAreaEntry => a !== null)
        .map(a => ({ name: a.name, points: a.points, pitch_degrees: a.pitch_degrees }));

      if (roofAreas.length === 0) {
        usage(false, 'No roof areas detected');
        return NextResponse.json({ success: false, error: 'No usable roof outline was detected.' }, { status: 422 });
      }

      const internalNodes: V2Node[] = (Array.isArray(raw.internal_nodes) ? raw.internal_nodes : [])
        .filter((n): n is Record<string, unknown> => typeof n === 'object' && n !== null)
        .map(n => {
          const x = typeof n.x === 'number' ? Math.round(n.x) : -1;
          const y = typeof n.y === 'number' ? Math.round(n.y) : -1;
          if (x < 0 || x >= width || y < 0 || y >= height) return null;
          return {
            id: typeof n.id === 'string' ? n.id : `n${Math.random().toString(36).slice(2, 8)}`,
            area_index: typeof n.area_index === 'number' ? n.area_index : 0,
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
          area_index: typeof s.area_index === 'number' ? s.area_index : 0,
          start_node_id: typeof s.start_node_id === 'string' ? s.start_node_id : '',
          end_node_id: typeof s.end_node_id === 'string' ? s.end_node_id : '',
          confidence: typeof s.confidence === 'number' ? s.confidence : 0.5,
          inferred: s.inferred === true,
        }))
        .filter(s => s.start_node_id && s.end_node_id);

      const unresolvedGeometry: string[] = Array.isArray(raw.unresolved_geometry)
        ? raw.unresolved_geometry.filter((g): g is string => typeof g === 'string')
        : [];
      const notes: string[] = Array.isArray(raw.notes)
        ? raw.notes.filter((n): n is string => typeof n === 'string')
        : [];

      // Normalize geometry server-side
      const normalized = normalizeV2Skeleton(
        { roof_areas: roofAreas, internal_nodes: internalNodes, segments, unresolved_geometry: unresolvedGeometry, notes },
        width, height,
      );

      // Scale to canvas dimensions
      const scaleX = canvasW / width;
      const scaleY = canvasH / height;
      const scaledRoofAreas = normalized.roof_areas.map(a => ({
        ...a,
        points: a.points.map(p => scalePoint(p, scaleX, scaleY)),
      }));
      const scaledNodes = normalized.nodes.map(n => ({
        ...n,
        x: Math.round(n.x * scaleX),
        y: Math.round(n.y * scaleY),
      }));
      const scaledSegments = normalized.segments; // IDs don't change, coords are in node space

      const cornerCandidates = classifyPolygonCorners(scaledRoofAreas);

      usage(true);

      return NextResponse.json({
        success: true,
        stage: 'outline_skeleton',
        data: {
          roof_areas: scaledRoofAreas,
          internal_nodes: scaledNodes,
          segments: scaledSegments,
          unresolved_geometry: normalized.unresolved_geometry,
          notes: normalized.notes,
          rejected_segment_count: normalized.rejected_segments.length,
        },
        cornerCandidates,
        analysisDimensions: { width, height },
        canvasDimensions: { width: canvasW, height: canvasH },
        summary: {
          areas: scaledRoofAreas.length,
          skeletonNodes: scaledNodes.filter(n => n.kind === 'junction').length,
          skeletonSegments: scaledSegments.length,
          rejectedSegments: normalized.rejected_segments.length,
          notes: normalized.notes,
          unreadable: false,
        },
      });
    }

    // ── Stage 2: Classify Segments ──────────────────────────────────────
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

      // Scale skeleton back to image-pixel coordinates (from canvas coords)
      const scaleX = width / canvasW;
      const scaleY = height / canvasH;
      const pixelSkeleton: V2NormalizedSkeleton = {
        roof_areas: confirmedAreas.map(a => ({
          ...a,
          points: a.points.map(p => ({ x: Math.round(p.x * scaleX), y: Math.round(p.y * scaleY) })),
        })),
        nodes: skeletonData.nodes.map(n => ({
          ...n,
          x: Math.round(n.x * scaleX),
          y: Math.round(n.y * scaleY),
        })),
        segments: skeletonData.segments,
        unresolved_geometry: skeletonData.unresolved_geometry,
        notes: skeletonData.notes,
        rejected_segments: [],
      };

      // Build segment table
      const { text: segmentTable, facts } = buildSegmentTable(pixelSkeleton);

      // Render clean skeleton image
      const cleanSkeletonBuffer = await renderSkeletonImage(pixelSkeleton, width, height);
      const cleanSkeletonDataUrl = `data:image/png;base64,${cleanSkeletonBuffer.toString('base64')}`;

      // Render annotated original
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
          V2_SCAN2_SCHEMA,
          model,
          { reasoningEffort: 'low', maxCompletionTokens: 3000 },
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        usage(false, message);
        return NextResponse.json({ success: false, error: `AI classification failed: ${message}` }, { status: 502 });
      }

      console.log('[ai-scan-v2] Scan 2 trace:', { responseId: result.responseId, usage: result.usage });

      const raw = result.parsed as Record<string, unknown>;
      const classifications = (Array.isArray(raw.classifications) ? raw.classifications : [])
        .filter((c): c is Record<string, unknown> => typeof c === 'object' && c !== null)
        .map(c => ({
          segment_id: typeof c.segment_id === 'string' ? c.segment_id : '',
          classification: typeof c.classification === 'string' ? c.classification : 'unresolved',
          confidence: typeof c.confidence === 'number' ? c.confidence : 0.5,
          reason_code: typeof c.reason_code === 'string' ? c.reason_code : 'ambiguous',
        }));

      // Convert classifications to component lines
      const components = classificationsToComponents(pixelSkeleton, classifications);

      // Build the AiScanResult format the client expects
      const aiResult: AiScanResult = {
        scale: { detected: false, ratio: null, dimension_line: null },
        pitch: { detected: false, global_degrees: null },
        roof_areas: pixelSkeleton.roof_areas,
        components,
        notes: Array.isArray(raw.notes) ? raw.notes.filter((n): n is string => typeof n === 'string') : [],
      };

      // Run perimeter accounting for barge/spouting
      const perimeterCorrected = perimeterAccountingPass(aiResult);
      const correctedResult: AiScanResult = { ...aiResult, components: perimeterCorrected };

      // Scale to canvas dimensions
      const canvasResult = scaleResult(correctedResult, canvasW / width, canvasH / height);
      canvasResult.roof_areas = confirmedAreas;

      // Persist
      if (pageId) {
        await supabase.from('takeoff_pages')
          .update({ ai_scan_result: JSON.parse(JSON.stringify(canvasResult)) })
          .eq('id', pageId).eq('quote_id', quoteId);
      }

      usage(true);

      return NextResponse.json({
        success: true,
        stage: 'classify',
        data: canvasResult,
        summary: buildSummary(canvasResult),
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
