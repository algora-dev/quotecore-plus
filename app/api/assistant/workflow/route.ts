/**
 * GET /api/assistant/workflow  - Selector-free workflow step list (Stage 4)
 * =========================================================================
 * READ-ONLY. Returns the full, selector-free step list for one workflow so the
 * CLIENT step-engine (useGuideEngine) can drive stepping deterministically
 * WITHOUT an LLM turn. The LLM only runs when the user actually chats; this
 * endpoint is how the client gets the steps the moment a workflow is confirmed.
 *
 * Auth + tenancy are resolved exactly like the chat route: identity/company/
 * trade come from the authenticated session (never the query string). The trade
 * decides which guide set (roofing | generic) the workflow is read from, so the
 * client gets the steps that match the user's company - same resolution path as
 * the chat orchestrator (resolveServerContext).
 *
 * Query: ?id=<workflowId>
 * Returns: { workflow: { id, name, startPage, steps: [{ id, title, instruction,
 *           elementId, page, doneSignal }] } } or { workflow: null }.
 *
 * No DB writes, no mutations, no new deps. Mirrors the read-only invariant of
 * the chat tools: it only ever READS the in-memory workflow library.
 */

import { NextRequest } from 'next/server';
import { ASSISTANT_ENABLED } from '@/app/lib/assistant/config';
import {
  resolveServerContext,
  AssistantContextError,
} from '@/app/lib/assistant/contextResolver';
import { getWorkflowById } from '@/app/lib/assistant/library/workflowLibrary';
import {
  ASSISTANT_PROTOCOL_VERSION,
  type AssistantClientHints,
} from '@/app/lib/assistant/protocol';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

export async function GET(req: NextRequest) {
  // Feature flag - same gate as the chat route.
  if (!ASSISTANT_ENABLED) {
    return json({ error: 'invalid_request', message: 'Assistant is not enabled.' }, 404);
  }

  const workflowId = req.nextUrl.searchParams.get('id')?.trim();
  if (!workflowId) {
    return json({ error: 'invalid_request', message: 'Query param "id" is required.' }, 400);
  }

  // Resolve trusted context from the SESSION (identity/company/trade) - the
  // query string can only carry the workflow id, never tenancy. We supply a
  // minimal, valid hints envelope; resolveServerContext reads identity + trade
  // from the session, not from these hints.
  let trade: string;
  try {
    const hints: AssistantClientHints = {
      assistantProtocolVersion: ASSISTANT_PROTOCOL_VERSION,
      clientCapabilities: ['web'],
      // Structurally-valid semantic screen key (resolver requires one). The
      // workflow lookup itself does not depend on the current screen.
      screenKey: 'home',
    };
    const ctx = await resolveServerContext(hints);
    trade = ctx.trade;
  } catch (e) {
    if (e instanceof AssistantContextError) {
      const status = e.code === 'unauthorized' ? 401 : 400;
      return json({ error: e.code, message: e.message }, status);
    }
    return json({ error: 'internal_error', message: 'Context resolution failed.' }, 500);
  }

  const wf = getWorkflowById(workflowId, trade);
  if (!wf) {
    return json({ workflow: null });
  }

  // Selector-free projection - exactly the fields the client step-engine needs.
  return json({
    workflow: {
      id: wf.id,
      name: wf.name,
      startPage: wf.startPage,
      steps: wf.steps.map((s) => ({
        id: s.id,
        title: s.title,
        instruction: s.instruction,
        elementId: s.elementId,
        page: s.page,
        doneSignal: s.doneSignal,
      })),
    },
  });
}
