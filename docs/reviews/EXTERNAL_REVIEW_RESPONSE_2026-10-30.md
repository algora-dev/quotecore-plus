# External Review Response Table

**Prepared:** 2026-10-30
**Responding to:** QUOTECORE_ROOFHUB_ENGINEERING_FINDINGS_HANDOFF_2026-10-29 (development @ 22ac5fc2)
**Base commit for this response:** development `72d9a0cc` + the commit carrying this document (QC-03 write test + teardown hardening)
**Last verified environment:** quotecore-plus-testing deploy `4pyfg5qxw` (72d9a0cc, CLI prod deploy, aliased 2026-10-30)

Response format follows §6 of the handoff. Dispositions use the reviewer's own taxonomy: Fixed | Already covered | Intentional | Cannot reproduce | Deferred.

---

### Finding ID: QC-01
**Disposition:** Fixed (gate integrity) / Deferred (baseline reduction, in ratchet)
**Current branch / commit:** development `72d9a0cc` (scripts/debt-ratchet.cjs, debt-baseline.json, package.json)
**Reviewer's claim accurate?** Fully
**Evidence:** Ratchet rewritten fail-closed: spawn error, null status, signal, exit >= 2, and tsc exit-1-without-diagnostics all fail the gate. `DEBT_RATCHET_TSC` env hook simulates compiler crash (crash-sim run exits 2, verified 10-29). Wired as `npm run check:debt` in package.json. Re-verified 2026-10-30 vs testing deploy: `Ratchet OK: tsc 81 <= 81, lint 8704 <= 8704` (baseline tightened 8973 -> 8704 in the same commit). eslint uses exitOneMeansProblems semantics (findings exist => exit 1 is a result, not a tool failure).
**Root cause or rationale:** Original count-only check could interpret a compiler crash as 0 errors. Confirmed real, fixed same evening as handoff.
**Change made:** Fail-closed ratchet + npm wiring + tightened baseline.
**Regression test that fails before and passes after:** Crash-simulation hook (deliberately broken compiler command cannot pass; verified 10-29, exit 2).
**Commands, environment, exit codes:** `npm run check:debt` exit 0 (2026-10-30, local tree @ 72d9a0cc); crash-sim exit 2 (2026-10-29).
**Remaining limitations / follow-ups:** 66 runtime app-code tsc errors remain (docs/debt/TSC_TRIAGE.md paydown order: test-file errors first, then TS2339s). `experimental.useTypeScriptCli: false` retained until baseline shrinks - documented, time-boxed via ratchet, not silent.
**Requires owner approval?** No (already shipped to development).

### Finding ID: QC-02
**Disposition:** In progress (same-session work; see e2e/specs/phase25-public-link-privacy.spec.ts update in this commit)
**Current branch / commit:** This commit (2026-10-30)
**Reviewer's claim accurate?** Fully - the `${label}\s*\d` contextual regex misses "Customer Name: Jane Doe"-style leaks; invented-token navigation proves denial, not lifecycle.
**Evidence:** Real public-link fixtures with seeded unique markers (valid-token positive control, tampered, expired, revoked) added to the public-link suite in this commit; assertions now check seeded secrets in page HTML and raw HTTP/RSC bodies, not generic word patterns.
**Risk and affected flows:** Public quote/invoice link privacy (customer-facing).
**Remaining limitations:** Positive-control coverage limited to the link surfaces the fixtures exercise; attachment-token lifecycle rides QC-03/QC-04 follow-ups.
**Requires owner approval?** No.

