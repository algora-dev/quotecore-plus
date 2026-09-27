# Phase 8 decisions

## P8-D01: surgical completion, not another architecture phase

Keep Home/Job Space, navigation, Takeoff, document outputs and the Advanced Builder as integrated. Guided Quote mode remains a separate future decision, not a hidden addition here.

## P8-D02: retire only the unused legacy creator

`/{workspaceSlug}/resources/new` redirects to `/{workspaceSlug}/resources/document-templates`. No new template is created by visiting the path. The obsolete inline server action is removed together with its mismatched form. Current template creators and bookmarks to current templates are unchanged. This fulfils P7-TEMPLATE-02; runtime redirect verification remains required.

## P8-D03: feedback belongs where the outcome can be understood

Correctable form input uses the form's own error area. An ordinary blocking acknowledgement uses existing `useQcFeedback` and C27. A completed bulk operation uses new C66 (composed from existing C30/C01), with actual counts and complete per-record details. No transient success toast, fabricated saved indicator, invented retry or hidden partial failure.

C66 has no timers or business actions. Async feature functions own the result and pending state. Export copy says the browser download was requested, not that the file was saved on disk. Compression failures are caught; quote post-download audit failures explicitly tell users to check their download before retrying.

## P8-D04: destructive action guard retained

Decisions use the existing queued awaitable confirmation. The only shared hook extension is optional `destructive`; omitted remains false. No existing consumer gets a new destructive default. Cancel does not invoke mutations. Recovery-question and order-template delete actions receive explicit danger styling. Existing ownership, eligibility, batch caps, invoice draft-only deletion and six order statuses are unchanged.

## P8-D05: focus and state

User-initiated batch results may request focus after a completed dialog closes. Dismiss restores a surviving trigger or a main heading/action, never retries. Background status changes do not gain polling or remounts. Native details supports keyboard disclosure and a bounded scrollable failure list. All feedback text is ordinary escaped React text. Nested native-dialog focus and screen-reader announcement timing require real React/browser testing.

## P8-D06: New Quote remains the same journey

No new wizard, route or create action. The current disabled predicate and guard order remain. Missing customer, entry mode and plan are explained beside the appropriate control and in the submit guidance. Existing billing errors retain typed messages and Upgrade links. Generic Trades flags, labels, options, state, collections, action payload and measurement choice remain; only the narrow-grid presentation stacks on phones.

## P8-D07: truthful order eligibility

Order-from-Quote says to choose a quote and clarifies that drafts are not shown. The existing non-draft server query and status presentation are not replaced with a new confirmed-only business rule.

## P8-D08: scope explicitly excludes ambiguous providers

Do not paper over invoice-template failures reported as empty lists, Inbox rollback contracts, security-question provider errors or Orders' 20-record query. Do not refactor protected renderers/measurement workspaces merely to remove their native alerts. The follow-up ledger remains Gavin-owned.
