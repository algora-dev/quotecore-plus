/**
 * AI Assistant - Workflow Library (Stage 2, Deliverable A)
 * ========================================================
 * A typed, in-memory, server-safe library of workflows the chatbot (Stage 3)
 * can query. It is DERIVED AT MODULE LOAD from the authored Copilot guides -
 * we never copy-paste guide content. The only net-new authored data is the
 * per-workflow `intents[]` (see intents.ts).
 *
 * Relationship to workflowService.ts: that file already maps CopilotGuide → a
 * screen-anchored Workflow used by Guide-me's DB progress reads. This library
 * is the COMPLEMENTARY, intent-first view: same source guides, but adds
 * intents + selector-free doneSignals and exposes intent/browse accessors the
 * chatbot needs. It reuses workflowService's `elementIdFromTarget` rule
 * (data-copilot="X" → "X") so the two stay consistent.
 *
 * DOM-free. Imports nothing from React or the DOM. Pure accessors, no I/O.
 */

import { COPILOT_GUIDES } from '@/app/components/copilot/guides';
import { COPILOT_GUIDES_GENERIC } from '@/app/components/copilot/guides.generic';
import type { CopilotGuide, CopilotStep } from '@/app/components/copilot/types';
import { intentsForWorkflow } from './intents';
import type {
  DoneSignal,
  LibraryStep,
  LibraryTrade,
  LibraryWorkflow,
  LibraryWorkflowSummary,
} from './types';

// ---------------------------------------------------------------------------
// Derivation helpers (pure)
// ---------------------------------------------------------------------------

/**
 * Pull a registry elementId out of a Copilot `target`/`validationTarget`
 * selector, if present. e.g. `[data-copilot="component-name"]` →
 * "component-name". Raw element/aria selectors (e.g. the account nav) → null.
 * Mirrors workflowService.elementIdFromTarget (kept selector-free on the wire).
 */
function elementIdFromTarget(target: string | undefined): string | null {
  if (!target) return null;
  const m = /\[data-copilot="([^"]+)"\]/.exec(target);
  return m ? m[1] : null;
}

/**
 * Translate a step's Copilot `validation` into a SEMANTIC, selector-free
 * doneSignal:
 *   - validation 'input'                       → input-filled @ step element
 *   - validation 'click' + validationTarget    → element-appears @ that target
 *   - validation 'click' (no validationTarget)  → clicked @ step element
 *   - any other validation w/ a validationTarget → element-appears @ target
 *   - otherwise                                  → manual (nav / user-driven)
 *
 * All CSS selectors are stripped; only registry elementIds are exposed.
 */
function deriveDoneSignal(step: CopilotStep): DoneSignal {
  const stepElementId = elementIdFromTarget(step.target);
  const validationElementId = elementIdFromTarget(step.validationTarget);

  switch (step.validation) {
    case 'input':
      return { kind: 'input-filled', elementId: stepElementId };
    case 'click':
      if (step.validationTarget) {
        return { kind: 'element-appears', elementId: validationElementId };
      }
      return { kind: 'clicked', elementId: stepElementId };
    case 'select':
      // Treat a select the same as filling an input (a value gets chosen).
      return { kind: 'input-filled', elementId: stepElementId };
    default:
      // 'none' / undefined. A validationTarget can still hint completion.
      if (step.validationTarget) {
        return { kind: 'element-appears', elementId: validationElementId };
      }
      return { kind: 'manual' };
  }
}

function mapStep(step: CopilotStep): LibraryStep {
  return {
    id: step.id,
    title: step.title,
    instruction: step.description,
    elementId: elementIdFromTarget(step.target),
    page: step.page ?? null,
    doneSignal: deriveDoneSignal(step),
  };
}

function mapGuide(guide: CopilotGuide, trade: LibraryTrade): LibraryWorkflow {
  const steps = guide.steps.map(mapStep);
  const startPage = steps.find((s) => s.page !== null)?.page ?? null;
  return {
    id: guide.id,
    name: guide.name,
    summary: guide.description,
    trade,
    intents: intentsForWorkflow(guide.id, trade),
    startPage,
    steps,
  };
}

