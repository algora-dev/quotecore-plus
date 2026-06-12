/**
 * Option-A guide-launch bridge.
 *
 * Lets any client surface (the Tutorials page, a help link, a button) start an
 * existing Q guide WITHOUT an LLM round-trip. We dispatch a window CustomEvent;
 * AssistantWidget listens, opens the assistant panel, and calls
 * engine.startWorkflow(workflowId, location.pathname) - reusing all existing
 * step / highlight / nav-hop logic. Zero tokens, instant, deterministic.
 *
 * IMPORTANT (nav-highlight blocking fix): when a caller ALSO navigates the user
 * to the workflow's start page (e.g. the Tutorials "Walk me through with Q"
 * button), we must start the guide ONLY AFTER the route has actually landed on
 * that page. Otherwise startWorkflow reads the OLD pathname, decides the user
 * still needs to "go to the start page", and highlights a top-nav button - and
 * that highlight, applied mid-navigation, ends up swallowing the user's first
 * click on the nav (the "nav is 100% blocked" bug). By waiting for the expected
 * path first, the engine sees the user is already on the start page, emits NO
 * nav hop, and begins at the first real on-page step.
 */

export const START_GUIDE_EVENT = 'qcp:start-guide';

export interface StartGuideDetail {
  workflowId: string;
}

/** Fire the start-guide event immediately. */
export function startGuide(workflowId: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<StartGuideDetail>(START_GUIDE_EVENT, {
      detail: { workflowId },
    })
  );
}

/**
 * Start a guide AFTER the SPA route has settled on `expectPathPrefix`.
 *
 * Polls `location.pathname` until it starts with the expected target path (the
 * navigation we kicked off has landed), then dispatches the start-guide event.
 * Falls back to firing anyway after `timeoutMs` so a path mismatch never leaves
 * the guide unstarted.
 */
export function startGuideAfterNavigation(
  workflowId: string,
  expectPathPrefix: string,
  timeoutMs = 2500
): void {
  if (typeof window === 'undefined') return;
  const start = Date.now();
  const tick = () => {
    const here = window.location.pathname;
    const landed = here === expectPathPrefix || here.startsWith(expectPathPrefix + '/');
    if (landed || Date.now() - start >= timeoutMs) {
      // One more frame so the destination layout has painted its nav + anchors
      // before the engine resolves the first step.
      requestAnimationFrame(() => startGuide(workflowId));
      return;
    }
    window.setTimeout(tick, 60);
  };
  // Give the router a beat to begin the transition before first check.
  window.setTimeout(tick, 60);
}
