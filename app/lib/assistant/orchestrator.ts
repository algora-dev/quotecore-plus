/**
 * AI Assistant — Orchestrator (Phase 1)
 * ======================================
 * Runs an assistant turn: system prompt + history -> model -> tool loop ->
 * final text. Phase 1 exposes ONLY `search_help_docs`; context/workflow/
 * highlight tools arrive in Phases 3/4.
 *
 * The orchestrator receives ALREADY-TRUSTED context (resolved by the route
 * from the session). It never reads tenancy/permissions from client input.
 * Guards: tool-call depth cap, per-turn token accumulation, abort signal.
 */

import { runChatStep, type LlmMessage, type LlmToolSchema } from './llmClient';
import { searchHelpDocs } from './knowledge';
import { getLiveToolDefinitions } from './toolRegistry';
import { MODEL_LIMITS } from './config';
import type { AssistantServerContext } from './contextResolver';
import type { AssistantMode, ChatMessage } from './protocol';

export interface OrchestratorInput {
  context: AssistantServerContext;
  mode: AssistantMode;
  history: ChatMessage[];
  /** Stream a text delta to the client. */
  onToken: (text: string) => void;
  /** Notify the client a tool was invoked (name only). */
  onToolCall?: (name: string) => void;
  signal?: AbortSignal;
}

export interface OrchestratorResult {
  finalText: string;
  totalTokens: number;
  toolsUsed: string[];
}

function buildSystemPrompt(
  ctx: AssistantServerContext,
  mode: AssistantMode
): string {
  const base = [
    'You are the QuoteCore+ in-app assistant. QuoteCore+ is construction/roofing quoting software.',
    'Your job: explain, guide, clarify, teach, and answer questions about the app.',
    'CORE RULE: the application is the source of truth for workflow state. You never invent workflows or decide the next step yourself — you explain the step the app reports.',
    'When you use help docs, SUMMARISE and CONTEXTUALISE — never paste documentation verbatim.',
    'Be concise, direct, and practical. If you do not know, say so and suggest where to look.',
    'You are READ-ONLY: you cannot modify, create, or delete any data.',
    `Current screen: ${ctx.screenKey || 'unknown'}.`,
    `User plan/tier: ${ctx.serverPermissions.tier}.`,
  ];
  if (ctx.selectedEntities.length > 0) {
    base.push(
      `The user has selected: ${ctx.selectedEntities
        .map((e) => `${e.type} "${e.name}"`)
        .join(', ')}.`
    );
  }
  if (mode === 'guide_me') {
    base.push(
      'GUIDE MODE: proactively help the user progress. Tell them where they are and what to do next in plain language. The user may also ask free-form questions between steps — answer them naturally.'
    );
  } else {
    base.push(
      'RESPOND MODE: answer the user’s questions reactively. Do not push proactive step-by-step guidance unless asked.'
    );
  }
  return base.join('\n');
}

function toLlmTools(): LlmToolSchema[] {
  // Phase 1: only search_help_docs is dispatchable. We still surface only the
  // live, read-only definitions from the registry.
  return getLiveToolDefinitions()
    .filter((d) => d.id === 'search_help_docs')
    .map((d) => ({
      name: d.id,
      description: d.description,
      parameters: d.parameters as unknown as Record<string, unknown>,
    }));
}

/** Dispatch a tool call to its handler. Phase 1: search_help_docs only. */
async function dispatchTool(
  name: string,
  rawArgs: string
): Promise<{ ok: boolean; result: unknown }> {
  let args: Record<string, unknown> = {};
  try {
    args = JSON.parse(rawArgs || '{}');
  } catch {
    return { ok: false, result: { error: 'invalid tool arguments JSON' } };
  }

  if (name === 'search_help_docs') {
    const results = await searchHelpDocs({
      query: String(args.query ?? ''),
      section: args.section ? String(args.section) : undefined,
      k: typeof args.k === 'number' ? args.k : undefined,
    });
    return { ok: true, result: { results } };
  }

  // Any other tool is not live in Phase 1.
  return { ok: false, result: { error: `tool "${name}" is not available` } };
}

export async function runAssistantTurn(
  input: OrchestratorInput
): Promise<OrchestratorResult> {
  const tools = toLlmTools();
  const messages: LlmMessage[] = [
    { role: 'system', content: buildSystemPrompt(input.context, input.mode) },
    ...input.history.map((m) => ({
      role: m.role === 'tool' ? 'assistant' : m.role,
      content: m.content,
    })) as LlmMessage[],
  ];

  let totalTokens = 0;
  const toolsUsed: string[] = [];
  let finalText = '';

  for (let depth = 0; depth <= MODEL_LIMITS.maxToolCallDepth; depth++) {
    const step = await runChatStep({
      messages,
      tools,
      onToken: input.onToken,
      signal: input.signal,
    });
    totalTokens += step.totalTokens;
    finalText = step.text;

    if (step.toolCalls.length === 0) {
      // Model produced a final answer.
      return { finalText, totalTokens, toolsUsed };
    }

    if (depth === MODEL_LIMITS.maxToolCallDepth) {
      // Out of tool budget — stop looping; return whatever text we have.
      break;
    }

    // Record the assistant's tool-call turn, then each tool result.
    messages.push({
      role: 'assistant',
      content: step.text,
      tool_calls: step.toolCalls,
    });

    for (const call of step.toolCalls) {
      input.onToolCall?.(call.name);
      toolsUsed.push(call.name);
      const { result } = await dispatchTool(call.name, call.arguments);
      messages.push({
        role: 'tool',
        tool_call_id: call.id,
        content: JSON.stringify(result).slice(0, 6000),
      });
    }
  }

  return { finalText, totalTokens, toolsUsed };
}
