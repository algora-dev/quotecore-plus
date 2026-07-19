import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import sharp from 'sharp';
import { createSupabaseServerClient, requireCompanyContext } from '@/app/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import type { Database } from '@/app/lib/supabase/database.types';
import {
  AI_TAKEOFF_COMPONENT_GRAPH_SCHEMA,
  AI_TAKEOFF_OUTLINE_SCHEMA,
  AI_TAKEOFF_MODEL,
  buildAiTakeoffComponentsPrompt,
  buildAiTakeoffOutlinePrompt,
  type PromptRoofArea,
} from '@/app/lib/takeoff/ai-prompt';
import { snapAiGeometryToImage } from '@/app/lib/takeoff/snapAiGeometryToImage';
import { classifyPolygonCorners, graphToComponents, validateComponentGraph } from '@/app/lib/takeoff/aiTopology';

export const runtime = 'nodejs';
export const maxDuration = 120;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || 'placeholder' });

// Service-role client for usage logging (bypasses RLS)
let usageClient: ReturnType<typeof createServiceClient<Database>> | null = null;
function getUsageClient() {
  if (usageClient) return usageClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  usageClient = createServiceClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return usageClient;
}

// Magic byte validation

const MAGIC_BYTES: { mime: string; bytes: number[] }[] = [
  { mime: 'image/png', bytes: [0x89, 0x50, 0x4E, 0x47] },
  { mime: 'image/jpeg', bytes: [0xFF, 0xD8, 0xFF] },
  { mime: 'image/webp', bytes: [0x52, 0x49, 0x46, 0x46] },
];

function detectImageMime(base64Data: string): string | null {
  try {
    const cleanBase64 = base64Data.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(cleanBase64.substring(0, 32), 'base64');
    for (const { mime, bytes } of MAGIC_BYTES) {
      if (bytes.every((byte, i) => buffer[i] === byte)) {
        if (mime === 'image/webp') {
          if (buffer.slice(8, 12).toString('ascii') !== 'WEBP') continue;
        }
        return mime;
      }
    }
    return null;
  } catch {
    return null;
  }
}

// Image preprocessing

const MAX_INPUT_BYTES = 20 * 1024 * 1024;
const MAX_OUTPUT_PX = 2000; // Max longest edge — matches client-side MAX_CANVAS_DIM

/**
 * Preserve the lossless canvas render and only cap extreme dimensions.
 */
