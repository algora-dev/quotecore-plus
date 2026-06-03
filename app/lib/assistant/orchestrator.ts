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
import { getElement } from './uiRegistry';
import {
  getWorkflow,
  getWorkflowForScreen,
  getWorkflowProgress,
  getWorkflowStep,
  type Workflow,
} from './workflowService';
import { MODEL_LIMITS } from './config';
import { isRegisteredElement } from './uiRegistry';
import type { AssistantServerContext } from './contextResolver';
import type { AssistantMode, ChatMessage, HighlightCommand } from './protocol';

/** Trade label used for workflow lookups, derived from server context. */
function tradeOf(ctx: AssistantServerContext): string {
  // serverPermissions doesn't carry trade today; the screen-mapped workflows
  // are keyed roofing|generic. Roofing is the default trade (mirrors
  // CopilotProvider default). Generic trades resolve to the generic guide set.
  // contextResolver can surface trade later; until then default roofing.
  return ctx.trade ?? 'roofing';
}

/** Serialise a workflow for the model (selector-free, bounded). */
function workflowForModel(wf: Workflow) {
  return {
    workflowId: wf.workflowId,
    title: wf.title,
    description: wf.description,
    stepCount: wf.stepCount,
    steps: wf.steps.map((s) => ({
      index: s.index,
      id: s.id,
      title: s.title,
      instruction: s.instruction,
      elementId: s.elementId,
    })),
  };
}

export interface OrchestratorInput {
  context: AssistantServerContext;
  mode: AssistantMode;
  history: ChatMessage[];
  /** Stream a text delta to the client. */
  onToken: (text: string) => void;
  /** Notify the client a tool was invoked (name only). */
  onToolCall?: (name: string) => void;
  /** Emit a validated highlight command to the client (Phase 4). */
  onHighlight?: (command: HighlightCommand) => void;
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
    'CORE RULE: the application is the source of truth for workflow state. You never invent workflows or decide the next step yourself — you read it via the workflow tools and explain the step the app reports.',
    'TOOLS: use get_current_workflow / get_current_step to ground guidance in the REAL workflow for the screen; use get_ui_element_details to explain a specific button/field; use search_help_docs for conceptual "how/why" questions; use request_ui_highlight to visually point the user at the exact on-screen control for the current step (pass the registry elementId). Prefer workflow tools over docs when the user is mid-task on a guided screen.',
    'HIGHLIGHTING: only call request_ui_highlight with an elementId that get_current_step / get_current_workflow reported, or one you can see in get_current_context.visibleElementIds. If it returns highlighted:false (not on screen), do NOT keep retrying — just describe where to find it. One highlight per step is enough.',
    'When you use help docs, SUMMARISE and CONTEXTUALISE — never paste documentation verbatim.',
    'You are READ-ONLY: you cannot modify, create, or delete any data. Never claim to have done something in the app — only tell the user what to click/do.',
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
      'GUIDE MODE — you are a hands-on, step-by-step coach. Walk the user through ONE step at a time.',
      'Rules for guide mode:',
      '- Give the user the SINGLE next action to take, not the whole list. Keep it to 1-3 sentences.',
      '- Name the exact button/field/control to use (from the workflow step), then briefly why it matters. When that control is on the current screen, call request_ui_highlight with its elementId so the user can SEE it, then refer to "the highlighted button/field".',
      '- End by telling them to do it and that you’ll continue once they have (e.g. "Do that, then tell me when you’re ready / ask if you get stuck").',
      '- If a [WORKFLOW CONTEXT] note is provided below, START from the current step it names. Do not re-explain steps already behind them.',
      '- The user may ask free-form questions between steps — answer naturally, then steer back to the next step.',
      '- Never dump all steps at once. That is RESPOND mode behaviour, not guide mode.'
    );
  } else {
    base.push(
      'RESPOND MODE — answer reactively and CONCISELY.',
      'Rules for respond mode:',
      '- Answer the actual question asked. Do NOT pre-emptively dump an entire step-by-step walkthrough unless the user explicitly asks for the full steps.',
      '- If a question genuinely has a short procedure, give a tight summary (2-4 bullets max), then offer: "Want me to walk you through it step by step? Switch to Guide me."',
      '- Be direct and practical. If you don’t know, say so and point to where to look.'
    );
  }
  return base.join('\n');
}

