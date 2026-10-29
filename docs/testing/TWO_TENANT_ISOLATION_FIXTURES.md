# Two-tenant isolation fixtures: implementation guide

Goal: make security E2E tests prove REAL cross-tenant denial using records
that exist. Today several specs poke nonexistent IDs (all-zero UUIDs), which
proves "missing record 404s", not "foreign record denied".

Estimated effort: half a day. Pure test code - zero production risk.
Written 2026-10-29 (Gavin) for any implementer.

## Step-by-step

1. **Fixture accounts (one-time setup).** In the TESTING environment create
   two dedicated users, e.g. `e2e-iso-a@quotecore.test` and
   `e2e-iso-b@quotecore.test`, each with its own workspace/company. Reuse the
   existing signup/auth helpers in `e2e/fixtures/auth.ts`. Tag both accounts
   (recognizable email prefix) so cleanup is exact.

2. **New spec:** `e2e/specs/tenant-isolation-real.spec.ts`, tagged
   `@security`. In a `beforeAll` (serial mode), signed in as tenant A, create
   through the real actions/API:
   - one quote with 2 lines (capture `quoteId`)
   - one attachment upload (capture `attachmentId`)
   - one customer public link (capture `token` and the quote number)
   Store all IDs in a manifest object. Make setup idempotent (reuse rows if
   the current run already created them).

3. **Control test FIRST (proves the IDs are valid):** as tenant A, load the
   quote page, the attachment, and the public link. All must succeed.
   Without a passing control, every denial test is meaningless.

4. **Denial tests (the point):** fresh browser context signed in as tenant B:
   - open A's quote page `/[workspaceB]/quotes/<A-quoteId>`: expect 404 or
     redirect, and NO A-data anywhere in the response (use the fixed
     `assertNoDataLeak` helper from phase25-public-link-privacy.spec.ts; it
     now checks every leak pattern).
   - call A's quote server actions (rename, delete) with A's quoteId: expect
     rejection. Then re-verify AS A that the quote still has 2 lines and the
     same status (mutation guard - proves no partial write leaked through).
   - request A's attachment download: expect denial.
   - hit A's API routes with A's IDs: expect 403/404 JSON with no foreign
     fields in any channel, including RSC payloads.

5. **Public-link variants:** valid token shows only public fields; modified
   token denied; revoked token (revoke as A) denied.

6. **Teardown:** delete only the manifest rows (never broad queries). Keep
   or delete the two accounts per your run policy, but never touch rows you
   did not create.

7. **Prove the tests bite (acceptance gate):** on a LOCAL dev server only,
   temporarily comment out one tenant guard (e.g. the quote ownership check),
   run the spec, confirm it FAILS, restore. If removing the guard does not
   fail the test, the test still proves nothing. Do this locally, never on
   shared testing.

8. **Run against testing:** `E2E_BASE_URL=https://<testing-url> npx playwright
   test e2e/specs/tenant-isolation-real.spec.ts`.

## Rules

- Never run destructive mutation tests against production.
- Update the older nonexistent-ID specs to delegate to these real fixtures
  where they overlap (phase-b-tenant-isolation, phase25-attachment-isolation).
- If a denial test unexpectedly PASSES cross-tenant access: STOP, report to
  the owner, do not commit a loosened assertion to make it green.
