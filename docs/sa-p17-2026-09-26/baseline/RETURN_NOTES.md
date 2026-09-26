# RETURN NOTES — P1.6 Universal Retrieval

**Implementation completed in supplied source; NOT deployed or database-applied.**

## Authoritative baseline

`quotecore-plus-SA-handoff-2026-09-26.zip`, agent export `1908e78d4e260c8a037f131eb7bf01c9645e1e97`. Full `quotecore-plus/` structure retained. Read the original `docs/SA_HANDOFF_2026-09-26.md` and the appended original START_HERE entry for live-state authority. Earlier 24/25 September packages were not merged over this baseline.

## Implemented

- Shared, versioned registry covering 16 existing business sources, constrained query/relationship/aggregation compiler, strict server AND database validation. Tenant scope comes only from authenticated admitted-run authority. Business reads use RLS/security-invoker; no arbitrary SQL, account selector or model writes.
- Natural-language model path exposes `query_workspace` and compact `describe_workspace_sources`, instead of overlapping bespoke read vocabularies. Existing zero-model P1.5 commands remain available. Independent context reads are conditionally parallel-safe; resolving/card-producing calls remain serial barriers.
- Deterministic exact/phrase/word/fuzzy resolution, preservation of ties, current-record binding and actionable candidate choices through existing cards. Drafts never need quote numbers. Search scope/qualifiers are not discarded for broadening.
- Whole-filter stored-value aggregates and existing-engine quote totals with currency/unit separation, completeness accounting and actual maximum/minimum winner evidence. No sampled global totals. Existing quote-summary and customer-document bases remain distinct.
- Trusted deterministic completion for a simple sole first-hop query can avoid the second Luna call. Complex/multi-tool/action/continuation turns still synthesize. Tokens and existing final permission guard remain mandatory; the model cannot grant itself terminal authority.
- Explicit setup/permission/empty/ambiguous/incomplete/read-budget error states, source/basis attribution and bounded model context with visible document excerpts.
- Privacy-safe capability/retrieval telemetry, offline diagnostic reporter, 100 annotated acceptance utterances and guarded opt-in real HTTP benchmark. It allows the current P2/P3 test rollout, keeps P4 off, never clicks Confirm and stops uncertain turns without retrying.
- Additive SQL draft `20260926150000_sa_v2_retrieval.sql`, generated from the same registry/hash. Only new tables are rollout and document-classification metadata, not a shadow database.

## Preserved

Luna model configuration and `reasoning_effort` hotfix; original admission/reservation/replay/finish protocol; original migrations; service-only finalisation; P2/P3 live implementation, requester-button confirmation and audit; feature permissions/rollout; existing pricing/tax/currency/conversion engines. P4 remains separately gated. No Orders mutation feature is added. No UI, microphone, streaming transport, speech, PWA or general QuoteCore redesign.

`package.json` / lock file, generated UTF-16 Supabase database types, HTTP turn route, original migrations and all application source outside `app/lib/smart-assistant/` were byte-compared to the supplied baseline. Evidence: `docs/sa-retrieval-2026-09-26/validation/LOCKED_FILES.json`.

## Validation actually performed

**383 executable offline checks passed:** new retrieval/compiler/engine/model-loop/corpus checks 204, new service/registration checks 60, new metrics/harness checks 7, retained speed tests 83, retained speed service tests 24, retained speed metrics 5. RPC transports in service tests are explicitly mocked; these are not SQL/RLS or live model tests. The 100 utterances have not been run against Luna; 43 included query-plan examples are checked by the real compiler within the offline suite.

TypeScript/TSX syntax checks passed across 73 assistant files. Registry generation/fingerprint consistency and 339 physical-column references across 16 sources matched the supplied schema types. SQL security/allowlist/bounds structure was statically checked, **not PostgreSQL-parsed/executed**. Logs, commands and caveats are in `docs/sa-retrieval-2026-09-26/validation/VALIDATION.md`.

**Build limitations:** `npm ci --ignore-scripts --no-audit --no-fund --fetch-retries=0 --fetch-timeout=10000` failed with registry DNS `EAI_AGAIN` and npm `Exit handler never called!`. Full `tsc` was attempted and failed because dependency types are unavailable. A targeted import-graph diagnostic attempt was also blocked by missing dependencies; it is not recorded as a successful typecheck. No successful ESLint/Next production build, database migration/RLS test, real Luna latency/accuracy benchmark or browser E2E is claimed. Incomplete `node_modules` is not shipped.

## Integration order

1. Agent reads `docs/SMART_ASSISTANT_RETRIEVAL_HANDOFF_2026-09-26.md`; validates diff, installs normal dependencies and runs build/type/lint/offline gates with new server flag **off**. Preserve current P1.5/P2/P3 and Luna settings.
2. Review and test the **one new SQL draft** on isolated/staging Supabase, with existing P0/P1 and speed-facts prerequisites. Do not apply all outstanding migrations or enable P4. Run `DATABASE_ACCEPTANCE.md`: every source, direct-RPC isolation/forged plans, stale run/revision, grants/RLS, totals parity, truncation and timeouts.
3. Explicitly enable only the intended testing company in `assistant_v2_retrieval_rollout` (`enabled=true`, `knowledge_enabled=false`), then server `SMART_ASSISTANT_RETRIEVAL_ENABLED=true`. Confirm the logged tool registry actually includes `query_workspace` before diagnosing model capability.
4. Run annotated accuracy cases and real benchmark; join run ID to capability, query, model and trusted-finish logs. Verify named 9th-canvas draft and original Ridge proposal/Confirm/audit regressions. Compare warm/cold p50/p95 by execution path, not an invented universal speedup.
5. Keep uploaded knowledge off until trusted per-document section classification and withdrawal/history tests pass. Unclassified uploads are intentionally excluded. No automatic classification/backfill was performed.

## Known limits / next decisions

Derived quote calculations refuse beyond 200 matching quotes or child/payload bounds rather than use a misleading sample. Large catalogue fuzzy queries can scan their tenant candidate set; real EXPLAIN and effective caller timeout tests are required. No guaranteed sub-second natural-language response is claimed. Raw CSV/line-by-line numbers remain source text; unsupported business calculations require a registered authoritative adapter. UTC date presets are explicit, not a guessed account timezone. Broader business questions and domain-specific analytics can extend this same registry without new unrestricted SQL tools.

Rollback by disabling company retrieval/knowledge and then the server flag **while retaining the new code/metadata**. After optional knowledge has been used, a blind old-code/DDL rollback can lose the classification-epoch history protection. Stored UI transcripts are not retroactively erased. See the detailed rollback/privacy guidance.

## Delivery

Full updated ZIP, changed-files SHA-256 manifest, optional baseline patch and ZIP checksum. `CHANGED_FILES.json` excludes itself to avoid a self-referential hash. No dependency cache, environment secrets, database credentials, generated build outputs or automatic deployment are included. See `PACKAGE_VERIFICATION.md` in the validation folder for packaging checks.