/**
 * Guide-me priming: pre-fetch the workflow + current step for the screen and
 * return a system note so the model narrates the RIGHT step immediately,
 * without having to first decide to call a tool. Returns null when no workflow
 * maps to the screen (guide mode then just answers/offers help generally).
 * Fail-soft: any error returns null rather than breaking the turn.
 */
async function buildGuidePriming(
  ctx: AssistantServerContext
): Promise<string | null> {
  try {
    const trade = tradeOf(ctx);
    const wf = getWorkflowForScreen(ctx.screenKey, trade);
    if (!wf) return null;
    const progress = await getWorkflowProgress(ctx.userId, wf);
    if (progress.completed) {
      return `[WORKFLOW CONTEXT] The user is on a screen for the "${wf.title}" workflow, which they have already completed before. Offer a quick refresher or ask what they need — don't force them through every step again.`;
    }
    const idx = Math.min(progress.currentStepIndex, wf.steps.length - 1);
    const cur = getWorkflowStep(wf, idx);
    const next = getWorkflowStep(wf, idx + 1);
    const lines = [
      `[WORKFLOW CONTEXT] Active workflow: "${wf.title}" (${wf.stepCount} steps).`,
      cur
        ? `Current step ${cur.index}/${wf.stepCount}: "${cur.title}" — ${cur.instruction}${cur.elementId ? ` (control: ${cur.elementId})` : ''}`
        : 'Current step: start.',
    ];
    if (next) {
      lines.push(`Then next: "${next.title}".`);
    }
    lines.push(
      'Narrate THIS current step to the user in your own words, one step at a time. Do not list all steps.'
    );
    return lines.join('\n');
  } catch {
    return null;
  }
}

/**
 * Tools dispatchable in Phase 3: search + the read-only context/workflow tools.
 * `request_ui_highlight` is Phase 4 (needs the client-side executor), so it is
 * intentionally still withheld from the live set here.
 */
const LIVE_TOOL_IDS = new Set([
  'search_help_docs',
  'get_current_context',
  'get_current_workflow',
  'get_current_step',
  'get_ui_element_details',
  // Phase 4: highlight is now live (web executor renders it client-side).
  'request_ui_highlight',
]);

function toLlmTools(): LlmToolSchema[] {
  return getLiveToolDefinitions()
    .filter((d) => LIVE_TOOL_IDS.has(d.id))
    .map((d) => ({
      name: d.id,
      description: d.description,
      parameters: d.parameters as unknown as Record<string, unknown>,
    }));
}

const HIGHLIGHT_TREATMENTS = new Set(['pulse', 'glow', 'spotlight', 'arrow']);

/** Dispatch a tool call to its handler. Phase 4: search + context/workflow +
 *  request_ui_highlight. `onHighlight` emits validated highlight commands. */
