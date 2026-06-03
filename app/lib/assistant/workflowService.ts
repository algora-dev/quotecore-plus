/**
 * AI Assistant — Workflow Service (Phase 3, headless)
 * ====================================================
 * The SOURCE OF TRUTH for "what workflow applies here / what step is the user
 * on / what's next", with ZERO DOM coupling. This is what makes Guide-me real.
 *
 * Option A (Shaun, 2026-06-03): reuse the existing, authored Copilot guides as
 * the workflow content rather than re-authoring flows. We import the guide DATA
 * only (it's a plain array, no React) and map each `CopilotGuide` into the
 * assistant's SEMANTIC workflow shape:
 *
 *   - CSS selectors are STRIPPED. The assistant protocol is selector-free on
 *     the wire (plan ARCH LOCK): a step exposes a semantic `elementId` derived
 *     from `data-copilot="X"` → `X`. Non-registry targets (e.g. raw nav[...])
 *     yield no elementId.
 *   - Each guide → one Workflow keyed by the screenKey(s) it belongs to, using
 *     the SAME pathname→guide rules CopilotProvider uses (translated to the
 *     assistant screenKey vocabulary from useAssistantHints).
 *
 * Progress (current step index) is read from `workflow_progress` per user — the
 * APPLICATION owns progression; the assistant only reads and narrates it.
 *
 * Server-only. Pure functions for the static mapping (no I/O); the DB read for
 * live progress is isolated in getWorkflowProgress().
 */

import { COPILOT_GUIDES } from '@/app/components/copilot/guides';
import { COPILOT_GUIDES_GENERIC } from '@/app/components/copilot/guides.generic';
import type { CopilotGuide, CopilotStep } from '@/app/components/copilot/types';
import { createAdminClient } from '@/app/lib/supabase/admin';

// ---------------------------------------------------------------------------
// Semantic workflow shape (selector-free, safe for the model)
// ---------------------------------------------------------------------------

export interface WorkflowStep {
  /** Stable step id (from the source guide). */
  id: string;
  /** Short human title. */
  title: string;
  /** What to do at this step (selector-free instruction). */
  instruction: string;
  /**
   * Semantic registry element id this step refers to, if any. Derived from
   * `data-copilot="X"` → "X". Undefined when the target isn't a registry id.
   */
  elementId?: string;
  /**
   * In-app path this step belongs to (from the source guide's `page` field),
   * e.g. "/quotes/new". Used to anchor the starting step to the user's actual
   * screen when DB progress is empty/behind, so Guide-me doesn't coach the user
   * backwards to an earlier step on a different page.
   */
  screenPath?: string;
  /** 1-based position for narration ("step 3 of 7"). */
  index: number;
}

export interface Workflow {
  workflowId: string;
  title: string;
  description: string;
  /** Trade this workflow belongs to: 'roofing' | 'generic' | 'any'. */
  trade: 'roofing' | 'generic' | 'any';
  steps: WorkflowStep[];
  stepCount: number;
}

export interface WorkflowProgress {
  workflowId: string;
  /** 0-based index of the current step (clamped to range). */
  currentStepIndex: number;
  completed: boolean;
}

// ---------------------------------------------------------------------------
// Guide → semantic workflow mapping
// ---------------------------------------------------------------------------

/** Pull a registry elementId out of a Copilot `target` selector, if present.
 *  e.g. `[data-copilot="nav-components"]` → "nav-components". Anything else
 *  (raw element/aria selectors) → undefined (no semantic id on the wire). */
function elementIdFromTarget(target: string): string | undefined {
  const m = /\[data-copilot="([^"]+)"\]/.exec(target);
  return m ? m[1] : undefined;
}

function mapStep(step: CopilotStep, index: number): WorkflowStep {
  return {
    id: step.id,
    title: step.title,
    instruction: step.description,
    elementId: elementIdFromTarget(step.target),
    screenPath: step.page,
    index: index + 1,
  };
}

