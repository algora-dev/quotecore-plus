# Gavin integration — final Phase 5

## Merge safely

This is a complete repository return, not a patch. Compare against `quotecore-plus-phase5-ux-handoff-2026-09-25.zip`. If your branch is newer, three-way merge the files in FILE_CHANGES.json. Never replace your branch wholesale or overwrite subsequent Takeoff, mobile, Assistant or backend fixes. The original 2,505 baseline files are retained. Unlisted original files match byte-for-byte.

Root AGENTS.md, BRANDING.md, DESIGN_CHANGES.md and development/phase notes were read. This incoming archive has no root AGENT_BRIEF.md or INTEGRATION_UPDATE.md. Its AGENTS requests bundled Next docs; node_modules was absent. No new Next API, dependency or configuration was introduced. The scoped v2 standard takes precedence over historical branding recipes.

## Review order

1. Shared C55/C58 chrome and C59/C60 clean renderers. Selection owns only UI target and local uncommitted-draft protection. It must never become an alternative invoice/quote/order state store.
2. Quote/Invoice inspectors. Compare detailed LineEditForm margin defaults with the former QuotePreview bindings. Global/live-versus-stored fallback and original callbacks are retained. Invoice payment details still have their own Save action and explicit warning.
3. Order family picker, line editor and embedded component editor. Existing storage values `line_by_line`, `single`, `double` remain. No family conversion. The render-only camel/snake projection does not change the save payload.
4. Authenticated/public output and bundle renderer call sites. Only returned markup/render props change in server pages/client export wrappers. Token checks, view stamping, expiry, attachments and action handlers are retained. Public Invoice receives only its existing record/lines; QuotePreview is a server-compatible pure renderer on public quote pages (do not move full quote rows across a new client boundary).
5. Resolve AGENT_TODOS.md and run RUNTIME_CHECKLIST.md before production or owner sign-off.

## Output contracts

Selection borders live on excluded overlay buttons, never on captured document data. The buttons carry `data-html2canvas-ignore` and `data-exclude-pdf`; print hides them. Empty/add affordances are in the toolbar/inspector, not standalone PDF segments. Totals have a full-width outer capture block. Visual Order has an invisible second cell for an odd final two-column row, preventing the existing segmented exporter from scaling the final half-width card to a full sheet. Invoice payment/notes form an equal-column row for the same exporter. Extreme long cards/notes and real image/CORS capture remain actual-helper gates.

The clean renderers do not recompute financial values from rendered text. Quote/Invoice receive the original controller or saved-provider totals. OrderBody continues using its original order parsers/tax functions. Hiding a quote/invoice item can still contribute to its total; a hidden Line Order item does not. Preserve that difference.

## What was and was not tested

See VALIDATION.md. Syntax, source comparisons, fixture layout, isolated real React DOM interactions and native browser-print specimens were checked. The local React harness is 18.2 with a bundled ReactDOM build, **not** the application's pinned dependencies. Original data/persistence/lifecycle effects were deliberately disabled in that harness. No Next build, authoritative full TypeScript/lint run, authenticated application, actual html2canvas/jsPDF capture, email, DB write, payment or integration test ran here.

Preview and production share Supabase. Use owner-approved fixture records/recipients for controlled save/send/status checks; do not run broad writes or send to real customers. The complete UX-standard v2.6 package travels with this return. Earlier static specimens and proofs are historical, not evidence for the final implementation.
