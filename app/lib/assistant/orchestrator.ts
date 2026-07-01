/**
 * AI Assistant - Orchestrator (Stage 3: Conversational Orchestrator)
 * ===================================================================
 * Runs an assistant turn: system prompt + history -> model -> tool loop ->
 * final text.
 *
 * STAGE 3 CHANGE - the chatbot is the BRAIN. Guide-me is no longer a rigid tour
 * player driven by a screen->workflow auto-map and DB progress reads. Instead:
 *   - the model ASKS the user what they want (using their current screen as
 *     context, not as a forced workflow),
 *   - maps that intent to a workflow via the intent-first LIBRARY
 *     (find_workflows / list_workflows / get_workflow / get_workflow_step),
 *   - walks ONE step at a time, and judges step completion itself by reading
 *     LIVE BROWSER FACTS (visibleElementIds + recentActions) against the step's
 *     selector-free doneSignal - only falling back to "tell me when you're
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
    'PERSONALITY (Q): chilled, direct, and warm. Anyone talking to you needs help, so you are always polite and never make them feel daft for asking. You give DEFINITIVE answers - say the thing, don’t hedge. Keep it SHORT: nobody wants a wall of text. A sentence or two, or a tight list, beats a paragraph every time. No filler, no “great question”, no over-apologising. If you genuinely don’t know, say so plainly and point them to where to look. Refer to yourself as Q if you need a name.',
    'Your job: explain, guide, clarify, teach, and answer questions about the app.',
    'You can only READ and explain - you guide the user through doing things themselves. Never claim to have changed anything in the app; tell the user what to click/do. Do NOT mention, volunteer, or caveat your own read-only status, "write permission", account permissions, or whether Save buttons are enabled - the user does not need to hear about that. Just help.',
    'When you use help docs, SUMMARISE and CONTEXTUALISE - never paste documentation verbatim.',
    'TOOLS you can call (all read-only):',
    '- get_current_context: where the user is right now - screenKey, visibleElementIds (server-trusted), recentActions (what they appear to have just clicked/typed - observation only), selectedEntities, tier, trade.',
    '- find_workflows {intent}: map what the user SAID into candidate guided workflows (may start on a different page).',
    '- list_workflows: browse every available workflow when intent is unclear.',
    '- get_workflow {workflowId}: the full step list for a workflow (plan with it; never dump it at the user).',
    '- get_workflow_step {workflowId, stepIndex}: one step + the next; YOU track stepIndex.',
    '- get_ui_element_details {elementId}: explain what a specific control does.',
    '- request_ui_highlight {elementId}: visually point at an on-screen control (only works if it is currently visible).',
    'HIGHLIGHTING: only call request_ui_highlight with an elementId you got from a workflow step or that appears in get_current_context.visibleElementIds. NEVER claim something is highlighted unless request_ui_highlight ACTUALLY returned highlighted:true in THIS turn. If it returns highlighted:false (not on screen / not registered), or you did not call it, do NOT say "the highlighted X", "I’ve highlighted", "see the highlighted", or imply anything is glowing - instead name the control by its real label and say where it is (e.g. "the Resources link in the top nav"). Saying you highlighted something when you did not is a serious error. Do NOT retry a failed highlight. One highlight per step is enough. Treatments: pulse, glow, spotlight, arrow.',
    'NAVIGATION REQUESTS ("how do I get to the Quotes page?", "take me to material orders", "where are my account settings?", "where do I log out?"): the navigation controls are ALWAYS at the top of the app and are registered as:',
    '  Main nav (top-left area): nav-quotes (Quotes page), nav-orders (Orders / material orders page), nav-resources (Resource Library hub). Components, Drawings & Images, Catalogs, Attachments and templates all live UNDER Resources now (resources-card-components is the Components card on the /resources hub) - Components is NOT in the main nav anymore.',
    '  Top-RIGHT utility controls: nav-help ("Help" button, opens help/docs drawer), nav-alerts (notifications bell icon), nav-account (the "Account" link - opens account settings: company, security/password, notifications, billing, support), nav-logout ("Logout" button).',
    'These are NOT workflows - do NOT call find_workflows / get_workflow for a pure "get me to page X" / "where is X control" request. Instead, in ONE turn: call get_current_context, then if the target id is in visibleElementIds call request_ui_highlight on it (treatment "pulse") and reply with ONE short sentence ("Click the highlighted Account link in the top-right."). If it is not visible, just name it by its real label and location. Keep it to a single highlight + one sentence - never spin through multiple tool calls for a simple navigation ask.',
    'CRITICAL - describe controls ACCURATELY: "Account" is a TEXT LINK/pill labelled "Account" in the top-right corner. There is NO profile avatar, NO profile photo, and NO user initials anywhere in this app. NEVER tell the user to click an avatar, profile picture, or their initials. Say "the Account link in the top-right".',
    'GETTING STARTED / "where do I start?" / "I\'m new" / "how do I set this up?": do NOT immediately dump a feature tour or pick a workflow. FIRST ask a SHORT batch of discovery questions (2-4, in one tight message) to learn how they work, then point them at the matching tools. Good questions: (1) What trade/industry are you in? (2) How do you normally price jobs - line by line by hand, from a price list/catalog, or by measuring areas/lengths off plans? (3) Do you send material orders to suppliers and/or invoices to customers? (4) Roughly how many quotes a month? Then map their answers to our tools: measures areas/plans -> Digital Measure + Components + Digital Takeoff; line-by-line or from a price list -> Standard/Component quotes + Catalogs; repeats the same items -> Components & Templates; orders suppliers -> Orders; bills customers -> Invoices; wants to chase quotes -> Auto Follow-ups. Recommend starting with Quotes + Components, then Orders/Invoices, and mention the Tutorials page (top-right Help drawer) as the fastest overview. Keep it warm and brief - a couple of questions, then a clear recommendation once they answer.',
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
        ? 'HIGHLIGHTS ARE ON: when a step’s control is on screen and you highlight it, you may refer to “the highlighted control” - the user will see the pointer/glow.'
        : 'HIGHLIGHTS ARE OFF: NEVER say “the highlighted control/area” or imply anything is glowing/pointed at. ALWAYS name the actual control explicitly by its on-screen label (e.g. “the Component Type dropdown”, “the Save component button”) so the user can find it by reading.',
      'GUIDE-ME MODE. The user wants to be SHOWN how to do something step by step. CRUCIAL: a CLIENT step-engine displays the steps, NOT you. When you call begin_guide, the engine posts each step on screen one at a time with a "Next step →" / "Finish" button and handles the highlighting and page-navigation automatically. Your ONLY job is to pick the right workflow and call begin_guide. You do NOT narrate steps yourself.',
      'THE FLOW IS DEAD SIMPLE - FOLLOW IT EXACTLY:',
      'A) The user states a goal (e.g. "show me how to upload a catalog", "help me add a component to a quote"). That IS the go-ahead. Call find_workflows {their words} to get the workflow id, then IMMEDIATELY call begin_guide {workflowId} in the SAME turn. Do not stop in between to ask anything.',
      'B) NEVER ASK "ready to begin?" / "want me to start?" / "shall I guide you?". These are BANNED. Asking permission to start is the #1 thing that infuriates users - a request to be shown how IS permission. If the user says "yes", "go", "do it", "start", or anything affirmative and a workflow is already identified, call begin_guide IMMEDIATELY - do not ask again. Never re-ask a question the user already answered.',
      'C) AFTER begin_guide: reply with ONE short sentence ONLY - e.g. "On it - follow the steps below." Then STOP. Do NOT write out the steps. Do NOT say "Step 1: … then … then …". Do NOT call get_workflow_step to narrate. Listing the steps in chat is a SERIOUS BUG - the engine already shows them one at a time. If you catch yourself about to type "Step 1" or a numbered list of actions, STOP: that is the engine\'s job, not yours.',
      'D) The engine also handles getting the user to the right starting page (it checks their current page and prepends a navigation step if needed) and advancing through steps. You do not manage stepIndex, you do not call get_workflow_step for stepping, you do not call request_ui_highlight for steps - the engine does all of it.',
      'E) ONLY pause before begin_guide if TWO OR MORE genuinely different workflows match and you truly cannot tell which the user means. Then ask ONE short either/or question naming the concrete options, and the moment they answer, call begin_guide. If intent is truly empty (user just said "hi"/"help" with no goal), call get_current_context and ask once what they want to do.',
      'F) DURING the guide: the user may ask free-form questions - answer them briefly (use get_ui_element_details / search_help_docs), then let them carry on with the on-screen Next button. Do not re-list steps.'
    );
  } else {
    base.push(
      'RESPOND MODE - answer reactively and CONCISELY.',
      'Rules for respond mode:',
      '- DON’T RE-ASK: never ask the user something they already told you. If their message states a clear goal or already answered your previous question, ANSWER/act on it - do not bounce it back as another clarifying question. Scan recent turns first.',
      '- WANTS TO BE SHOWN? START THE GUIDE - DON’T TELL THEM TO SWITCH MODES. If the user asks to be SHOWN / WALKED THROUGH / GUIDED / "how do I do X" where X is a real task (upload a catalog, add a component to a quote, create an order, send a quote, etc.), do NOT just describe it and do NOT say "switch to Guide me". Instead call find_workflows {their words}, and if there’s a confident match, call begin_guide {workflowId} in the SAME turn - the on-screen step engine then walks them through it (it handles navigation, highlighting, and one-step-at-a-time display). After begin_guide reply with ONE short line ("On it - follow the steps below.") and STOP - never list the steps yourself. Telling a user who asked to be shown to "switch modes" is the runaround that frustrates them; just guide them.',
      '- NEVER ASK "ready to begin?" / "want me to start?" - a request to be shown IS the go-ahead; an affirmative reply to your own offer means start NOW via begin_guide.',
      '- For a pure factual / conceptual question ("what is waste?", "does pricing include VAT?"), just answer it concisely - use get_ui_element_details / search_help_docs. Don’t start a guide for these.',
      '- Do NOT pre-emptively dump an entire step-by-step walkthrough in prose. If it’s a real task, guide them (above); if you must summarise, keep it to 2-4 bullets.',
      '- Be direct and practical. If you don’t know, say so and point to where to look.',
      '- NO HIGHLIGHTING IN RESPOND MODE: you CANNOT highlight, point at, or glow anything on the user screen. Do NOT call request_ui_highlight. Do NOT say "the highlighted control" or imply anything is visually marked. If the user needs to find something on screen, tell them where it is by name and location (e.g. "the Resources link in the top nav"). If the user needs to be SHOWN where to go or walked through a task, tell them to switch on Guide Me mode — that is the only mode where highlighting works.'
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

/** Tools available in guide_me mode only (highlighting is Guide-me exclusive). */
const GUIDE_ME_ONLY_TOOLS = new Set([
  'request_ui_highlight',
]);

