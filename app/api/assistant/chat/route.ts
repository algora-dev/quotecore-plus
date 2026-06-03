/**
 * POST /api/assistant/chat  — AI Assistant chat endpoint (Phase 1)
 * ================================================================
 * Streams an assistant turn over SSE. This is the API every client (web widget
 * today, mobile/voice later) calls.
 *
 * Acceptance gates enforced here, IN ORDER (Gerald H-01/H-02):
 *   1. Feature flag.
 *   2. Auth required (session-derived identity) — no anonymous access.
 *   3. Protocol version + request shape validation.
 *   4. Rate limit — FAIL CLOSED (per-user/company/IP).
 *   5. Cost budget — FAIL CLOSED when accounting unavailable.
 *   6. Trusted context resolution (client hints validated, never trusted).
 *   7. SSE stream of the orchestrated turn, with abort cleanup.
 *   8. Persist messages + record token usage + audit event.
 */

import { NextRequest } from 'next/server';
import { getClientIP } from '@/app/lib/security/rateLimit';
import {
  ASSISTANT_ENABLED,
  REQUEST_LIMITS,
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
  const lastUser = [...body.messages].reverse().find((m) => m.role === 'user');
  if (!lastUser || !lastUser.content?.trim()) {
    return errorResponse('invalid_request', 'A user message is required.', 400);
  }
  if (lastUser.content.length > REQUEST_LIMITS.maxUserMessageChars) {
    return errorResponse('invalid_request', 'User message too long.', 413);
  }
  const mode = body.mode === 'guide_me' ? 'guide_me' : 'respond_only';

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

  // 4. Rate limit — fail closed.
  const ip = getClientIP(req.headers);
  const rl = await checkAssistantRateLimits({
    userId: context.userId,
    companyId: context.companyId,
    ip,
  });
  if (!rl.allowed) {
    return errorResponse('rate_limited', `Rate limited (${rl.deniedBy}).`, 429);
  }

  // 5. Cost budget — fail closed.
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

      try {
        const result = await runAssistantTurn({
          context,
          mode,
          history: body.messages,
          onToken: (text) => send({ type: 'token', text }),
          onToolCall: (name) => send({ type: 'tool_call', tool: name }),
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
          message: aborted ? 'Cancelled.' : 'Assistant error.',
        });
        controller.close();
        if (!aborted) console.error('[assistant.chat] turn error:', err);
      }
    },
    cancel() {
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
