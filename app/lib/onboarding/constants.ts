/**
 * Demo-first onboarding flow (owner 2026-11-13).
 *
 * New free signups are routed straight into the guided demo: a welcome modal
 * with the founder video plays over the demo launcher, a tips modal follows
 * ("finish the first three tasks; add your pricing first in your own
 * workspace"), and two one-time activation nudges fire inside the personal
 * workspace (add pricing -> create first job) with a get-in-touch escape
 * hatch (message / book a call / Done For You).
 */

/** Founder welcome video (mp4). Empty until Shaun's recording is uploaded;
 * the modal then falls back to the Done For You overview video below. */
export const WELCOME_VIDEO_URL = '';

/** Placeholder shown while the founder recording is pending. */
export const WELCOME_VIDEO_FALLBACK_YOUTUBE_ID = 'fJYVEnVTcOA';

/** Marketing surfaces the flow links to (same-origin, so they stay on the
 * right host in testing vs prod). */
export const DFY_PAGE_PATH = '/done-for-you-setup';
export const CONTACT_PAGE_PATH = '/contact';
export const DFY_BOOK_ANCHOR = 'how-it-works';

export function dfyHref(content: string): string {
  return `${DFY_PAGE_PATH}?utm_source=app&utm_medium=onboarding&utm_content=${content}`;
}

export function dfyBookHref(content: string): string {
  return `${DFY_PAGE_PATH}?utm_source=app&utm_medium=onboarding&utm_content=${content}#${DFY_BOOK_ANCHOR}`;
}

export function contactHref(content: string): string {
  return `${CONTACT_PAGE_PATH}?utm_source=app&utm_medium=onboarding&utm_content=${content}`;
}

// --- Activation nudge timings (owner 2026-11-13) ---
/** Pricing nudge: 12 min after the first personal-workspace visit... */
export const PRICING_NUDGE_AFTER_VISIT_MS = 12 * 60_000;
/** ...or 30 min after signup, whichever comes first. */
export const PRICING_NUDGE_AFTER_SIGNUP_MS = 30 * 60_000;
/** First-quote nudge: 45 min after the first workspace visit, only once
 * pricing exists and no job has been created. */
export const QUOTE_NUDGE_AFTER_VISIT_MS = 45 * 60_000;
