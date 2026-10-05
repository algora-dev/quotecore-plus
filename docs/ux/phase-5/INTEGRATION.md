> Historical first Phase 5 style pass. Superseded by `../phase-5-final/README.md`; its tests and behavior descriptions are not final-pass evidence.

# Gavin integration — Phase 5

## Baseline and merge

Use `quotecore-plus-phase5-ux-handoff-2026-09-25.zip` as the three-way comparison base. This is the entire returned repository, not a patch. If your branch has advanced, port the explicit presentation diffs in `FILE_CHANGES.json`; do not overwrite your newer Takeoff, mobile, Assistant or backend work. There were no root INTEGRATION_UPDATE.md or AGENT_BRIEF.md files in this incoming ZIP. AGENTS.md, BRANDING.md, DESIGN_CHANGES.md, retained phase notes and the v2.4 standard were read; newer scoped v2 standards supersede the historical branding recipe.

No dependency, config, database, migration, API or server-action change is required. Root AGENTS asks for bundled Next guides; node_modules/next/dist/docs was not supplied. No new Next API was introduced. Existing navigation/import contracts remain. Dependencies could not be installed in this isolated environment; do not treat syntax/layout evidence as an app build.

## Land as one UI phase, review in bounded pieces

1. C55/T05 `QcDocumentWorkspace.tsx` + `qc-document.css`: header, save-state display, mounted hideable editor panel, non-collapsing sections and one live-preview island. The sole effect is focus handoff when the user hides/reopens the panel. No persistence, request, calculation or route owner in the shared component.
2. Customer Quote, Invoice and Line-by-line Order migrate to those slots without merging their controllers. Quote retains manual save, preview-pencil editing, templates, margins/taxes and labour-sheet props. Invoice retains inline line editing, existing Items/Details/Activity states, autosave, separate payment save, status actions and PDF selector. Line Order keeps its isolated envelope and live items/footer/tax preview, which is **not** the complete saved order header.
3. Visual Order uses the same frame. Supplier/company/template/header editing moves into Order details in the left panel; components, measurements and images retain their specialised editor. One/two-column controls move to the preview bar. Existing layoutMode state and save payload are unchanged. The up-front picker now emits `line_by_line` or `single`; historical `double` links and stored modes still load through the unchanged loader. There is no conversion between content families.
4. C56 is an **optical CSS adapter only**, not C53, not a native-dialog wrapper and not a new overlay controller. Legacy AI/add/header/payment/sending forms keep their current open/close, dirty, validation and pending policy. The existing C27 is used for the order-type picker, full-size Quote preview and opted-in ConfirmModal. Nothing scopes C53 at an app root. The drawing/image selector has an opt-in v2 native-button option list (two order callers); filtering, outside-click timing and onChange values remain intact.

## Explicit presentation exceptions

- Orders create/page.tsx changes only its returned outer wrapper from viewport-clipping height/overflow to min-w-0. All loaders, authentication and data expressions are untouched.
- Visual componentsPanelCollapsed starts false at every width instead of a window-width expression. The panel stays mounted and can always be restored from the preview toolbar. No hydration-dependent viewport branch remains for that UI flag.
- Invoice's formerly conditional editor subtree now remains mounted while hidden. Existing controllers and tab conditions remain; verify local field/selection state when reopened.
- Full-size Quote preview now receives the same existing quantity/price/totals/margin display inputs as the live preview. It previously omitted some. Renderer calculation logic is unchanged; this is display parity, not a new financial calculation.
- QuotePreview.tsx changes **only three accessible names on its interactive pencils**. InvoicePreview.tsx and LineEditForm.tsx are byte-unchanged. CSS reaches preview form controls/buttons but does not recolour or rewrite ordinary recipient text, images or numeric output. New width/scroll framing still requires PDF/print comparison.
- Existing omitted native button type semantics are retained explicitly when replacing a button with C01. Do not change these to implicit default button behavior during integration.

## Source proof versus runtime proof

All 196 original JSX event-handler expressions in the four main editors survive (three presentation bindings added in Quote); all original disabled expressions, field bindings and guide selectors survive. Quote, Invoice and Line Order pre-return executable statements compare identically after comment/whitespace normalisation. Visual Order differs only in the documented collapsed-state initializer, apart from its JSX header helper. This does not prove DOM propagation, scheduling, focus, hydration or persistence correctness.

No app build, full typecheck/lint, authenticated browser, real PDF export, send, payment, database or e2e test ran here. Static specimens use inert hook shims and fictional data. Actual React/Next validation belongs to your gate below.

## AGENT-TODO — existing owned behaviour, deliberately not fixed

**P5-SAVE-01 (high):** Quote handleSave catches failures without returning success/failure. Save & return callers still navigate after awaiting it. Please add an explicit success contract/route gate in owned code and test a failed write. No new guard was silently introduced here.

**P5-PAY-01 (high):** Invoice payment details use handleSavePaymentDetails separately; general autosave/save/send does not persist those fields. The UI explicitly says so and marks unsaved payment details. Decide and implement any unified save/send barrier separately; test leave/send with dirty payment fields.

**P5-AUTO-01:** Invoice's existing 2-second autosave swallows rejection and does not set the manual saving flag. The new header shows owner-supplied dirty/last-save state, not a fabricated live autosave progress indicator. Review failure/retry and toggles in the actual app. Do not alter timers/dependencies casually in this UI merge.

**P5-TAX-01:** Invoice taxTotal is still zero in this source (with the existing future-tax comment). No invoice tax editor or calculation was invented to mimic Quote/Order capabilities. Validate quote-to-invoice amounts through the existing owned pipeline.

Customer link opening still marks a draft invoice sent; the new copy makes that side effect explicit. Sending components and guards were not rewritten. Order Save stays its current flow; preview of a saved order is not an unsaved live/public link.

## Runtime/owner gate

Install/build/typecheck/lint with the locked dependencies in your environment, then follow PARITY_CHECKLIST.md. Both preview and production share production Supabase; use approved fixtures and explicitly controlled writes. Never run indiscriminate send/payment/status tests on real customer records. Test actual email/link/PDF paths only with owner-approved recipients.

Review the five formats together in-browser. Phase 5 is one review phase; do not claim approval from static fixtures. Once integrated, provide a newer ZIP as the only baseline for further work.
