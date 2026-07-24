# QuoteCore+ Phase 1 E2E Test Harness - Implementation Plan

**Date:** 2026-07-24  
**Owner:** Gavin  
**Implementation model:** GLM 5.2 after Gerald review  
**Source brief:** `C:\Users\Jimmy\.openclaw\workspace-gerald\audits\quotecore-plus-launch-2026-07-24\06-phase-1-e2e-test-harness-brief.md`  
**Status:** Plan only; no harness code implemented

## 1. Goal

Build a Playwright browser regression harness that runs only against `https://quotecore-plus-dev.vercel.app`, uses ordinary E2E users through real customer-facing paths, and verifies launch-critical journeys, persistence, entitlements, concurrency protection, routing, public pages, and ordinary-user access boundaries.

This is a rapid dev regression net. It is not production certification, a load test, a complete security audit, or proof of Stripe/provider reliability.

## 2. Non-Negotiable Safety Rules

Dev currently shares the production Supabase project, so data safety outranks coverage.

1. Abort before browser launch unless `BASE_URL` is exactly `https://quotecore-plus-dev.vercel.app`.
2. Reject main, production, preview, localhost, IP, and lookalike hosts.
3. Use only named ordinary E2E email/password accounts.
4. Never load admin, service-role, database, Supabase dashboard, Stripe, Resend, OpenAI, or provider credentials.
5. Never import or create a Supabase client under `e2e/`.
6. Never perform direct database queries, schema work, resets, bulk deletes, or storage-wide cleanup.
7. Prefix every generated entity with `E2E-<run-id>`.
8. Track created entities in a local manifest: type, owner account, visible name, URL/ID, and cleanup path.
9. Perform automatic cleanup only inside the same test that created the entity, after exact manifest, prefix, and visible-owner verification.
10. Never run a standalone deletion/recovery command in Phase 1. Leftovers enter a manual review queue; any cleanup utility is dry-run/report-only.
11. Start with `workers: 1`; no parallel mutation tests.
12. Keep credentials, auth state, traces, screenshots, videos, tokens, and reports local and gitignored.
13. Disable email sending unless an explicit opt-in and exact recipient allowlist both pass.
14. Do not invoke Stripe or real AI services in the automated Phase 1 suite.

## 3. Dev/Main and Admin Environment

### Verified parity baseline

At plan creation, `main`, `development`, `origin/main`, and `origin/development` all point to commit `f7731fcc43d0114a3fe7a568f9aa2dd5d47580e2`. There is no branch divergence.

### What is separate

Dev and main are separate deployments/hosts. On the Vercel hosts, auth cookies should be host-scoped. Before implementation Gavin will manually verify:

- dev admin is served from the dev host and main admin from the main host;
- logging into dev admin does not authenticate the main host;
- logging out of dev admin does not alter a separate main-host session;
- both deployments expose the same expected admin navigation and key read-only pages at the parity baseline;
- dashboard, users, admins, support, suppressions, free-tool usage, rate limits, and settings render equivalently.

### What is not separate

Both deployments currently use the same Supabase project. Auth users, companies, plans, admin audit data, and E2E records are therefore shared. A test user created via dev admin will also be visible in main admin.

The plan must not claim data isolation. True dev/main admin data separation requires the Phase 2 staging Supabase project.

### Admin access boundary

Shaun has authorised Gavin to create the test accounts through the existing admin UI during setup. This is manual fixture provisioning, not a harness capability. Playwright never receives or stores admin credentials and never automates admin mutations.

## 4. Test Account Provisioning

Gavin will create five ordinary accounts:

| Fixture | Purpose | Required state |
|---|---|---|
| E2E Trial Company A | Trial restrictions and baseline flows | Onboarded; Trial |
| E2E Starter Company B | Core paid flows | Onboarded; Starter |
| E2E Paid Company C | Higher-tier access | Onboarded; Pro or Pro Plus |
| E2E CrossTenant Company D | Tenant isolation | Onboarded; separate company |
| E2E Onboarding User E | Repeatable onboarding gate | Onboarding incomplete |

