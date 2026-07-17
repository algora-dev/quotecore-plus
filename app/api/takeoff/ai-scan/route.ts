import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import sharp from 'sharp';
import { createSupabaseServerClient, requireCompanyContext } from '@/app/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import type { Database } from '@/app/lib/supabase/database.types';
import { AI_TAKEOFF_PROMPT, AI_TAKEOFF_RESPONSE_SCHEMA, AI_TAKEOFF_MODEL } from '@/app/lib/takeoff/ai-prompt';

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
const MAX_OUTPUT_PX = 1536; // downscale longest side to ≤1536px

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

  return pipeline.jpeg({ quality: 90 }).toBuffer();
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

  // Components
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

    // 8. Call vision model with structured output
    const model = AI_TAKEOFF_MODEL;
    let rawResult: unknown;

    try {
      const response = await openai.chat.completions.create({
        model,
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: AI_TAKEOFF_PROMPT },
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
            schema: AI_TAKEOFF_RESPONSE_SCHEMA,
          },
        },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        logScanUsage({
          companyId: profile.company_id,
          quoteId,
          userId: profile.id,
          pageId: pageId ?? null,
          success: false,
          model,
          error: 'Empty response from model',
        });
        return NextResponse.json(
          { success: false, error: 'AI returned an empty response. Please try again.' },
          { status: 502 },
        );
      }

      rawResult = JSON.parse(content);
    } catch (err) {
      console.error('[ai-scan] OpenAI call failed:', err);
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      logScanUsage({
        companyId: profile.company_id,
        quoteId,
        userId: profile.id,
        pageId: pageId ?? null,
        success: false,
        model,
        error: errorMsg,
      });
      return NextResponse.json(
        { success: false, error: `AI service error: ${errorMsg}` },
        { status: 502 },
      );
    }

    // 9. Server-side validation + sanitization
    const validated = validateAiResult(rawResult);

    if (!validated) {
      logScanUsage({
        companyId: profile.company_id,
        quoteId,
        userId: profile.id,
        pageId: pageId ?? null,
        success: false,
        model,
        error: 'Failed validation',
      });
      return NextResponse.json(
        { success: false, error: 'AI returned unparseable results. Please try again.' },
        { status: 502 },
      );
    }

    // 10. Count results for the response summary
    const totalAreas = validated.roof_areas.length;
    const totalComponents =
      validated.components.ridges.length +
      validated.components.hips.length +
      validated.components.valleys.length +
      validated.components.barges.length +
      validated.components.spouting.length;

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
      data: validated,
      summary: {
        areas: totalAreas,
        components: totalComponents,
        ridges: validated.components.ridges.length,
        hips: validated.components.hips.length,
        valleys: validated.components.valleys.length,
        barges: validated.components.barges.length,
        spouting: validated.components.spouting.length,
        notes: validated.notes,
        unreadable: validated.error === 'unreadable',
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
