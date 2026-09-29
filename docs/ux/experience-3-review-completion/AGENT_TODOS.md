# Follow-ups outside this return

**AGENT-TODO E3-01 — existing customer-editor save failure continuation.** `customer-edit/CustomerQuoteEditor.tsx` catches save failure in `handleSave` (around lines 795–801). Some callers subsequently navigate to summary after awaiting that swallowed result (around lines 900–914 and 1650–1664). Audit separately so failed customer-document saves cannot look successful. This return neither changes that protected contract nor hides it behind an auto-send. Gavin should exercise this during acceptance.

**AGENT-TODO E3-02 — Review tax/grand-total preview.** Existing Review margin rows use draft percentages while tax/grand total use saved quote settings until save. Copy reflects this; calculation code is unchanged. A live all-draft total preview is separate pricing-authority work, not smuggled into completion.

**AGENT-TODO E3-03 — live RSC retry/navigation.** Real Next build and async navigation/refetch are unavailable in the isolated fixture. Pinned Next 16.2.12 supports the version-specific refetch prop according to official version history. Validate installed docs/runtime. Ordinary same-route link fallback exists. Never introduce automatic refresh/polling on active workspaces.

**AGENT-TODO E3-04 — assistant/coplay labels.** Existing selector `data-copilot=quote-confirm` is retained on the primary, but its destination is now Customer Quote. Authoritative assistant business tools remain untouched. Gavin/SA owner should verify narrated guidance and any selector-driven click expectations; update owned copy separately where it still promises the old summary destination. The explicit secondary has `quote-save-job-space`.

**AGENT-TODO E3-05 — shared pressed-vs-hover specificity.** The current shared primary hover rule appears after an equal-specificity pressed rule, so hovered presses can mask the intended primary gradient. C74 supplies a scoped pressed rule only. A global shared-style correction belongs in a separate acceptance-tested pass, not this narrowly scoped return.

No claim of concurrency safety across browsers/tabs, atomic margin+confirmation transactions, automatic line synchronization or new customer-document autosave. Those would require separate product/engineering decisions.