Account rules:

- Use synthetic, admin-confirmed email-format logins; prefer a reserved non-delivery domain such as `quotecore.invalid` if accepted.
- Do not use real customer addresses.
- Generate unique strong passwords and store them only in local gitignored `.env.e2e`.
- Never put passwords in source control, this plan, memory, reports, screenshots, or chat.
- Inject secrets through local secret management now and CI secrets later; never copy them into tickets or reports.
- Redact E2E emails, passwords, session values, and token-looking strings from Markdown output and traces where feasible.
- Document only fixture name, email, workspace slug, company, plan, and intended tests.
- Verify each completed account by normal email/password login, never impersonation.
- Keep User E unfinished. Automated onboarding coverage stops before final submission so the fixture remains reusable.
- Full onboarding completion and Google OAuth remain manual smoke tests using a fresh alias/dedicated Google account.

## 5. Safe Email Model

Shaun supplies one recipient mailbox he controls. Email tests require:

- `E2E_ALLOW_EMAIL_SEND=true`; and
- `E2E_SAFE_RECIPIENT_EMAIL` exactly matching the approved address.

Each message uses an `E2E-<run-id>` subject/reference. Playwright verifies QuoteCore's visible send result and records time/reference. Shaun manually confirms receipt, content, and customer-link behaviour. No mailbox/provider credentials enter the harness.

## 6. Automated AI Model

Automated tests must not spend points or call OpenAI. Playwright intercepts `/api/takeoff/scan-jobs` to simulate queue, cancellation, stage changes, success, insufficient points, failure/refund, rescan, and duplicate protection. Every mocked-AI test must assert that interception occurred and fail immediately if any real scan-job request reaches the dev server.

This verifies the browser UI/state machine only. One real budget-capped AI scan remains a separate manual canary.

## 7. Planned Files and Runtime Policy

```text
playwright.config.ts
e2e/
  config/{account-matrix,accounts,guard,noise-allowlist}.ts
  fixtures/{auth,base,evidence,run-context}.ts
  pages/{login,quotes,quote-builder,takeoff}.page.ts
  reporters/summary-reporter.ts
  specs/
    auth-routing.spec.ts
    quotes-customers.spec.ts
    calculations-catalogue.spec.ts
    attachments-public.spec.ts
    invoices-orders.spec.ts
    plans-entitlements.spec.ts
    takeoff-ai-ui.spec.ts
    resilience.spec.ts
    access-boundaries.spec.ts
    public-surface.spec.ts
  test-data/{plan-fixture,attachment-fixture}.pdf
  global-setup.ts
  global-teardown.ts
.env.e2e.example
docs/testing/phase-1-e2e.md
```

Prefer role/label/name/heading selectors. Add `data-testid` only when no stable semantic selector exists. Use page objects only for repeated workflows.

Planned commands:

- `npm run e2e:smoke` - P0 suite against the approved dev origin.
- `npm run e2e` - all deterministic Phase 1 journeys.
- `npm run e2e:email` - opt-in safe-recipient cases.
- `npm run e2e:report` - open the latest local report.
- `npm run e2e:cleanup:dry-run -- --run-id=<id>` - report-only leftover inspection; never deletes.

Initial Playwright policy: Chromium desktop only, one worker, `retries: 0` for every mutation suite, screenshot/trace/video retained on mutation failure, HTML/JSON/Markdown reports, and no local web server. A separate explicitly tagged read-only project may use one retry for navigation/crawl diagnostics only.

Use metadata tags from day one: `@smoke`, `@mutation`, `@read-only`, `@email-opt-in`, `@mocked-ai`, `@manual`, and `@cross-tenant`. Keep fixture plan/state requirements in the versioned account matrix and fail as `fixture drift` before mutation when state differs.

