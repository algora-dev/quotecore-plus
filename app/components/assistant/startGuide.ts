/**
 * Option-A guide-launch bridge.
 *
 * Lets any client surface (the Tutorials page, a help link, a button) start an
 * existing Q guide WITHOUT an LLM round-trip. We dispatch a window CustomEvent;
 * AssistantWidget listens, opens the assistant panel, and calls
 * engine.startWorkflow(workflowId, location.pathname) — reusing all existing
 * step / highlight / nav-hop logic. Zero tokens, instant, deterministic.
 *
 * Pair with an optional router.push to the workflow's start URL so the user is
 * already on the right page when the guide begins (callers handle navigation).
 */

export const START_GUIDE_EVENT = 'qcp:start-guide';

export interface StartGuideDetail {
  workflowId: string;
}

/** Fire the start-guide event. Safe to call from any client component. */
export function startGuide(workflowId: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<StartGuideDetail>(START_GUIDE_EVENT, {
      detail: { workflowId },
    })
  );
}
