/**
 * POST /api/assistant/chat  - AI Assistant chat endpoint (Phase 1)
 * ================================================================
 * Streams an assistant turn over SSE. This is the API every client (web widget
 * today, mobile/voice later) calls.
 *
 * Acceptance gates enforced here, IN ORDER (Gerald H-01/H-02):
 *   1. Feature flag.
 *   2. Auth required (session-derived identity) - no anonymous access.
 *   3. Protocol version + request shape validation.
 *   4. Rate limit - FAIL CLOSED (per-user/company/IP).
 *   5. Cost budget - FAIL CLOSED when accounting unavailable.
 *   6. Trusted context resolution (client hints validated, never trusted).
 *   7. SSE stream of the orchestrated turn, with abort cleanup.
 *   8. Persist messages + record token usage + audit event.
 */

import { NextRequest } from 'next/server';
import { getClientIP } from '@/app/lib/security/rateLimit';
import {
  ASSISTANT_ENABLED,
  REQUEST_LIMITS,
  MODEL_LIMITS,
} from '@/app/lib/assistant/config';
import {
  isProtocolVersionSupported,
  type AssistantChatRequest,
  type AssistantStreamEvent,
  type AssistantErrorCode,
} from '@/app/lib/assistant/protocol';
import {
  resolveServerContext,
  AssistantContextError,
} from '@/app/lib/assistant/contextResolver';
import { checkAssistantRateLimits } from '@/app/lib/assistant/rateLimit';
import { checkCostBudget, recordTokenUsage } from '@/app/lib/assistant/costGuard';
import { runAssistantTurn } from '@/app/lib/assistant/orchestrator';
import { checkUserNewness, tryEarlyIntent } from '@/app/lib/assistant/earlyIntentRouter';
import {
  ensureSession,
  persistMessage,
  recordEvent,
} from '@/app/lib/assistant/sessions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// --- SSE helpers -----------------------------------------------------------