## 8. Evidence Contract

Every failure records stable ID/severity, run ID, account/plan, start/final URL, actions, visible failure, response status/failed request, console/page errors, screenshot, trace/video path, reproducibility, customer impact, and cleanup status.

Fail on `pageerror`, same-origin 5xx responses, first-party failed requests, and redirect loops. Do not blanket-fail console warnings or third-party noise. Maintain a small versioned allowlist for known harmless third-party console/network events; every entry requires a pattern, reason, owner, and expiry date.

Public crawling is limited to same-origin, explicitly allowlisted QuoteCore paths. It must not follow external links, submit forms, download unknown files, or mutate state.

## 9. Implementation Phases for GLM 5.2

### GLM execution protocol

For each phase, GLM 5.2 must:

1. Work only on the current phase; do not pre-build later-phase features.
2. List the exact files it intends to add/change before editing.
3. Preserve all safety rules even if a journey becomes difficult to automate.
4. Prefer skipping with a documented limitation over adding a privileged hook or direct database access.
5. Run only the validation named by that phase, then report changed files, commands, results, and unresolved risks.
6. Stop immediately on a host/account guard failure, ownership ambiguity, unexpected non-E2E data, or any real AI/Stripe request.
7. After two failed implementation attempts on the same issue, stop patching and return a root-cause/replan note.
8. Mark the phase complete only when its gate passes; otherwise leave it in progress for review.

### Phase 0 - Prerequisites and fixtures

1. Verify branch parity and admin deployment/session/function parity.
2. Create the five ordinary accounts through dev admin.
3. Record their non-secret account map and workspace slugs.
4. Apply Trial, Starter, paid, and cross-tenant states through existing admin controls.
5. Verify normal login for each completed account.
6. Obtain Shaun's safe recipient email.
7. Add Shaun's approved non-sensitive plan and attachment fixtures.
8. Audit UI cleanup paths for quotes, customers, invoices, orders, attachments, and takeoff records.
9. Classify every journey as automated, mocked, opt-in, hybrid, or manual.

**Gate:** Shaun and Gerald approve the account/environment matrix and accept that dev/main data is shared.

### Phase 1 - Harness and safety controls

1. Add `@playwright/test`, config, and scripts.
2. Add exact-origin and exact-account pre-browser guards.
3. Reject forbidden credentials/configuration.
4. Add run IDs, serial execution, tags, and the versioned account matrix.
5. Add explicit gitignore rules for `playwright-report/`, `test-results/`, `blob-report/`, `.auth/`, `e2e-artifacts/`, local manifests/reports, and storage state.
6. Add `!.env.e2e.example` because the existing `.env*` rule would otherwise ignore the safe template.
7. Add a static check blocking Supabase, Stripe, OpenAI, and admin-client imports under `e2e/`.

**Gate:** wrong host and wrong account abort before any browser opens.

### Phase 2 - Fixtures and observability

1. Add ordinary-user login fixtures and local storage states.
2. Add run naming and ownership manifests.
3. Capture console, page, response, and request failures.
4. Add safe upload/download helpers.
5. Add same-test automatic cleanup only after exact manifest, prefix, and visible-owner checks.
6. Add a manual leftover review report; do not add a deletion command.
7. Add concise redacted Markdown reporting.
8. Run one harmless create/read/delete cycle twice.

**Gate:** no unowned data remains and forced failures produce usable evidence.

### Phase 3 - P0 smoke journeys

Implement auth/session, protected-route redirect, quote validation/create/save/reload/edit, customer linking, calculations, summary/export, invoice, material order, manual takeoff, duplicate submit, public route crawl, cross-tenant denial, and admin denial.

**Gate:** `npm run e2e:smoke` completes only on dev and produces a concise report.

### Phase 4 - Entitlements and secondary workflows

Add password-reset request, onboarding gate/routing, catalogue access, attachments, plan display, Trial-versus-paid access, public-link coverage, and opt-in safe-recipient send.

