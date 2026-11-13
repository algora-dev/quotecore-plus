# Smoke Tests — What's Current vs Historical

**Purpose:** this folder is a cumulative evidence archive. Most of it describes past deploy-day verifications, not today's flows. This README separates the live rule from the record.

## CURRENT — the only live procedure here

**Billing-matrix smoke (hard rule, owner directive 2026-10-19): run on EVERY testing deploy.**

```bash
npx vercel ls          # confirm deploy Ready, alias flipped
npm run smoke:billing  # needs QCP_TESTING_URL + BILLING_SMOKE_KEY on the testing project
```

All three rows (`legacy`, `custom_metered`, `custom_admin_granted`) must print `[PASS]` before QA is handed to Shaun. Full procedure: top section of [`CHECKLIST.md`](CHECKLIST.md). Gate-by-gate proof and last-verified state live in [`../testing/EVIDENCE_MATRIX.md`](../testing/EVIDENCE_MATRIX.md) — that file, not this folder, is the source of truth for test evidence.

## HISTORICAL — read as records, not instructions

Everything below the billing section in `CHECKLIST.md` is a dated deploy-day checklist from 2026-07 → 2026-10. Kept as evidence; do not follow as current procedure. Notable stale eras:

- **Paid-only changeover sections (2026-09-16)** — describe the trial-removal/paywall model. Predates the free-workspace signup flow (2026-11). Trial/paywall claims there are not today's flows.
- **AI-takeoff / AI-queue sections (2026-07)** — written against long-gone preview/dev deployments and superseded pipeline versions.
- **Per-feature pending-verification blocks** — snapshots of specific past deploys (affiliate 2026-10-25, flooring 2026-09-04, etc.).

Other files here are historical too: `AI_CALIBRATION_CHECKLIST.md` (AI calibration was removed from the user flow 2026-09-25), `SMART_ASSISTANT_SMOKE.md`, `AdditionalSmokeTestIssues.txt`.

## Rules

- Do not delete, rewrite, or "tidy" historical entries — they are the acceptance trail.
- New smoke-test evidence goes into `docs/testing/EVIDENCE_MATRIX.md` (update "Last verified" only after a green run) or a clearly dated new section — never by editing history.
