# Phase 8 return: polish and feedback

**This contains the implemented UX Phase 8 changes, not a Phase 7-only tree or an audit-only handoff.**

Read `docs/ux/phase-8/INTEGRATION.md`, `FILE_CHANGES.json`, `DECISIONS.md`, `AGENT_TODOS.md`, `VALIDATION.md` and `RUNTIME_CHECKLIST.md`.

Baseline: `quotecore-plus-phase8-ux-handoff-2026-09-27.zip`, SHA-256 `3419f46b37938caa0d4cd33daa3cf74195722b7d3c857cba16c767344c3869bf`. Outer handoff says `a2595922`; inner Phase7 note is older. Three-way merge against archive bytes and Gavin's newest branch; do not overwrite newer work.

24 modified production files + 2 new files. Examples: `app/components/ui/v2/QcActionNotice.tsx`, `QuotesList.tsx`, `InvoiceList.tsx`, `material-orders/order-list.tsx`, `quotes/new/QuoteDetailsForm.tsx`, and the redirected `resources/new/page.tsx`.

Completed: persistent bulk/row feedback, inline New Quote/template/component validation, scoped shared acknowledgements/confirmations, non-draft order wording and obsolete route redirect. Generic Trades and protected pricing/measurement/recipient work are retained. Core UX tokens unchanged; companion standard v2.9 adds C66 contract.

This is a source implementation candidate. Source/isolated/Chromium specimens checked; **Gavin must run real TypeScript/lint/Next build and runtime/device gates** before owner review. No dependency installation or live writes performed here. Recovery-question provider error handling remains an owned follow-up, not a fabricated client-side success fix.

Historical Phase7 root notes remain under `docs/ux/phase-8/history/`. Exact raw hashes, scope and validation limits are in this phase's documentation.
