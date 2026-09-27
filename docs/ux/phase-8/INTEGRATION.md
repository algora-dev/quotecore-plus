# Phase 8 integration: end-to-end polish and feedback

**Implemented source candidate. Not the incoming Phase 8 handoff, not a Phase 7-only archive.**

Complete companion: `quotecore-plus-phase8-polish-feedback-return-2026-09-27.zip`. UX standard: `QuoteCore-Plus-UX-Handoff-v2.9.zip`.

## Baseline and safe merge

Use **quotecore-plus-phase8-ux-handoff-2026-09-27.zip**, SHA-256 `3419f46b37938caa0d4cd33daa3cf74195722b7d3c857cba16c767344c3869bf`, as the three-way base. Its outer START_HERE identifies `a2595922` / `ux/phase-4`; the older inner Phase 7 integration note identifies `0f3758dd`. The delivered archive bytes are the authority. This ZIP does not contain Git history, and the older inner commit label is not permission to reset your current branch.

Apply only this phase's listed deltas to Gavin's newest branch. Never replace the tree wholesale over newer fixes. Keep the Generic Trades lane (also called Phase 8 in its own comments), accepted Phase 7, live copy-existing Quote Header flow, marketing and Smart Assistant work. This is the **UX Phase 8** return, not an implementation of the Generic Trades feature.

1. Read `DECISIONS.md`, `SCOPE.csv` and `AGENT_TODOS.md`.
2. Verify raw before-hashes in `FILE_CHANGES.json` against the exact base. Hashes include BOM and line endings. Edited TSX files may be LF where the archive uses CRLF; `validation/production.diff` is the line-normalized review aid, not the hash authority.
3. Merge 24 modified production files and two new production files. New C66 files are `app/components/ui/v2/QcActionNotice.tsx` and `qc-feedback.css`.
4. Review the only server-page exception: obsolete `/resources/new` now redirects. No API, shared action, schema, data migration or package/config change is required.
5. Run full TypeScript, lint, Next build and targeted runtime/device checks. Our source/isolated checks are not substitutes.
6. Deploy to owner preview only after checking failures as well as happy paths. Owner approval remains outstanding.

## Where to see the implementation

`QuotesList.tsx`, `order-list.tsx`, `InvoiceList.tsx`: persistent local outcomes with actual success/failure counts, failure details, current guards and download requests preserved. Status failures are no longer only logged.

`QuoteDetailsForm.tsx`: inline customer/mode/plan feedback, explicit reasons while the original submit disabled gate applies, accessible control relationships. Existing entry modes, measurement systems, Generic Trades fields, billing checks and create/upload payloads are preserved. The Industry/Component Collection grid stacks on small screens instead of truncating both selects side-by-side.

Ordinary library/template/supplier/security panels: existing C27/C63 dialogs and queued `useQcFeedback` acknowledgements replace browser alerts/confirmations. Acknowledgement ordering remains explicit for async handlers.

`resources/new/page.tsx`: deterministic redirect to Document Templates. Order-from-Quote copy describes the existing non-draft query; it does not narrow eligibility.

## Release notes

The new action notice is not a global notification service. It owns only local display state. It does not poll, refresh, retry, fetch, save or infer success. Existing action bodies remain the authority. Results persist until dismissed or superseded by another operation; not across navigation/reload.

List mutation failure closes its existing confirmation to expose the persistent failure on the list, retaining selected IDs for retry. That is a deliberate presentation change, not rollback logic. Original local invoice removal and provider semantics are retained; do not infer that client display is server reconciliation.

REV 2 is followed: no npm installation, full app typecheck/build or production writes attempted here. Gavin owns dependency-complete build/runtime verification. No real emails, uploads, deletions, invoices, supplier mutations, auth changes or payments were performed.
