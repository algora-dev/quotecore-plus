# Assistant UI adapter and future shell contract

Authority: supplied `QuoteCore-Plus-UX-Handoff-v2.0/` design package, particularly `docs/QUOTECORE_PLUS_UI_STANDARD.md`, `design/tokens.json`, `design/qc-tokens.css`, `design/qc-recipes.css`, and component registry C01/C09/C10/C13/C18/C30/C41. The P0 implementation is constrained to the assistant-owned trees.

## What P0 uses

Only the new permission settings and read-only admin summary opt into these styles. Existing identity/knowledge controls, the launcher, the live chat, account shell, admin access-control panel and global stylesheet are unchanged. There is no broad restyling of an unmigrated page.

The source archive has no installed `app/components/ui/v2/QcButton.tsx` or other registered V2 primitives. This directory is a deliberately scoped compatibility adapter, not a second app-wide design system. Its token declarations are copied without changing values from the supplied generated CSS; the selector is a CSS-module `.scope` class rather than a global root. The CSS is loaded only by the new P0 surfaces and cannot style unrelated buttons or inputs.

| Registry contract | P0 implementation | Integration target |
|---|---|---|
| C01 QcButton | `AssistantButton.tsx`, primary/ghost subset, native props/ref, explicit pending lock | Replace with the shared QcButton when it exists on the UX branch; preserve callbacks, pending state and accessible naming. |
| C09 QcChoice / C10 QcSegmentedControl | Native fieldset/legend/radio groups in `AssistantPermissionsPanel.tsx` | Three labelled choices, not a drag-only range slider. Keep Hidden/View/Edit values and the explicit Save transaction. |
| C13 QcStatusBadge | Prepared/read-only metadata badges | Do not imply a permission is currently enforced. |
| C18 QcSurface | Solid permission card | Never add glass behind the settings copy. |
| C30 QcNotice / C45 QcSaveState | Visible staged-only warning, errors, conflict, dirty and acknowledged-save states | Critical messages stay inline, never just a toast. |

The primary action has the exact GR-01 orange gradient and dark labels. Controls retain a minimum 44px touch target, named focus ring, 12px control/16px surface radii, restrained pointer-hover glow, native radio keyboard handling and forced-colours/reduced-motion rules. No input keyboard is required to set section permissions. No font, icon library or application dependency is added.

**AGENT-TODO:** reconcile these adapters with the parallel UX branch's real C01/C09/C10 implementations before broad migration. Do not move shared files or import a nonexistent primitive just to match the proposed registry path. Review touch layout and focus states in the deployed preview; static code inspection is not visual/device certification.

## Locked owner direction for the later assistant shell (NOT wired in P0)

Keep one stable conversation/controller across show/hide/navigation. Do not implement another assistant engine for voice. Apply these requirements in the next approved navigation/shell phase and the voice phases, not as hidden P0 behaviour changes.

1. Mobile chat fills the usable screen. Its top strip has only an accessible **Hide assistant** control and **Menu** control. A small identity label is optional; no settings, new-chat, model picker, history tabs or usage dashboard across the header. Keep hit targets at least 44px even when the strip is visually quiet.
2. Hide is a view operation, not logout, delete, conversation reset, cancellation of pending confirmation, or end of the staged-action session. Reopening returns to the same task and message position.
3. Preferred input is per user: voice-first shows a clear microphone surface without a permanent text box; text-first shows the composer. Switching input remains available without losing either draft. Do not store a personal input preference in the company permission map.
4. Voice must distinguish idle, recording, stopped/review, sending and error. The owner's interaction is tap to record, tap to stop, then Send. Do not infer consent from merely capturing audio or auto-send an unfinished recording. Implement the agreed voice tiers and locked metering separately at their approved phases.
5. Server-defined response actions are first-class: Open, Confirm, Change, Cancel and short choice sets. Prefer a button over demanding the user type or dictate a predictable answer. Buttons need pending, completed, expired and unavailable states; repeated taps cannot repeat mutations.
6. One navigation button resolves a server-approved internal destination, navigates, then hides the assistant in the same interaction. Keep the pending task available to resume. Model text must never invent arbitrary URLs, cross-tenant destinations or confirmation tokens.
7. When showing a visual result, keep an exact summary and the required confirm affordance in the conversation as well. Navigation itself is read-only; navigation is NOT confirmation of an edit. Failed navigation keeps the assistant accessible with a clear error.
8. No automatic dismissal on backdrop tap. A future menu/dialog uses the design standard's focus/return-focus and layer rules. No nested blur stack; solid message text, optional G-B chrome only.
9. Feature/permission gating remains server-side. Conversational buttons never give a model a bypass to an existing locked action. Maintain `data-clarity-mask` on every chat root and avoid logging transcripts in generic diagnostics.

P0 does not add dead microphone or input-preference controls for functionality it does not yet provide. The current text/voice-note experience stays intact until the approved replacement is implemented.
