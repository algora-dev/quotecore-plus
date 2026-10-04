# START HERE — Demo V2.2 private-testing candidate

**Prepared:** 2026-10-03  
**Owner:** Shaun · **Integration/deployment:** Gavin  
**Baseline:** supplied `quotecore-plus-lean-20261003-77e99efd(1).zip`, commit `77e99efd`  
**Return:** cumulative changed-files-only patch, including and superseding Increment 1.  
**Status:** implementation candidate for integration and private testing; not deployed, not production-approved.

## What to do with this package

Read this file first, then `docs/demo-v2.2/DATABASE_GATES.md`, `docs/demo-v2.2/TESTING.md` and `docs/demo-v2.2/VALIDATION.md`. The latest owner brief is the four-chapter **Pricing → prepared Takeoff → Customer Quote → real Smart Assistant** journey, including optional, verified, tightly limited self-send. Earlier blanket no-send and live-AI-scan proposals are superseded by that brief.

Do **not** reapply the old Increment 1 ZIP after this package. `FILE_CHANGES.json` compares every payload file to the original supplied `77e99efd` snapshot, not to Increment 1. Three-way merge against current branch if it moved. It is not a complete repository and cannot be run alone.

## Actual implementation included

- Replaces the provisioner's arbitrary existing-company copy with an explicitly authored, fictional **QCP Roofing & Construction** seed. Three libraries, 20 components, eight jobs, two orders, one invoice, tax snapshots, inert history and a prepared plan.
- Separate normal/demo browser and server auth namespaces, including preview-host routing. Corrects Supabase browser singleton reuse. Demo cookie is 24 hours; normal cookie remains 180 days.
- Durable server-confirmed guide state, actual component create/test/edit hooks, draggable/clamped desktop guide, compact mobile bottom sheet, welcome/resume/reset/completion UI.
- Prepared, **disclosed precomputed** scan feeds the existing Takeoff contract. Finishing calls the existing save and pricing path, then opens the real customer editor without presenting Advanced Builder.
- Dedicated expiring, strongly demo-branded customer preview with sandbox-only Accept/Decline. Optional self-send requires email verification, conservative allowances and explicit enablement; ordinary production send/public-token paths remain blocked for demos.
- Real Smart Assistant wrappers: guide authorization, owned conversation validation, up to ten user turns, conservative visitor/IP cost debits, request reconciliation and post-commit guide acknowledgments. Transcription and speech have separate paid-call guards.
- Reset replaces tenant data but retains anonymous visitor/resource identity. Retryable expiry cleanup and hourly cron. Demo session replay analytics are disabled.

## Required integration before Shaun tests

1. Merge; retain the existing package/lockfile and database migrations. This return adds **no dependencies or executable migrations**.
2. Use **Node 24**, run `npm ci`, full project typecheck, scoped lint, Next build and the existing roof/assistant regression gates. Restore assets intentionally omitted from the lean source snapshot from the canonical repo; do not remove their application references.
3. Check the existing demo tables/plan, exact RLS/column grants, auth isolation and normal-account negative cases against the actual testing database. Run `node scripts/demo/check-readiness.mjs` with server-side testing credentials for a read-only schema/config check. It is not an RLS audit.
4. For the full Smart Assistant chapter, Gavin must review/apply the narrow cleanup helper contract in `DATABASE_GATES.md`, test it against an expired demo, and approve the existing assistant confirmation/write policies. **Do not grant general DELETE on production assistant audit tables.**
5. Set environment values from `.env.demo-v22.example` in **testing**. Create fresh random server-only secrets. Enable `DEMO_V2_TEST_ENABLED` and the existing `demo_control.demo_enabled` switch only after the gates. Anonymous sign-in must be available in the testing Supabase project.
6. First smoke-test chapters 1–3 with AI and email disabled. Then calibrate AI reservations, enable existing AI switch and the explicit assistant integration flags, and test chapter 4. Enable optional self-send only after preview/expiry/ownership tests pass and the verified sender is approved.
7. Deploy to testing, not the public marketing launch. Run the browser checklist, including 320px/390px, two independent visitors, a normal signed-in customer in another tab, reset/expiry and real final-canvas edits. Return failures as actual logs/screenshots.

## Important limits — do not turn these into completion claims

Offline checks passed for the isolated demo domain, authored seed shape/types and existing geometry/calibration/precision suites. **Full dependency installation failed in this environment. No full Next build, full-project semantic typecheck, lint, live Supabase, browser, provider email, or real Smart Assistant end-to-end execution was completed here.** See exact evidence in `VALIDATION.md`.

The allowance implementation is conservative compare-and-swap admission using existing tables, **not** a new cross-bucket SQL transaction or actual-cost refund system. Errors may consume allowance. Calibration must bound the real pipeline's cost; ten turns is not a dollar guarantee. Direct Supabase RLS/expiry and protected-column grants remain mandatory live security gates.

The canvas interaction requirement currently advances on a successful real Takeoff save after guide prerequisites; a separately attested "rectangle drawn" event is not yet implemented. Remaining browser-level scenario checks, upload quotas and generic record limits are explicit in the testing document, not represented as proven.

## Rollback / kill switch

Set `demo_control.ai_enabled=false` to stop new demo paid admissions. Set `DEMO_SELF_SEND_ENABLED=false` to stop optional delivery. Set `demo_control.demo_enabled=false` or `DEMO_V2_TEST_ENABLED=false` to close the demo. Keep cleanup runnable for retired demo data; cron authentication still requires `CRON_SECRET`. Do not restore the former provisioner that copied a real company row. Revert source by the manifest only after considering any active demo data.

## Package map

- `RETURN_NOTES.md`: exact changes, protected areas and deviations.
- `docs/demo-v2.2/IMPLEMENTATION_NOTES.md`: source map and contracts.
- `docs/demo-v2.2/DATABASE_GATES.md`: Gavin-owned helper and live security prerequisites.
- `docs/demo-v2.2/TESTING.md`: deployment and acceptance checklist.
- `docs/demo-v2.2/VALIDATION.md`: tests actually run versus not run.
- `.env.demo-v22.example`: server-only setup, all new feature flags default off.
- `scripts/demo/`: repeatable checks using existing dependencies only.
- `FILE_CHANGES.json`: normalized baseline/payload hashes; does not list itself.
