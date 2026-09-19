# Phase P7 — Validation, admin polish, controlled release readiness

Status: complete for code/test/admin/observability scope; live vision smoke BLOCKED by OpenAI org credits (0 remaining) — see docs/CALIBRATION_P7_SMOKE_RESULTS.md. Controlled cohort enablement remains a Shaun decision, not blocked by code.

Changed files:
- `app/admin/(dashboard)/calibration/actions.ts` (new): calibration flag admin server actions. Mirrors the smart-assistant pattern exactly (requireAdmin + createAdminClient + writeAudit + revalidatePath). Writes go through the service-role-only `set_calibration_flag` RPC (patch_046) instead of a direct table upsert — same trust model, no new auth mechanism.
- `app/admin/(dashboard)/calibration/page.tsx` (new) + `CalibrationFlagPanel.tsx` (new): grant/revoke UI mirroring SmartAssistantPanel (rounded-full buttons, rounded-lg input with orange focus, list rows with hover:bg-orange-50/40, status badge with dot). Section total ~200 lines across the three files, matching the existing admin visual language.
- `app/admin/(dashboard)/AdminNav.tsx`: additive "AI Calibration" nav entry.
- `scripts/smoke-ai-calibration.mjs` (new): cost-bounded live fixture smoke. Generates 3 sharp synthetic fixtures (dimension line "6.42 m", scale bar "0 1 2 4 m", blank negative), calls `runCalibrationSearch` directly (internal functions, auth bypassed by construction, never via the deployed app), prints per-fixture structured results + total tokens. Windows-safe file:// import of the TS module via tsx.
- `app/lib/takeoff/calibrationSession.test.ts`: +4 reducer-level E2E-matrix tests (below).
- `app/api/takeoff/calibration/route.ts`: additive structured logging only — `search_start` (action/round/strategy/requestId), `round_token_rejected reason=...`, `points_charged points=1 remaining_after=N`, `points_denied remaining=N`, `search_success` now includes token usage, plus `unsuitable reason=...`. Existing failure/refund warns unchanged. No behaviour change.
- `docs/smoke-tests/AI_CALIBRATION_CHECKLIST.md` (new): manual smoke steps for Shaun's dev account (flag via admin, chooser, AI search, accept/finish, rescan/refine, recalibrate, manual fallback, flag-off invisibility).
- `docs/CALIBRATION_P7_SMOKE_RESULTS.md` (new): honest smoke run record.

Requirements covered:
- Spec 13-P7 tasks 1 (build/lint/tests), 4 (manual fallback documented + checklist), 5 (log/observability confirmation), 6/7 partially (flag admin shipped + cohort enablement ready; rollout decision + measured fixture version pending live smoke).
- Spec 14.2 scenarios 13/14 (reducer level), simultaneous-tab independence, saved-reload hydration.
- Spec 15 structured events (search started/completed/failed, suitability, token issues, billing).

New tests (calibrationSession.test.ts, P7 describe):
- Lost-response recovery: SEARCH_FAILED frees the lock without consuming a round; same-requestId replay completes the round exactly once; a duplicate terminal SEARCH_SUCCEEDED replay is a no-op.
- Page-switch mid-search: PAGE_CHANGED advances the context epoch; the stale SEARCH_SUCCEEDED is fully discarded; old candidates never leak into a fresh session.
- Simultaneous tabs: independent session ids; foreign-session results rejected by the context guard; each tab's rounds/candidates independent.
- Saved reload: accepted set -> encodeCalibrationMetadata -> JSON -> decodeCalibrationMetadata -> START_EDIT hydration -> fresh search respects slot cap -> finish with 3 contributing references.

Validation actually run:
- `npm run test:calibration` — 122 pass, 0 fail (118 pre-existing + 4 new).
- `npx eslint` on all new/changed TS/TSX files — clean.
- Em-dash scan on all new/changed files — clean.
- `npm run build` — passed.
- `node --import tsx scripts/smoke-ai-calibration.mjs` — ran once; all 3 fixtures returned PROVIDER_ERROR 429 "no credits remaining" from the OpenAI org. 0 tokens consumed. Script mechanics (fixture rendering, direct pipeline invocation, structured error reporting) validated; vision accuracy NOT measured. Honest record in docs/CALIBRATION_P7_SMOKE_RESULTS.md.

Not yet validated:
- Live vision accuracy on the 3 synthetic fixtures (blocked: OpenAI org has 0 credits; needs a funded key, then re-run the script — 2-minute job).
- Browser/E2E matrix against the real UI (reducer level covered; browser automation was out of P7-subtask scope by instruction).
- Billing reconciliation and quota-exhaustion UX against the live dev database.
- Dedicated CALIBRATION_TOKEN_SECRET (still falls back to OPENAI_API_KEY for HMAC round tokens — carried limitation from P5/P6).

Migration / compatibility notes:
- No schema changes; `set_calibration_flag` RPC already shipped in patch_046 (service-role only). The admin panel calls it through the existing service-role admin client.
- Route logging is additive; no response contract changes.

Remaining work and next phase:
- Fund the OpenAI org, re-run `scripts/smoke-ai-calibration.mjs`, record per-fixture accuracy in the results doc.
- Walk docs/smoke-tests/AI_CALIBRATION_CHECKLIST.md on dev with Shaun's account.
- Controlled cohort enablement via Admin -> AI Calibration (ready to use).
- No commit or push performed (working tree left uncommitted with prior phases, as instructed).