async function dispatchTool(
  name: string,
  rawArgs: string,
  ctx: AssistantServerContext,
  onHighlight?: (command: HighlightCommand) => void
): Promise<{ ok: boolean; result: unknown }> {
  let args: Record<string, unknown> = {};
  try {
    args = JSON.parse(rawArgs || '{}');
  } catch {
    return { ok: false, result: { error: 'invalid tool arguments JSON' } };
  }

  const trade = tradeOf(ctx);

  switch (name) {
    case 'search_help_docs': {
      const results = await searchHelpDocs({
        query: String(args.query ?? ''),
        section: args.section ? String(args.section) : undefined,
        k: typeof args.k === 'number' ? args.k : undefined,
      });
      return { ok: true, result: { results } };
    }

    case 'get_current_context': {
      // Server-validated context only — never client claims.
      return {
        ok: true,
        result: {
          screenKey: ctx.screenKey,
          tier: ctx.serverPermissions.tier,
          canWrite: ctx.serverPermissions.canWrite,
          selectedEntities: ctx.selectedEntities.map((e) => ({
            type: e.type,
            name: e.name,
          })),
          visibleElementIds: ctx.visibleElementIds,
          trade,
        },
      };
    }

    case 'get_current_workflow': {
      const wid = args.workflowId ? String(args.workflowId) : undefined;
      const wf = wid
        ? getWorkflow(wid, trade)
        : getWorkflowForScreen(ctx.screenKey, trade);
      if (!wf) {
        return {
          ok: true,
          result: {
            workflow: null,
            note: 'No guided workflow maps to this screen.',
          },
        };
      }
      return { ok: true, result: { workflow: workflowForModel(wf) } };
    }

    case 'get_current_step': {
      const wid = args.workflowId ? String(args.workflowId) : undefined;
      const wf = wid
        ? getWorkflow(wid, trade)
        : getWorkflowForScreen(ctx.screenKey, trade);
      if (!wf) {
        return {
          ok: true,
          result: { step: null, note: 'No guided workflow on this screen.' },
        };
      }
      const progress = await getWorkflowProgress(ctx.userId, wf);
      const idx = Math.min(progress.currentStepIndex, wf.steps.length - 1);
      const current = getWorkflowStep(wf, idx);
      const next = getWorkflowStep(wf, idx + 1);
      return {
        ok: true,
        result: {
          workflowId: wf.workflowId,
          completed: progress.completed,
          stepCount: wf.stepCount,
          currentStep: current
            ? { index: current.index, title: current.title, instruction: current.instruction, elementId: current.elementId }
            : null,
          nextStep: next
            ? { index: next.index, title: next.title, instruction: next.instruction, elementId: next.elementId }
            : null,
        },
      };
    }

    case 'get_ui_element_details': {
      const elementId = String(args.elementId ?? '');
      const entry = getElement(elementId);
      if (!entry) {
        return {
          ok: true,
          result: { element: null, note: `Unknown element id "${elementId}".` },
        };
      }
      return {
        ok: true,
        result: {
          element: {
            id: entry.id,
            label: entry.label,
            role: entry.role,
            description: entry.description ?? null,
          },
        },
      };
    }

    case 'request_ui_highlight': {
      const elementId = String(args.elementId ?? '');
      // Validation 1: must be a real registry id (semantic, never a selector).
      if (!isRegisteredElement(elementId)) {
        return {
          ok: false,
          result: { error: `Unknown element id "${elementId}" — not in the UI registry.` },
        };
      }
      // Validation 2: must be CURRENTLY VISIBLE on the user's screen (server-
      // trusted set). Prevents highlighting off-screen / wrong-page elements,
      // which would point the user at nothing.
      if (!ctx.visibleElementIds.includes(elementId)) {
        return {
          ok: true,
          result: {
            highlighted: false,
            note: `"${elementId}" is a valid control but is not on the user's current screen, so it cannot be highlighted right now. Describe where to find it instead.`,
          },
        };
      }
      const treatment =
        typeof args.treatment === 'string' && HIGHLIGHT_TREATMENTS.has(args.treatment)
          ? (args.treatment as HighlightCommand['treatment'])
          : 'glow';
      const reason =
        typeof args.reason === 'string' ? args.reason.slice(0, 200) : undefined;
      const command: HighlightCommand = {
        type: 'highlight',
        elementId,
        treatment,
        reason,
      };
      onHighlight?.(command);
      const entry = getElement(elementId);
      return {
        ok: true,
        result: {
          highlighted: true,
          elementId,
          label: entry?.label ?? elementId,
          note: 'The control is now highlighted on the user\u2019s screen. Refer to it naturally (e.g. "the highlighted button").',
        },
      };
    }

    default:
      return { ok: false, result: { error: `tool "${name}" is not available` } };
  }
}

export async function runAssistantTurn(
  input: OrchestratorInput
): Promise<OrchestratorResult> {
  const tools = toLlmTools();
  const messages: LlmMessage[] = [
    { role: 'system', content: buildSystemPrompt(input.context, input.mode) },
  ];

  // Guide mode: inject live workflow/step priming so the assistant starts from
  // the user's actual current step instead of waiting to be asked.
  if (input.mode === 'guide_me') {
    const priming = await buildGuidePriming(input.context);
    if (priming) messages.push({ role: 'system', content: priming });
  }

  messages.push(
    ...(input.history.map((m) => ({
      role: m.role === 'tool' ? 'assistant' : m.role,
      content: m.content,
    })) as LlmMessage[])
  );

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
      const { result } = await dispatchTool(
        call.name,
        call.arguments,
        input.context,
        input.onHighlight
      );
      messages.push({
        role: 'tool',
        tool_call_id: call.id,
        content: JSON.stringify(result).slice(0, 6000),
      });
    }
  }

  return { finalText, totalTokens, toolsUsed };
}