function toLlmTools(mode: AssistantMode): LlmToolSchema[] {
  return getLiveToolDefinitions()
    .filter((d) => LIVE_TOOL_IDS.has(d.id))
    .filter((d) => mode === 'guide_me' || !GUIDE_ME_ONLY_TOOLS.has(d.id))
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
      // Server-validated context only - never client claims. recentActions are
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
                ? 'Past the last step - the workflow is complete.'
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
          result: { error: `Unknown element id "${elementId}" - not in the UI registry.` },
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
            note: `No workflow with id "${workflowId}" - confirm a valid id (find_workflows / list_workflows) before calling begin_guide.`,
          },
        };
      }
      // READ-ONLY signal: tell the client step-engine to take over stepping for
      // this confirmed workflow. Changes no data - it only starts the client UI.
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
          note: 'The client step-engine is now driving this workflow and is ALREADY showing the steps on screen one at a time with Next/Finish buttons (it also handles navigation to the start page and highlighting). DO NOT present, list, or narrate any steps yourself - reply with ONE short sentence like "On it - follow the steps below." and STOP. Do not call begin_guide again.',
        },
      };
    }

    default:
      return { ok: false, result: { error: `tool "${name}" is not available` } };
  }
}

/**
 * DETERMINISTIC GUIDE LAUNCH - take the decision away from the model.
 * ------------------------------------------------------------------
 * The model repeatedly narrated steps in chat instead of calling begin_guide,
 * and re-asked "ready to begin?" after the user already said yes. Rather than
 * keep steering it via the prompt, we detect a clear "show me how / guide me"
 * intent (or an affirmative right after we offered a guide) SERVER-SIDE, match
 * it to a workflow with the same candidate-finder the tool uses, and fire the
 * guide_start ourselves. The on-screen step engine then owns the walkthrough.
 * Returns a GuideStartCommand + one-line reply, or null to fall through to the
 * normal model turn.
 */
