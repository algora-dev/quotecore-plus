import { NextRequest, NextResponse } from 'next/server';
import { isUuid } from '@/app/lib/smart-assistant/v2/contracts';
import { isRecord } from '@/app/lib/smart-assistant/section-permissions';
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
 * Body: { conversationId, message, clientRequestId, pageContext? }
 * pageContext is an untrusted per-request hint, never part of confirmation authority.
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
    pageContext?: unknown;
  };
  try {
    const value: unknown = await req.json();
    if (!isRecord(value)) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    payload = value;
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

  let pageContext: { companyId: string; pathname: string | null } | undefined;
  if (payload.pageContext !== undefined) {
    const hint = payload.pageContext;
    if (!isRecord(hint) || !isUuid(hint.companyId) || (hint.pathname !== null && (typeof hint.pathname !== 'string' || hint.pathname.length > 500))) {
      return NextResponse.json({ error: 'Invalid page context' }, { status: 400 });
    }
    pageContext = { companyId: hint.companyId, pathname: hint.pathname as string | null };
  }
  const requestStarted = performance.now();
  const supabase = await createSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const admissionStarted = performance.now();
  const { data: admitData, error: admitError } = await supabase.rpc('sa_admit_run', {
    p_conversation_id: conversationId,
    p_user_message: message,
    p_client_request_id: clientRequestId,
  });

  if (admitError) {
    return NextResponse.json({ error: admitError.message }, { status: 500 });
  }

  const admissionMs = Math.round(performance.now() - admissionStarted);
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

  const admin = createAdminClient();
  let result: Awaited<ReturnType<typeof runPipeline>> | null = null;
  let failure: ReturnType<typeof pipelineFailureDetails> | null = null;
  let profileMs = 0;
  try {
    const profileStarted = performance.now();
    const { data: profile, error: profileError } = await supabase
      .from('users').select('company_id').eq('id', session.user.id).maybeSingle();
    profileMs = Math.round(performance.now() - profileStarted);
    // Once admitted, even bootstrap failure must reach trusted finish. The old
    // early 403 left the reserved active slot waiting for stale-run recovery.
    if (profileError || !profile?.company_id) throw new Error('No company context');
    result = await runPipeline(admit.runId, message, {
      supabase, // USER / RLS client - tools stay tenant-scoped
      companyId: profile.company_id, conversationId, pageContext,
    });
  } catch (error) {
    failure = pipelineFailureDetails(error);
  }

  // Exactly one finalization attempt. A failed finish is an uncertain outcome,
  // not a reason to execute the pipeline again or certify it as a different run.
  // Completed runs may still carry sanitized tool-error markers
  // (`tool_error::tool:class|...`) so in-loop tool failures are one DB query
  // from diagnosis. Identifiers only; no user text, arguments or record data.
  const toolErrorCode = result?.toolErrors?.length
    ? ('tool_error::' + result.toolErrors.join('|')).slice(0, 180)
    : undefined;
  const finishStarted = performance.now();
  let finished = false;
  try {
    finished = await finishRunTrusted(admin, result ? {
      runId: admit.runId, status: 'completed', assistantContent: result.content,
      tokensIn: result.tokensIn, tokensOut: result.tokensOut,
      ...(toolErrorCode ? { errorCode: toolErrorCode } : {}),
    } : {
      runId: admit.runId, status: 'failed', errorCode: failure?.errorCode ?? 'pipeline_error',
      tokensIn: failure?.tokensIn ?? 0, tokensOut: failure?.tokensOut ?? 0,
    });
  } catch { /* existing status/replay reconciliation owns uncertain outcomes */ }
  const finishMs = Math.round(performance.now() - finishStarted);
  const requestMs = Math.round(performance.now() - requestStarted);
  try {
    console.info('[smart-assistant:request]', JSON.stringify({ event: 'sa_request_performance', runId: admit.runId,
      status: !finished ? 'finish_uncertain' : result ? 'completed' : 'failed', requestMs, admissionMs, profileMs, finishMs }));
  } catch { /* logging cannot change the canonical result */ }
  if (!finished) {
    return NextResponse.json({ error: 'Run finalization failed' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
  if (!result) return NextResponse.json({ error: 'Assistant error' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  const body: TurnResponse = { ok: true, status: 'completed', run_id: admit.runId, reply: result.content };
  return NextResponse.json(body, { status: 200, headers: { 'Cache-Control': 'no-store',
    'Server-Timing': `sa;dur=${requestMs}, sa_admission;dur=${admissionMs}, sa_finish;dur=${finishMs}` } });
}