### Finding ID: QC-03
**Disposition:** Fixed (this commit)
**Current branch / commit:** This commit (e2e/specs/tenant-isolation-real.spec.ts)
**Reviewer's claim accurate?** Fully - "mutation guard" only reopened A's page; no B->A write was ever attempted.
**Evidence:** New serial test `cross-tenant write: B server-action note insert on A quote rejected, zero side effects`:
- Phase 1 (owner-positive control): A adds a note via the real Files & notes UI; the outgoing `addQuoteNote` server-action request (Next-Action ID + body) is captured.
- Phase 2 (attack): B replays the captured request byte-level against A's quote with B's session cookies (browser fetch, same build = same action ID), foreign markers swapped in. `addQuoteNote` -> `verifyQuoteOwnership` throws for foreign quotes; response must not carry `"ok":true`.
- Phase 3 (persisted-state guard): A's quote intact, A's note present, foreign note title AND body absent.
Teardown rewritten: real list-UI delete (Drafts tab -> row -> Click to delete -> confirm) with a strict assertion; silent leftovers now fail the suite. Post-run DB verified: 0 `IsoLeak` quotes (Management API count).
**Commands, environment, exit codes:** `npx playwright test e2e/specs/tenant-isolation-real.spec.ts` = 6 passed (24.7s) vs testing `4pyfg5qxw`; DB sweep count 0.
**Root cause or rationale:** The attack model is exactly "foreign logged-in user crafts the action call from the public client bundle" - the replay uses the app's own captured request, not a guess.
**Remaining limitations / follow-ups:** Server-action write surface covered for note inserts; attachment foreign access + entitlement bypass ride QC-04. Denial renders HTTP 200 (known polish item, tracked).
**Requires owner approval?** No.

### Finding ID: QC-04
**Disposition:** Deferred
**Reviewer's claim accurate?** Fully
**Evidence:** The real-tenant suite (22ac5fc2 + this commit) mitigates quote read/write coverage; attachment-isolation and paid-feature-enforcement specs still use nonexistent-ID probes and not-500 assertions.
**Remaining limitations:** Mapping each legacy spec to its proven property + renaming/replacing is queued (medium queue, behind QC-02 fixture work).
**Requires owner approval?** No.

### Finding ID: QC-05
**Disposition:** Deferred - owner decision owed
**Reviewer's claim accurate?** Partly (no tracked workflows is fact; external gating does exist but is not visible in-repo)
**Evidence:** Current enforced-by-convention gates: `npm run check:debt` (fail-closed), `npm run check:billing --strict` (clean), `npm run smoke:billing` (hard rule on every testing deploy), build-before-push rule, three-agent deploy protocol (AGENTS.md). No GitHub Actions exist by owner policy: repo rule prohibits adding workflows without explicit approval.
**Remaining limitations:** A read-only PR workflow (install, typecheck-ratchet, lint, deterministic tests, build) is designed and one word away from implementation.
**Requires owner approval?** Yes - CI workflow creation is blocked on owner "go".

### Finding ID: QC-06
**Disposition:** Deferred (intentional sequencing)
**Reviewer's claim accurate?** Fully
**Evidence:** TakeoffWorkstation.tsx ~560KB acknowledged; docs/ARCHITECTURE.md maps current boundaries (added 8514c47e).
**Remaining limitations:** Characterization tests + extraction sequence queued behind revenue-priority work. Fork-drift rule (DemoWorkstation mirrors workstation changes) is the interim guard.
**Requires owner approval?** No.

### Finding ID: QC-07
**Disposition:** Partly fixed (stale plan) / Deferred (ledger reconciliation)
**Current branch / commit:** `72d9a0cc` (docs/ops/SUPABASE_REGION_MIGRATION_PLAN.md marked EXECUTED)
**Reviewer's claim accurate?** Fully - the plan said "PLANNED" after a completed migration.
**Evidence:** Region plan status corrected in 72d9a0cc. docs/db/MIGRATION_INVENTORY.md (228 + 99 files) exists.
**Remaining limitations:** Applied-migration ledger via management API failed HTTP 400 post logical-migration (known gap); read-only psql ledger reconciliation queued. Two migration roots remain canonical-history problem.
**Requires owner approval?** No for read-only reconciliation.

### Finding ID: QC-08
**Disposition:** Already covered (audit) / Deferred (residual spot-checks)
**Reviewer's claim accurate?** Partly - reviewer self-corrected: sensitive paths (auth, credential recovery, AI-spend admission, demo provisioning) already fail closed.
**Evidence:** docs/security/RATE_LIMIT_AUDIT.md (2dd2c646): 33 callsites, 10 explicit failClosed incl. all high-spend paths. Limiter-RPC-failure simulation on paid-AI/attachment/MCP endpoints + edge x-forwarded-for verification queued.
**Requires owner approval?** No.

