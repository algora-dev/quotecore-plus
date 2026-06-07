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

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ActiveHighlight } from './useAssistantChat';
import type { DoneSignal } from '@/app/lib/assistant/library/types';
import { pathnameToScreenKey } from './useAssistantHints';
import { loadGuide, saveGuide, clearGuide } from './assistantPersistence';

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
/** One synthetic navigation hop: highlight a control + tell the user to click
 *  it. Each hop is its OWN guide step so the user clicks one thing at a time. */
interface NavHop {
  elementId: string;
  title: string;
  instruction: string;
  /** When set, this hop auto-completes once that elementId appears on screen
   *  (i.e. the destination page rendered). Else it's manual (click Next). */
  appearsTarget?: string;
}

/**
 * The ordered list of navigation hops needed to REACH a workflow's start page
 * from the top nav. Resource Library destinations are TWO hops: open Resources
 * (top nav), then click the section card. Top-level pages are a single hop.
 */
function navHopsForScreenKey(screenKey: string): NavHop[] {
  switch (screenKey) {
    case 'quotes':
    case 'quote.new':
    // The customer-quote editor (catalog-add-to-quote start page) is reached
    // via the Quotes hub — same first hop. No registered quotes-hub arrival
    // anchor exists, so this hop is manual (click Quotes → Next); the important
    // fix is that a highlighted nav hop now EXISTS for this start page at all.
    case 'quote.customer':
      return [{ elementId: 'nav-quotes', title: 'Go to Quotes', instruction: 'Open the Quotes page: click Quotes in the top navigation.' }];
    case 'material-orders':
      // mo-custom-order renders on the orders hub on arrival, so the hop
      // auto-advances the moment the Orders page loads (parity with catalog).
      return [{ elementId: 'nav-orders', title: 'Go to Orders', instruction: 'Open the Orders page: click Orders in the top navigation.', appearsTarget: 'mo-custom-order' }];
    case 'resources':
      // resources-card-attachments renders on the Resource Library hub on
      // arrival, so this hop auto-advances on landing (parity with catalog).
      return [{ elementId: 'nav-resources', title: 'Go to Resources', instruction: 'Open the Resource Library: click Resources in the top navigation.', appearsTarget: 'resources-card-attachments' }];
    case 'resources.catalogs':
      return [
        { elementId: 'nav-resources', title: 'Open the Resource Library', instruction: 'Click Resources in the top navigation to open the Resource Library.', appearsTarget: 'resources-card-catalogs' },
        { elementId: 'resources-card-catalogs', title: 'Open Catalogs', instruction: 'Click the Catalogs card to open your Catalog Library.', appearsTarget: 'upload-catalog' },
      ];
    case 'resources.attachments':
      return [
        { elementId: 'nav-resources', title: 'Open the Resource Library', instruction: 'Click Resources in the top navigation to open the Resource Library.', appearsTarget: 'resources-card-attachments' },
        { elementId: 'resources-card-attachments', title: 'Open Attachments', instruction: 'Click the Attachments card to open your attachment library.' },
      ];
    case 'components':
      return [
        { elementId: 'nav-resources', title: 'Open the Resource Library', instruction: 'Click Resources in the top navigation to open the Resource Library.', appearsTarget: 'resources-card-components' },
        { elementId: 'resources-card-components', title: 'Open Components', instruction: 'Click the Components card to open your component library.' },
      ];
    case 'flashings':
      return [
        { elementId: 'nav-resources', title: 'Open the Resource Library', instruction: 'Click Resources in the top navigation to open the Resource Library.', appearsTarget: 'resources-card-drawings' },
        { elementId: 'resources-card-drawings', title: 'Open Drawings & Images', instruction: 'Click the Drawings & Images card.' },
      ];
    default:
      return [];
  }
}

/**
 * Build the synthetic "navigate to the start page" steps when the user isn't
 * there yet — ONE step per hop (e.g. Resources -> Catalogs card = two steps).
 * Each hop auto-advances when its destination element appears (so clicking the
 * highlighted control moves the guide on), falling back to manual Next.
 * Returns [] when no navigation is needed (already on the right page / unknown).
 */
function buildNavSteps(startPage: string | null, currentPathname: string | null): GuideStep[] {
  if (!startPage) return [];
  const targetKey = pathnameToScreenKey(startPage);
  const currentKey = pathnameToScreenKey(currentPathname);
  if (targetKey === currentKey) return []; // already on the right page
  const hops = navHopsForScreenKey(targetKey);
  return hops.map((hop, i) => ({
    id: `__nav-${targetKey}-${i}`,
    title: hop.title,
    instruction: hop.instruction,
    elementId: hop.elementId,
    page: null, // shown from wherever the user currently is
    doneSignal: hop.appearsTarget
      ? { kind: 'element-appears', elementId: hop.appearsTarget }
      : { kind: 'manual' },
  }));
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
  // Rehydrate an in-progress guide so navigating to the highlighted page (which
  // can remount this hook) doesn't drop the walkthrough mid-flow.
  const restored = typeof window !== 'undefined' ? loadGuide() : null;
  const [status, setStatus] = useState<GuideEngineStatus>(restored ? 'active' : 'idle');
  const [workflowId, setWorkflowId] = useState<string | null>(restored?.workflowId ?? null);
  const [workflowName, setWorkflowName] = useState<string | null>(restored?.workflowName ?? null);
  const [startPage, setStartPage] = useState<string | null>(restored?.startPage ?? null);
  const [steps, setSteps] = useState<GuideStep[]>((restored?.steps as GuideStep[]) ?? []);
  const [currentIndex, setCurrentIndex] = useState(restored?.currentIndex ?? 0);
  // A unique key per (step entry) so the highlight executor re-fires even when
  // two consecutive steps target the same elementId. Seeded on rehydrate so the
  // restored step's highlight fires after a remount.
  const [stepKey, setStepKey] = useState<string>(restored ? nextStepKey() : '');
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
      const navSteps = buildNavSteps(wf.startPage, path);
      const steps = [...navSteps, ...wf.steps];
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
    clearGuide();
  }, []);

  // Persist the active guide (workflow + position) so it survives a remount.
  useEffect(() => {
    if (status === 'active' && workflowId && steps.length > 0) {
      saveGuide({ workflowId, workflowName, startPage, steps, currentIndex });
    }
  }, [status, workflowId, workflowName, startPage, steps, currentIndex]);

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