Plan-sensitive tests verify visible fixture state first. Entitlement drift produces a fixture-state error, not a misleading product failure.

**Gate:** all accounts match the approved feature matrix.

### Phase 5 - Resilience and AI UI

Add mocked queue/cancel/points/refund/rescan, rapid double-click protection, two-tab save protection, and refresh/back/forward recovery.

**Gate:** no duplicate record, silent lost update, unexpected 5xx, or real AI request.

### Phase 6 - Repeatability and documentation

1. Run the deterministic suite twice.
2. Inspect E2E companies via normal UI for unowned pollution.
3. Exercise dry-run leftover reporting for one known run ID; perform no standalone deletion.
4. Force a failure and verify git status, artifact capture, and redaction; confirm no plaintext credentials/tokens are exposed.
5. Document setup, commands, fixtures, cleanup, reports, and limits.
6. Run one hybrid email check with Shaun.
7. Run manual Google OAuth, full onboarding, and real AI canary checks.
8. Run `npm run build`.

**Gate:** Gerald's acceptance criteria pass and Gerald approves the evidence.

## 10. Deterministic Journey Catalogue

Every journey must define its account/precondition, exact actions, visible assertion, network assertion, persisted user-visible result, and cleanup owner.

| ID | Journey | Required result | Cleanup |
|---|---|---|---|
| E2E-01 | Login, reload persistence, logout | Workspace persists through reload; logout blocks protected routes; no unexpected 4xx/5xx | Clear local state |
| E2E-02 | Invalid login and unauthenticated direct route | Safe error/redirect; no protected-content flash; no session | None |
| E2E-03 | Password-reset request | Non-enumerating confirmation; request accepted without 5xx | Link completion manual |
| E2E-04 | Onboarding gate/workspace routing | User E remains in onboarding; Starter B reaches workspace; no loop | Clear sessions |
| E2E-05 | Quote required-field validation | Stable errors; no successful create action; no matching quote | None |
| E2E-06 | Quote create/save/reload/edit | Exactly one quote; final values survive reload; no mutation 5xx | Delete via quote UI |
| E2E-07 | Customer create/search/select/edit | Updated customer remains linked/searchable after reload | Unlink/delete through audited UI path |
| E2E-08 | Builder calculation and invalid input | Deterministic valid total; invalid values handled; valid state persists | Quote owns child cleanup |
| E2E-09 | Catalogue/component entitlement | Trial blocked with no record; paid path succeeds and persists | Delete paid fixture |
| E2E-10 | Attachment/plan lifecycle | Upload/list/download/reload/delete works; no 5xx | Exact-owned UI delete |
| E2E-11 | Quote summary/export | Summary matches builder; non-empty expected download | Quote cleanup |
| E2E-12 | Public quote link/optional send | Intended data only; invalid token safe; optional send recorded | Quote cleanup; Shaun confirms email |
| E2E-13 | Invoice create/edit/reload/preview/delete | Values/totals persist; no payment route invoked | Invoice UI delete |
| E2E-14 | Material order create/edit/reload/preview/delete | Lines/totals persist; no Stripe request | Order UI delete |
| E2E-15 | Account plan/quota display | Trial/Starter/paid labels and quotas match matrix; read-only | None |
| E2E-16 | Trial restrictions versus paid access | Trial creates nothing; paid user succeeds and persists | Delete paid fixture |
| E2E-17 | Manual digital takeoff | Upload, calibration, area/component, save, and reopen persist | Quote owns takeoff/file cleanup |
| E2E-18 | Mocked AI queue/cancel | Queued copy/cancel visible; cancel restores choices; no real AI traffic | Remove mock; quote cleanup |
| E2E-19 | Mocked AI points/failure/rescan | Upgrade, refund, result, and duplicate states display correctly | No real AI data; quote cleanup |
| E2E-20 | Rapid duplicate submit | One entity or explicit idempotent response; no broken state/5xx | Delete one entity |
| E2E-21 | Two-tab save protection | Explicit conflict/recovery or deterministic final state; no silent corruption | Quote cleanup |
| E2E-22 | Refresh/back/forward recovery | No blank page/loop/duplicate mutation; last confirmed save intact | Quote cleanup |
| E2E-23 | Same-origin allowlisted public route crawl | Never leaves dev origin or submits forms; no 404, loop, pageerror, first-party failure, or same-origin 5xx | None |
| E2E-24 | Company A direct access to Company D fixture | Safe denial/404 with no D names, totals, files, IDs, or payload | D deletes fixture via UI |
| E2E-25 | Ordinary user attempts admin routes | Redirect/403/safe denial; no admin content or mutation | Clear session |