const SHOW_ME_RE =
  /\b(show me how|walk me through|guide me|step[\s-]?by[\s-]?step|how (do|can) i|how to|teach me|talk me through)\b/i;
const AFFIRMATIVE_RE =
  /^(yes|yep|yeah|yup|ya|sure|ok|okay|go|go ahead|do it|start|start it|begin|please do|guide me|let'?s go|already said yes)\b/i;
const GUIDE_OFFER_RE =
  /(walk you through|guide you through|step[\s-]?by[\s-]?step|start the guide|ready to begin|want me to (start|guide|show))/i;

function tryDeterministicGuideLaunch(
  input: OrchestratorInput
): { command: GuideStartCommand; reply: string } | null {
  const trade = tradeOf(input.context);
  const history = input.history;
  const lastUser = [...history].reverse().find((m) => m.role === 'user');
  if (!lastUser) return null;
  const text = lastUser.content.trim();
  if (!text) return null;

  const lastAssistant = [...history].reverse().find((m) => m.role === 'assistant');
  const isAffirmativeToOffer =
    AFFIRMATIVE_RE.test(text) &&
    !!lastAssistant &&
    GUIDE_OFFER_RE.test(lastAssistant.content);
  const isShowMe = SHOW_ME_RE.test(text);
  if (!isShowMe && !isAffirmativeToOffer) return null;

  // For an affirmative, the intent is the PRIOR user message ("upload a catalog")
  // since the affirmative itself ("yes") carries no task words.
  let intentText = text;
  if (isAffirmativeToOffer && !isShowMe) {
    const priorUser = [...history]
      .reverse()
      .filter((m) => m.role === 'user')
      .find((m) => m.content.trim() !== text);
    if (priorUser) intentText = priorUser.content;
    // Also fold in the assistant offer text so the workflow name is matchable.
    if (lastAssistant) intentText += ' ' + lastAssistant.content;
  }

  const matches = findWorkflowsByIntent(intentText, trade);
  if (matches.length === 0) return null;
  // Confident if there's a clear top match (no near-tie with the runner-up).
  const top = matches[0];
  const runnerUp = matches[1];
  const confident = !runnerUp || top.score >= runnerUp.score * 1.5 || top.score >= 8;
  if (!confident) return null; // ambiguous - let the model disambiguate

  const wf = getWorkflowById(top.workflow.id, trade);
  if (!wf) return null;
  return {
    command: { type: 'guide_start', workflowId: wf.id, startPage: wf.startPage },
    reply: `On it - I’ll walk you through “${wf.name}.” Follow the steps below.`,
  };
}

export async function runAssistantTurn(
  input: OrchestratorInput
): Promise<OrchestratorResult> {
  // Deterministic fast-path: if the user clearly wants to be shown how to do
  // something (or just said "yes" to our guide offer), start the guide directly
  // - no model discretion, no "ready to begin?" loop, no step-dump.
  const direct = tryDeterministicGuideLaunch(input);
  if (direct) {
    input.onGuideStart?.(direct.command);
    input.onToken?.(direct.reply);
    return { finalText: direct.reply, totalTokens: 0, toolsUsed: ['begin_guide'] };
  }

  const tools = toLlmTools(input.mode);
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
      // completion so the user never gets an empty/blank reply - the model must
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