async function preprocessImage(rawBuffer: Buffer): Promise<Buffer> {
  let pipeline = sharp(rawBuffer).rotate(); // EXIF auto-orient

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

// Server-side validation

interface ImagePoint { x: number; y: number }
interface LineEntry { points: ImagePoint[] }
interface RoofAreaEntry { name: string; points: ImagePoint[]; pitch_degrees: number | null }
interface AiScanResult {
  scale: {
    detected: boolean;
    ratio: string | null;
    dimension_line: {
      p1: ImagePoint; p2: ImagePoint;
      real_length: number; unit: string;
    } | null;
  };
  pitch: { detected: boolean; global_degrees: number | null };
  roof_areas: RoofAreaEntry[];
  components: {
    ridges: LineEntry[];
    hips: LineEntry[];
    valleys: LineEntry[];
    barges: LineEntry[];
    spouting: LineEntry[];
  };
  notes: string[];
  error?: string;
}

function validatePoint(
  obj: unknown,
  width: number,
  height: number,
): ImagePoint | null {
  if (typeof obj !== 'object' || obj === null) return null;
  const p = obj as Record<string, unknown>;
  if (
    typeof p.x !== 'number' || !Number.isFinite(p.x) || p.x < 0 || p.x >= width
    || typeof p.y !== 'number' || !Number.isFinite(p.y) || p.y < 0 || p.y >= height
  ) return null;
  return { x: Math.round(p.x), y: Math.round(p.y) };
}

function validateLineEntry(obj: unknown, width: number, height: number): LineEntry | null {
  if (typeof obj !== 'object' || obj === null) return null;
  const entry = obj as Record<string, unknown>;
  const points = entry.points;
  if (!Array.isArray(points) || points.length < 2) return null;
  const validated = points.map(point => validatePoint(point, width, height))
    .filter((point): point is ImagePoint => point !== null);
  if (validated.length < 2) return null;

  // Reject zero-length lines (both endpoints within 2 pixels)
  const [a, b] = validated;
  if (Math.abs(a.x - b.x) < 2 && Math.abs(a.y - b.y) < 2) return null;

  return { points: validated };
}

function validateRoofArea(
  obj: unknown,
  width: number,
  height: number,
): RoofAreaEntry | null {
  if (typeof obj !== 'object' || obj === null) return null;
  const area = obj as Record<string, unknown>;
  const name = typeof area.name === 'string' ? area.name : 'Area';
  const points = Array.isArray(area.points) ? area.points : [];
  const validated = points.map(point => validatePoint(point, width, height))
    .filter((point): point is ImagePoint => point !== null);
  if (validated.length < 3) return null; // need at least a triangle

  const pitch = area.pitch_degrees;
  const pitchDegrees = (typeof pitch === 'number' && Number.isFinite(pitch) && pitch >= 0 && pitch <= 89)
    ? pitch
    : null;

  return { name, points: validated, pitch_degrees: pitchDegrees };
}

function validateAiResult(
  raw: unknown,
  width: number,
  height: number,
): AiScanResult | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const obj = raw as Record<string, unknown>;

  // Unreadable image
  if (typeof obj.error === 'string' && obj.error === 'unreadable') {
    return {
      scale: { detected: false, ratio: null, dimension_line: null },
      pitch: { detected: false, global_degrees: null },
      roof_areas: [],
      components: { ridges: [], hips: [], valleys: [], barges: [], spouting: [] },
      notes: typeof obj.notes === 'string' ? [obj.notes] : ['Image was unreadable.'],
      error: 'unreadable',
    };
  }

  // Scale
  const rawScale = obj.scale as Record<string, unknown> | null;
  const scale = {
    detected: rawScale?.detected === true,
    ratio: typeof rawScale?.ratio === 'string' ? rawScale.ratio : null,
    dimension_line: null as AiScanResult['scale']['dimension_line'],
  };
  if (rawScale?.dimension_line && typeof rawScale.dimension_line === 'object') {
    const dl = rawScale.dimension_line as Record<string, unknown>;
    const p1 = validatePoint(dl.p1, width, height);
    const p2 = validatePoint(dl.p2, width, height);
    if (p1 && p2 && typeof dl.real_length === 'number' && typeof dl.unit === 'string') {
      scale.dimension_line = { p1, p2, real_length: dl.real_length, unit: dl.unit };
    }
  }

  // Pitch
  const rawPitch = obj.pitch as Record<string, unknown> | null;
  const pitch = {
    detected: rawPitch?.detected === true,
    global_degrees: (typeof rawPitch?.global_degrees === 'number' && Number.isFinite(rawPitch.global_degrees))
      ? rawPitch.global_degrees
      : null,
  };

  // Roof areas
  const rawAreas = Array.isArray(obj.roof_areas) ? obj.roof_areas : [];
  const roofAreas = rawAreas.map(area => validateRoofArea(area, width, height))
    .filter((area): area is RoofAreaEntry => area !== null);

  // Components (may be absent in Phase 1 response)
  const rawComponents = (typeof obj.components === 'object' && obj.components !== null)
    ? obj.components as Record<string, unknown>
    : {};
  const componentKeys = ['ridges', 'hips', 'valleys', 'barges', 'spouting'] as const;
  const components = {} as AiScanResult['components'];
  for (const key of componentKeys) {
    const rawList = Array.isArray(rawComponents[key]) ? rawComponents[key] : [];
    components[key] = rawList
      .map(entry => validateLineEntry(entry, width, height))
      .filter((e): e is LineEntry => e !== null);
  }

  // Notes
  const rawNotes = Array.isArray(obj.notes) ? obj.notes : [];
  const notes = rawNotes.filter((n): n is string => typeof n === 'string');

  // Deduplicate identical lines within each component type
  for (const key of componentKeys) {
    const seen = new Set<string>();
    components[key] = components[key].filter((entry) => {
      const key_str = entry.points.map(p => `${p.x},${p.y}`).join('|');
      const reverseKey = entry.points.slice().reverse().map(p => `${p.x},${p.y}`).join('|');
      if (seen.has(key_str) || seen.has(reverseKey)) return false;
      seen.add(key_str);
      return true;
    });
  }

  return { scale, pitch, roof_areas: roofAreas, components, notes };
}

// Usage logging

function logScanUsage(params: {
  companyId: string;
  quoteId: string;
  userId: string;
  pageId?: string | null;
  success: boolean;
  model: string;
  error?: string;
}) {
  const client = getUsageClient();
  if (!client) return;
  client.from('ai_scan_usage').insert({
    company_id: params.companyId,
    quote_id: params.quoteId,
    user_id: params.userId,
    page_id: params.pageId ?? null,
    success: params.success,
    model: params.model,
    error: params.error,
  }).then(() => {}, (err) => {
    console.warn('[ai-scan] usage log failed:', err.message);
  });
}

// OpenAI vision call helper

