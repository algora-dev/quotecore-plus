# Phase 5 final | UI standard 2.6

Contextual, document-first editing and professional output, superseding the first Phase 5 style pass. C55/C58 provide one stable inspector and interactive document; C59/C60 provide clean output with excluded selection controls. Four specialised editors retain independent business owners. See `docs/ux/phase-5-final/README.md` and `RETURN_NOTES.md`. Integration/runtime/owner review pending; core tokens unchanged.

---

# Phase 3 | UI standard 2.3

Latest owner decision: **Job Spaces is additional; Quotes and its Drafts tab stay where they are. No /quotes redirect.** This overrides the earlier draft-only split proposal.

- C50 QcSidebarTab: one orange edge tab for expanded/fully hidden desktop navigation; narrow face, 44px target, visible hover/focus/pressed. Internal rail is not a user-facing mode. Preserve real /q-mark.png.
- Slide sidebar/tab with transform/position only; do not animate main/grid/canvas width or remount the workspace. Normal editors now follow expanded/hidden preference; takeoff remains hidden by default.
- C51 JobSpacesList: existing non-draft quote projection, clean row cards, status/updated metadata, search/filter/sort, read-only actions. Quotes retains all draft/creation/bulk/status tools.
- Existing Summary supports an allowlisted from=job-spaces return while preserving Quotes and Inbox origins.
- Palette, gradient/glow/glass tokens and IF-01 remain unchanged. New controls reuse them; no additional orange shades or isolated button recipe.
- Mobile drawer gets a scrolling middle and non-overlapping explicit close footer; no new mobile takeoff flow.

Current contracts and integration gates: docs/ux/phase-3/README.md. Phase 3 is a candidate until Gavin's build/runtime checks and owner preview pass. Historical rules below yield to the current phase where navigation/defaults differ.

---

# Phase 2A + 2B | UI standard 2.2

Owner-approved scope: global collapsible shell, task-led Home, real card-based Job Space. This section supersedes the earlier Phase 2 document-first direction. It does not change the integrated four-step quote builder or add Guided/project-management functionality.

- Shared C23/C24 shell owns navigation, utility header and width modes. Normal expanded, dense rail, takeoff hidden; one stable children tree, no route-refresh effects. Mobile uses a full-label explicit-dismissal side sheet.
- C48 Home leads with quote creation/measurement and continuation; setup resources remain secondary. Missing recent data is a working Quotes route, never fabricated empty/company data.
- C22/C47/C11 Job Space is a persistent quote/job hub. Costing document is a separate section; cards show actual capability state and explicit next actions. Customer document and private internal numbers are clearly different.
- White solid data surfaces, orange gradient for a single task-level primary, warm glass/frost only for appropriate chrome/overlays. No giant summary preview as the hub hero.
- IF-01: every custom enabled control has visible hover, keyboard focus and pressed feedback. Retain orange wash and reinforce the ghost/glass boundary with orange-ink for visibility. Disabled/pending wins. Palette and pricing are unchanged.
- No fake Schedule/Tasks/Team controls. The capability-card and section contracts provide a place to extend later when services exist.

Full code/visual traceability: `docs/ux/phase-2ab/COMPONENT_MAP.md`, `SHELL_CONTRACT.md`, `CAPABILITY_PARITY.csv` and `STATIC_VALIDATION.md`. Application runtime validation remains pending.

---

## Prior Phase 1 design record (retained)

# DESIGN_CHANGES - QuoteCore+ Phase 1 redo

Date: 2026-09-24. Status: implementation candidate for isolated preview, not production approval.

This file supersedes the old page-level visual rules only on the Phase 1 builder surfaces marked `data-qc-ui="v2"`. `docs/DESIGN_SYSTEM.md` remains unchanged and continues to govern unmigrated pages. AGENT_BRIEF.md overrides historical design-package phase suggestions and protects all business behavior.

## What is in this phase

The existing Areas / Components / Extras / Review flow is restyled. Manual entry and digital takeoff results still use the same original builder routes and state owners. No Guided/Fast model is invented. No sidebar, summary-to-Job-Space rename, customer editor, AI scan, canvas geometry or mobile takeoff flow is changed.

## Brand and surface standard

| Role | Exact value | Use |
|---|---|---|
| Core orange | #FF6B35 | Identity / reference brand colour |
| Vivid orange | #FF641F | Primary gradient start |
| Bright orange | #FF8A3D | Primary gradient midpoint |
| Light orange | #FFB36B | Primary gradient end |
| Orange tint | #FFE6D2 | Small selection boundaries |
| Orange wash | #FFF4EB | Selected UI background |
| Orange ink | #B63D0A | Contrast-safe small text / focus; never a large decorative brown fill |
| Primary ink | #191B20 | Main text, dark labels on orange gradient |
| Body / secondary | #303641 / #596273 | Reading hierarchy |
| App / card | #F6F7F9 / #FFFFFF | Quiet surfaces |
| Divider / input border | #DDE1E7 / #7C8798 | Different jobs, not interchangeable |

