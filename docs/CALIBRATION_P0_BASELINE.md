# CALIBRATION P0 BASELINE — Repository Reality Map

**Date:** 2026-09-19 · **Phase:** P0 (repository baseline, read-only)
**Repo:** `C:\Users\Jimmy\.openclaw\workspace-gavin\projects\quotecore-plus`
**Spec:** `docs\AI_ASSISTED_CALIBRATION_IMPLEMENTATION_PLAN.md` + `..._CONTINUATION_10_2_ONWARD.md` (source of truth)
**Prototype:** `qc-external-handoff\improved.zip` — verified **NOT integrated**; none of its symbol names exist in the repo (see §9).

Paths below are relative to the repo root. `TakeoffWorkstation.tsx` = `app\(auth)\[workspaceSlug]\quotes\[id]\takeoff\TakeoffWorkstation.tsx` (abbreviated **TW**), `actions.ts` = same directory.

---

## 1. Calibration flow today (manual two-click only — NO AI calibration exists in production code)

### 1.1 Files
| Concern | Real file |
|---|---|
| Workstation (state, handlers, canvas) | `TW` — **6,471 lines** (spec/audit said 7,045 — that was the prototype's modified copy) |
| Server actions | `app\(auth)\[workspaceSlug]\quotes\[id]\takeoff\actions.ts` — 1,211 lines |
| Manual entry modal | `app\(auth)\[workspaceSlug]\quotes\[id]\takeoff\modals\CalibrationModal.tsx` (3,825 bytes) |
| Duplicate domain types | `app\lib\takeoff\reconstructTypes.ts` (CalibrationPoint/Calibration duplicated from TW lines 180–193) |
| **NOT FOUND** | `app\lib\takeoff\calibration.ts`, `calibrationTypes.ts`, `calibrationCoordinates.ts`, `ai-calibration-v2.ts`, `outlineValidation.ts` — none exist in the repo. All "improved"/v2 calibration code is prototype-only. |

### 1.2 State & handlers (TW)
- Calibration state: TW lines 245–254 (`calibrationMode`, `calibrationPoints`, `calibrations`, `_activeCalibrationId`, `showCalibrationModal`, `tempCalibrationLine`, `calibrationConfirmed`, `showCalibrationHelp`).
- Refs mirror state for stale-closure safety: TW 3125–3173 (`calibrationsRef`, `calibrationModeRef`, `calibrationPointsRef`).
- Per-page cache: TW 315–316 `pageCalibrationsRef = useRef<Map<string, Calibration[]>>` keyed by page DB id; save/restore on page switch at TW 1220–1256 & 1278–1362.
- Two-click capture: TW 3631–3692 — `canvas.getScenePoint(opt.e)` (scene coords, **not** rounded; `const newPoint = { x: pointer.x, y: pointer.y }`), yellow markers + line, second point opens `CalibrationModal`.
- `handleSaveCalibration` (TW 4891–4926): `scale = actualDistance / pixelDistance` where pixelDistance = Euclidean scene-pixel distance. **`scale` semantics = real-units-per-scene-pixel — CONFIRMED** (matches spec §9.1). Unit is only `'feet' | 'meters'`; **no unit normalisation before averaging** (see §9 gap G1).
- `handleConfirmCalibration` (TW 4843), `handleCancelCalibration` (4870), `handleStartCalibration` (4830 — recalibrate clears existing calibrations + confirmation, i.e. destructive reset, TW 4833–4835).
- Cap of 3: enforced only by the modal's `canAddAnother = calibrationNumber < 3` and TW 4922 `addAnother && updatedCalibrations.length < 3`.

### 1.3 Averaging — CONFIRMED unit-mixing risk
Every consumer computes the mean of stored `cal.scale` directly, with no unit conversion:
- TW 2162 (multi-lineal live sum), **TW 3110 (`calculatePolygonArea`: `avgScale = mean(cal.scale)`; `realArea = pixelArea × avgScale²`)**, TW 3375 (line measurement), TW 4915 (save-time), TW 5190/5200/5901 (UI display "x unit/px").
`calibrations[0].unit` is used everywhere for display (TW 1159, 2355, 5244, …) — if records mix feet/meters the mean is numerically wrong. Spec §2.1 finding [C02] **CONFIRMED against repo**.

### 1.4 Where scale is consumed (measurement materialisation)
- Line: TW 3373–3378 — `realDistance = pixelDistance × avgScale` at draw time; value stored on the measurement record (`m.value`).
- Area: TW 3098–3122 `calculatePolygonArea` — stored into `roofAreas[].area` and measurement value.
- Multi-lineal: TW 2151–2162.
- Volume 3D / L×H freestyle: TW 2355–2410, 6647–6690 (uses calibrated area × user depth/height).
- Once written, values are **materialised** (state + DB) and NOT recomputed if calibration changes — spec finding [C10] **CONFIRMED**.

### 1.5 Undo/redo
TW 585 `useStateHistory<TakeoffSnapshot>(2)` (`app\lib\takeoff\useStateHistory.ts`); snapshots include calibrations (TW 618–621, restore 777–813). No Fabric-JSON history. Matches spec [C12] expectation.

---

## 2. save_takeoff_atomic

- **Caller:** `actions.ts` `saveTakeoffMeasurements` (line 30; RPC invoked ~line 432: `supabase.rpc('save_takeoff_atomic', { p_quote_id, p_payload })`).
- **SQL (original):** `backend\supabase\migrations\20260505180000_save_takeoff_atomic.sql` (+ ~15 follow-up migrations: enum casts 20260507200000, ownership 20260510130000, page_id 20260520140000, scoped delete 20260520150000, reconcile 20260520160000, trade compat v1/v2 20260525…, session version 20260526150000, overload fix 20260526160000, and supabase\migrations 2026070x rpc v5–v8 series).
- **Persists:** `quote_takeoff_measurements` rows (`measurement_value` — the materialised number, `measurement_unit`, `canvas_points`, `entry_inputs`, `page_id`, `quote_roof_area_id`), roof areas, component entries, canvas/lines storage paths, session version guard (`STALE_TAKEOFF_VERSION` → actions.ts ~437).
- **Calibration is NOT part of the RPC.** After the RPC succeeds, `actions.ts` lines ~447–457 does a **separate, explicitly non-fatal** `takeoff_pages.update({ scale_calibration })` scoped `.eq('id', currentPageId).eq('quote_id', quoteId)`, wrapped in try/catch that only `console.warn`s. Spec finding [C09] ("calibration save treated non-fatal") **CONFIRMED** in production repo.
- Followed by non-fatal `recalcAllQuoteComponents` + `quote_files` inserts.

---

## 3. AI point metering

- **Client/server constant:** `app\lib\takeoff\pointCost.ts` — `AI_SCAN_POINT_COST = { low: 2, medium: 6, high: 12 }` (comment: SQL cannot import this; keep in sync manually).
- **SQL (two locations, values DIFFER):**
  - `supabase\migrations\20260722200000_ai_assist_points_quota.sql` — `check_and_deduct_ai_points(company_id, points)` (line 47), `get_ai_assist_points_status` (123), `reset_ai_assist_points` (162). Header comment says low=2/medium=4/high=8.
  - `supabase\migrations\20260724120000_ai_scan_jobs.sql` — `ai_scan_jobs` table (line 11), `submit_ai_scan_job` RPC (63) deriving cost by quality (line 136; header low=2/medium=4/high=8), points lifecycle `reserved → charged | refunded`, `refund_ai_scan_points` (180). ⚠️ SQL costs (4/8) are stale vs `pointCost.ts` (6/12) — the drift the pointCost comment warns about is live.
- **Scan-jobs route:** `app\api\takeoff\scan-jobs\route.ts` — POST gated by env flag `AI_TAKEOFF_ENABLED === 'true'` (line ~27), quote-ownership check, roofing-only check, idempotency key, `submit_ai_scan_job` via service-role client, GET polls status, DELETE cancels + refunds.
- **Cron queue:** `app\api\cron\process-ai-scan-queue\route.ts` (authorised, calls `app\lib\takeoff\scan-worker.ts` to claim/process queued jobs).
- **Direct route:** `app\api\takeoff\ai-scan-v3\route.ts` (1,227 lines) — stages `scan1|scan2|scan3` only; **`stage: 'calibrate'` does NOT exist** (grep zero hits) — the spec's "temporary compatibility adapter" target has nothing to adapt yet. Ownership: quote checked (716–719); `pageId` used in `takeoff_pages` writes scoped `.eq('id', pageId).eq('quote_id', quoteId)` (884–895, 1057–1063, 1328–1331) but there is **no explicit page-belongs-to-quote validation before use** — spec finding (page-ownership gap) **CONFIRMED** (writes are quote-scoped, so no cross-tenant write, but a foreign pageId within the same quote silently no-ops rather than 404s).

---

## 4. Scene coordinates

- `MAX_CANVAS_DIM = 2000` — TW line 150. `computeCanvasDimensions` (TW 152–158): uniform scale `dims.scale` capping longest edge, aspect preserved.
- Background: TW 2268–2280 — canvas sized to processed dims; `FabricImage` set with uniform `scaleX: scaleY: dims.scale`, left/top 0. Same at TW 3254, 3992, 4044.
- Input: `canvas.getScenePoint(opt.e)` throughout (TW 3308, 3397, 3443, 3472, 3633, 3711, 3742, 3887). **No rounding of stored coordinates** — spec finding "candidate coordinates rounded" applies to the *prototype's AI path only*; the repo's manual path stores raw floats. Viewport scaling at TW 4189–4193 is render-only.
- Server-side: `app\lib\takeoff\scan-engine.ts` line 85 `MAX_OUTPUT_PX = 2000`, sharp `resize fit:'inside' withoutEnlargement` (91–92); clamps model coords to image bounds (164) — the clamp-on-hallucination the spec forbids for calibration is present here.
- **Stored geometry frame:** scene coords in the capped 2000-px reference frame (background scale uniform). `takeoff_pages` has `pan_zoom_state jsonb` (schema below) but geometry uses scene frame.

---

## 5. Feature flag pattern → proposed calibration flag

### 5.1 Existing pattern (Smart Assistant dark launch)
`backend\supabase\migrations\quotecore_v2_patch_042_smart_assistant_feature_flag.sql`:
- Table `assistant_feature_flags(company_id uuid PK → companies, enabled bool default false, updated_at, updated_by)`; absence of row = disabled.
- RLS ON; SELECT-only policy `assistant_feature_flags_read_own` via `user_belongs_to_company(company_id)`; **no write policies — service-role/admin panel only** (deliberate: a `companies` column would be self-enableable via `companies_update_own`).
- `SECURITY DEFINER` helper `smart_assistant_enabled(p_company_id uuid) RETURNS boolean` (COALESCE false), exec granted to authenticated.
- App consumers: `app\(auth)\[workspaceSlug]\layout.tsx`, `assistant\page.tsx`, `account\smart-assistant\*`, `admin\(dashboard)\smart-assistant\actions.ts`.
- Separate quota knob: `quotecore_v2_patch_044_...sql` added `quota_monthly_turns` to the same table.
- Note: AI Takeoff scan-jobs currently uses **env var** `AI_TAKEOFF_ENABLED`, not the DB flag.

### 5.2 Proposed calibration flag (P0 design, proposal only — no SQL written)
Mirror patch_042 exactly:
- `calibration_feature_flags(company_id uuid PK REFERENCES companies ON DELETE CASCADE, enabled bool NOT NULL DEFAULT false, updated_at timestamptz, updated_by uuid)`; absence = disabled.
- RLS ON; SELECT-only policy for authenticated members (`user_belongs_to_company`); zero write policies (service-role/admin only).
- `calibration_ai_enabled(p_company_id uuid) RETURNS boolean` — `SECURITY DEFINER, STABLE`, `COALESCE((SELECT enabled …), false)`; revoke from PUBLIC, grant to authenticated.
- Enforce inside the new calibration API route AND inside any points-deducting RPC (same double-gate as patch_045 does for quota), so the client can render/hide the entry point while the server remains authoritative. Whitelist rows inserted service-role only.

---

## 6. Page / image model

- `takeoff_pages` created in `backend\supabase\migrations\20260520120010_generic_trades_phase_2_dark_schema.sql` lines 122–140: `id, session_id, quote_id (FK composite session+quote), image_storage_path text NULL, page_order, page_name, scale_calibration jsonb NULL, pan_zoom_state jsonb NULL, created_at`.
- Images live in the `QUOTE-DOCUMENTS` storage bucket; **storage path is the canonical reference**, signed URLs minted per render (see `uploadCanvasImage.ts` header, 2026-05-10 change).
- Hydration: `actions.ts` `loadTakeoffHydrationData` (555) selects `image_storage_path, scale_calibration, ai_scan_result` (574) and returns `scaleCalibration: unknown | null` + minted `imageUrl`.
- **Immutable imageRevision candidates:** nothing exists today — no content digest, no object generation/version column, `ai_scan_result` jsonb gets overwritten in place (ai-scan-v3 writes 893–895). A realistic `imageRevision` = `{image_storage_path} + {content digest}` (hash fetched server-side) or a new `image_revision` column bumped on `finalizeTakeoffPageImage`/replace — must be server-established per spec §5.3. Storage path alone is *almost* immutable (path changes on re-upload) but has no version for in-place object replacement.

## 7. Measurement value materialisation (recalibration must recompute)

- Client records: `ComponentMeasurement.value` (TW ~198 snapshot shape) with `canvas_points`, `entryInputs {height_m, depth_m}`; `roofAreas[].area` + `pitch`.
- DB: `quote_takeoff_measurements.measurement_value` + `measurement_unit` + `canvas_points` + `entry_inputs` (actions.ts measurementsPayload ~392–408; NaN coerced to 0).
- Area-derived component entries: `entryInputs.value_basis: 'pitched'|'plan'` + `entryInputs.plan_value` — set at TW 2040 (`plan_value: choice.plan`), re-derived server-side in actions.ts 311–346 (`toMetricArea(ei.plan_value)`). **`points: []` + plan_value with no durable source-polygon link — CONFIRMED** (spec [C11]): the link exists only via creation-time context; recompute after recalibration currently relies on the stored plan_value, not source geometry.
- Downstream: `recalcAllQuoteComponents` after every save re-runs pack pricing from stored values — so stale values propagate to pricing.

## 8. Existing test tooling

- **Unit runner:** Node built-in test via tsx — only script: `npm run test:roof-takeoff` → `node --import tsx --test "app/(public)/free-roofing-takeoff-builder/*.test.ts" "app/lib/supplier-pricing/*.test.ts"`. Existing `*.test.ts` files: `app\lib\currency\currencies.test.ts`, `app\lib\integrations\connectors\fergus\connector.test.ts`, `app\lib\supplier-pricing\*.test.ts`, `app\(public)\free-roofing-takeoff-builder\*.test.ts`. No jest/vitest. **No tests exist anywhere under the takeoff app dirs.**
- **E2E:** Playwright — `playwright.config.ts` (testDir `./e2e/specs`, projects incl. mobile), scripts `e2e`, `e2e:smoke`, `e2e:security`, etc. Takeoff persistence spec exists: `e2e\specs\phase-d-quote-takeoff-persistence.spec.ts`.
- **Typecheck:** no standalone script; `tsc --noEmit` via tsconfig (strict) or `next build`. Lint: `npm run lint` (eslint 9 flat config). Build: `npm run build` (prebuild `scripts/check-server-deps.mjs`).
- New calibration unit tests should follow the `*.test.ts` + `node --import tsx --test` pattern (add a `test:calibration` script mirroring `test:roof-takeoff`).

## 9. §2.1 findings table — CONFIRM / REFUTE against the real repo

| # | Spec finding | Verdict in real repo |
|---|---|---|
| F1 | Averaging mixes stored `cal.scale` values regardless of unit | **CONFIRMED** — TW 2162/3110/3375/4915 mean `cal.scale` directly; `unit` is display-only metadata. |
| F2 | Improved `selectCalibrationScale()` longest-only | **N/A in repo** — symbol NOT FOUND anywhere; prototype-only. Repo has no selection function at all (pure mean). |
| F3 | Improved schema requires positive real_length / rejects low value confidence | **N/A in repo** — no candidate schema exists in production code. |
| F4 | Improved ranking: small span weight in blended score | **N/A in repo** — no candidate ranking exists. |
| F5 | `drawAiCalibrationCandidate()` draws one pair only | **N/A in repo** — symbol NOT FOUND. |
| F6 | `handleConfirmAiCalibration()` setCalibrations([cal]) discards candidates | **N/A in repo** — symbol NOT FOUND. Manual path appends (TW 4911). |
| F7 | Retry submits current candidates as rejected; no server rescan counter | **N/A in repo** — no AI calibration retry path exists at all. |
| F8 | Candidate coordinates rounded after canvas conversion | **REFUTED for repo manual path** — TW 3634 stores raw `getScenePoint` floats, no rounding. (True only of prototype's AI conversion.) |
| F9 | Scene capped ~2000px, uniform background scale | **CONFIRMED** — TW 150/158, 2276; scan-engine.ts 85. |
| F10 | AI image cache single-ref, no page/image/session identity guard | **PARTIAL/N/A** — no calibration image cache in repo (ai-scan-v3 takes client image per request; scan-jobs stores one job image). The specific "single cache ref" code is prototype-only. |
| F11 | Calibration branch verifies quote but not page ownership | **CONFIRMED (adapted)** — ai-scan-v3 route: quote ownership checked (716), pageId never validated against quote; writes happen but are `.eq('quote_id')` scoped (884–895 etc.). No `stage:'calibrate'` exists (route is 1,227 lines, not the prototype's 1,312). |
| F12 | Manual modal: first reference has "Save & Add Another" but no explicit save-and-finish | **CONFIRMED** — CalibrationModal.tsx: `calibrationNumber === 1` shows only "Save & Add Another"; "Save"/"Skip" appear only for number > 1 or at 3. Also carries the "More = better accuracy" wording the spec wants replaced. |
| F13 | Calibration persistence after save_takeoff_atomic, non-fatal | **CONFIRMED** — actions.ts 447–457 (try/catch + console.warn). |
| F14 | Calibration can change while stored measurement values remain | **CONFIRMED** — recalibrate (TW 4830) wipes calibrations; no recompute of existing `value`/`area` records anywhere. |
| F15 | Area-derived components: `points: []` + `entryInputs.plan_value`, no durable source link | **CONFIRMED** — TW 2040, actions.ts 311–346. |
| F16 | Workstation uses state-only history | **CONFIRMED** — TW 585 `useStateHistory<TakeoffSnapshot>(2)`. |
| F17 | "7,045-line prototype workstation" | **REFUTED for this repo** — real TW is **6,471 lines** (7,045 was the modified prototype). |
| F18 | V3 full scan never populated calibration scale | **CONFIRMED** — ai-scan-v3 writes only `ai_scan_result` to takeoff_pages; no scale write. |

## 10. P1–P7 build-plan reality check

Shared correction: the spec's module map target `app/lib/takeoff/calibration.ts` etc. is **greenfield** — none exist. UI prefix `takeoff-ui/takeoff/` is the packaging alias; the real location is `app\(auth)\[workspaceSlug]\quotes\[id]\takeoff\` (modals in `...\takeoff\modals\`).

- **P1 (maths/types/coordinates):** CREATE `app\lib\takeoff\calibration.ts` (new), `calibrationTypes.ts`, `calibrationCoordinates.ts`, `calibrationCodec.ts`. MODIFY: TW inline means (2162, 3110, 3375, 4915, 5190/5200, 5901), `reconstructTypes.ts` (import shared types). Spec assumption "existing `calibration.ts`" — **false in repo** (it's new). Coordinate basis (2000-cap uniform scene) verified correct.
- **P2 (state machine/UX):** CREATE `calibrationSession.ts` + UI under `...\takeoff\modals\` or a new `...\takeoff\calibration\` dir; MODIFY `CalibrationModal.tsx` (add first-reference Save & Finish, drop "More = better accuracy"), TW integration (replace destructive recalibrate at 4830). `canMeasure`: repo uses `calibrations.length === 0` gates at TW 4956, 5787, 5816, 5841 + `calibrationConfirmed` — audit all.
- **P3 (recompute):** CREATE `calibrationRecompute.ts`; MODIFY TW value materialisation sites (§1.4) + actions.ts plan_value handling (311–346) + hydration. `entry_inputs` comment "display only" exists in actions.ts ~402 — update.
- **P4 (persistence):** MODIFY `actions.ts` (move calibration into/alongside RPC atomically — today separate non-fatal update), SQL migration in **`supabase\migrations\`** (canonical; `backend\supabase\migrations\` holds the older v2 history — new dated migrations go to `supabase\migrations\` per recent convention), `app\lib\supabase\database.types.ts` (generated types are in-repo — regenerate), request-ledger table new. Note drift: `save_takeoff_atomic` has 15+ revisions — work from the latest definition (supabase\migrations 2026070x rpc v5–v8 + prelaunch hardening 20260730114500).
- **P5 (vision service):** CREATE `ai-calibration-v2.ts` (new, not replace), `calibrationCandidates.ts`, `calibrationServer.ts`. Sharp 0.35.3 + openai 6.41 + zod 4.4.3 available (package.json) — no new deps needed for schema validation.
- **P6 (integration):** CREATE `app\api\takeoff\calibration\route.ts`. The "existing `ai-scan-v3` stage:'calibrate' adapter" has **nothing to adapt** — either add the stage fresh or skip straight to the dedicated route. MODIFY scan-jobs/point RPCs only if calibration reuses the job queue; fix the 4/8-vs-6/12 point-cost drift between SQL and `pointCost.ts` while there.
- **P7 (validation):** Add `test:calibration` script mirroring `test:roof-takeoff`; Playwright takeoff specs under `e2e\specs\`. Calibration feature flag (§5.2) gates rollout.
- Cross-cutting spec mismatches: (a) spec cites `scan-engine.ts`/`ai-prompt-v3.ts` behaviours as "original V3" — verified present (`app\lib\takeoff\ai-prompt-v3.ts` 17KB, `scan-engine.ts` 40KB, `applyAiResults.ts` 35KB, `scanPostprocess.ts`, `outlineGeometry.ts` — outlineValidation NOT FOUND, prototype-only); (b) no `tests/` dir — unit tests colocated `*.test.ts`; (c) mobile consumer: `app\m\` exists but has no takeoff/calibration reader today (no array-only external consumer of `scale_calibration` found beyond hydration).

**Bottom line:** production repo = clean manual-only calibration with the unit-mixing, non-fatal-persistence, no-recompute, page-ownership and first-reference-modal gaps exactly as the spec predicts; ALL improved-archive behaviours (longest-only, single-candidate drawing, retry, rounding, cache) are prototype-only and must not be assumed present.