async function callVisionModel(
  prompt: string,
  dataUrl: string,
  schema: typeof AI_TAKEOFF_COMPONENT_GRAPH_SCHEMA | typeof AI_TAKEOFF_OUTLINE_SCHEMA,
  model: string,
): Promise<unknown> {
  const response = await openai.chat.completions.create({
    model,
    max_completion_tokens: 8192,
    temperature: 0, // Deterministic — roof outlines should be consistent across runs
    reasoning_effort: 'low',
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          {
            type: 'image_url',
            image_url: { url: dataUrl, detail: 'high' },
          },
        ],
      },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'roof_plan_analysis',
        strict: true,
        schema,
      },
    },
  } as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming);

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('AI returned an empty response.');
  }

  return JSON.parse(content);
}
// ── Route handler ────────────────────────────────────────────────────────

const emptyComponents = (): AiScanResult['components'] => ({
  ridges: [], hips: [], valleys: [], barges: [], spouting: [],
});

function scalePoint(point: ImagePoint, scaleX: number, scaleY: number): ImagePoint {
  return { x: Math.round(point.x * scaleX), y: Math.round(point.y * scaleY) };
}

function scaleResult(result: AiScanResult, scaleX: number, scaleY: number): AiScanResult {
  const scaleLine = (entry: LineEntry): LineEntry => ({
    points: entry.points.map(point => scalePoint(point, scaleX, scaleY)),
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
      points: area.points.map(point => scalePoint(point, scaleX, scaleY)),
    })),
    components: {
      ridges: result.components.ridges.map(scaleLine),
      hips: result.components.hips.map(scaleLine),
      valleys: result.components.valleys.map(scaleLine),
      barges: result.components.barges.map(scaleLine),
      spouting: result.components.spouting.map(scaleLine),
    },
  };
}

function buildSummary(result: AiScanResult) {
  const components = result.components.ridges.length + result.components.hips.length
    + result.components.valleys.length + result.components.barges.length
    + result.components.spouting.length;
  return {
    areas: result.roof_areas.length,
    components,
    ridges: result.components.ridges.length,
    hips: result.components.hips.length,
    valleys: result.components.valleys.length,
    barges: result.components.barges.length,
    spouting: result.components.spouting.length,
    notes: result.notes,
    unreadable: result.error === 'unreadable',
  };
}