All values are in `app/components/ui/v2/qc-tokens.css`, matching the approved token set. GR-01 is 135deg, #FF641F at 0%, #FF8A3D at 55%, #FFB36B at 100%. Labels are dark, not low-contrast white on the pale end of the gradient. Its brighter hover and pressed variants are also the approved tokens.

GL-01 glow is confined to primary hover: 0 4px 14px rgba(255,107,53,.20). No pulsing glow, large glowing card borders or animated money panels. Keyboard focus has a separate visible 2px orange-ink outline with a white gap.

G-A frosted overlay uses rgba(246,247,249,.55), blur12px and saturation1.05. It softens the background while retaining context. The dialog itself is near-opaque white (.98), so amounts and warnings remain readable. Without blur support or with reduced-transparency/forced-colour preferences, it falls back to the solid/fallback tokens. It never implies click-to-dismiss.

G-B interactive glass uses white .90, blur16px, saturation1.12 and the inset white highlight. In this phase it is used on workflow chrome and the takeoff shortcut. Normal quote cards, forms, tables and financial totals remain solid. Canvas and assistant glass belong to later phases.

## Shape, type and density

System sans stack from the approved tokens; no fonts or dependencies added. Page title28/36 at weight600, phone24/32. Section title20/28; group title16/24; body14; help13/20. Financial values use tabular numerals. Existing currency/unit formatters remain the only formatting authority.

Control radius12px, small embedded controls8px, data cards16px, dialogs20px. Pills are used for small statuses, not every action. Controls are40px by default,32px compact on fine-pointer desktop,44px minimum on phone/coarse pointer. Phone numeric inputs are16px. Danger remains red; confirming an area retains green; selection is also expressed in text/aria state, not only colour.

## Layout decisions

The builder can use up to1440px while the existing global header is unchanged. The quote identity is first. Takeoff and files share a compact contextual row; opening files gives them full width. Then the original four steps and current content.

At1280px+ the current-total panel sits beside the workspace, becoming sticky only when the viewport is also at least760px tall. On narrower screens it becomes a compact in-flow summary. No desktop/phone duplicate form trees, fixed mobile action footer or conditional mobile remounting is introduced. Review tables scroll inside their own named region instead of widening the page.

Component names, actual/priced quantities and costs are visible in the disclosure header. Removal is a separate named button, not nested inside the disclosure. Existing Plan/Actual, pitch, area assignment, all numeric entry modes, combine/split and per-entry removal stay available inside. A stable Fragment key fixes one missing-key presentation warning without changing entry state.

## Copy decisions

"+" library action now reads "Add component". Area confirmation reads "Confirm area". Main workflow labels remain the existing four steps. None of these labels rename a database field, route or exported API.

The previous assurance that margins are never visible to customers is replaced with an instruction to review visibility in the existing customer quote editor. No privacy rule is invented. Review explains the existing saved-margin versus edited-margin-preview distinction instead of presenting stale tax/grand total as a new live calculation.

## Implementation map and validation

See [COMPONENT_CONTRACTS.md](docs/ux/phase-1/COMPONENT_CONTRACTS.md), [PARITY_CHECKLIST.md](docs/ux/phase-1/PARITY_CHECKLIST.md), and [STATIC_VALIDATION.md](docs/ux/phase-1/STATIC_VALIDATION.md). The ZIP-root RETURN_NOTES.md is Gavin's entry point.

The standalone [visual reference](docs/ux/phase-1/visual-reference.html) embeds the actual CSS with synthetic HTML/data. It is not the app, does not save, and is not runtime parity evidence.


## Phase 4 | Desktop Digital Takeoff | 24 September 2026

Implementation candidate against the integrated Phase3 baseline. Fitted desktop host; grouped persistent tools; areas/components hierarchy; separate library/measurement disclosure; scoped standard dialogs and entry/upload styling. C52/C53/C54 added; no palette changes. Reset takeoff moved away from zoom. All original workstation executable statements/event/disabled expressions preserved; only a presentation disclosure state is added. Mobile engine/layout modules, server/API/app-lib, Builder, shell and Smart Assistant remain untouched. Native dialog and shared canvas layout effects require Gavin's runtime gates. See docs/ux/phase-4/README.md. Not built, deployed or owner-preview-approved here.
