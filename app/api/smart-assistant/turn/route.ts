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
 * Body: { conversationId, message, clientRequestId, pageContext?, stream? }
 * pageContext is an untrusted per-request hint, never part of confirmation authority.
 * stream=true requests SSE text streaming. Streaming is SERVED ONLY when the
 * server env flag SA_STREAMING_ENABLED is 'true'; otherwise the flag-off path
 * is byte-identical to the classic JSON turn. The tool-calling loop never
 * changes: only model synthesis text is forwarded as `delta` events, tool-hop
 * narration is invalidated with `discard`, and every stream ends with exactly
 * one labelled terminal event (`final` or `error`) carrying the same payload
 * shape the non-streaming client consumes. On any mid-stream failure the
 * client falls back to the existing session/pending flow — never a partial
 * unlabelled payload.
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
    stream?: unknown;
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
  // Streaming is opt-in on BOTH sides: client request AND server env flag.
  const wantsStream = payload.stream === true && process.env.SA_STREAMING_ENABLED === 'true';
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

  const sseHeaders = (extra?: Record<string, string>): HeadersInit => ({
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-store',
    ...(extra ?? {}),
  });
  const sseFrame = (event: string, data: unknown): Blob =>
    new Blob([`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`]);

  if (admit.kind === 'refused') {
    const body: TurnResponse = { ok: false, status: 'refused', error_code: admit.errorCode };
    if (!wantsStream) return NextResponse.json(body, { status: refusalStatus(admit.errorCode) });
    return new Response(sseFrame('error', { ...body, status: refusalStatus(admit.errorCode), error: 'Request refused.' }),
      { status: refusalStatus(admit.errorCode), headers: sseHeaders() });
  }

  if (admit.kind === 'duplicate') {
    // Idempotent replay: the original run already happened (or is in flight).
    // Never re-run the model, never finish twice.
    const body: TurnResponse = { ok: true, status: 'duplicate', run_id: admit.runId };
    if (!wantsStream) return NextResponse.json(body, { status: 200 });
    return new Response(sseFrame('final', body), { status: 200, headers: sseHeaders() });
  }

  if (!wantsStream) {
    return classicTurn({ admit, message, pageContext, conversationId, supabase, session, requestStarted, admissionMs });
  }

  // ── Streaming turn ────────────────────────────────────────────────────────
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      let closed = false;
      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          closed = true; // client went away; the run still finishes below
        }
      };
      void (async () => {
        send('run', { run_id: admit.runId });
        let finished = false;
        try {
          const { result, failure, requestMs } = await executePipeline({
            admit, message, pageContext, conversationId, supabase, session, requestStarted, admissionMs,
            onText: {
              delta: (text) => send('delta', { text }),
              discard: () => send('discard', {}),
            },
          });
          if (!finished) {
            finished = true;
            if (result) send('final', { ok: true, status: 'completed', run_id: admit.runId, reply: result.content, requestMs });
            else send('error', { ok: false, status: failure?.httpStatus ?? 500, error: failure?.message ?? 'Assistant error', error_code: failure?.errorCode, requestMs });
          }
        } catch {
          if (!finished) {
            finished = true;
            send('error', { ok: false, status: 500, error: 'Assistant error' });
          }
        } finally {
          if (!closed) {
            try { controller.close(); } catch { /* already closed */ }
            closed = true;
          }
        }
      })();
    },
  });
  return new Response(stream, { status: 200, headers: sseHeaders({ 'Server-Timing': `sa_admission;dur=${admissionMs}` }) });
}

/** Shared pipeline execution + trusted finish (identical for both modes). */
async function executePipeline(input: {
  admit: { kind: 'accepted'; runId: string; messageId: string };
  message: string;
  pageContext?: { companyId: string; pathname: string | null };
  conversationId: string;
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  session: { user: { id: string } };
  requestStarted: number;
  admissionMs: number;
  onText?: { delta: (text: string) => void; discard: () => void };
}): Promise<{
  result: Awaited<ReturnType<typeof runPipeline>> | null;
  failure: ReturnType<typeof pipelineFailureDetails> & { httpStatus?: number; message?: string } | null;
  requestMs: number;
  profileMs: number;
  finishMs: number;
}> {
  const { admit, message, pageContext, conversationId, supabase, session } = input;
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
    }, input.onText);
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
  const requestMs = Math.round(performance.now() - input.requestStarted);
  try {
    console.info('[smart-assistant:request]', JSON.stringify({ event: 'sa_request_performance', runId: admit.runId,
      status: !finished ? 'finish_uncertain' : result ? 'completed' : 'failed', requestMs, admissionMs: input.admissionMs, profileMs, finishMs }));
  } catch { /* logging cannot change the canonical result */ }
  if (!finished) {
    return { result: null, failure: { ...(failure ?? { errorCode: 'finish_failed', tokensIn: 0, tokensOut: 0 }), httpStatus: 500, message: 'Run finalization failed' }, requestMs, profileMs, finishMs };
  }
  if (!result) {
    return { result: null, failure: { ...(failure ?? { errorCode: 'pipeline_error', tokensIn: 0, tokensOut: 0 }), httpStatus: 500, message: 'Assistant error' }, requestMs, profileMs, finishMs };
  }
  return { result, failure: null, requestMs, profileMs, finishMs };
}

/** Classic non-streaming turn: byte-identical to the pre-streaming route. */
async function classicTurn(input: {
  admit: { kind: 'accepted'; runId: string; messageId: string };
  message: string;
  pageContext?: { companyId: string; pathname: string | null };
  conversationId: string;
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  session: { user: { id: string } };
  requestStarted: number;
  admissionMs: number;
}): Promise<Response> {
  const { result, failure, requestMs, finishMs } = await executePipeline(input);
  if (!result || failure) {
    return NextResponse.json({ error: failure?.message ?? 'Assistant error' }, { status: failure?.httpStatus ?? 500, headers: { 'Cache-Control': 'no-store' } });
  }
  const body: TurnResponse = { ok: true, status: 'completed', run_id: input.admit.runId, reply: result.content };
  return NextResponse.json(body, { status: 200, headers: { 'Cache-Control': 'no-store',
    'Server-Timing': `sa;dur=${requestMs}, sa_admission;dur=${input.admissionMs}, sa_finish;dur=${finishMs}` } });
}
