/**
 * AI Assistant — Orchestrator (Stage 3: Conversational Orchestrator)
 * ===================================================================
 * Runs an assistant turn: system prompt + history -> model -> tool loop ->
 * final text.
 *
 * STAGE 3 CHANGE — the chatbot is the BRAIN. Guide-me is no longer a rigid tour
 * player driven by a screen->workflow auto-map and DB progress reads. Instead:
 *   - the model ASKS the user what they want (using their current screen as
 *     context, not as a forced workflow),
 *   - maps that intent to a workflow via the intent-first LIBRARY
 *     (find_workflows / list_workflows / get_workflow / get_workflow_step),
 *   - walks ONE step at a time, and judges step completion itself by reading
 *     LIVE BROWSER FACTS (visibleElementIds + recentActions) against the step's
 *     selector-free doneSignal — only falling back to "tell me when you're
 *     ready" when a step's doneSignal is `manual` or facts are inconclusive.
 *
 * The library + live facts are the model's senses and reference; the model owns
 * the conversation and progression. There is NO hardcoded screen->workflow map
 * and NO DB workflow-progress read here anymore (workflowService is de-wired).
 *
 * The orchestrator receives ALREADY-TRUSTED context (resolved by the route from
 * the session). It never reads tenancy/permissions from client input. Guards:
 * tool-call depth cap, per-turn token accumulation, abort signal. The read-only
 * highlight VALIDATION (registry id + ctx.visibleElementIds) is preserved.
 */

import { runChatStep, type LlmMessage, type LlmToolSchema } from './llmClient';
import { searchHelpDocs } from './knowledge';
import { getLiveToolDefinitions } from './toolRegistry';
import { getElement, isRegisteredElement } from './uiRegistry';
import {
  findWorkflowsByIntent,
  getStep,
  getWorkflowById,
  listWorkflowSummaries,
} from './library/workflowLibrary';
import type { LibraryWorkflow } from './library/types';
import { MODEL_LIMITS } from './config';
import type { AssistantServerContext } from './contextResolver';
import type { AssistantMode, ChatMessage, HighlightCommand } from './protocol';

/** Trade label used for library lookups, derived from server context. */
function tradeOf(ctx: AssistantServerContext): string {
  // contextResolver resolves the company default trade server-side; the library
  // keys roofing|generic (roofing is the default, anything else -> generic).
  return ctx.trade ?? 'roofing';
}