## 11. Default Smoke Set

`e2e:smoke` initially runs E2E-01, 02, 05, 06, 07, 08, 11, 13, 14, 17, 20, 23, 24, and 25.

The exact host/account guard is a prerequisite step for every smoke run. E2E-24 and E2E-25 are mandatory and cannot be excluded from smoke selection.

Email delivery, password-reset delivery, Google OAuth, full onboarding completion, and real AI are outside the default smoke command.

## 12. Acceptance Criteria

Implementation is complete only when:

1. One command runs smoke tests against the approved dev host.
2. Wrong host/account fails before browser action.
3. The harness has no privileged provider/database credentials or clients.
4. All generated records use the run prefix.
5. Automatic cleanup occurs only in the creating test after ownership proof; standalone cleanup is disabled/dry-run only.
6. Two consecutive deterministic runs do not pollute non-E2E data.
7. All 25 journeys are implemented or explicitly classified with rationale.
8. Failures preserve the required evidence and customer-impact summary.
9. Redacted Markdown and HTML reports are produced, and artifact folders are verified as ignored after a forced failure.
10. Admin deployment/session separation and functional parity are manually verified.
11. Documentation acknowledges that dev/main data remains shared.
12. `npm run build` passes.
13. Mutation suites have zero automatic retries; any retry-enabled project is read-only only.
14. Gerald approves safety and evidence before release use.

## 13. Explicit Limits

Phase 1 does not prove main/production behaviour, Stripe correctness, automated external email delivery, Google OAuth automation, full onboarding repeatability, real AI worker correctness, provider outage resilience, load capacity, every browser/mobile layout, every visual detail, absence of all security vulnerabilities, or dev/main database isolation.

## 14. Phase 2 Direction

Move to a dedicated staging Supabase project, migration-driven fixtures/reset, Stripe test mode, controlled AI canaries, broader RLS/API coverage, multiple browsers/mobile, safe parallelism, CI gates, dedicated mailbox assertions, and true admin/data isolation.

## 15. Gerald Review Resolution

Gerald approved the plan subject to revisions. This version incorporates all four required changes and the recommended improvements:

1. Zero retries for mutation suites; retries allowed only in an explicitly read-only project.
2. Standalone cleanup deletion removed; only same-test verified cleanup plus dry-run/manual leftover review.
3. Explicit artifact ignores and `!.env.e2e.example` requirement added.
4. Same-origin crawler and precise console/network failure policy added.
5. Suite tags and versioned fixture-state matrix added.
6. Credential/report redaction and private artifact handling added.
7. AI interception must be proven and any real scan-job request fails the test.
8. Host/account guards are smoke prerequisites; cross-tenant and admin denial remain mandatory.

## 16. Handoff

1. Shaun sends this plan path to Gerald.
2. Gerald reviews safety, coverage, and scope.
3. Gavin revises the plan if required.
4. Shaun approves implementation.
5. Gavin returns to GLM 5.2 and implements phase-by-phase, stopping at each gate.
6. Gavin runs the build and suite and returns evidence for Gerald's final review.
