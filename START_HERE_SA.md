# START HERE — Smart Assistant P1.7 integration return

This is the **integrated and live-tested P1.7 return** (2026-09-26 evening).
Integrated from `QuoteCore-Plus-SA-P1.7-Retrieval-Intelligence-2026-09-26.zip`
onto `ux/phase-4` @ `a18f4ab9` (+docs-only `cc13790e`); zero drift outside the
75-file manifest; 207 locked files verified identical under CRLF/LF canonicalization.

Read, in order:

1. `docs/sa-p17-2026-09-26/INTEGRATION_REPORT_2026-09-26.md` — all gates, timings, failures, fixes
2. `docs/sa-p17-2026-09-26/evidence/` — battery/bench/boundary/catalogue JSON, screenshots, Vercel telemetry logs
3. `docs/SMART_ASSISTANT_P17_HANDOFF_2026-09-26.md` — the implementation contract (unchanged)
4. `docs/sa-p17-2026-09-26/DATABASE_ACCEPTANCE.md` — the gate definitions

Live state on quotecore-plus-testing (Production env): P1.7 **ENABLED**
(`SMART_ASSISTANT_RETRIEVAL_V17_ENABLED=true`), telemetry-proven
(`intelligenceActive:true, intelligenceVersion:1`). Migration
`20260926190000_sa_v2_retrieval_v17.sql` **applied** to the shared DB
(additive; verified in `pg_proc`). P1.6 gates, P4 and knowledge unchanged/off.
All disposable test fixtures were created, used and **deleted with verification**.

Key results: offline suites + tsc parity + lint + build green; v17 RPC security
battery 47/47; P1.6 regression green (RPC 33/33; component-open gap from P1.6
now fixed); repeat bench 19/20 (p50 2.8–3.7 s); browser focus navigation +
snap-back guard verified. One scale finding: **100k-catalogue WORDS search hits
the 8 s statement timeout** (per-row rank() is not indexable; trigram/ILIKE
pre-filter recommended as P1.7.1) — exact search 6.4 s, count 869 ms, engine
boundary 200 complete / 201 refuses.

Residual model inconsistencies (honest, nondeterministic): customer-qualifier
phrase-bundling into parent text search (~1 in 5 on "…for John Smith" shapes);
first-attempt Gutter open missed once, retry correct. No wrong-parent proposals,
no permission leaks, no auto-applied mutations anywhere.

Rollback: set the flag false on testing; keep additive SQL installed; P1.6
continues on the original RPC.
