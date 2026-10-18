import { createHash } from 'node:crypto';
import { customScope } from '@/app/lib/billing/custom/environment';
import { customUsageMeteringApplies, usageClient } from '@/app/lib/billing/custom/usage/store';
import { usageError } from '@/app/lib/billing/custom/usage/contracts';
import { withVoiceProviderBudget } from '@/app/lib/billing/custom/usage/voice-provider';
import { voiceActualMicroUsd, voiceCostRatesFromEnv } from '@/app/lib/billing/custom/usage/voice-cost';
import { withDemoTranscription } from '@/app/lib/demo/assistant.server';
import { NextRequest, NextResponse } from 'next/server';
import { VOICE_UPLOAD_MAX_BYTES, voiceAudioMaxBytes } from '@/app/lib/smart-assistant/voice-policy';
import { createSupabaseServerClient, requireCompanyContext } from '@/app/lib/supabase/server';
import { smartAssistantFeatureAvailable } from '@/app/lib/smart-assistant/access.server';

export const runtime = 'nodejs';

const MAX_BYTES = voiceAudioMaxBytes(); // Leaves multipart headroom below the deployment's request ceiling.
const TRANSCRIPTION_MODEL = 'gpt-4o-mini-transcribe';

function customVoiceReserveMicroUsd(): number {
  const value = Number(process.env.CUSTOM_VOICE_RESERVE_MICROUSD ?? '');
  return Number.isSafeInteger(value) && value > 0 ? value : 0;
}


/**
 * POST /api/smart-assistant/transcribe
 * Voice-to-text via OpenAI transcription. For a custom setup this provider
 * call is internally budgeted, but it is NOT itself a customer Assistant
 * Task. The normal accepted /turn request consumes the single task whether
 * the text was typed or originated here.
 */
async function handlePost(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

  const profile = await requireCompanyContext();
  let custom = false;
  try {
    custom = await customUsageMeteringApplies(profile.company_id);
  } catch {
    return NextResponse.json({ code: 'usage_unavailable', error: 'Billing access could not be verified.' }, { status: 503 });
  }

  if (!(await smartAssistantFeatureAvailable(supabase, profile.company_id))) {
    return NextResponse.json({ error: 'Not available' }, { status: 404 });
  }

  const contentLength = Number(req.headers.get('content-length') ?? '0');
  if (contentLength > VOICE_UPLOAD_MAX_BYTES) return NextResponse.json({ error: 'Recording too long' }, { status: 413 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { error: contentLength > 0 ? 'Recording too long' : 'Audio upload required' },
      { status: contentLength > 0 && contentLength > MAX_BYTES ? 413 : 400 },
    );
  }

  const file = form.get('audio');
  if (!(file instanceof File)) return NextResponse.json({ error: 'Audio upload required' }, { status: 400 });
  if (file.size === 0) return NextResponse.json({ error: 'Empty recording' }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'Recording too long' }, { status: 413 });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'Transcription is not configured' }, { status: 503 });

  const transcribe = async (signal?: AbortSignal) => {
    const upstream = new FormData();
    upstream.append('file', file, file.name || 'audio.webm');
    upstream.append('model', TRANSCRIPTION_MODEL);
    upstream.append('language', 'en');
    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: upstream,
      signal,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.error('[smart-assistant] transcription failed', res.status, detail.slice(0, 300));
      throw new Error(`transcription_provider_${res.status}`);
    }
    const data = (await res.json()) as { text?: string; usage?: unknown };
    return { text: (data.text ?? '').trim(), actualMicroUsd: voiceActualMicroUsd(data.usage, voiceCostRatesFromEnv(process.env)) };
  };

  if (!custom) {
    try {
      const result = await transcribe();
      return NextResponse.json({ text: result.text });
    } catch {
      return NextResponse.json({ error: 'Transcription failed' }, { status: 502 });
    }
  }

  // Custom voice must be retry-safe before a provider call. The recorder client
  // supplies one stable key for the upload and reuses it on transport retry.
  const requestKey = (req.headers.get('idempotency-key') ?? String(form.get('clientRequestId') ?? '')).trim();
  if (requestKey.length < 8 || requestKey.length > 200) {
    return NextResponse.json({ code: 'voice_request_id_required', error: 'Please retry the recording from the Assistant.' }, { status: 400 });
  }
  const reserveMicroUsd = customVoiceReserveMicroUsd();
  if (!reserveMicroUsd) {
    return NextResponse.json({ code: 'custom_voice_not_configured', error: 'Voice input is temporarily unavailable. Type your request instead.' }, { status: 503 });
  }

  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    const payloadHash = createHash('sha256').update(TRANSCRIPTION_MODEL).update('\0').update(bytes).digest('hex');
    const scope = customScope();
    const value = await withVoiceProviderBudget({
      companyId: profile.company_id,
      userId: profile.id,
      accountId: scope.accountId,
      mode: scope.mode,
      requestKey,
      payloadHash,
      audioBytes: file.size,
      reservedMicroUsd: reserveMicroUsd,
      client: usageClient(),
      execute: async signal => {
        const result = await transcribe(signal);
        return { value: { text: result.text }, actualMicroUsd: result.actualMicroUsd };
      },
    });
    return NextResponse.json(value);
  } catch (error) {
    const e = usageError(error);
    if (e.code === 'request_conflict') {
      return NextResponse.json({ code: 'voice_retry_status_required', error: 'This recording was already submitted. Record again only if no transcript appears.' }, { status: 409 });
    }
    if (error instanceof Error && error.message.startsWith('transcription_provider_')) {
      return NextResponse.json({ error: 'Transcription failed' }, { status: 502 });
    }
    return NextResponse.json({ code: e.code, error: e.message }, { status: e.httpStatus });
  }
}

export async function POST(req: NextRequest) { return withDemoTranscription(req, handlePost); }
