# Gavin-owned follow-ups and limits

| ID | Source condition / treatment | Next owner action |
|---|---|---|
| AGENT-TODO P7-TEMPLATE-01 | Header TemplateCreator's copy-existing branch was already a dead TODO. It now explains the limitation and cannot masquerade as successful copying; scratch remains functional. | DONE - implemented by Gavin 0f3758dd (2026-09-27): copy option live, builder prefills from selected source template via build page `copy` param + `loadCustomerQuoteTemplates`; save creates a new template. Awaiting owner smoke test. |
| AGENT-TODO P7-TEMPLATE-02 | Deprecated `/resources/new` still has `roofing_profile` form name versus `roofingProfile` lookup in its existing inline server action. No incoming route uses it for new template creation. | Retire/redirect this legacy path or repair its owned action after review; Phase 7 does not change server actions. |
| AGENT-TODO P7-API-01 | `/api/invoices/templates` can catch provider failure and return successful `[]`. Client error handling can only distinguish errors actually exposed by HTTP/data shape. | Change protected provider to expose truthful failure separately; test client Retry/continue-without-template flow. |
| AGENT-TODO P7-INBOX-01 | Existing bulk mutations optimistically roll back on failure without an error notice. All current action bodies remain unchanged. | Decide on an owned mutation-error contract; inject failures in runtime before changing backend behavior. |
| AGENT-TODO P7-CACHE-01 | Existing actions revalidate historic template URLs. New UI explicitly refreshes after successful operations rather than modifying server action paths. | Verify new library and Send/create selectors refresh after create/update/delete; add owned revalidation only if required. |
| AGENT-TODO P7-BILLING-01 | Plan data carries prices, not guarantee/refund policy terms. Existing 30-day/three-day policy wording remains. Signup receives no plan list, so redundant amounts were removed in favour of existing `/pricing`. | Confirm policy copy with owner; introduce authoritative policy metadata only in a separately owned change. |
| P6-DATA-02 / P6-STATUS-01 | Orders' 20-recent-record loading scope and six action states remain. | Existing backlog/DB acceptance checks, not replaced with invented pagination/statuses. |
| P6-BILLING-02 | Checkout return/entitlement timing remains unchanged. | Actual checkout/portal/dunning/subscription tests in Gavin's environment. |

## Release gates, not implemented backend features

Nested-dialog focus/Escape/pending behaviour; portal/top-layer positioning; native input soft keyboard; iOS safe areas; shell navigation collisions; authenticated permissions; storage limits; upload cancellation; double-click saves; result freshness; protected-workspace dirty exits. Static fixtures do not establish these.

No real email was sent, invoice paid, template deleted, component activated, catalogue uploaded, supplier publication changed, or production record written in this environment.
