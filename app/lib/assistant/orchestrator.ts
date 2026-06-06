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
import type {
  AssistantMode,
  ChatMessage,
  GuideStartCommand,
  HighlightCommand,
} from './protocol';

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
  /**
   * Whether the client's Highlights preference is ON. Drives the Guide-me
   * prompt branch: ON → refer to "the highlighted control"; OFF → name the
   * control explicitly and never say "highlighted". Client-supplied hint.
   */
  highlightsOn: boolean;
  /** Stream a text delta to the client. */
  onToken: (text: string) => void;
  /** Notify the client a tool was invoked (name only). */
  onToolCall?: (name: string) => void;
  /** Emit a validated highlight command to the client. */
  onHighlight?: (command: HighlightCommand) => void;
  /** Tell the client step-engine to start guiding a confirmed workflow. */
  onGuideStart?: (command: GuideStartCommand) => void;
  signal?: AbortSignal;
}

export interface OrchestratorResult {
  finalText: string;
  totalTokens: number;
  toolsUsed: string[];
}

function buildSystemPrompt(
  ctx: AssistantServerContext,
  mode: AssistantMode,
  highlightsOn: boolean
): string {
  const base = [
    'You are Q, the QuoteCore+ in-app assistant. QuoteCore+ is construction/roofing quoting software.',
    'PERSONALITY (Q): chilled, direct, and warm. Anyone talking to you needs help, so you are always polite and never make them feel daft for asking. You give DEFINITIVE answers — say the thing, don’t hedge. Keep it SHORT: nobody wants a wall of text. A sentence or two, or a tight list, beats a paragraph every time. No filler, no “great question”, no over-apologising. If you genuinely don’t know, say so plainly and point them to where to look. Refer to yourself as Q if you need a name.',
    'Your job: explain, guide, clarify, teach, and answer questions about the app.',
    'You can only READ and explain — you guide the user through doing things themselves. Never claim to have changed anything in the app; tell the user what to click/do. Do NOT mention, volunteer, or caveat your own read-only status, "write permission", account permissions, or whether Save buttons are enabled — the user does not need to hear about that. Just help.',
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
    'NAVIGATION REQUESTS ("how do I get to the Quotes page?", "take me to material orders", "where are my account settings?", "where do I log out?"): the navigation controls are ALWAYS at the top of the app and are registered as:',
    '  Main nav (top-left area): nav-quotes (Quotes page), nav-orders (Orders / material orders page), nav-resources (Resource Library hub). Components, Drawings & Images, Catalogs, Attachments and templates all live UNDER Resources now (resources-card-components is the Components card on the /resources hub) - Components is NOT in the main nav anymore.',
    '  Top-RIGHT utility controls: nav-help ("Help" button, opens help/docs drawer), nav-alerts (notifications bell icon), nav-account (the "Account" link — opens account settings: company, security/password, notifications, billing, support), nav-logout ("Logout" button).',
    'These are NOT workflows — do NOT call find_workflows / get_workflow for a pure "get me to page X" / "where is X control" request. Instead, in ONE turn: call get_current_context, then if the target id is in visibleElementIds call request_ui_highlight on it (treatment "pulse") and reply with ONE short sentence ("Click the highlighted Account link in the top-right."). If it is not visible, just name it by its real label and location. Keep it to a single highlight + one sentence — never spin through multiple tool calls for a simple navigation ask.',
    'CRITICAL — describe controls ACCURATELY: "Account" is a TEXT LINK/pill labelled "Account" in the top-right corner. There is NO profile avatar, NO profile photo, and NO user initials anywhere in this app. NEVER tell the user to click an avatar, profile picture, or their initials. Say "the Account link in the top-right".',
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
      highlightsOn
        ? 'HIGHLIGHTS ARE ON: when a step’s control is on screen and you highlight it, you may refer to “the highlighted control” — the user will see the pointer/glow.'
        : 'HIGHLIGHTS ARE OFF: NEVER say “the highlighted control/area” or imply anything is glowing/pointed at. ALWAYS name the actual control explicitly by its on-screen label (e.g. “the Component Type dropdown”, “the Save component button”) so the user can find it by reading.',
      'GUIDE-ME MODE — you are a hands-on conversational coach. Guide-me means the user wants to be SHOWN how to do something, step by step, not just told facts. You own the conversation and the progression; the library and live browser facts are your senses and reference.',
      'HOW TO RUN GUIDE-ME:',
      'DON’T RE-ASK — THE #1 RULE. NEVER ask the user something they have already told you. If their message already states a clear goal (e.g. "help me upload a new catalog", "add a component to a quote", "take me to orders"), that IS the intent — do NOT ask "what do you want to do?" and do NOT ask "are you sure you want to do X?". Map it and START. Scan the recent conversation before every reply: if you already asked a question and the user answered (even tersely, even rudely), ACT on that answer — never repeat the question or ask for the same confirmation again. Re-asking an answered question is the worst thing you can do here.',
      '1. ORIENT. On your first guide turn, call get_current_context to see where the user is. THEN: if the user already told you what they want, skip straight to step 2 and guide them. ONLY ask an orienting question when the user has given you NO goal yet (e.g. they just opened Guide-me with "hi" or "help"). In that case greet them with what you see and ask what they want — offering the obvious current-page workflow as one option while making clear they can ask for anything. Never force this question when a goal is already on the table.',
      '2. MAP INTENT TO A WORKFLOW. As soon as the user’s goal is known, call find_workflows with their words, pick the best candidate, and GUIDE — go straight to begin_guide + step 0. Do NOT add a separate "shall I start? yes?" gate for a clear request; starting IS the help they asked for. Only pause to confirm when there are genuinely two+ plausible workflows AND you can’t tell which they mean — in that case ask ONE short disambiguating question naming the concrete options, then act on their answer immediately. If intent is truly vague, call list_workflows and offer a short menu.',
      '3. CROSS-PAGE IS NORMAL. The chosen workflow may start on a DIFFERENT page than the user is on (check startPage vs get_current_context.screenKey). If so, tell the user you’ll guide them there and start from that page’s first step. A user on Components who says "add a component to a quote" should be routed into the quote workflow.',
      '4. WALK ONE STEP AT A TIME. Track the stepIndex yourself, starting at 0. For each step call get_workflow_step {workflowId, stepIndex}. Tell the user the SINGLE next action (1–3 sentences): name the exact control, a brief why.' +
        (highlightsOn
          ? ' If the step’s elementId is present in get_current_context.visibleElementIds, call request_ui_highlight for it and you may refer to "the highlighted control". If the element is not visible (e.g. they’re on the wrong page yet), describe where it is instead.'
          : ' Highlights are OFF, so do NOT call request_ui_highlight and do NOT say "highlighted" — instead name the control by its exact label and say where it is.'),
      'AFTER CONFIRMING THE WORKFLOW: call begin_guide {workflowId} ONCE (right after the user confirms), THEN present step 0. begin_guide hands the workflow to the client so the user gets an instant "Next step →" button and follow-along — you do not need to re-fetch each step for them to advance, though you stay available for questions.',
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
      '- DON’T RE-ASK: never ask the user something they already told you. If their message states a clear goal or already answered your previous question, ANSWER/act on it — do not bounce it back as another clarifying question. Scan recent turns first.',
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
  'begin_guide',
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
  onHighlight?: (command: HighlightCommand) => void,
  onGuideStart?: (command: GuideStartCommand) => void
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

    case 'begin_guide': {
      const workflowId = String(args.workflowId ?? '').trim();
      const wf = workflowId ? getWorkflowById(workflowId, trade) : null;
      if (!wf) {
        return {
          ok: true,
          result: {
            started: false,
            note: `No workflow with id "${workflowId}" — confirm a valid id (find_workflows / list_workflows) before calling begin_guide.`,
          },
        };
      }
      // READ-ONLY signal: tell the client step-engine to take over stepping for
      // this confirmed workflow. Changes no data — it only starts the client UI.
      onGuideStart?.({
        type: 'guide_start',
        workflowId: wf.id,
        startPage: wf.startPage,
      });
      return {
        ok: true,
        result: {
          started: true,
          workflowId: wf.id,
          name: wf.name,
          startPage: wf.startPage,
          stepCount: wf.steps.length,
          note: 'The client step-engine is now driving this workflow (the user has a "Next step →" button). Present the FIRST step (index 0) now; you do not need to call begin_guide again.',
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
    {
      role: 'system',
      content: buildSystemPrompt(input.context, input.mode, input.highlightsOn),
    },
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
      // Out of tool budget. If the model already produced text alongside its
      // (ignored) tool calls, keep it. Otherwise force a FINAL no-tools
      // completion so the user never gets an empty/blank reply — the model must
      // answer from the tool results it has already gathered. This is the fix
      // for the "typing dots that never resolve" hang on multi-tool turns
      // (e.g. cross-page guide-me: context -> find -> begin -> step -> highlight
      // exhausts the budget before any prose is emitted).
      if (!finalText.trim()) {
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
            input.onHighlight,
            input.onGuideStart
          );
          messages.push({
            role: 'tool',
            tool_call_id: call.id,
            content: JSON.stringify(result).slice(0, 6000),
          });
        }
        const finalStep = await runChatStep({
          messages,
          tools: [], // no tools -> model is forced to produce prose now
          onToken: input.onToken,
          signal: input.signal,
        });
        totalTokens += finalStep.totalTokens;
        finalText = finalStep.text;
      }
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
        input.onHighlight,
        input.onGuideStart
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
