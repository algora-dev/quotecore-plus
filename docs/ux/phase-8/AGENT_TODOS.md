# Gavin-owned follow-ups and release gates

| ID | Condition | Required action |
|---|---|---|
| P7-TEMPLATE-02 | Implemented by this return: obsolete `/resources/new` redirects to unified Document Templates. | Verify deep link, workspace path and permissions in runtime; then close ledger item. |
| AGENT-TODO P8-SECURITY-01 | Existing `settings/security-questions-actions.ts` deleteSecurityQuestion returns void and does not inspect the Supabase returned error. The existing UI locally clears the question after the promise returns. | Gavin should expose/handle real delete failure in the owned contract; test timeout, denied and successful delete. Phase8 changes confirmation presentation only and does not add a misleading success message. |
| P7-API-01 | Invoice-template provider can return successful empty array on failure. | Return a truthful failure from the protected provider before adding client recovery behavior. |
| P7-INBOX-01 | Bulk mutation rollback/error contract still ambiguous to presentation. | Integrator owns contract and runtime failure testing; unchanged here. |
| P7-CACHE-01 | Template mutations revalidate historical locations; existing explicit UI refresh retained. | Verify freshness in unified libraries and all Send/create selectors; no polling workaround. |
| P6-DATA-02 | Orders fetches 20 recent records. | Separate data/product decision; no fake pagination or incomplete client-wide search claim. |
| P7-BILLING-01 / P6-BILLING-02 | Commercial metadata, checkout, entitlement timing and paid-only gates remain owned. | Actual billing/portal/subscription tests, not a UX-source fix. |
| P8-RUNTIME-01 | Native queued feedback nested inside manager dialogs; result focus after list dialogs. | Test queue ordering, inert backgrounds, soft keyboard, Escape, focus return and pending interactions in actual app. |
| P8-RUNTIME-02 | File download is a browser request, not verified filesystem persistence. | Test blocked download, cancellation, compression exception, all/partial failures and post-download quote audit error. |

Gavin's copy-existing Quote Header feature remains live in this baseline. Do not reintroduce the old unavailable placeholder. Generic Trades and marketing are separate lanes. This phase does not reopen their source.
