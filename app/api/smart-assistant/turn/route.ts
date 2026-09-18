import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/app/lib/supabase/server';
import {
  parseAdmitRow,
  refusalStatus,
  runPipeline,
  type TurnResponse,
} from '@/app/lib/smart-assistant/turn';

export const runtime = 'nodejs';

/**
 * POST /api/smart-assistant/turn
 * Body: { conversationId, message, clientRequestId }
 *
 * Turn admission + execution. Guarantees (enforced atomically in sa_admit_run):
 *  - one active run per conversation (409 busy)
 *  - duplicate clientRequestId replays the original outcome (200 duplicate)
 *  - flag-off company = 404, no trace
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
    const body: TurnResponse = { ok: true, status: 'duplicate', run_id: admit.runId };
    return NextResponse.json(body, { status: 200 });
  }

  // Admitted. Execute and ALWAYS finish the run, even on pipeline failure.
  let pipeline: { content: string; tokensIn: number; tokensOut: number };
  try {
    pipeline = await runPipeline(admit.runId, message);
  } catch (err) {
    const errorCode = 'pipeline_error';
    await supabase.rpc('sa_finish_run', {
      p_run_id: admit.runId,
      p_status: 'failed',
      p_error_code: errorCode,
      p_assistant_content: undefined,
      p_tokens_in: 0,
      p_tokens_out: 0,
    });
    const body: TurnResponse = { ok: false, status: 'refused', error_code: errorCode };
    return NextResponse.json(body, { status: 500 });
  }

  const { error: finishError } = await supabase.rpc('sa_finish_run', {
    p_run_id: admit.runId,
    p_status: 'completed',
    p_error_code: undefined,
    p_assistant_content: pipeline.content,
    p_tokens_in: pipeline.tokensIn,
    p_tokens_out: pipeline.tokensOut,
  });

  if (finishError) {
    // Run stays claimed; the 5-minute stale sweep will free the conversation.
    return NextResponse.json({ error: finishError.message }, { status: 500 });
  }

  const body: TurnResponse = {
    ok: true,
    status: 'completed',
    run_id: admit.runId,
    reply: pipeline.content,
  };
  return NextResponse.json(body, { status: 200 });
}
