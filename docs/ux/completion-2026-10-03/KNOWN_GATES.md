# AGENT-TODO / remaining owned checks

These are not newly implemented features or silently repaired business rules.

**AGENT-TODO UC-01 — Real app acceptance.** Darren: complete build/type/lint/roof tests and the runtime checklist. No production signoff or device claim is made by isolated fixtures.

**AGENT-TODO UC-02 — Existing quantity/pack semantics.** The original free component editor offers pack configuration for quantity through its `packStrategies` fallback to `per_pack_length`; the report’s existing pricing paths do not make that a new quantity-pack rule. Confirm intended behavior with owner/calculation maintainer before changing constraints or pricing. This return deliberately preserves the original selector/save/math. Also verify zero/missing pack size behavior and actual unit expectations.

**AGENT-TODO UC-03 — Existing grouping/area ownership.** The report still groups on existing area IDs and summaries. Exercise components without a valid active/parent area and empty-result return paths. Do not add a general “back to canvas” from a completed report without auditing its run/reset/hydration contract. That behavior was not redesigned.

**AGENT-TODO UC-04 — Existing CSV replacement metadata.** The original handler reads `fileRef.current?.files?.[0]?.name` after the file input unmounts for preview, then falls back to the old filename. It also has the existing start/batch/finish partial-write behavior. Display/dialog fixes do not make the operation transactional or correct metadata. Darren should address a demonstrated failure in its own change, not infer success from the isolated parser stub.

**AGENT-TODO UC-05 — Message load/search and prefs contract.** Message Center still loads at most 1,000 records and searches only loaded title/body text; no server paging/full-thread search. Preserve actual alert taxonomy/company preference permissions. Real uncertain/partial API result acceptance remains required; no fake success banner or extra polling was added.

**AGENT-TODO UC-06 — Public report downstream parity.** Print tests cover the source-rendered HTML report with sample payloads and the actual pitch/waste helper. They do not prove free-generator or account import matches every cost/pack/unit rule. Compare live downstream outputs before making marketing claims about full quote parity. The existing draft-save POST and conversion payload are untouched.

**AGENT-TODO UC-07 — SA / marketing follow-ups.** Smart Assistant text/layout was explicitly excluded; marketing homepage content and broader demo workflow are separate. Preserve those active lanes rather than blending them into this release.
