# P1.6 retrieval implementation plan

Baseline: `quotecore-plus-SA-handoff-2026-09-26.zip`, export `1908e78d4e260c8a037f131eb7bf01c9645e1e97`.

1. Define one versioned business-source registry; share it between TypeScript validation, model discovery, SQL allowlists and regression tests. No infrastructure/private conversation/token/storage-path columns.
2. Add read-only, authenticated, admitted-run RPCs. The database independently validates plans, scopes every parent/child to the current company, enforces section dependencies and current permission revisions, and keeps RLS active. Fixed semi-joins prevent join multiplication.
3. Add stored-value aggregates and a bounded engine-input batch for derived quote totals. Preserve canonical units, separate currencies and both quote-total bases. Report incomplete coverage rather than claiming partial results are global facts.
4. Rank named results structurally, broaden only text matching within the original authorised/filtered scope, return real candidates and focused clarification. Draft names never require nonexistent numbers.
5. Expose compact schema discovery and a shared query tool; keep existing deterministic commands and P3 proposals. Permit deterministic final rendering of a sole complete factual tool result, never a proposal or multi-tool workflow.
6. Add privacy-safe retrieval timing, adversarial/offline and opt-in database/model acceptance tests. Preserve all locked files and supplied model hotfix. No UI, microphone, PWA, quota or mutation redesign.
7. Package full source, additive SQL DRAFT, RETURN_NOTES, rollout/rollback instructions, exact validation evidence and a baseline patch/manifest. No automatic migration or rollout change.
