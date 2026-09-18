import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/app/lib/supabase/server';
import { createAdminClient } from '@/app/lib/supabase/admin';
import {
  parseAdmitRow,
  refusalStatus,
  runPipeline,
  finishRunTrusted,
  pipelineFailureDetails,
  type TurnResponse,
} from '@/app/lib/smart-assistant/turn';

export const runtime = 'nodejs';

/**
 * POST /api/smart-assistant/turn
 * Body: { conversationId, message, clientRequestId }
 *
 * Authority split (patch 045): the authenticated user client handles
 * admission and the pipeline (all tool reads stay RLS-scoped); ONLY the
 * trusted finalization uses the service-role client. The browser can
 * request runs but never certify model output or token usage.
 */
export async function POST(req: NextRequest) {
  let payload: {
    conversationId?: string;
    message?: string;
    clientRequestId?: string;
  };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { conversationId, message, clientRequestId } = payload;
  if (!conversationId || typeof message !== 'string' || !clientRequestId) {
    return NextResponse.json(
      { error: 'conversationId, message and clientRequestId are required' },
      { status: 400 },
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { data: admitData, error: admitError } = await supabase.rpc('sa_admit_run', {
    p_conversation_id: conversationId,
    p_user_message: message,
    p_client_request_id: clientRequestId,
  });

  if (admitError) {
    return NextResponse.json({ error: admitError.message }, { status: 500 });
  }

  const admit = parseAdmitRow((admitData as unknown[])[0]);

  if (admit.kind === 'refused') {
    const body: TurnResponse = { ok: false, status: 'refused', error_code: admit.errorCode };
    return NextResponse.json(body, { status: refusalStatus(admit.errorCode) });
  }

  if (admit.kind === 'duplicate') {
    // Idempotent replay: the original run already happened (or is in flight).
    // Never re-run the model, never finish twice.
    const body: TurnResponse = { ok: true, status: 'duplicate', run_id: admit.runId };
    return NextResponse.json(body, { status: 200 });
  }

  const { data: profile } = await supabase
    .from('users')
    .select('company_id')
    .eq('id', session.user.id)
    .maybeSingle();
  if (!profile?.company_id) {
    return NextResponse.json({ error: 'No company context' }, { status: 403 });
  }

  const admin = createAdminClient();

  try {
    const result = await runPipeline(admit.runId, message, {
      supabase, // USER / RLS client - tools stay tenant-scoped
      companyId: profile.company_id,
      conversationId,
    });

    const finished = await finishRunTrusted(admin, {
      runId: admit.runId,
      status: 'completed',
      assistantContent: result.content,
      tokensIn: result.tokensIn,
      tokensOut: result.tokensOut,
    });
    if (!finished) {
      console.error('[smart-assistant] trusted finish reported failure for run', admit.runId);
      return NextResponse.json({ error: 'Run finalization failed' }, { status: 500 });
    }

    const body: TurnResponse = {
      ok: true,
      status: 'completed',
      run_id: admit.runId,
      reply: result.content,
    };
    return NextResponse.json(body, { status: 200 });
  } catch (err) {
    // Trusted finalization on failure so the slot is released and any usage
    // already incurred is recorded.
    const failure = pipelineFailureDetails(err);
    await finishRunTrusted(admin, {
      runId: admit.runId,
      status: 'failed',
      errorCode: failure.errorCode,
      tokensIn: failure.tokensIn,
      tokensOut: failure.tokensOut,
    });
    return NextResponse.json({ error: 'Assistant error' }, { status: 500 });
  }
}
