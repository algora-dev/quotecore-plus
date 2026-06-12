/**
 * AI Assistant - Workflow Library Types (Stage 2)
 * ================================================
 * The SEMANTIC, selector-free shapes the chatbot (Stage 3) will query when it
 * needs to know "what workflow does the user want, what are its steps, and how
 * do I know a step is done". Derived at module load FROM the authored Copilot
 * guides (see workflowLibrary.ts) - these types describe the derived view, not
 * the raw guide content.
 *
 * Hard rules (mirror protocol.ts ARCH LOCK):
 *   - NO CSS selectors, NO raw routes-as-selectors, NO DOM attributes here.
 *   - Element references are semantic registry `elementId`s only (the value of
 *     `data-copilot="X"` → "X"). Non-registry targets resolve to `null`.
 *   - Server-safe: this file imports nothing from React or the DOM.
 */

/** Trade a workflow belongs to. Mirrors workflowService's roofing/generic split. */
export type LibraryTrade = 'roofing' | 'generic';

/**
 * A selector-free completion hint for a single step. Translated from the
 * source Copilot `validation` field into something the observer/chatbot can
 * reason about WITHOUT knowing any DOM selectors:
 *
 *   - input-filled    : the named input/registry element has a value.
 *   - element-appears : the named registry element becomes present/visible
 *                       (e.g. a modal field shows up after a button click).
 *   - clicked         : the step's own element was clicked (no follow-on
 *                       element to watch for).
 *   - manual          : no auto-detectable signal - user-driven or pure
 *                       navigation; the chatbot must rely on browser facts /
 *                       the user's word.
 *
 * `elementId` is the registry id to watch, or null when none is resolvable.
 */
export type DoneSignal =
  | { kind: 'input-filled'; elementId: string | null }
  | { kind: 'element-appears'; elementId: string | null }
  | { kind: 'clicked'; elementId: string | null }
  | { kind: 'manual' };

/** One step within a library workflow (selector-free). */
export interface LibraryStep {
  /** Stable step id (from the source guide). */
  id: string;
  /** Short human title. */
  title: string;
  /**
   * The authored instruction. The original `_italic_` emphasis markers are
   * preserved verbatim so the chatbot can render or strip them as it sees fit.
   */
  instruction: string;
  /**
   * Semantic registry element id this step refers to (from `data-copilot="X"`
   * → "X"), or null when the source target is a raw selector (e.g. the account
   * `nav[aria-label=...]`).
   */
  elementId: string | null;
  /** In-app path this step belongs to (from the source step's `page`), or null. */
  page: string | null;
  /** Selector-free completion hint for this step. */
  doneSignal: DoneSignal;
}

/** A whole workflow as queryable data for the chatbot. */
export interface LibraryWorkflow {
  /** Workflow id (= source guide id). */
  id: string;
  /** Human name (= guide name). */
  name: string;
  /** One-line summary (= guide description). */
  summary: string;
  /** Trade this workflow belongs to. */
  trade: LibraryTrade;
  /**
   * Natural-language phrasings a user might say that map to this workflow.
   * Authored data (see intents.ts) - NOT derived from code logic. Used by the
   * keyword candidate-finder; the chatbot refines from there.
   */
  intents: string[];
  /**
   * The in-app path the workflow begins on (the first step's `page`), or null
   * when the first step has no page (typically a nav-from-anywhere start).
   */
  startPage: string | null;
  /** Ordered steps. */
  steps: LibraryStep[];
}

/** Lightweight browse shape for listing workflows to the chatbot. */
export interface LibraryWorkflowSummary {
  id: string;
  name: string;
  summary: string;
  intents: string[];
}
