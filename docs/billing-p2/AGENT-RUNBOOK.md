# Agent runbook

## Objective

Integrate P2 into the current branch without rewriting P1 or altering current customers' legacy subscriptions. Finish the explicit host bindings, validate on a disposable database, then deploy only to testing. Return evidence before asking Shaun to approve production.

## 1. Preserve the recovery point

Commit/push the P1 integration and any subsequent fixes. Compare with the packet's `27d19446` baseline. Inspect the package manifest and patch. The installer stops on changed source rather than overwriting newer work.

Keep `CUSTOM_BILLING_CHECKOUT_ENABLED=false` and do not set `CUSTOM_BILLING_LIVE_APPROVED=true`. Keep P1 renewal/webhook processing running. Do not redirect a live webhook or change production credentials for this exercise.

One database is shared by development, testing and production. A testing branch does not isolate database changes. A disposable database run comes before any shared-database DDL.

## 2. Inventory the actual database

Run `tools/billing-p2/preflight.sql` read-only. Confirm:

- The P1 paid snapshot/grant tables and current deployed P1 transaction are present.
- Custom company count is still zero. The first P2 migration intentionally refuses if any custom company exists. Do not delete a real snapshot to bypass that refusal. Existing custom accounts need an explicit opening balance/cutover plan, including current quotes, tasks, scan reservations and files.
- The live definitions of `create_quote_atomic`, `sa_admit_run`, `sa_check_turn_quota`, `get_ai_assist_points_status`, `company_has_feature`, `fn_quote_status_usage_delta` and storage triggers are captured.
- No client can update company billing identity, paid grants, usage counters or P2 ledgers directly.
- Current storage counters reconcile with `quote_files`; orphan objects and in-flight operations are separately inventoried.
- There are no pending legacy scan/calibration jobs to cross a future legacy-to-custom conversion. Switching remains disabled in P1.

Keep real secrets and customer content out of returned reports. Function definitions, aggregate counts, redacted fixtures and environment variable names are sufficient.

## 3. Apply source and test

From the unpacked handoff:

```sh
python install.py --repo /path/to/quotecore
python install.py --repo /path/to/quotecore --apply
```

The first command is a dry run. It checks every original and replacement hash. The second makes source changes with a local backup. It does not run migrations, install dependencies, deploy, or change Stripe.

Inside the repository:

```sh
node --test tests/billing-p2/*.test.cjs
node tools/billing-p2/check-source.cjs
python tools/billing-p2/test-postgres.py --image postgres:16 --report p2-db-report.json
```

The Docker image must already be present. The harness creates a named disposable PostgreSQL instance with no network, published port, or persistent volume. It never accepts a connection URL. Its synthetic schema covers relevant contracts, not the whole live application's RLS, triggers, libraries or workers.

Also run the same batteries on a sanitized disposable copy of the ACTUAL schema. Preserve and rerun all P1 tests, original legacy regression fixtures, existing Assistant/calibration suites, full TypeScript checks and the Next build. Compare any existing unrelated failures to the saved baseline instead of suppressing new errors.

## 4. Complete host bindings

Follow `BINDINGS-AND-GAPS.md`. Required work includes the actual scan caller, active Assistant provider loop, voice provider budget, queued scans/calibration, Offcut execution gate, all upload/delete paths, and account usage/error displays. The budget policy is not a substitute for instrumenting provider calls. Never enable it merely to clear an error.

Regenerate Supabase types after the disposable migration run. The packet's generated type file is UTF-16 and predates these functions; this patch does not fabricate a replacement generated file. Narrow RPC shims are intentional until regeneration.

## 5. Apply approved database migrations

Only after disposable/full-schema tests and review, apply these in order:

1. `20261010160000_custom_usage_p2.sql`
2. `20261010161000_custom_scans_p2.sql`
3. `20261010162000_custom_storage_p2.sql`
4. `20261010163000_custom_usage_wrappers_p2.sql`
5. `20261010164000_custom_assistant_budget_p2.sql`

Each is transactional. Do not rerun individual statements manually or ignore an error. Check whether a prior partial rollout already committed any complete migration. The shared database does not have a reliable migration-history table in the supplied report, so record applied filename and SHA-256 explicitly.

Migration 4 copies each installed legacy body into an owner-only helper, then replaces the public function IN PLACE. Public OIDs are preserved because existing RLS policies/dependencies may reference them. Do not change this to rename-and-recreate.

No production Assistant policy is seeded. After the active adapter and audio path are reviewed, create a disabled policy, review its budgets, test it, then enable the test-scope policy only. Confirm every callback/tool loop/retry uses the adapter before enabling.

## 6. Deploy testing and collect evidence

Reconfirm the test Stripe account ID and webhook endpoint. A `200` from `/pricing` proves only route availability. Test purchase, paid grant, consumption, renewal, failure, retry and limit-hit behavior. Show that the exact purchased allowance reaches actual endpoints, not just the UI.

Use two browser sessions and separate database connections for race tests. Test drafts, clones, all scan qualities, failed component tails, Assistant retries/streaming, duplicate uploads and deletion failures. Test expiry and renewal without manufacturing a 30-day period in application code.

Keep invoice/payment/subscription changes under P1/P3 ownership. This patch does not enable upgrades, downgrades or legacy conversions.

## 7. Return to Shaun

Return a lean packet with:

- Commit SHA, changed-file hashes, final applied migration hashes and testing URL.
- P2 Node/SQL/concurrency output, full-schema legacy results, typecheck/build output and browser evidence.
- The exact active provider/client/worker/policy bindings and any corrections you made.
- Test purchase-to-grant-to-usage evidence, webhook/environment confirmation and remaining blockers.

Do not claim production-ready until all bindings and P3 payment lifecycle checks are complete. Production deployment requires Shaun's explicit approval.

## Rollback

Before any custom customer exists, the application can roll back to the known P1 build while leaving the additive P2 database objects installed. Validate legacy behavior first. Disable the new custom purchase path and budget policy; do not disable legacy renewals or delete Stripe objects.

Once custom customers or usage exist, do not roll back to code that ignores their usage. Keep the ledgers and paid grants, pause only affected custom mutations, and use a forward repair or explicitly reviewed database/function restoration. Never delete usage to make a failing test pass.
