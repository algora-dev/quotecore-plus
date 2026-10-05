# Capability parity

| Surface | Presentation change | Preserved contract |
|---|---|---|
| Quotes list | Persistent export/delete outcomes, complete failures, surfaced status failures, touch-visible row actions | Drafts/Confirmed, all statuses and filters, selections and cap25, actions, audit calls, serial bundling, ZIP paths, navigation, billing entry checks |
| Orders list | Same outcome model, survives empty list after last deletion | Six states, query scope, per-row/bulk deletion, supplier context, bundling and filenames; no new pagination |
| Invoices list | Same outcomes, row failures report to list; failed bulk confirm closes so error is reachable | Existing manual status whitelist, recipient-driven states, draft-only deletion/skips, cancel and local removal policy |
| New Quote | Inline required-field feedback, disabled reason, explicit next step, accessible labels; narrow trade grid stacks | Guard order, original disabled predicate, measurement choice/lock prompt, entry modes, templates, signed upload limits, billing, Generic Trades flag/values/payload, route destinations |
| Quote structures (create/edit) | Name error beside input; existing empty structure confirmation in shared native dialog | All metadata, components/extras, IDs, notes, presentation association, save payloads and return route |
| Customer quote headers/save-from-quote | Shared acknowledgement + inline names where applicable | Existing fields, images, storage guards, create/update actions, exact template names; Gavin's copy-existing flow untouched |
| Order template forms/managers | Shared feedback, explicit destructive confirm in legacy manager, inline names | Supplier/reference/type/colors/delivery/notes/logo/company/contacts; full create/edit/delete/default/apply contracts |
| Invoice template list | Shared delete-error acknowledgement | All header/footer/payment/notes/terms fields and API behavior |
| Pricing Library/components | Current inline form error for coverage/decimal/image validation; shared action errors | All component pricing/measurements/calculations, selectors, Generic Trades data, limits, mutation calls and payloads |
| Catalogue/suppliers | Existing error messages in shared feedback | 190px Actions column, parsing/publish/import/geolocation requests and lifecycle |
| Security settings | Branded confirmations/feedback, recovery editor in shared native dialog | Existing MFA and recovery actions, answer validation, transition state; no auth-provider rewrite |
| Order from Quote | Non-draft wording | Existing eligibility query |
| Obsolete Resources URL | Redirect to unified library | No data migration or template creation; active templates remain usable |

132 syntax-normalized protected-helper/action/request/navigation call sites and their arguments match the baseline across the modified production files, excluding the explicitly retired orphan route. This does not prove external provider behavior or React scheduling. Mutation callbacks, payloads and scopes must still be tested in Gavin's environment.

All 3,094 original repository paths are retained. New source files: C66 TSX and scoped CSS. Only 24 existing production files are changed. The exact raw-byte change manifest and canonical diff, not this table, define the merge.
