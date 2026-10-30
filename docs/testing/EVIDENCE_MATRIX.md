# Test Evidence Matrix

**Purpose (QC-12, external review 2026-10-29):** one place that states, per verification command, what it proves, where it last ran, at which commit, with which result, and what is knowingly skipped. Update the "Last verified" row whenever a gate runs. No test label may claim more than its assertions prove.

**Legend:** scope kinds - `unit` (deterministic in-process assertions), `static` (source/contract checks, no runtime behavior), `e2e-browser` (Playwright vs a live deployment), `deployed-api` (HTTP probes vs a live deployment), `build` (compile/type gate).

## Gates

| Command | Scope | Proves | Last verified | Environment | Result | Known skips |
| --- | --- | --- | --- | --- | --- | --- |
| `npm run build` | build | App compiles + type-checks under the 16.2 compiler-API path | 2026-10-30 @ `3c375067` | Gavin host box, Node 24.22.1 | exit 0 | `experimental.useTypeScriptCli: false` (81-error tsc baseline; see debt ratchet) |
| `npm run check:debt` | build+static | tsc error count + lint count never grow (fail-closed ratchet: spawn error/signal/exit>=2/no-diagnostic all fail) | 2026-10-30 @ `3c375067` baseline | local | OK: tsc 81 <= 81, lint 8704 <= 8704 | Counts not zero; paydown plan in docs/debt/TSC_TRIAGE.md |
| `npm run check:billing` | static | Billing resolver contract (strict): every metered call site funnels through the single resolver | 2026-10-30 | local | clean (0 errors, 0 warnings) | - |
| `npm run smoke:billing` | deployed-api | Live billing matrix vs testing: legacy / custom_metered / custom_admin_granted fixtures incl. entitlements, usage env scope, storage hold round-trip + verified cleanup | 2026-10-30 12:31Z @ testing `l4h7ljzzr` (`1ce1e754`) | testing deployment + shared Supabase | ALL GREEN | Intentionally not run vs prod (gate key absent there) |
| `npx playwright test e2e/specs/tenant-isolation-real.spec.ts` | e2e-browser | Real-record tenant isolation: A owns/creates quote, B denied read (page + HTTP), B's replayed `addQuoteNote` server-action write rejected with zero side effects, strict UI teardown | 2026-10-30 @ testing `l4h7ljzzr` | testing, fixtures paid-c + cross-tenant-d | 6/6 passed (33s) | Denial renders HTTP 200 (known polish item); attachment foreign-access rides phase25 gap below |
| `npx playwright test e2e/specs/public-link-lifecycle-real.spec.ts` | e2e-browser | Real acceptance-token lifecycle: valid link serves quote to anonymous visitor; tampered/expired/withdrawn/deleted deny with no seeded-marker leak in page text OR raw HTTP body | 2026-10-30 @ testing `d1nixlclw` (`b08c3143`) | testing + Management API for expired/withdrawn transitions | 6/6 passed | Needs `SUPABASE_ACCESS_TOKEN` in runner env; expired/withdrawn transitions are DB-driven (not UI-driven) by design |
| `npm run test:precision` | unit | Deterministic geometry/pricing passes incl. touchAiOutline billing parity + unknown-level fallback = 10 (owner decision 2026-10-30) | 2026-10-30 @ `3c375067` | local, node --test + tsx | pass | AI-in-the-loop behavior excluded by design (deterministic passes only) |
| `npm run test:roof-takeoff` | unit | Free roof-takeoff builder + supplier-pricing engine contracts | 2026-10-30 @ `3c375067` | local | pass | - |
| `npm run test:calibration` | unit | Calibration pipeline contracts | 2026-10-30 @ `3c375067` | local | pass | - |
| `npm run test:topology` | unit | Topology completion contracts | 2026-10-30 @ `3c375067` | local | pass | - |
| `npx playwright test e2e/specs/phase-b-tenant-isolation.spec.ts` (+ phase25 attachment/paid-feature) | e2e-browser | Slug-level workspace-boundary denial, guessed-ID/tampered-token safety, baseline entitlement denial without side effects (see each spec header for exact PROVES / DOES NOT PROVE) | 2026-10-29 @ testing | testing | green | NOT real-record proof (QC-04 gap: real foreign attachment + signed-token lifecycle queued) |
| CI workflow (.github/workflows/ci.yml) | build+static+unit | Same deterministic gates on every PR + development push: npm ci, check:debt, 4 unit suites | first run 2026-10-30 | GitHub Actions, ubuntu, Node 24 | see Actions tab | No `next build` in CI v1 (needs env strategy); no E2E in CI (browser suites run from Gavin's box against testing) |

## Known-red / intentionally skipped

| Item | Status | Reason |
| --- | --- | --- |
| `check-smart-assistant-p17-source` + `resolver-source` | RED since Sept | Generated SQL files out of sync with generators; regen is careful manual work, migrations are live. Tracked in tech-debt ledger |
| AI-cost E2E (real model calls) | skipped by design | Paid model spend; deterministic passes + harness-level checks cover logic |
| Browser E2E in CI | not in CI v1 | Needs deploy URLs + fixture accounts; run ad hoc from Gavin's box vs testing (rows above) |
| `next build` in CI | not in CI v1 | Build requires env strategy (secrets/non-secret defaults); queued follow-up |

## Verification rules

- A row is only updated after a run that exited 0 (or with explicitly recorded failure).
- Deployed-app claims reference a deployment ID or build-id, never CDN greps (standing owner mandate).
- When a gate fails, the failure is recorded here before any fix ships.
