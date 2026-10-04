import { withDemoSpeech } from '@/app/lib/demo/assistant.server';
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, requireCompanyContext } from '@/app/lib/supabase/server';
import { TTS_CONFIG } from '@/app/lib/assistant/config';
import { isRecord } from '@/app/lib/smart-assistant/section-permissions';

export const runtime = 'nodejs';

/**
 * POST /api/smart-assistant/v2/speak
 * Body: { text: string, voice?: string }
 *
 * Server-side neural text-to-speech for spoken replies (premium path,
 * SA Phase 2a). Auth mirrors the transcribe route: session + company context
 * + smart_assistant_enabled flag, plus the SA_TTS_ENABLED deployment flag
 * (default off - the route 404s until the owner enables it).
 *
 * The endpoint is a pure synthesizer: the ONLY input it accepts is the reply
 * text to speak plus an allowlisted voice id. It never accepts instructions,
 * never logs user text server-side, and streams the provider audio body
 * straight back as audio/mpeg with no-store.
 */
async function handlePost(req: NextRequest) {
  if (!TTS_CONFIG.enabled) {
    return NextResponse.json({ error: 'Not available' }, { status: 404 });
  }

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

  let text = '';
  let voice = 'ash';
  try {
    const value: unknown = await req.json();
    if (!isRecord(value)) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    if (typeof value.text !== 'string') return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    if (value.voice !== undefined) {
      if (typeof value.voice !== 'string' || !(TTS_CONFIG.voices as readonly string[]).includes(value.voice)) {
        return NextResponse.json({ error: 'Unknown voice' }, { status: 400 });
      }
      voice = value.voice;
    }
    text = value.text;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!text.trim()) {
    return NextResponse.json({ error: 'Text is required' }, { status: 400 });
  }
  if (text.length > TTS_CONFIG.maxInputChars) {
    return NextResponse.json({ error: 'Text is too long to speak' }, { status: 413 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Spoken replies are not configured' }, { status: 503 });
  }

  const started = performance.now();
  let upstream: Response;
  try {
    upstream = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      // Plain text to SPEAK. There is no prompt surface here: the route never
      // forwards instructions to the provider, only the reply text itself.
      body: JSON.stringify({ model: TTS_CONFIG.model, voice, input: text, response_format: 'mp3' }),
      signal: req.signal,
    });
  } catch {
    // Client aborts land here too; the listener is gone either way.
    return NextResponse.json({ error: 'Speech service could not be reached' }, { status: 502 });
  }

  if (!upstream.ok || !upstream.body) {
    // Log the provider status only. Never echo provider response text - it can
    // embed request content, and no user text may reach server logs.
    console.error('[smart-assistant:tts] synthesis failed', upstream.status);
    return NextResponse.json({ error: 'Speech could not be generated' }, { status: 502 });
  }

  try {
    console.info('[smart-assistant:tts]', JSON.stringify({ event: 'sa_tts_request', ok: true, voice, ms: Math.round(performance.now() - started) }));
  } catch { /* telemetry cannot change the audio result */ }
  return new NextResponse(upstream.body, {
    status: 200,
    headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' },
  });
}

export async function POST(req: NextRequest): Promise<Response> { return withDemoSpeech(req, handlePost); }
