import { isCustomUsageCompany } from '@/app/lib/billing/custom/usage/store';
import { withDemoTranscription } from '@/app/lib/demo/assistant.server';
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, requireCompanyContext } from '@/app/lib/supabase/server';

export const runtime = 'nodejs';

const MAX_BYTES = 15 * 1024 * 1024; // 15MB upload cap (~2min compressed audio)

/**
 * POST /api/smart-assistant/transcribe
 * Voice-to-text via OpenAI transcription. Replaces the browser's built-in
 * speech engine (inconsistent quality per device) with a consistent server
 * model. Auth + feature flag mirror the turn route; audio is discarded
 * immediately after transcription.
 */
async function handlePost(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const profile = await requireCompanyContext();
  // P2 activation gate. Connect a measured audio budget and retry guard at this
  // provider boundary before removing this guard. A voice transcript is not
  // itself a customer Assistant Task. The legacy/demo path is unchanged.
  try {
    if (await isCustomUsageCompany(profile.company_id)) {
      return NextResponse.json({ code: 'custom_voice_binding_required',
        error: 'Voice input is not enabled for custom setups yet. Type your request instead.' }, { status: 409 });
    }
  } catch {
    return NextResponse.json({ code: 'usage_unavailable', error: 'Billing access could not be verified.' }, { status: 503 });
  }
  const { data: flagOn } = await supabase.rpc('smart_assistant_enabled', {
    p_company_id: profile.company_id,
  });
  if (!flagOn) {
    return NextResponse.json({ error: 'Not available' }, { status: 404 });
  }

  // Reject oversized uploads before parsing multipart: formData() throws
  // on huge bodies, which would hide the 413 behind a 400.
  const contentLength = Number(req.headers.get('content-length') ?? '0');
  if (contentLength > MAX_BYTES + 64 * 1024) {
    return NextResponse.json({ error: 'Recording too long' }, { status: 413 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    // Parsing can also blow up on oversized/chunked bodies without a usable
    // content-length: report 413 in that case, 400 otherwise.
    return NextResponse.json(
      { error: contentLength > 0 ? 'Recording too long' : 'Audio upload required' },
      { status: contentLength > 0 && contentLength > MAX_BYTES ? 413 : 400 },
    );
  }

  const file = form.get('audio');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Audio upload required' }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: 'Empty recording' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Recording too long' }, { status: 413 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Transcription is not configured' }, { status: 503 });
  }

  const upstream = new FormData();
  upstream.append('file', file, file.name || 'audio.webm');
  upstream.append('model', 'gpt-4o-mini-transcribe');
  upstream.append('language', 'en');

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: upstream,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    console.error('[smart-assistant] transcription failed', res.status, detail.slice(0, 300));
    return NextResponse.json({ error: 'Transcription failed' }, { status: 502 });
  }

  const data = (await res.json()) as { text?: string };
  return NextResponse.json({ text: (data.text ?? '').trim() });
}

export async function POST(req: NextRequest) { return withDemoTranscription(req, handlePost); }
