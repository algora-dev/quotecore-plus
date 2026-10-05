# Integration and release gates

## Order

Read ZIP-root RETURN_NOTES.md, root DESIGN_CHANGES.md, then the component contracts and parity checklist. The complete return ZIP has the original repository structure, but is a review artifact: do not overwrite a newer live repo wholesale.

Create a branch/clone of the actual repository with history and a dedicated nonproduction preview. Source baseline was main20b3f54c. Compare CHANGED_FILES.json original hashes against that baseline or the current branch. Reconcile newer mobile work rather than reverting it to this older snapshot. Integrate the listed existing UI file modifications and all new primitive/CSS files together as a single coherent Phase1 candidate. Shared primitives, imports and the builder depend on each other.

Only Gavin should run installation/build/e2e in the authorized full-repo environment. No dependencies/config were changed here. Use the existing dependency lockfile and established test scripts; don't upgrade packages to match this handoff. Preview credentials/services must be isolated before loading the app because existing page loads and background jobs can perform writes.

## Source-specific pre-release items

### G01 - failed margin save can still confirm (AGENT-TODO in quote-builder.tsx)

Existing handleSaveMargins alerts/returns on invalid values and catches a save error without rethrowing. Existing ConfirmQuoteButton catches onBeforeSubmit errors as non-fatal and always requestSubmits afterwards. The UI pass deliberately retains that contract. New feedback is awaited, so the user acknowledges it before the original continuation proceeds.

Reproduce this on the baseline and UX preview. Gavin/owner must decide whether that continuation is intentional or needs a separately approved behavior fix. Do not silently change it inside the design patch. A future safe contract would have to report save success/failure explicitly and control whether confirmation continues, but no such new callback, action or result shape was implemented here.

### G02 - edited margin previews versus saved totals

The original Review computes margin preview lines/subtotal from locally edited percentages, but tax/grandTotal from existing computeQuoteTotals with saved quote margins. The new copy states that distinction; formulas remain unchanged. Do not represent this as a new live tax/total calculator. A future live aggregate preview needs Gavin's domain approval and tests, not duplicate arithmetic in a presentation primitive.

### G03 - digital storage prop is not forwarded in the supplied baseline

The manual quote page passes isOverStorage to QuoteBuilder. The supplied digital build/page and QuoteBuilderV2Wrapper do not provide that prop. Existing PDF/storage operations retain their own checks; the UX pass makes no entitlement assumptions and does not edit these loaders. Verify the over-quota case on both entry paths and decide separately whether a prop-wiring correction is needed.

### G04 - component collapse issue

The source already includes a wrapper popstate/stale-query fix. It is byte-identical here. Domain component IDs remain stable keys; no mobile duplicate trees were added. This does not prove the intermittent collapse report resolved. Reproduce it with real refreshes, library mutations and narrow/large viewport transitions before accepting.

### G05 - auxiliary legacy dialogs

PDF page picker and StorageBlockedModal are not reskinned. Test their layering, cancellation and keyboard behavior with the Phase1 root. The new creator/error/confirmation dialogs use native top-layer presentation; integration must verify nested errors and focus restoration in React, not just the standalone HTML.

## What is not required

No new backend data or endpoint is needed for the implemented design. No fabricated readiness statuses, completion counters, customer/job records, totals or entitlements were added. No Guided/Fast placeholder was built because that flow is locked for a later owner-supplied reference.

## Release

After critical parity checks and owner preview approval, merge the reviewed UI delta through the normal controlled release path with a rollback commit/tag. Do not copy pieces straight into live. If production rollout will wait for later phases, retain this reviewed Phase1 commit in the UX branch and keep it synchronized with ongoing product development. Phase2 remains unstarted.