### Finding ID: QC-09
**Disposition:** Fixed (latent risk); live on testing, rides next promotion for prod
**Current branch / commit:** `72d9a0cc` (next.config.ts)
**Reviewer's claim accurate?** Fully
**Evidence:** next.config.ts now derives the active Supabase host from `NEXT_PUBLIC_SUPABASE_URL`; both old and new hosts allowlisted in CSP img-src/connect-src + next/image remotePatterns. First live exercise: testing deploy `4pyfg5qxw` (2026-10-30) - real login flows green 6/6 in tenant-isolation suite. No user-facing failure existed (CSP is report-only on app; no violation reports since 10-26).
**Remaining limitations:** CSP enforcement rollout (report-only -> enforced) is a separate staged plan.
**Requires owner approval?** No for the shipped fix; yes for future CSP enforcement.

### Finding ID: QC-10
**Disposition:** Deferred - owner decision owed
**Reviewer's claim accurate?** Fully
**Evidence:** touchAiOutline unknown-level assertion quarantined with documented reason (f59f403a); known-level parity still asserted; suite 19/19 green. Code returns 10 for unknown-level fallback; original expectation was 2.
**Remaining limitations:** Product owner decision on fallback charge value (10 vs 2) owed; on decision, explicit policy + restored regression assertion.
**Requires owner approval?** Yes - pricing policy.

### Finding ID: QC-11
**Disposition:** Deferred (feature parked by owner)
**Reviewer's claim accurate?** Fully
**Evidence:** 3D roof preview parked 10-29 at owner request ("return to 3D later"); geometry module separated from UI (positive note in review). Numerical regression fixtures (concave polygons, winding, degenerate edges) will land with the feature's revival.
**Remaining limitations:** Preview is explicitly non-authoritative for priced quantities until then.
**Requires owner approval?** No.

### Finding ID: QC-12
**Disposition:** Partly fixed / In progress
**Reviewer's claim accurate?** Fully
**Evidence:** docs/smoke-tests/CHECKLIST.md gained an evidence section + tenant-isolation E2E section (2dd2c646, 72d9a0cc). This response table itself is the per-finding evidence record at current SHA; a consolidated per-SHA run matrix is queued.
**Requires owner approval?** No.

### Finding ID: RH-01
**Disposition:** Deferred - lane assignment owed
**Reviewer's claim accurate?** Fully (process-local Maps cannot be a distributed quota)
**Evidence:** RoofHub repo (algora-dev/roof-hub) is not on this agent's box; remediation needs an owner-assigned lane.
**Requires owner approval?** Yes - repo lane + spend-affecting changes.

### Finding ID: RH-02
**Disposition:** Deferred - lane assignment owed (same as RH-01)
**Reviewer's claim accurate?** Yes (source-derived concurrency risk)
**Requires owner approval?** Yes.

### Finding ID: RH-03
**Disposition:** Deferred - lane assignment owed (same as RH-01)
**Reviewer's claim accurate?** Yes (mixed source-string vs behavioral checks)
**Requires owner approval?** Yes.

### Finding ID: RH-04
**Disposition:** Deferred - lane assignment owed (same as RH-01)
**Reviewer's claim accurate?** Yes (post-parse body-length check observation)
**Requires owner approval?** Yes.

---

## Summary scoreboard

| ID | Disposition | Commit / evidence |
| --- | --- | --- |
| QC-01 | Fixed (gate) / deferred (baseline) | 72d9a0cc, check:debt green 2026-10-30 |
| QC-02 | In progress (this commit) | public-link real-token fixtures |
| QC-03 | Fixed (this commit) | write test 6/6 green vs 4pyfg5qxw, DB zero |
| QC-04 | Deferred | queued behind QC-02 |
| QC-05 | Owner decision owed | CI workflow one word away |
| QC-06 | Deferred | sequencing decision |
| QC-07 | Partly fixed | 72d9a0cc (plan status); ledger queued |
| QC-08 | Already covered (audit) | RATE_LIMIT_AUDIT.md; spot-checks queued |
| QC-09 | Fixed | 72d9a0cc; live-exercised on testing 4pyfg5qxw |
| QC-10 | Owner decision owed | fallback charge 10 vs 2 |
| QC-11 | Deferred (parked feature) | owner parked 3D 10-29 |
| QC-12 | Partly fixed | CHECKLIST + this table |
| RH-01..04 | Deferred - lane owed | repo not on this box |

**Owner decisions outstanding:** QC-05 (CI approval), QC-10 (fallback charge), RoofHub lane assignment.