/**
 * The in-app path a screenKey corresponds to, used to anchor the starting step
 * to the user's actual page. Mirrors useAssistantHints.pathnameToScreenKey in
 * reverse for the cases where a workflow spans multiple pages and the user can
 * land mid-flow. Returns null when the screen doesn't need anchoring.
 */
function screenPathForKey(screenKey: string): string | null {
  switch (screenKey) {
    case 'quote.new':
      return '/quotes/new';
    default:
      return null;
  }
}

/**
 * Find the index of the first step whose `screenPath` matches the user's
 * current screen. Returns -1 when no step is anchored to this screen (so the
 * caller falls back to normal progress).
 */
function firstStepIndexForScreen(
  workflow: Workflow,
  screenKey: string
): number {
  const path = screenPathForKey(screenKey);
  if (!path) return -1;
  return workflow.steps.findIndex((s) => s.screenPath === path);
}

function mapGuide(
  guide: CopilotGuide,
  trade: 'roofing' | 'generic'
): Workflow {
  const steps = guide.steps.map(mapStep);
  return {
    workflowId: guide.id,
    title: guide.name,
    description: guide.description,
    trade,
    steps,
    stepCount: steps.length,
  };
}

/** Build the per-trade workflow index once at module load (pure, no I/O). */
function buildIndex(): Record<'roofing' | 'generic', Map<string, Workflow>> {
  const roofing = new Map<string, Workflow>();
  for (const g of COPILOT_GUIDES) roofing.set(g.id, mapGuide(g, 'roofing'));
  const generic = new Map<string, Workflow>();
  for (const g of COPILOT_GUIDES_GENERIC) generic.set(g.id, mapGuide(g, 'generic'));
  return { roofing, generic };
}

const WORKFLOW_INDEX = buildIndex();

function guidesForTrade(trade: string): Map<string, Workflow> {
  return trade === 'roofing' ? WORKFLOW_INDEX.roofing : WORKFLOW_INDEX.generic;
}

// ---------------------------------------------------------------------------
// screenKey → workflowId  (mirrors CopilotProvider's pathname→guide rules,
// translated into the assistant screenKey vocabulary from useAssistantHints)
// ---------------------------------------------------------------------------

/**
 * Resolve which workflow a screen maps to. Returns a workflowId or null.
 *
 * screenKey vocabulary (useAssistantHints.pathnameToScreenKey):
 *   quote.takeoff | quote.labor | quote.build | quote.summary | quote.customer
 *   quotes | components | templates | customer-quote-templates | flashings
 *   material-orders | catalogs | attachments | account | home | <slug-rest>
 *
 * Note: the create-quote walkthrough spans /quotes (hub) -> /quotes/new (form).
 * useAssistantHints distinguishes them: "quotes" = the hub landing (start at
 * step 1, "click Quotes / + New Quote"), "quote.new" = the new-quote form
 * (anchor to the customer-details step). Both resolve to the same create-quote
 * workflow; resolveCurrentStep() anchors the starting step to the screen so the
 * user isn't coached backwards. The quote-builder guide is reached at
 * quote.build.
 */
