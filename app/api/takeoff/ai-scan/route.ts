import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import sharp from 'sharp';
import { createSupabaseServerClient, requireCompanyContext } from '@/app/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import type { Database } from '@/app/lib/supabase/database.types';
import {
  AI_TAKEOFF_PROMPT_PHASE1,
  AI_TAKEOFF_PROMPT_PHASE2,
  AI_TAKEOFF_RESPONSE_SCHEMA,
  AI_TAKEOFF_PHASE1_SCHEMA,
  AI_TAKEOFF_MODEL,
} from '@/app/lib/takeoff/ai-prompt';

export const runtime = 'nodejs';
export const maxDuration = 60;

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

// ── Magic byte validation (reused from parse-document) ──────────────────────

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

// ── Image preprocessing ─────────────────────────────────────────────────────

const MAX_INPUT_BYTES = 8 * 1024 * 1024; // 8MB input cap
const MAX_OUTPUT_PX = 1536; // downscale longest side to ≤1536px (OpenAI high detail)

/**
 * EXIF-normalize + downscale the image to ≤1536px longest side.
 * Returns a Buffer of JPEG data (always JPEG for consistency — the model
 * doesn't care about format, and JPEG keeps the base64 payload small).
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

  return pipeline.jpeg({ quality: 95 }).toBuffer();
}

// ── Server-side validation ──────────────────────────────────────────────────

interface NormalizedPoint { x: number; y: number }
interface LineEntry { points: NormalizedPoint[] }
interface RoofAreaEntry { name: string; points: NormalizedPoint[]; pitch_degrees: number | null }
interface AiScanResult {
  scale: {
    detected: boolean;
    ratio: string | null;
    dimension_line: {
      p1: NormalizedPoint; p2: NormalizedPoint;
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

function validateCoordinate(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1000;
}

function validatePoint(obj: unknown): NormalizedPoint | null {
  if (typeof obj !== 'object' || obj === null) return null;
  const p = obj as Record<string, unknown>;
  if (!validateCoordinate(p.x) || !validateCoordinate(p.y)) return null;
  return { x: Math.round(p.x), y: Math.round(p.y) };
}

function validateLineEntry(obj: unknown): LineEntry | null {
  if (typeof obj !== 'object' || obj === null) return null;
  const entry = obj as Record<string, unknown>;
  const points = entry.points;
  if (!Array.isArray(points) || points.length < 2) return null;
  const validated = points.map(validatePoint).filter((p): p is NormalizedPoint => p !== null);
  if (validated.length < 2) return null;

  // Reject zero-length lines (both endpoints within 2 normalized units)
  const [a, b] = validated;
  if (Math.abs(a.x - b.x) < 2 && Math.abs(a.y - b.y) < 2) return null;

  return { points: validated };
}

function validateRoofArea(obj: unknown): RoofAreaEntry | null {
  if (typeof obj !== 'object' || obj === null) return null;
  const area = obj as Record<string, unknown>;
  const name = typeof area.name === 'string' ? area.name : 'Area';
  const points = Array.isArray(area.points) ? area.points : [];
  const validated = points.map(validatePoint).filter((p): p is NormalizedPoint => p !== null);
  if (validated.length < 3) return null; // need at least a triangle

  const pitch = area.pitch_degrees;
  const pitchDegrees = (typeof pitch === 'number' && Number.isFinite(pitch) && pitch >= 0 && pitch <= 89)
    ? pitch
    : null;

  return { name, points: validated, pitch_degrees: pitchDegrees };
}

function validateAiResult(raw: unknown): AiScanResult | null {
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
    const p1 = validatePoint(dl.p1);
    const p2 = validatePoint(dl.p2);
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
  const roofAreas = rawAreas.map(validateRoofArea).filter((a): a is RoofAreaEntry => a !== null);

  // Components (may be absent in Phase 1 response)
  const rawComponents = (typeof obj.components === 'object' && obj.components !== null)
    ? obj.components as Record<string, unknown>
    : {};
  const componentKeys = ['ridges', 'hips', 'valleys', 'barges', 'spouting'] as const;
  const components = {} as AiScanResult['components'];
  for (const key of componentKeys) {
    const rawList = Array.isArray(rawComponents[key]) ? rawComponents[key] : [];
    components[key] = rawList
      .map(validateLineEntry)
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

// ── Usage logging ───────────────────────────────────────────────────────────

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

// ── OpenAI vision call helper ───────────────────────────────────────────────

async function callVisionModel(
  prompt: string,
  dataUrl: string,
  schema: typeof AI_TAKEOFF_RESPONSE_SCHEMA | typeof AI_TAKEOFF_PHASE1_SCHEMA,
  model: string,
): Promise<unknown> {
  const response = await openai.chat.completions.create({
    model,
    max_tokens: 4096,
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
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('AI returned an empty response.');
  }

  return JSON.parse(content);
}

// ── Route handler ───────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    // 1. Auth — session-based, same as all takeoff operations
    const profile = await requireCompanyContext();
    const supabase = await createSupabaseServerClient();

    // 2. Kill switch
    if (process.env.AI_TAKEOFF_ENABLED !== 'true') {
      return NextResponse.json({ success: false, error: 'AI Takeoff is not enabled.' }, { status: 403 });
    }

    // 3. Parse request
    const body = await req.json();
    const { image: base64Image, imageMime: providedMime, quoteId, pageId } = body as {
      image?: string;
      imageMime?: string;
      quoteId?: string;
      pageId?: string;
      imageDimensions?: { width: number; height: number };
    };

    if (!base64Image || !quoteId) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: image, quoteId.' },
        { status: 400 },
      );
    }

    // 4. Verify quote belongs to caller's company
    const { data: quote, error: quoteError } = await supabase
      .from('quotes')
      .select('id, company_id')
      .eq('id', quoteId)
      .eq('company_id', profile.company_id)
      .single();

    if (quoteError || !quote) {
      return NextResponse.json({ success: false, error: 'Quote not found.' }, { status: 404 });
    }

    // 5. Trade gate — roofing companies only in V1
    const { data: company } = await supabase
      .from('companies')
      .select('default_trade')
      .eq('id', profile.company_id)
      .single();

    if (company?.default_trade !== 'roofing') {
      return NextResponse.json(
        { success: false, error: 'AI Takeoff is available for roofing companies only.' },
        { status: 403 },
      );
    }

    // 6. Per-page consumption guard — reject if already scanned+applied
    if (pageId) {
      const { data: page } = await supabase
        .from('takeoff_pages')
        .select('ai_scan_result')
        .eq('id', pageId)
        .eq('quote_id', quoteId)
        .single();

      if (page?.ai_scan_result) {
        return NextResponse.json(
          { success: false, error: 'AI scan already applied to this page. Use "Reset AI Entries" to re-scan.' },
          { status: 409 },
        );
      }
    }

    // 7. Validate + preprocess image
    const detectedMime = detectImageMime(base64Image);
    const mime = detectedMime || providedMime;
    if (!mime) {
      return NextResponse.json(
        { success: false, error: 'Unrecognized image format.' },
        { status: 400 },
      );
    }

    const cleanBase64 = base64Image.replace(/^data:[^;]+;base64,/, '');
    const rawBuffer = Buffer.from(cleanBase64, 'base64');

    if (rawBuffer.length > MAX_INPUT_BYTES) {
      return NextResponse.json(
        { success: false, error: 'Image too large. Maximum 8MB.' },
        { status: 413 },
      );
    }

    let processedBuffer: Buffer;
    let processedMime: string;
    try {
      processedBuffer = await preprocessImage(rawBuffer);
      processedMime = 'image/jpeg';
    } catch (err) {
      console.error('[ai-scan] image preprocessing failed:', err);
      return NextResponse.json(
        { success: false, error: `Image processing failed: ${err instanceof Error ? err.message : 'Unknown error'}` },
        { status: 400 },
      );
    }

    const base64ForOpenAI = processedBuffer.toString('base64');
    const dataUrl = `data:${processedMime};base64,${base64ForOpenAI}`;

    const model = AI_TAKEOFF_MODEL;

    // ── Phase 1: Outline detection ──────────────────────────────────────
    let phase1Result: unknown;
    try {
      phase1Result = await callVisionModel(
        AI_TAKEOFF_PROMPT_PHASE1,
        dataUrl,
        AI_TAKEOFF_PHASE1_SCHEMA,
        model,
      );
    } catch (err) {
      console.error('[ai-scan] Phase 1 failed:', err);
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      logScanUsage({
        companyId: profile.company_id,
        quoteId,
        userId: profile.id,
        pageId: pageId ?? null,
        success: false,
        model,
        error: `Phase 1: ${errorMsg}`,
      });
      return NextResponse.json(
        { success: false, error: `AI service error (outline detection): ${errorMsg}` },
        { status: 502 },
      );
    }

    // Validate Phase 1 result
    const phase1Validated = validateAiResult(phase1Result);
    if (!phase1Validated) {
      logScanUsage({
        companyId: profile.company_id,
        quoteId,
        userId: profile.id,
        pageId: pageId ?? null,
        success: false,
        model,
        error: 'Phase 1 validation failed',
      });
      return NextResponse.json(
        { success: false, error: 'AI returned unparseable outline results. Please try again.' },
        { status: 502 },
      );
    }

    // Check for unreadable
    if (phase1Validated.error === 'unreadable') {
      logScanUsage({
        companyId: profile.company_id,
        quoteId,
        userId: profile.id,
        pageId: pageId ?? null,
        success: false,
        model,
        error: 'Image unreadable',
      });
      return NextResponse.json({
        success: true,
        data: phase1Validated,
        summary: {
          areas: 0,
          components: 0,
          ridges: 0,
          hips: 0,
          valleys: 0,
          barges: 0,
          spouting: 0,
          notes: phase1Validated.notes,
          unreadable: true,
        },
      });
    }

    // If no roof areas detected, return early
    if (phase1Validated.roof_areas.length === 0) {
      logScanUsage({
        companyId: profile.company_id,
        quoteId,
        userId: profile.id,
        pageId: pageId ?? null,
        success: true,
        model,
      });
      return NextResponse.json({
        success: true,
        data: phase1Validated,
        summary: {
          areas: 0,
          components: 0,
          ridges: 0,
          hips: 0,
          valleys: 0,
          barges: 0,
          spouting: 0,
          notes: phase1Validated.notes.length > 0 ? phase1Validated.notes : ['No roof outline detected. Try scanning manually.'],
          unreadable: false,
        },
      });
    }

    // ── Phase 2: Component detection (with outline context) ────────────
    // Build the outline context string for the Phase 2 prompt
    const outlineContext = phase1Validated.roof_areas.map((area, idx) => {
      const pointsStr = area.points.map(p => `(${p.x},${p.y})`).join(' → ');
      return `Area ${idx + 1} "${area.name}": ${pointsStr}${area.pitch_degrees ? ` (pitch: ${area.pitch_degrees}°)` : ''}`;
    }).join('\n');

    const phase2Prompt = AI_TAKEOFF_PROMPT_PHASE2.replace('{OUTLINE_CONTEXT}', outlineContext);

    let phase2Result: unknown;
    try {
      phase2Result = await callVisionModel(
        phase2Prompt,
        dataUrl,
        AI_TAKEOFF_RESPONSE_SCHEMA,
        model,
      );
    } catch (err) {
      console.error('[ai-scan] Phase 2 failed:', err);
      // Return Phase 1 results without components — user can still use the outline
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      logScanUsage({
        companyId: profile.company_id,
        quoteId,
        userId: profile.id,
        pageId: pageId ?? null,
        success: true, // Partial success — outline worked
        model,
        error: `Phase 2: ${errorMsg}`,
      });

      // Merge Phase 1 data (outline + scale + pitch) with empty components
      const partialResult: AiScanResult = {
        ...phase1Validated,
        components: { ridges: [], hips: [], valleys: [], barges: [], spouting: [] },
        notes: [...phase1Validated.notes, 'Component detection failed — outline only. You can draw components manually.'],
      };

      return NextResponse.json({
        success: true,
        data: partialResult,
        summary: {
          areas: partialResult.roof_areas.length,
          components: 0,
          ridges: 0,
          hips: 0,
          valleys: 0,
          barges: 0,
          spouting: 0,
          notes: partialResult.notes,
          unreadable: false,
        },
      });
    }

    // Validate Phase 2 result
    const phase2Validated = validateAiResult(phase2Result);
    if (!phase2Validated) {
      logScanUsage({
        companyId: profile.company_id,
        quoteId,
        userId: profile.id,
        pageId: pageId ?? null,
        success: false,
        model,
        error: 'Phase 2 validation failed',
      });
      return NextResponse.json(
        { success: false, error: 'AI returned unparseable component results. Please try again.' },
        { status: 502 },
      );
    }

    // ── Merge: Phase 1 outline + Phase 2 components ─────────────────────
    // Phase 1 outline is authoritative (it was detected first, with a
    // dedicated outline-only prompt). Use Phase 2 only for components.
    const mergedResult: AiScanResult = {
      // Scale/pitch: prefer Phase 2 (it has a second look), but fall back to Phase 1
      scale: phase2Validated.scale.detected ? phase2Validated.scale : phase1Validated.scale,
      pitch: phase2Validated.pitch.detected ? phase2Validated.pitch : phase1Validated.pitch,
      // Roof areas: Phase 1 is authoritative
      roof_areas: phase1Validated.roof_areas,
      // Components: Phase 2
      components: phase2Validated.components,
      // Notes: merge both
      notes: [...phase1Validated.notes, ...phase2Validated.notes],
    };

    // 10. Count results for the response summary
    const totalAreas = mergedResult.roof_areas.length;
    const totalComponents =
      mergedResult.components.ridges.length +
      mergedResult.components.hips.length +
      mergedResult.components.valleys.length +
      mergedResult.components.barges.length +
      mergedResult.components.spouting.length;

    // 11. Log success
    logScanUsage({
      companyId: profile.company_id,
      quoteId,
      userId: profile.id,
      pageId: pageId ?? null,
      success: true,
      model,
    });

    // 12. Return validated result
    return NextResponse.json({
      success: true,
      data: mergedResult,
      summary: {
        areas: totalAreas,
        components: totalComponents,
        ridges: mergedResult.components.ridges.length,
        hips: mergedResult.components.hips.length,
        valleys: mergedResult.components.valleys.length,
        barges: mergedResult.components.barges.length,
        spouting: mergedResult.components.spouting.length,
        notes: mergedResult.notes,
        unreadable: mergedResult.error === 'unreadable',
      },
    });
  } catch (err) {
    console.error('[ai-scan] unhandled error:', err);
    const errMsg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: `Server error: ${errMsg}` },
      { status: 500 },
    );
  }
}
