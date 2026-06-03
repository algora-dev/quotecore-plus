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
  /** Fetch the step list for a workflow id and start at index 0. */
  startWorkflow: (workflowId: string) => Promise<void>;
  /** Advance to the next step (instant — steps already in memory). */
  next: () => void;
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

  const startWorkflow = useCallback(async (id: string) => {
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
      setWorkflowName(wf.name);
      setStartPage(wf.startPage);
      setSteps(wf.steps);
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
      // No-op if not active or already at/after the last step.
      if (prev + 1 >= steps.length) {
        setStatus('complete');
        return prev; // stay on last; complete state signals end
      }
      setStepKey(nextStepKey());
      return prev + 1;
    });
  }, [steps.length]);

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
    reset,
  };
}