/** Serialise a full workflow for the model (selector-free, bounded). */
function workflowForModel(wf: LibraryWorkflow) {
  return {
    id: wf.id,
    name: wf.name,
    summary: wf.summary,
    startPage: wf.startPage,
    stepCount: wf.steps.length,
    steps: wf.steps.map((s, index) => ({
      index,
      id: s.id,
      title: s.title,
      instruction: s.instruction,
      elementId: s.elementId,
      page: s.page,
      doneSignal: s.doneSignal,
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
  /** Emit a validated highlight command to the client. */
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
    'You are READ-ONLY: you cannot modify, create, or delete any data. Never claim to have done something in the app — only tell the user what to click/do.',
    'When you use help docs, SUMMARISE and CONTEXTUALISE — never paste documentation verbatim.',
    'TOOLS you can call (all read-only):',
    '- get_current_context: where the user is right now — screenKey, visibleElementIds (server-trusted), recentActions (what they appear to have just clicked/typed — observation only), selectedEntities, tier, trade.',
    '- find_workflows {intent}: map what the user SAID into candidate guided workflows (may start on a different page).',
    '- list_workflows: browse every available workflow when intent is unclear.',
    '- get_workflow {workflowId}: the full step list for a workflow (plan with it; never dump it at the user).',
    '- get_workflow_step {workflowId, stepIndex}: one step + the next; YOU track stepIndex.',
    '- get_ui_element_details {elementId}: explain what a specific control does.',
    '- request_ui_highlight {elementId}: visually point at an on-screen control (only works if it is currently visible).',
    'HIGHLIGHTING: only call request_ui_highlight with an elementId you got from a workflow step or that appears in get_current_context.visibleElementIds. If it returns highlighted:false (not on screen), do NOT retry — just describe where to find it. One highlight per step is enough. Treatments: pulse, glow, spotlight, arrow.',
    `Current screen: ${ctx.screenKey || 'unknown'}.`,
    `User plan/tier: ${ctx.serverPermissions.tier}.`,
    `Trade: ${tradeOf(ctx)}.`,
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
      'GUIDE-ME MODE — you are a hands-on conversational coach. Guide-me means the user wants to be SHOWN how to do something, step by step, not just told facts. You own the conversation and the progression; the library and live browser facts are your senses and reference.',
      'HOW TO RUN GUIDE-ME:',
      '1. ORIENT, THEN ASK FIRST. On your first guide turn, call get_current_context to see where the user is, then greet them with what you see and ASK what they want to do. DO NOT assume they want the workflow for their current page. Offer the obvious current-page workflow as ONE option, but make clear they can ask for anything (including things on other pages). Example: "I can see you’re on the Components page — do you want help creating or editing a component here, or are you trying to do something else?"',
      '2. MAP INTENT TO A WORKFLOW. When the user tells you their goal, call find_workflows with their words. Pick the best candidate and briefly confirm it ("Sounds like you want to …, I’ll walk you through it — yes?"). If their intent is vague or find_workflows is unclear, call list_workflows and offer a short menu of concrete options.',
      '3. CROSS-PAGE IS NORMAL. The chosen workflow may start on a DIFFERENT page than the user is on (check startPage vs get_current_context.screenKey). If so, tell the user you’ll guide them there and start from that page’s first step. A user on Components who says "add a component to a quote" should be routed into the quote workflow.',
      '4. WALK ONE STEP AT A TIME. Track the stepIndex yourself, starting at 0. For each step call get_workflow_step {workflowId, stepIndex}. Tell the user the SINGLE next action (1–3 sentences): name the exact control, a brief why. If highlights are on AND the step’s elementId is present in get_current_context.visibleElementIds, call request_ui_highlight for it and refer to "the highlighted control". If the element is not visible (e.g. they’re on the wrong page yet), describe where it is instead.',
      '5. DETECT COMPLETION FROM LIVE FACTS — DO NOT rely on "tell me when you’re done" as the primary mechanism. After the user acts, re-read get_current_context and compare visibleElementIds + recentActions to the current step’s doneSignal:',
      '   • doneSignal.kind "clicked": done if recentActions shows a click on doneSignal.elementId (or the step’s elementId).',
      '   • doneSignal.kind "input-filled": done if recentActions shows an input/change on that elementId.',
      '   • doneSignal.kind "element-appears": done if doneSignal.elementId now appears in visibleElementIds.',
      '   • doneSignal.kind "manual": no auto signal — THIS is the only case where you say "do that, then tell me when you’re ready" (also acceptable when facts are genuinely inconclusive, or when a navigation between pages just needs the user to arrive).',
      '   When a step looks done, advance: increment stepIndex and present the next step automatically. When the whole workflow is done, congratulate briefly and ask if they want anything else.',
      '6. STAY CONVERSATIONAL. Answer free-form questions mid-flow naturally (use get_ui_element_details / search_help_docs as needed), then steer back to the current step.',
      'NEVER dump all the steps at once — that is Respond-mode behaviour. Give ONE step, judge completion from facts, then the next.'
    );
  } else {
    base.push(
      'RESPOND MODE — answer reactively and CONCISELY.',
      'Rules for respond mode:',
      '- Answer the actual question asked. Use get_current_context to stay page-aware, get_ui_element_details to explain a specific control, and search_help_docs for conceptual "how/why" questions.',
      '- Do NOT pre-emptively dump an entire step-by-step walkthrough unless the user explicitly asks for the full steps.',
      '- If a question genuinely has a short procedure, give a tight summary (2-4 bullets max), then offer: "Want me to walk you through it step by step? Switch to Guide me."',
      '- Be direct and practical. If you don’t know, say so and point to where to look.'
    );
  }
  return base.join('\n');
}

/** The tools dispatchable this turn (the live, library-backed read-only set). */
const LIVE_TOOL_IDS = new Set([
  'search_help_docs',
  'get_current_context',
  'find_workflows',
  'list_workflows',
  'get_workflow',
  'get_workflow_step',
  'get_ui_element_details',
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

/** Dispatch a tool call to its handler. All handlers are read-only.
 *  `onHighlight` emits validated highlight commands. */
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
      // Server-validated context only — never client claims. recentActions are
      // client-observed (lower trust): for "what the user appears to have done",
      // never for any permission decision.
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
          recentActions: ctx.recentActions.map((a) => ({
            elementId: a.elementId,
            kind: a.kind,
            at: a.at,
          })),
          trade,
        },
      };
    }

    case 'find_workflows': {
      const intent = String(args.intent ?? '').trim();
      if (!intent) {
        return {
          ok: false,
          result: { error: 'find_workflows requires an "intent" string.' },
        };
      }
      const matches = findWorkflowsByIntent(intent, trade)
        .slice(0, 6)
        .map((m) => ({
          id: m.workflow.id,
          name: m.workflow.name,
          summary: m.workflow.summary,
          intents: m.workflow.intents,
          startPage: m.workflow.startPage,
          stepCount: m.workflow.steps.length,
          score: m.score,
        }));
      return {
        ok: true,
        result: {
          candidates: matches,
          note:
            matches.length === 0
              ? 'No strong match. Call list_workflows and offer the user options.'
              : 'Confirm the best candidate with the user before guiding. A candidate may start on a different page than the user is currently on.',
        },
      };
    }

    case 'list_workflows': {
      return {
        ok: true,
        result: { workflows: listWorkflowSummaries(trade) },
      };
    }

    case 'get_workflow': {
      const wid = String(args.workflowId ?? '');
      const wf = wid ? getWorkflowById(wid, trade) : null;
      if (!wf) {
        return {
          ok: true,
          result: {
            workflow: null,
            note: `No workflow with id "${wid}". Use find_workflows / list_workflows to get a valid id.`,
          },
        };
      }
      return { ok: true, result: { workflow: workflowForModel(wf) } };
    }

    case 'get_workflow_step': {
      const wid = String(args.workflowId ?? '');
      const rawIndex = args.stepIndex;
      const stepIndex =
        typeof rawIndex === 'number' && Number.isFinite(rawIndex)
          ? Math.max(0, Math.trunc(rawIndex))
          : 0;
      const wf = wid ? getWorkflowById(wid, trade) : null;
      if (!wf) {
        return {
          ok: true,
          result: {
            step: null,
            note: `No workflow with id "${wid}".`,
          },
        };
      }
      const current = getStep(wid, stepIndex, trade);
      const next = getStep(wid, stepIndex + 1, trade);
      if (!current) {
        return {
          ok: true,
          result: {
            workflowId: wf.id,
            stepCount: wf.steps.length,
            stepIndex,
            completed: stepIndex >= wf.steps.length,
            currentStep: null,
            nextStep: null,
            note:
              stepIndex >= wf.steps.length
                ? 'Past the last step — the workflow is complete.'
                : 'No step at that index.',
          },
        };
      }
      return {
        ok: true,
        result: {
          workflowId: wf.id,
          stepCount: wf.steps.length,
          stepIndex,
          completed: false,
          currentStep: {
            index: stepIndex,
            id: current.id,
            title: current.title,
            instruction: current.instruction,
            elementId: current.elementId,
            page: current.page,
            doneSignal: current.doneSignal,
          },
          nextStep: next
            ? {
                index: stepIndex + 1,
                id: next.id,
                title: next.title,
                instruction: next.instruction,
                elementId: next.elementId,
                page: next.page,
                doneSignal: next.doneSignal,
              }
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
