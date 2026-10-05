# Capability and lifecycle map

| Capability | Before | Return |
|---|---|---|
| Finish draft Review | Margin callback, confirm draft, summary | Same callback payload and same confirmation, then chosen destination |
| Finish non-draft Review | Margin callback, redirect only | Same, no additional status mutation |
| Job Space hub | Required intermediary | Explicit secondary option; all existing hub actions unchanged |
| Customer document entry | Summary → customer-edit link | Primary opens same customer-edit route after preparation |
| Existing customer document | Existing saved-lines hydration/recalculation | Same untouched editor; no replacement/template reset |
| No saved customer lines | Editor constructs initial local lines | Same; not claimed as a persisted customer document until existing save |
| Global margins | Review callback + customer editor controls | Both retained; typed callback result only |
| Invalid/failed Review margin save | Notify, then nonfatal confirmation | Confirm remains nonfatal; explicit choice before continuation |
| Per-line margins, templates, visibility | Existing Document Studio | Unchanged |
| Send/PDF/customer acceptance | Existing Job Space/editor controls | Unchanged; neither Review option sends |
| Empty/no-area pricing | Owner removed guard | No replacement guard |
| Manual/digital acquisitions | Shared QuoteBuilder Review | Shared completion component; acquisition and Takeoff unchanged |
| Generic Trades | Existing labels/data | Unchanged |
| Confirmation numbering/security | Existing server action | Same action untouched |
| Failed editor load | Generic inherited fallback | Local retry / Job Space; no automatic save/create |
| Other Builder navigation | All steps and back | Temporarily disabled while the Review snapshot is being committed or awaiting explicit warning acknowledgement |

Warning acknowledgment uses saved margins, not an invented zero or fallback rate. Existing pricing is not recomputed by the coordinator. Local confirmed-status reflection prevents another confirmation after a known-successful response; the underlying action remains idempotent for retry after ambiguous transport failures.

This is not a server transaction and is not a cross-tab lock. The existing margin save and confirmation can independently succeed/fail. UI reports only what their results establish. Leaving the page cancels follow-on client work, not an already-running server mutation.
