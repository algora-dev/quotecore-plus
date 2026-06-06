'use client';

/**
 * useGuideEngine — CLIENT-DRIVEN guided-step engine (Stage 4, Fix 1)
 * ===================================================================
 * Decouples ADVANCING through a guided workflow from the LLM. Once a workflow
 * is confirmed, the CLIENT holds the full step list and drives stepping itself
 * — instant, deterministic, zero LLM tokens. The model is only used when the
 * user actually chats (questions / stuck).
 *
 * Flow:
 *   1. The orchestrator emits a `guide_start {workflowId, startPage}` SSE event
 *      when the model commits to guiding (via the read-only `begin_guide` tool).
 *   2. The widget calls startWorkflow(workflowId): we GET the selector-free
 *      step list from /api/assistant/workflow and set currentIndex = 0.
 *   3. The widget shows a "Next step →" button. next() advances currentIndex
 *      synchronously — the steps are already in memory, so the click is INSTANT
 *      (no fetch/LLM). currentIndex+1 is always "preloaded" by virtue of being
 *      in the same in-memory array.
 *   4. The widget drives the highlight + step message from `current` directly
 *      (NOT an SSE round-trip).
 *   5. Facts-based auto-advance (useBrowserFacts) can call next() before the
 *      user clicks the button, using the current step's doneSignal.
 *
 * The engine is transport-light and DOM-free beyond the fetch. It holds no
 * tenancy state; the endpoint resolves trade from the session.
 */

import { useCallback, useRef, useState } from 'react';
import type { ActiveHighlight } from './useAssistantChat';
import type { DoneSignal } from '@/app/lib/assistant/library/types';
import { pathnameToScreenKey } from './useAssistantHints';

/**
 * Map a workflow's startPage to the SINGLE main-nav control that gets the user
 * there, plus a human instruction. Every guided flow begins by making sure the
 * user is on the right page; if they're not, we inject this as a synthetic
 * step 0 so the walkthrough always starts from the correct location.
 *
 * Keyed by the coarse screenKey of the startPage (via pathnameToScreenKey) so
 * it survives the workspace-slug prefix and the /resources/* nesting. Returns a
 * registered nav elementId to highlight + a plain "how to get there" line.
 */
function navStepForScreenKey(screenKey: string): { elementId: string; title: string; instruction: string } | null {
  switch (screenKey) {
    case 'quotes':
    case 'quote.new':
      return { elementId: 'nav-quotes', title: 'Go to Quotes', instruction: 'First, open the Quotes page: click Quotes in the top navigation.' };
    case 'material-orders':
      return { elementId: 'nav-orders', title: 'Go to Orders', instruction: 'First, open the Orders page: click Orders in the top navigation.' };
    case 'resources':
      return { elementId: 'nav-resources', title: 'Go to Resources', instruction: 'First, open the Resource Library: click Resources in the top navigation.' };
    case 'resources.catalogs':
      return { elementId: 'nav-resources', title: 'Go to Resources → Catalogs', instruction: 'First, open the Resource Library: click Resources in the top navigation, then open the Catalogs card.' };
    case 'resources.attachments':
      return { elementId: 'nav-resources', title: 'Go to Resources → Attachments', instruction: 'First, open the Resource Library: click Resources in the top navigation, then open the Attachments card.' };
    case 'components':
      return { elementId: 'nav-resources', title: 'Go to Components', instruction: 'First, open the Resource Library: click Resources in the top navigation, then open the Components card.' };
    case 'flashings':
      return { elementId: 'nav-resources', title: 'Go to Drawings & Images', instruction: 'First, open the Resource Library: click Resources in the top navigation, then open the Drawings & Images card.' };
    default:
      return null;
  }
}

/**
 * Build a synthetic "navigate to the start page" step when the user isn't there
 * yet. doneSignal is element-appears on the nav control's destination is hard
 * to assert generically, so we use 'manual' (the user clicks Next once they've
 * arrived) — simple and reliable. Returns null when no nav step is needed
 * (already on the right page, or no startPage / unknown mapping).
 */
function buildNavStep(startPage: string | null, currentPathname: string | null): GuideStep | null {
  if (!startPage) return null;
  const targetKey = pathnameToScreenKey(startPage);
  const currentKey = pathnameToScreenKey(currentPathname);
  if (targetKey === currentKey) return null; // already on the right page
  const nav = navStepForScreenKey(targetKey);
  if (!nav) return null;
  return {
    id: `__nav-to-${targetKey}`,
    title: nav.title,
    instruction: nav.instruction,
    elementId: nav.elementId,
    page: null, // shown from wherever the user currently is
    doneSignal: { kind: 'manual' },
  };
}

/** One client-held workflow step (mirrors the endpoint projection). */
export interface GuideStep {
  id: string;
  title: string;
  instruction: string;
  elementId: string | null;
  page: string | null;
  doneSignal: DoneSignal;
}

interface WorkflowResponse {
  workflow: {
    id: string;
    name: string;
    startPage: string | null;
    steps: GuideStep[];
  } | null;
}

export type GuideEngineStatus = 'idle' | 'loading' | 'active' | 'complete' | 'error';

let stepKeySeq = 0;
function nextStepKey() {
  stepKeySeq += 1;
  return `guide-step-${Date.now()}-${stepKeySeq}`;
}