function sse(event: AssistantStreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

function errorResponse(code: AssistantErrorCode, message: string, status: number) {
  return new Response(JSON.stringify({ error: code, message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// --- handler ---------------------------------------------------------------

export async function POST(req: NextRequest) {
  // 1. Feature flag.
  if (!ASSISTANT_ENABLED) {
    return errorResponse('invalid_request', 'Assistant is not enabled.', 404);
  }

  // 3a. Parse body.
  let body: AssistantChatRequest;
  try {
    body = (await req.json()) as AssistantChatRequest;
  } catch {
    return errorResponse('invalid_request', 'Malformed JSON body.', 400);
  }

  // 3b. Protocol + shape.
  if (!isProtocolVersionSupported(body?.hints?.assistantProtocolVersion ?? '')) {
    return errorResponse(
      'unsupported_protocol_version',
      'Unsupported or missing assistantProtocolVersion.',
      400
    );
  }
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return errorResponse('invalid_request', 'messages[] required.', 400);
  }
  if (body.messages.length > REQUEST_LIMITS.maxHistoryMessages) {
    body.messages = body.messages.slice(-REQUEST_LIMITS.maxHistoryMessages);
  }
  // M-03: strict per-message schema validation at the boundary. Direct API
  // callers could otherwise smuggle non-client roles (system/tool), non-string
  // content, or oversized history (the maxTotalInputChars cap existed but was
  // never enforced), weakening prompt-safety + cost assumptions.
  let totalInputChars = 0;
  for (const m of body.messages) {
    if (!m || (m.role !== 'user' && m.role !== 'assistant')) {
      return errorResponse(
        'invalid_request',
        'Each message role must be "user" or "assistant".',
        400,
      );
    }
    if (typeof m.content !== 'string') {
      return errorResponse('invalid_request', 'Message content must be a string.', 400);
    }
    if (m.content.length > REQUEST_LIMITS.maxUserMessageChars) {
      return errorResponse('invalid_request', 'A message exceeds the per-message limit.', 413);
    }
    totalInputChars += m.content.length;
  }
  if (totalInputChars > REQUEST_LIMITS.maxTotalInputChars) {
    return errorResponse('invalid_request', 'Total input is too large.', 413);
  }
  const lastUser = [...body.messages].reverse().find((m) => m.role === 'user');
  if (!lastUser || !lastUser.content?.trim()) {
    return errorResponse('invalid_request', 'A user message is required.', 400);
  }
  if (lastUser.content.length > REQUEST_LIMITS.maxUserMessageChars) {
    return errorResponse('invalid_request', 'User message too long.', 413);
  }
  const mode = body.mode === 'guide_me' ? 'guide_me' : 'respond_only';
  // Client Highlights preference (default ON). A pure UX hint: it only changes
  // how the assistant PHRASES control references ("the highlighted control" vs
  // naming the control explicitly). Never a permission/tenancy input.
  const highlightsOn = body.highlightsOn !== false;

  // 2 + 6. Auth + trusted context (resolver throws on unauthorised/protocol).
  let context;
  try {
    context = await resolveServerContext(body.hints);
  } catch (e) {
    if (e instanceof AssistantContextError) {
      const status =
        e.code === 'unauthorized'
          ? 401
          : e.code === 'unsupported_protocol_version'
            ? 400
            : 400;
      return errorResponse(e.code, e.message, status);
    }
    return errorResponse('internal_error', 'Context resolution failed.', 500);
  }

  // 4. Rate limit - fail closed.
  const ip = getClientIP(req.headers);
  const rl = await checkAssistantRateLimits({
    userId: context.userId,
    companyId: context.companyId,
    ip,
  });
  if (!rl.allowed) {
    return errorResponse('rate_limited', `Rate limited (${rl.deniedBy}).`, 429);
  }

  // 5. Cost budget - fail closed.
  const budget = await checkCostBudget({
    userId: context.userId,
    companyId: context.companyId,
  });
  if (!budget.allowed) {
    const msg = budget.failedClosed
      ? 'Assistant temporarily unavailable (budget accounting).'
      : `Usage limit reached (${budget.exceeded}).`;
    return errorResponse('cost_limit_exceeded', msg, 429);
  }

  // 7. Stream the turn.
  const encoder = new TextEncoder();
  const ac = new AbortController();
  // Abort the model call if the client disconnects.
  req.signal.addEventListener('abort', () => ac.abort());
  // M-05: enforce a server-side wall-clock turn timeout. Without this a stalled
  // model/upstream call holds the SSE request open indefinitely (the config
  // existed but was never wired). Cleared on completion below; aborting here
  // makes the turn surface the same 'timeout' error path as a client abort.
  let timedOut = false;
  const turnTimer = setTimeout(() => {
    timedOut = true;
    ac.abort();
  }, MODEL_LIMITS.turnTimeoutMs);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: AssistantStreamEvent) =>
        controller.enqueue(encoder.encode(sse(event)));

      let sessionId: string;
      try {
        sessionId = await ensureSession({
          sessionId: body.sessionId,
          userId: context.userId,
          companyId: context.companyId,
          firstUserMessage: lastUser.content,
        });
        send({ type: 'session', sessionId });
      } catch {
        send({ type: 'error', code: 'internal_error', message: 'Could not start session.' });
        controller.close();
        return;
      }

      // Persist the user message.
      await persistMessage({ sessionId, role: 'user', content: lastUser.content });

      // Early-intent router: for new users, check if the message matches
      // a common early-stage question (getting started, components, etc).
      // If it matches, stream a fixed, pre-written response and skip the
      // full orchestrator turn entirely. Falls through if no match.
      try {
        const newness = await checkUserNewness(context.userId, context.companyId);
        const earlyMatch = await tryEarlyIntent(lastUser.content, newness);
        if (earlyMatch) {
          // Stream the fixed response token-by-token for a natural feel.
          // Split into word chunks so the client sees progressive typing.
          const words = earlyMatch.response.split(' ');
          for (let i = 0; i < words.length; i++) {
            const chunk = i === 0 ? words[i] : ' ' + words[i];
            send({ type: 'token', text: chunk });
          }

          await persistMessage({
            sessionId,
            role: 'assistant',
            content: earlyMatch.response,
          });
          await recordEvent({
            sessionId,
            userId: context.userId,
            companyId: context.companyId,
            eventType: 'turn_complete',
            metadata: {
              mode,
              tools: [],
              tokens: 0,
              screen: context.screenKey,
              earlyIntent: earlyMatch.intent,
            },
          });

          send({ type: 'done', messageId: sessionId });
          controller.close();
          return;
        }
      } catch (earlyErr) {
        // If early-intent check fails, fall through to normal orchestrator
        console.warn('[assistant.chat] early-intent router error:', earlyErr);
      }

      try {
        const result = await runAssistantTurn({
          context,
          mode,
          highlightsOn,
          history: body.messages,
          onToken: (text) => send({ type: 'token', text }),
          onToolCall: (name) => send({ type: 'tool_call', tool: name }),
          onHighlight: (command) => send({ type: 'highlight', command }),
          onGuideStart: (command) => send({ type: 'guide_start', command }),
          signal: ac.signal,
        });

        // Persist assistant reply + usage + audit (best-effort).
        await persistMessage({
          sessionId,
          role: 'assistant',
          content: result.finalText,
        });
        await recordTokenUsage({
          userId: context.userId,
          companyId: context.companyId,
          totalTokens: result.totalTokens,
        });
        await recordEvent({
          sessionId,
          userId: context.userId,
          companyId: context.companyId,
          eventType: 'turn_complete',
          metadata: {
            mode,
            tools: result.toolsUsed,
            tokens: result.totalTokens,
            screen: context.screenKey,
          },
        });

        send({ type: 'done', messageId: sessionId });
        controller.close();
      } catch (err) {
        const aborted = ac.signal.aborted;
        send({
          type: 'error',
          code: aborted ? 'timeout' : 'upstream_error',
          message: timedOut
            ? 'Assistant timed out.'
            : aborted
              ? 'Cancelled.'
              : 'Assistant error.',
        });
        controller.close();
        if (!aborted) console.error('[assistant.chat] turn error:', err);
      } finally {
        clearTimeout(turnTimer);
      }
    },
    cancel() {
      clearTimeout(turnTimer);
      ac.abort();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
