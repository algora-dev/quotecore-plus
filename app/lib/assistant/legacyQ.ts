/**
 * Kill switch for the legacy Q chatbot in the main app (owner directive
 * 2026-10-17: Q's knowledge is out of sync with the redesigned app, so hide
 * him everywhere in-app until he is refreshed). The marketing-side switch
 * lives in app/(marketing)/layout.tsx (d2fe77ed).
 *
 * Gates: the AssistantWidget mount in the (auth) workspace layout, the Q
 * Assistant tab in Account settings, and the Q CTA on Tutorials. Smart
 * Assistant (V2) is NOT gated by this flag.
 *
 * Flip to true to re-enable: widget mount, settings tab and tutorials CTA
 * all come back with no further code changes.
 */
export const LEGACY_Q_ENABLED = false;