export interface GuideEngine {
  status: GuideEngineStatus;
  workflowId: string | null;
  workflowName: string | null;
  startPage: string | null;
  steps: GuideStep[];
  currentIndex: number;
  /** The step the user is on, or null when not active. */
  current: GuideStep | null;
  /** The PRELOADED upcoming step (currentIndex + 1), or null at the end. */
  upcoming: GuideStep | null;
  /** True while a guided workflow is being walked. */
  isActive: boolean;
  /** Highlight command for the current step's element (drives the executor). */
  currentHighlight: ActiveHighlight | null;
  /** Fetch the step list for a workflow id and start at index 0. Pass the
   *  user's current pathname so the engine can prepend a "get to the start
   *  page" step when they're not already there. */
  startWorkflow: (workflowId: string, currentPathname?: string | null) => Promise<void>;
  /** Advance to the next step (instant — steps already in memory). */
  next: () => void;
  /** Go back one step (instant). No-op at the first step. */
  back: () => void;
  /** True when there is a previous step to go back to. */
  canGoBack: boolean;
  /** Jump directly to a step index (used by Reset's facts-based re-sync). */
  goToIndex: (index: number) => void;
  /** Stop guiding and clear engine state. */
  reset: () => void;
}

export function useGuideEngine(): GuideEngine {
  const [status, setStatus] = useState<GuideEngineStatus>('idle');
  const [workflowId, setWorkflowId] = useState<string | null>(null);
  const [workflowName, setWorkflowName] = useState<string | null>(null);
  const [startPage, setStartPage] = useState<string | null>(null);
  const [steps, setSteps] = useState<GuideStep[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  // A unique key per (step entry) so the highlight executor re-fires even when
  // two consecutive steps target the same elementId.
  const [stepKey, setStepKey] = useState<string>('');
  // Guard against a stale fetch (a newer startWorkflow) overwriting state.
  const loadTokenRef = useRef(0);

  const startWorkflow = useCallback(async (id: string, currentPathname?: string | null) => {
    const token = ++loadTokenRef.current;
    setStatus('loading');
    setWorkflowId(id);
    try {
      const res = await fetch(
        `/api/assistant/workflow?id=${encodeURIComponent(id)}`,
        { headers: { Accept: 'application/json' } }
      );
      if (token !== loadTokenRef.current) return; // superseded
      if (!res.ok) {
        setStatus('error');
        return;
      }
      const data = (await res.json()) as WorkflowResponse;
      if (token !== loadTokenRef.current) return; // superseded
      const wf = data.workflow;
      if (!wf || wf.steps.length === 0) {
        setStatus('error');
        setSteps([]);
        return;
      }
      // EVERY flow begins by getting the user to the correct start page. If
      // they're not already there, prepend a synthetic navigation step so the
      // walkthrough starts from the right location instead of dumping step 1
      // for a page they can't see.
      const path = currentPathname ?? (typeof window !== 'undefined' ? window.location.pathname : null);
      const navStep = buildNavStep(wf.startPage, path);
      const steps = navStep ? [navStep, ...wf.steps] : wf.steps;
      setWorkflowName(wf.name);
      setStartPage(wf.startPage);
      setSteps(steps);
      setCurrentIndex(0);
      setStepKey(nextStepKey());
      setStatus('active');
    } catch {
      if (token !== loadTokenRef.current) return;
      setStatus('error');
    }
  }, []);

  const next = useCallback(() => {
    setCurrentIndex((prev) => {
      // No-op at the last step — stay ACTIVE on it so the guide bar (and its
      // "Finish" button) remains visible. Completion is now an explicit user
      // action (the Finish button -> reset), not an implicit jump on next().
      if (prev + 1 >= steps.length) {
        return prev;
      }
      setStepKey(nextStepKey());
      return prev + 1;
    });
  }, [steps.length]);

  const back = useCallback(() => {
    setCurrentIndex((prev) => {
      if (prev <= 0) return prev; // already at the first step
      setStepKey(nextStepKey());
      return prev - 1;
    });
  }, []);

  const goToIndex = useCallback(
    (index: number) => {
      setCurrentIndex((prev) => {
        const clamped = Math.max(0, Math.min(index, steps.length - 1));
        if (clamped === prev) return prev;
        setStepKey(nextStepKey());
        return clamped;
      });
    },
    [steps.length]
  );

  const reset = useCallback(() => {
    loadTokenRef.current++; // invalidate any in-flight fetch
    setStatus('idle');
    setWorkflowId(null);
    setWorkflowName(null);
    setStartPage(null);
    setSteps([]);
    setCurrentIndex(0);
    setStepKey('');
  }, []);

  const isActive = status === 'active';
  const current = isActive ? steps[currentIndex] ?? null : null;
  const upcoming = isActive ? steps[currentIndex + 1] ?? null : null;
  const canGoBack = isActive && currentIndex > 0;

  // Build the highlight command for the current step's element. Only when the
  // step actually targets a registry element; the executor itself fails safe if
  // the element isn't in the DOM (e.g. an off-page step).
  const currentHighlight: ActiveHighlight | null =
    isActive && current && current.elementId
      ? {
          type: 'highlight',
          elementId: current.elementId,
          treatment: 'glow',
          reason: current.title,
          key: stepKey,
        }
      : null;

  return {
    status,
    workflowId,
    workflowName,
    startPage,
    steps,
    currentIndex,
    current,
    upcoming,
    isActive,
    currentHighlight,
    startWorkflow,
    next,
    back,
    canGoBack,
    goToIndex,
    reset,
  };
}
