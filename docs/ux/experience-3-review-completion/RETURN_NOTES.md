# Experience 3: Review → Customer Quote

Implemented source candidate for Gavin/owner acceptance. This is a surgical continuation change, not a new quote lifecycle, document composer or Send flow.

Review now ends with **Continue to customer quote** (primary) and **Save & go to Job Space** (secondary). Both save the current global margin settings through the existing handler. Drafts then run the existing idempotent `confirmQuote`; non-drafts retain the old no-reconfirmation semantics. Only after preparation succeeds does the destination differ.

## Audit correction
The earlier conversational proposal mentioned `createCustomerQuote` and an existence-check helper. Those are NOT the actual architecture in this baseline. Job Space links directly to `customer-edit`. That page loads `savedLines` and priced components; the unchanged customer editor hydrates saved lines or prepares initial local lines. This return uses that very same route. It does not create a second customer document, regenerate saved lines, run an existence query, save customer content on opening, or send anything.

## Included
- One dominant, full-width primary and a quieter secondary, stacked on phones.
- Current unsaved Review margin values submitted; no new numerical validation or formula.
- Synchronous single-flight guard and temporary review-input/step lock. Repeated/mixed clicks cannot start parallel operations in one mounted instance.
- Explicit nonfatal margin warning: review the values or deliberately continue with saved margins. Draft confirmation still runs under the existing nonfatal policy.
- Confirmation failure stays in Review. Known opening failure retries only navigation. Route loading/error screens offer Job Space recovery without asserting unproven save success.
- Destination refetch retry uses the pinned Next 16.2 `unstable_retry` callback. Runtimes without it get a native same-route reload link, not a reset of cached error contents. No polling or automatic router refresh.
- Current Customer Quote material/labour and line-level margin controls retained byte-for-byte.

## Excluded
No Guided mode, sending redesign, customer-editor autosave or lifecycle changes. No pricing, measurement, actions/APIs, schema, permissions, shell, notification, Takeoff, Smart Assistant, marketing, Generic Trades or recipient-renderer modifications. No "all changes saved" claim for component measurements already persisted independently by their existing handlers.

All previous repository notes are retained as history. This directory and `START_HERE_REVIEW_CUSTOMER_QUOTE_RETURN.md` govern this return only.