function validateConfirmedAreas(value: unknown, width: number, height: number): RoofAreaEntry[] {
  if (!Array.isArray(value)) return [];
  return value.map(area => validateRoofArea(area, width, height))
    .filter((area): area is RoofAreaEntry => area !== null);
}

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
    const stage = body.stage === 'components' ? 'components' : 'outline';
    // Canvas dimensions from client (dynamic sizing — canvas = processed image dimensions)
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

    const persistScanResult = async (scanResult: AiScanResult) => {
      if (!pageId) return;
      const { error } = await supabase.from('takeoff_pages')
        .update({ ai_scan_result: JSON.parse(JSON.stringify(scanResult)) })
        .eq('id', pageId).eq('quote_id', quoteId);
      if (error) console.warn('[ai-scan] result persistence failed:', error.message);
    };

    const mime = detectImageMime(base64Image) || providedMime;
    if (!mime) return NextResponse.json({ success: false, error: 'Unrecognized image format.' }, { status: 400 });
    const rawBuffer = Buffer.from(base64Image.replace(/^data:[^;]+;base64,/, ''), 'base64');
    if (rawBuffer.length > MAX_INPUT_BYTES) {
      return NextResponse.json({ success: false, error: 'Image too large. Maximum 20MB.' }, { status: 413 });
    }

    let processedBuffer: Buffer;
    try {
      processedBuffer = await preprocessImage(rawBuffer);
    } catch (error) {
      return NextResponse.json({
        success: false,
        error: `Image processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }, { status: 400 });
    }
    const dataUrl = `data:image/png;base64,${processedBuffer.toString('base64')}`;
    const { data: grayscalePixels, info } = await sharp(processedBuffer)
      .greyscale().raw().toBuffer({ resolveWithObject: true });
    const width = info.width;
    const height = info.height;
    if (width < 200 || height < 200) {
      return NextResponse.json({ success: false, error: 'Analysis image is too small.' }, { status: 400 });
    }

    const model = AI_TAKEOFF_MODEL;
    const usage = (success: boolean, error?: string) => logScanUsage({
      companyId: profile.company_id, quoteId, userId: profile.id,
      pageId, success, model, error: error ? `${stage}: ${error}` : undefined,
    });

    if (stage === 'outline') {
      let rawOutline: unknown;
      try {
        rawOutline = await callVisionModel(
          buildAiTakeoffOutlinePrompt(width, height), dataUrl, AI_TAKEOFF_OUTLINE_SCHEMA, model,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        usage(false, message);
        return NextResponse.json({ success: false, error: `AI outline detection failed: ${message}` }, { status: 502 });
      }
      const outline = validateAiResult(rawOutline, width, height);
      if (!outline) {
        usage(false, 'Outline validation failed');
        return NextResponse.json({ success: false, error: 'AI returned an invalid roof outline.' }, { status: 502 });
      }
      const cornerCandidates = classifyPolygonCorners(outline.roof_areas as PromptRoofArea[]);
      const canvasResult = scaleResult(outline, canvasW / width, canvasH / height);
      usage(outline.error !== 'unreadable', outline.error === 'unreadable' ? 'Image unreadable' : undefined);
      return NextResponse.json({
        success: true,
        stage: 'outline',
        data: canvasResult,
        cornerCandidates,
        analysisDimensions: { width, height },
        canvasDimensions: { width: canvasW, height: canvasH },
        summary: buildSummary(canvasResult),
      });
    }

    const confirmedCanvasAreas = validateConfirmedAreas(body.confirmedAreas, canvasW, canvasH);
    if (confirmedCanvasAreas.length === 0) {
      return NextResponse.json({ success: false, error: 'Confirm at least one roof area before finding components.' }, { status: 400 });
    }
    const analysisAreas: PromptRoofArea[] = confirmedCanvasAreas.map(area => ({
      ...area,
      points: area.points.map(point => scalePoint(point, width / canvasW, height / canvasH)),
    }));
    const expectedCorners = classifyPolygonCorners(analysisAreas);
    const promptParams = { width, height, areas: analysisAreas, corners: expectedCorners };

    let rawGraph: unknown;
    try {
      rawGraph = await callVisionModel(
        buildAiTakeoffComponentsPrompt(promptParams), dataUrl, AI_TAKEOFF_COMPONENT_GRAPH_SCHEMA, model,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      usage(false, message);
      return NextResponse.json({ success: false, error: `AI component detection failed: ${message}` }, { status: 502 });
    }

    let validation = validateComponentGraph(rawGraph, analysisAreas, expectedCorners, width, height);
    if (!validation.graph || validation.violations.length > 0) {
      const repairContext = `${validation.violations.join('\n')}\nPrevious graph:\n${JSON.stringify(rawGraph)}`;
      try {
        const repaired = await callVisionModel(
          buildAiTakeoffComponentsPrompt({ ...promptParams, repairContext }),
          dataUrl,
          AI_TAKEOFF_COMPONENT_GRAPH_SCHEMA,
          model,
        );
        validation = validateComponentGraph(repaired, analysisAreas, expectedCorners, width, height);
      } catch (error) {
        validation.violations.push(error instanceof Error ? error.message : 'Repair request failed.');
      }
    }
    if (!validation.graph || validation.violations.length > 0) {
      const violations = Array.from(new Set(validation.violations)).slice(0, 8);
      usage(false, `Invalid topology: ${violations.join(' | ')}`);
      return NextResponse.json({
        success: false,
        error: 'The AI could not produce a fully connected roof graph. Review the roof areas and try again.',
        topologyViolations: violations,
      }, { status: 422 });
    }

    const outlineData = validateAiResult(body.outlineData, width, height) ?? {
      scale: { detected: false, ratio: null, dimension_line: null },
      pitch: { detected: false, global_degrees: null },
      roof_areas: confirmedCanvasAreas,
      components: emptyComponents(), notes: [],
    };
    const analysisResult = snapAiGeometryToImage({
      scale: { detected: false, ratio: null, dimension_line: null },
      pitch: outlineData.pitch,
      roof_areas: analysisAreas,
      components: graphToComponents(validation.graph),
      notes: [...outlineData.notes, ...validation.graph.notes, ...validation.graph.unresolved],
    }, grayscalePixels, width, height) as AiScanResult;
    const canvasResult = scaleResult(analysisResult, canvasW / width, canvasH / height);
    canvasResult.roof_areas = confirmedCanvasAreas;
    canvasResult.scale = outlineData.scale;

    await persistScanResult(canvasResult);
    usage(true);
    return NextResponse.json({
      success: true,
      stage: 'components',
      data: canvasResult,
      topology: {
        unresolved: validation.graph.unresolved,
        inferredEdges: validation.graph.edges.filter(edge => edge.inferred).length,
      },
      summary: buildSummary(canvasResult),
    });
  } catch (error) {
    console.error('[ai-scan] unhandled error:', error);
    return NextResponse.json({
      success: false,
      error: `Server error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }, { status: 500 });
  }
}
