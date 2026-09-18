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
export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const profile = await requireCompanyContext();
  const { data: flagOn } = await supabase.rpc('smart_assistant_enabled', {
    p_company_id: profile.company_id,
  });
  if (!flagOn) {
    return NextResponse.json({ error: 'Not available' }, { status: 404 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Audio upload required' }, { status: 400 });
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
