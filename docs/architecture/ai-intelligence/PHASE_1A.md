# Phase 1A — Intelligence foundation delivery

**Baseline:** `e2209d3e6137748d66c589e6cdc8ad0aac487d76` (owner-supplied archive).  
**Status:** implemented and tested in isolation; pending Gavin's integration/review. No feature is connected to a running app.  
**Architecture revision:** 0.2.1 (owner-approved existing 50 MiB per-file cap retained).

## Scope delivered

New modules only, under `app/lib/intelligence/`:

| Path | Responsibility |
|---|---|
| `contracts/validation.ts` | Bounded strict runtime parsers, explicit errors, duplicate detection |
| `contracts/evidence.ts` | Canonical company/quote or pre-quote intake scope; document revisions, page manifest, evidence coordinates and current-source checks; cap mirrors existing signed upload |
| `contracts/brief.ts` | Provider candidate parsing separate from stored/reviewed findings; quantity provenance, issue states, decisions, selection |
| `contracts/memory.ts` | Scoped, versioned memory records and active/approved/expiry/revocation filter |
| `contracts/policy.ts` | Default-disabled policy, action allowlist, model and spend limits |
| `contracts/tasks.ts` | Separate agent-task status and stage, attempts, deadlines, lease and fence contracts |
| `brief/candidates.ts` | Append provider candidates to trusted brief; revision and current-evidence checks; no implicit confirmation |
| `brief/coverage.ts` | Coverage derived from manifest, not model report; missing/screened/failed pages visible |
| `brief/readiness.ts` | Conservative brief-review gate; unresolved issues, stale evidence, unknown quantity basis and absent confirmed facts block readiness |
| `brief/markdown.ts` | Deterministic internal projection with source IDs/page numbers, review state and escaped text |
| `policy/admission.ts` | Fresh authority/version/entitlement/demo/mode checks; initial draft-only allowlist; reservation and settlement arithmetic |
| `policy/approval.ts` | Canonical JSON digest and exact action binding/expiry predicate; no automatic send |
| `policy/model-routing.ts` | Cheapest eligible, evaluated, enabled, budgeted model candidate; capability checks and fixture-only provider |
| `orchestration/transitions.ts` | Pure claim/checkpoint/finish/recovery/cancel/pause/resume/supersede proposals with fence/version/deadline/retry guards |

Test suite: `tests/intelligence/phase1a.test.ts`. Three documentation files in this directory. No new npm dependencies, package changes, migration, generated DB type change, legacy AI configuration, protected fixture, UI, or live runtime code path.

## Design choices and limitations

