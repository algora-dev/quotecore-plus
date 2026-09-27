# Smart Assistant P1.7.1 — Universal Entity Resolver

**Implemented and offline-checked source candidate. Not deployed. No migration applied.**

## Source authority and scope

Built directly on `quotecore-plus-SA-next-phase-handoff-2026-09-27.zip`, whose root
handoff records commit `72f3c3bb`, branch `ux/phase-4`. Preserve any newer agent
fixes when merging. The prior repository return notes concern UX Phase 6 and are
archived unchanged in `docs/sa-p171-2026-09-27/BASELINE_RETURN_NOTES.md`.
This phase does not redesign that UX, voice, PWA notifications, P4 or mutations.
The small assistant-card change is functional candidate selection using the
existing components/styles, plus safe display of its structured transport.

## Implemented

1. Shared entity resolution over 13 adapters backed by the existing 16-source
   authoritative business registry. It supports quotes/drafts, placed components,
   saved customer quote lines, areas, reusable components/collections, orders and
   both line layouts, invoices/lines and enabled catalogues/rows.
2. Actual-user exact numbers, explicit parent/child relationships and customer
   qualifiers constrain model plans. Quoted numeric names remain names; quoted
   `for` inside a job name does not become a customer filter. Compound or
   unsupported language stays on the existing bounded model path.
3. Direct/contextual matches first, then bounded concurrent discovery and one
   controlled broadening. Absolute relevance evidence, not just relative rank,
   determines whether to resolve, show up to five credible choices, ask a useful
   discriminator, or explain a genuine search/setup/permission limitation.
4. Trusted, expiring resolution continuation. Candidate buttons carry only
   state/choice identities, reauthorize and reread the selected record, and
   resume the original request. `None of these` excludes rejected identities.
   Both deterministic replies and a constrained model refinement can preserve
   the original task, parent and proposed rate. Two clarification attempts are
   the ceiling, not a guarantee that arbitrary speech will always resolve.
5. Existing P3 component proposals can use exact/composite resolution. Selection
   never confirms or commits an edit. Existing P3 eligibility, unit, snapshot,
   permission, requester-button and audit behavior remain authoritative.
6. Catalogue SQL adds an indexable necessary candidate prefilter and refuses
   populations over 1,500 before expensive ranking. It does not return a sampled
   ranking/count. Dense, unsupported natural/nested catalogue searches ask for
   narrower/direct supported scope rather than running an unbounded rank scan.
7. A strict retrieval decoder defect discovered by integration tests is fixed:
   valid boolean fields no longer fall through the generic scalar branch.
   Invalid booleans still fail closed. Existing protocol and engines unchanged.

## New deployment items (disabled initially)

- Server flag: `SMART_ASSISTANT_RESOLVER_ENABLED=true`, after acceptance only.
- Requires existing P1.6 retrieval and P1.7 intelligence flags/rollout, matching
  registry capability and `resolver_version=1`. No new company entitlement.
- SQL draft: `backend/supabase/migrations/20260927150000_sa_v2_resolver_v171.sql`.
  Review/apply ONLY this new migration on approved testing after prerequisites;
  do not sweep all outstanding migrations. It creates private resolution
  metadata/RPCs and an invoker-RLS business reader. No business-table mutation,
  billing/quota/auth policy or old migration change.
- Keep the existing approved testing-company restriction. P4 and knowledge stay
  off; preserve existing catalogue, P2/P3 and Luna settings.

## Validation and its limits

**812 executable offline tests passed:** 609 retained checks and 203 new resolver
checks. The retained 609 include 37 corpus/example-plan checks; these are not
live natural-language accuracy measurements. The new tests use explicit fake
RPC/store/model transports where indicated, not a real database/RLS emulator.

Additional source checks: syntax/transpilation of 92 assistant TS/TSX files plus
the two unchanged quote components; existing 16-source/339-column registry
checks; all three SQL generation checks; 13 bounded resolver adapter projections;
**2,944 original files raw byte-identical**, including all **179 original SQL
migrations**, the admission/finish route, pricing engines, model configuration,
manifests and unrelated UX. Static checks are not PostgreSQL parsing or planning.

Per the supplied owner-approved brief, **no dependency install, full typecheck,
lint or production build was attempted in this pass**. No Supabase migration,
real RLS/SQL, browser, Luna, cancellation, scale or live latency test was run.
Those are mandatory integration gates, not implied successes. Offline durations
are not service response times; there is no claimed production speed gain yet.

## Required agent sequence

1. Read the handoff, validation, database acceptance and integration prompt in
   `docs/sa-p171-2026-09-27/`. Reconcile newer branch/UX changes rather than overwrite.
2. Keep the new flag off. Run release install/typecheck/lint/build in the normal
   environment and regress the accepted P1.7/P3 behavior.
3. Review/test the single draft migration, repeat the prior 47-case live security
   suite against the new reader, then exercise resolution-state isolation,
   replay/expiry/revocation and catalogue scale/import/index correctness.
4. Enable only the intended testing deployment. Verify `resolverActive=true`,
   `resolverVersion=1`, `sa_v2_retrieval_query_v171` calls, and `path=resolver`
   for supported direct turns. Run the supplied 60-case live acceptance spec,
   repeated model and two-turn cases, and the existing 200/201 financial bounds.
5. Return the full latest source, actual migrations/flags, repaired integration
   issues, evidence and timing breakdowns. Widen rollout only after those pass.

## Important intentional limits

This does not promise every phrase resolves or every entity type has a usable
price/navigation target. Internal rates, saved customer charges, unpriced order
lines and imported raw text stay distinct; missing values are not zero. Catalogue
searches require compatible existing imported `search_text` and index evidence.
Date qualifiers use explicitly labelled UTC calendar ranges, not an invented
account timezone. Discovery has fixed read/time/population budgets; incomplete
searches never prove global absence or unique relevance. Metadata visibility lasts
15 minutes; physical cleanup is bounded/lazy and not guaranteed at minute 15.
Every choice/clarification uses normal admission/turn allowance, even with zero
model tokens. Detailed behavior and the rollback procedure are in the handoff.