// ---------------------------------------------------------------------------
// Build the per-trade library once at module load (pure, no I/O)
// ---------------------------------------------------------------------------

function buildLibrary(): Record<LibraryTrade, LibraryWorkflow[]> {
  return {
    roofing: COPILOT_GUIDES.map((g) => mapGuide(g, 'roofing')),
    generic: COPILOT_GUIDES_GENERIC.map((g) => mapGuide(g, 'generic')),
  };
}

const LIBRARY = buildLibrary();

/** Mirror workflowService's trade-selection rule: only 'roofing' is roofing. */
function resolveTrade(trade: string): LibraryTrade {
  return trade === 'roofing' ? 'roofing' : 'generic';
}

// ---------------------------------------------------------------------------
// Public accessors (pure, server-safe)
// ---------------------------------------------------------------------------

/** All workflows for a trade (roofing set vs generic set). */
export function getLibrary(trade: string): LibraryWorkflow[] {
  return LIBRARY[resolveTrade(trade)];
}

/** A single workflow by id for a trade, or null. */
export function getWorkflowById(
  id: string,
  trade: string
): LibraryWorkflow | null {
  return getLibrary(trade).find((w) => w.id === id) ?? null;
}

/** A single step (0-based) of a workflow, or null if out of range / no workflow. */
export function getStep(
  workflowId: string,
  stepIndex: number,
  trade: string
): LibraryStep | null {
  const wf = getWorkflowById(workflowId, trade);
  if (!wf) return null;
  if (stepIndex < 0 || stepIndex >= wf.steps.length) return null;
  return wf.steps[stepIndex];
}

/** Browse list (id+name+summary+intents) for the chatbot to skim. */
export function listWorkflowSummaries(trade: string): LibraryWorkflowSummary[] {
  return getLibrary(trade).map((w) => ({
    id: w.id,
    name: w.name,
    summary: w.summary,
    intents: w.intents,
  }));
}

// ---------------------------------------------------------------------------
// Intent candidate-finder (keyword scoring - NO LLM, NO new dep)
// ---------------------------------------------------------------------------

export interface WorkflowMatch {
  workflow: LibraryWorkflow;
  /** Higher is better. Relative score; not normalised. */
  score: number;
}

/** Tokenise to lowercase alphanumeric words, dropping trivial stop-words. */
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'to', 'of', 'in', 'on', 'my', 'me', 'i', 'is', 'it',
  'for', 'and', 'or', 'with', 'this', 'that', 'how', 'do', 'can', 'want',
  'new', 'add', 'get', 'set', 'up', 'go',
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t));
}

/**
 * Find candidate workflows for a natural-language query via case-insensitive
 * keyword/substring scoring over intents + name + summary. This is a
 * CANDIDATE-FINDER the chatbot refines - not a final classifier.
 *
 * Scoring (cheap, explainable):
 *   - +5  : an intent string is a substring of the query (or vice-versa)
 *   - +3  : per query token that appears in any intent
 *   - +2  : per query token that appears in the workflow name
 *   - +1  : per query token that appears in the summary
 * Returns matches with score > 0, sorted desc.
 */
export function findWorkflowsByIntent(
  query: string,
  trade: string
): WorkflowMatch[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const tokens = tokenize(query);
  const matches: WorkflowMatch[] = [];

  for (const workflow of getLibrary(trade)) {
    let score = 0;
    const intentBlob = workflow.intents.map((s) => s.toLowerCase());
    const nameLc = workflow.name.toLowerCase();
    const summaryLc = workflow.summary.toLowerCase();

    // Whole-phrase intent containment (strong signal).
    for (const intent of intentBlob) {
      if (q.includes(intent) || intent.includes(q)) score += 5;
    }

    // Per-token signals.
    for (const tok of tokens) {
      if (intentBlob.some((s) => s.includes(tok))) score += 3;
      if (nameLc.includes(tok)) score += 2;
      if (summaryLc.includes(tok)) score += 1;
    }

    if (score > 0) matches.push({ workflow, score });
  }

  matches.sort((a, b) => b.score - a.score);
  return matches;
}
