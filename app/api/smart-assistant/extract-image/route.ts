import { customUsageMeteringApplies } from '@/app/lib/billing/custom/usage/store';
import { NextRequest, NextResponse } from 'next/server';
import {
  EXTRACTION_SYSTEM_PROMPT,
  EXTRACTION_USER_PROMPT,
  SA_IMAGE_MULTIPART_HEADROOM_BYTES,
  SA_IMAGE_UPLOAD_MAX_BYTES,
  formatPhotoMeasurementsMessage,
  isSaImageType,
  parseExtractedMeasurements,
} from '@/app/lib/smart-assistant/image-policy';
import { smartAssistantFeatureAvailable } from '@/app/lib/smart-assistant/access.server';
import { createSupabaseServerClient, requireCompanyContext } from '@/app/lib/supabase/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_BYTES = SA_IMAGE_UPLOAD_MAX_BYTES - SA_IMAGE_MULTIPART_HEADROOM_BYTES;
const VISION_MODEL = 'gpt-4o-mini';

/**
 * POST /api/smart-assistant/extract-image
 * Photo → roof-measurement text for the Smart Assistant (owner 2026-10-31).
 *
 * Like transcription, this provider call is NOT itself a customer Assistant
 * Task: the /turn request that consumes the extracted text is metered by the
 * normal admission path exactly once, whether the values were typed, spoken
 * or photographed. Custom-setup image spend is not yet ledgered separately
 * (voice has qcp_begin/finish_voice_call); dedicated image-call RPCs are the
 * follow-up if per-call accounting is wanted. Billing availability is still
 * verified up front so a metered workspace cannot silently degrade.
 */
export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

  const profile = await requireCompanyContext();
  try {
    // Billing availability is verified up front so a metered workspace cannot
    // silently degrade; the /turn after this call does the actual metering.
    await customUsageMeteringApplies(profile.company_id);
  } catch {
    return NextResponse.json({ code: 'usage_unavailable', error: 'Billing access could not be verified.' }, { status: 503 });
  }

  if (!(await smartAssistantFeatureAvailable(supabase, profile.company_id))) {
    return NextResponse.json({ error: 'Not available' }, { status: 404 });
  }

  const contentLength = Number(req.headers.get('content-length') ?? '0');
  if (contentLength > SA_IMAGE_UPLOAD_MAX_BYTES) return NextResponse.json({ error: 'That photo is too large. Try another.' }, { status: 413 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { error: contentLength > 0 && contentLength > MAX_BYTES ? 'That photo is too large. Try another.' : 'A photo upload is required.' },
      { status: contentLength > 0 && contentLength > MAX_BYTES ? 413 : 400 },
    );
  }

  const file = form.get('image');
  if (!(file instanceof File)) return NextResponse.json({ error: 'A photo upload is required.' }, { status: 400 });
  if (file.size === 0) return NextResponse.json({ error: 'That photo is empty.' }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'That photo is too large. Try another.' }, { status: 413 });
  if (!isSaImageType(file.type)) {
    return NextResponse.json({ error: 'Only JPG, PNG or WebP photos can be read.' }, { status: 415 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'Photo reading is not configured' }, { status: 503 });

  let parsedJson: unknown = null;
  try {
    const base64 = Buffer.from(await file.arrayBuffer()).toString('base64');
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: VISION_MODEL,
        temperature: 0,
        max_tokens: 1400,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: EXTRACTION_SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              { type: 'text', text: EXTRACTION_USER_PROMPT },
              { type: 'image_url', image_url: { url: `data:${file.type};base64,${base64}`, detail: 'high' } },
            ],
          },
        ],
      }),
      signal: AbortSignal.timeout(45_000),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.error('[smart-assistant] image extraction failed', res.status, detail.slice(0, 300));
      return NextResponse.json({ error: 'The photo could not be read. Try again in a moment.' }, { status: 502 });
    }
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content ?? '';
    try {
      parsedJson = JSON.parse(content);
    } catch {
      parsedJson = null;
    }
  } catch (error) {
    console.error('[smart-assistant] image extraction transport failed', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'The photo could not be read. Try again in a moment.' }, { status: 502 });
  }

  const extraction = parseExtractedMeasurements(parsedJson);
  if (!extraction) {
    // Unparseable model output still produces a usable, honest message so the
    // turn proceeds instead of dead-ending in the client.
    return NextResponse.json({ text: '📷 Photo measurements (read from your image):\n- The photo could not be read reliably. I can retake it or type the measurements.' });
  }
  return NextResponse.json({ text: formatPhotoMeasurementsMessage(extraction) });
}