- Parsers are dependency-free strict TypeScript rather than the proposed Zod schemas. The repository already declares Zod, but installed project dependencies are not present in this isolated environment. These parsers are deliberately small and testable with the global TypeScript compiler. Reconcile schema reuse in 1B if needed; do not duplicate validation in live adapters.
- The 50 MiB source cap is a mirrored domain guard only, not an upload service. Use existing signed upload/finalizer quotas and verify the actual bytes, signatures, storage path and page count. No limit increase. Multiple files remain subject to packet/page/quota limits approved later. PDF/image/text intake and PDF rendering are not implemented here.
- `parseCandidates` is the untrusted model-output boundary. The model may propose facts and issues but cannot set approval, coverage, tenant identity, prices, policy or task status. The trusted ingestion adapter must register source evidence and validate actual excerpt/region against the original. Coordinate bounds and hashes alone do not prove a factual statement.
- `parseBrief`, `parseManifest`, `parseMemory`, `parseTask`, authority snapshots and approval receipts are shape contracts for trusted server state, not authorization. Do not accept them directly from clients or model responses. Authoritative manifest revision and record version must advance on every relevant change; apply changes with compare-and-swap. No durable persistence or RLS is present yet. Same-scope checks are defense in depth, not tenant isolation guarantees.
- All candidate facts initially require review. All unresolved issues block document-brief readiness, including low-priority issues. At least one confirmed fact is required. This is deliberately conservative until real evaluations and owner-approved exception policies. A brief marked ready is not an approved estimate, measurement, quote, or send. Unknown units/basis remain reviewable. Numeric pitch-ratio handling, manual non-document findings and conversions into `measurementLineSchema` belong in later integration; no independent quantity calculation is introduced.
- Memory stores scoped proposed/approved text and references, not a complete product knowledge or preference engine. Only server-authorized records may be activated; the filter is not an approval service or retrieval implementation. Conflicting rules, product versions, retrieval ACLs, cache invalidation and record linkage are 1B/2B responsibilities. No training, provider memory or permanent auto-learning occurs in this batch.
- Markdown is a deterministic **internal** projection. It contains source text that must remain untrusted evidence, even when escaped. Future rendering must disable raw HTML and remote resources, and the model must never interpret it as instructions. Customer-facing projection is intentionally absent until disclosure/scope rules are defined.
- Model pricing uses integer microdollars (1 USD = 1,000,000 micros) with caller-supplied upper bounds and verified registry entries. Fixture rates/model IDs in tests are fictional. No provider is selected in production. Real image/reasoning cost estimates, prompt cache, tariff versions, retries, usage settlement, timeouts and entitlement integration require adapter work. Reservations are pure arithmetic; enforce both budgets atomically in the database and reconcile uncertain usage without releasing prematurely. No spending guarantee before integration.
- Task transitions are pure proposals. The runner must store them transactionally, compare version/fence, atomically claim leases, re-check current mode and authority, and validate task attempts/deadline against admitted policy. Cancellation authorization is separate from execution admission so disabled agents can still be cancelled. Resume after approval requires a fresh admitted context, not just a state flag; later persistence must validate actual approval/decision and dependencies. A task with exhausted attempts requires a new authorized input/revision or review. No general worker, heartbeat scheduler, durable queue or notification is added.
- Approval digests bind exact validated payload hashes and versions; receipts must be server-issued, freshly authorized, single-use and consumed atomically with the action/outbox in 1B/later stages. The pure predicate cannot provide replay protection alone. There is no send implementation. The initial action allowlist rejects sending, permanent changes and destructive actions even if a policy record names them.

## Local validation

Isolated strict TypeScript compilation using ES2017 target, CommonJS output, global TypeScript 5.8.3, Node.js 22.16.0 and installed global Node type declarations. Emitted JS was run with `node --test`. **55/55 tests passed.** No app, network, credentials, live database or AI provider was used. The full log is in the delivery ZIP. The project-native command for Gavin after installing existing dependencies:

```sh
node --import tsx --test tests/intelligence/phase1a.test.ts
```

Then run the repo's required build/type/debt/billing/takeoff regression checks per AGENTS.md. This isolated compile does not establish full repo build success. No runtime schema, RLS, concurrency, storage or model-quality tests were performed.

## Next: Phase 1B (integration gates)

Read `ARCHITECTURE.md` and `IMPLEMENTATION_PLAN.md` (0.2.1). Before persistence, Gavin should return redacted current schema/RLS/grants, approved migration root, active entitlement and budget behavior, storage quota/finalization rules, queue/worker topology and baseline validation results. No secrets. Confirm the pilot company roles, default-off feature gate, cost policy, and permission to add migrations/generated types. Do not replay historical migrations. Preserve manual workflows.

Implement adapters first, with durable transaction semantics for memory/source/brief/issue revisions, task leases and budget reservation. Test authorized tenant access, cross-tenant reference denial, revision and approval invalidation, replay/idempotency, cancel/revoke, usage ambiguity, atomic leases and quota enforcement. Only then build the bounded PDF worker and job-brief review UI (2A/2B). Reuse existing measurement and quote services; no second job table and no bypass of existing approval/financial controls.