export function workflowIdForScreen(screenKey: string): string | null {
  switch (screenKey) {
    case 'components':
      return 'components';
    case 'quote.takeoff':
      return 'digital-takeoff';
    case 'quote.labor':
      return 'labor-sheet';
    case 'quote.summary':
    case 'quote.customer':
      return 'customer-labor';
    case 'quote.build':
      return 'quote-builder';
    case 'quotes':
    case 'quote.new':
      return 'create-quote';
    case 'flashings':
      return 'flashings-orders';
    case 'material-orders':
      return 'material-orders-hub';
    case 'account':
      return 'account-settings';
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Public accessors (static; pure)
// ---------------------------------------------------------------------------

/** Get a workflow by id for the given trade, or null. */
export function getWorkflow(
  workflowId: string,
  trade: string
): Workflow | null {
  return guidesForTrade(trade).get(workflowId) ?? null;
}

/** Get the workflow that applies to a screen for the given trade, or null. */
export function getWorkflowForScreen(
  screenKey: string,
  trade: string
): Workflow | null {
  const id = workflowIdForScreen(screenKey);
  if (!id) return null;
  return getWorkflow(id, trade);
}

/** Get a single step (0-based) from a workflow, or null if out of range. */
export function getWorkflowStep(
  workflow: Workflow,
  stepIndex: number
): WorkflowStep | null {
  if (stepIndex < 0 || stepIndex >= workflow.steps.length) return null;
  return workflow.steps[stepIndex];
}

// ---------------------------------------------------------------------------
// Live progress (DB) — application owns progression; assistant only reads it
// ---------------------------------------------------------------------------

/**
 * Read the user's progress for a workflow from `assistant_workflow_progress`.
 *
 * SCHEMA REALITY (mirrors copilot_progress — one row PER USER, not per
 * workflow): `current_workflow` (id), `current_step` (step ID, not an index),
 * `workflows_completed` (array of finished workflow ids). We translate the
 * stored step id into a 0-based index against the workflow definition.
 *
 * Returns a default (step 0, not completed) when there's no row, the user is
 * mid a DIFFERENT workflow, or the stored step id no longer exists. Fail-soft:
 * any DB error returns the start, never throws, so Guide-me degrades to
 * "explain step 1" rather than erroring the whole turn.
 */
export async function getWorkflowProgress(
  userId: string,
  workflow: Workflow
): Promise<WorkflowProgress> {
  const fallback: WorkflowProgress = {
    workflowId: workflow.workflowId,
    currentStepIndex: 0,
    completed: false,
  };
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('assistant_workflow_progress')
      .select('current_workflow, current_step, workflows_completed')
      .eq('user_id', userId)
      .maybeSingle();
    if (error || !data) return fallback;
    const row = data as {
      current_workflow: string | null;
      current_step: string | null;
      workflows_completed: string[] | null;
    };

    const completed = (row.workflows_completed ?? []).includes(
      workflow.workflowId
    );

    // Only honour current_step if the user is actually inside THIS workflow.
    let currentStepIndex = 0;
    if (row.current_workflow === workflow.workflowId && row.current_step) {
      const idx = workflow.steps.findIndex((s) => s.id === row.current_step);
      if (idx >= 0) currentStepIndex = idx;
    }

    return { workflowId: workflow.workflowId, currentStepIndex, completed };
  } catch {
    return fallback;
  }
}

/**
 * Convenience: resolve the current step a user is on for a screen, combining
 * the static workflow with live progress. Returns null when no workflow maps
 * to the screen. The returned step index is clamped to the workflow range.
 */
export async function resolveCurrentStep(
  userId: string,
  screenKey: string,
  trade: string
): Promise<{
  workflow: Workflow;
  progress: WorkflowProgress;
  currentStep: WorkflowStep | null;
  nextStep: WorkflowStep | null;
} | null> {
  const workflow = getWorkflowForScreen(screenKey, trade);
  if (!workflow) return null;
  const progress = await getWorkflowProgress(userId, workflow);

  // Screen anchoring: if this screen owns a later step than the stored progress
  // (e.g. user is on /quotes/new but progress is still at step 1 "click
  // Quotes"), start at the first step that belongs to THIS screen. This stops
  // Guide-me coaching the user backwards to a control on a previous page. We
  // only ever anchor FORWARD — never override progress that's already ahead.
  const anchorIdx = firstStepIndexForScreen(workflow, screenKey);
  const baseIdx =
    anchorIdx > progress.currentStepIndex ? anchorIdx : progress.currentStepIndex;
  const idx = Math.min(baseIdx, workflow.steps.length - 1);
  return {
    workflow,
    progress,
    currentStep: getWorkflowStep(workflow, idx),
    nextStep: getWorkflowStep(workflow, idx + 1),
  };
}
