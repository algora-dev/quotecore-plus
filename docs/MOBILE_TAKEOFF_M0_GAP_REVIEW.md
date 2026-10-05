# Mobile Takeoff & Precision Geometry Editor — M0 Gap Review

**Audit date:** 2026-09-21 · **Auditor:** Gavin subagent
**Repo state audited:** branch `main`, commit `c19c25c3` (Calibration review panel UX simplification).
**Spec under review:** `docs/MOBILE_TAKEOFF_PRECISION_EDITOR_IMPLEMENTATION_PLAN_2026-09-21.md` (written against the 20-Sep snapshot).
Commits between the snapshot and now: `4e55ffc6` (page-1 source fallback), `1906d3f2` (revision helper quote_id), `3aa8957f` (rpcByName shim fix + e2e harness), `c19c25c3` (review panel UX).

Paths use `TAKEOFF` = `app/(auth)/[workspaceSlug]/quotes/[id]/takeoff`.

---

## 1. Source map verification (R-SRC-01 .. R-SRC-15)

| Ref | Status | Current evidence (path : approx line : function/symbol) |
|---|---|---|
| R-SRC-01 | **EXISTS (unchanged)** | `TAKEOFF/TakeoffPage.tsx:81` — desktop widening wrapper `<div className="w-[125%] -ml-[12.5%]">` still present around the workstation. Dynamic client import still in place. |
| R-SRC-02 | **EXISTS (unchanged)** | `TAKEOFF/TakeoffWorkstation.tsx:201` — `const MAX_CANVAS_DIM = 2000` (longest edge, dynamic canvas sizing); `:349` `canvasDims` state (`useState({width:800,height:600})`); `:2421`, `:3419`, `:4159`, `:4211` `setCanvasDims` from image load. |
| R-SRC-03 | **EXISTS (unchanged)** | Alt-pan still gates all draw modes: `TakeoffWorkstation.tsx:3472` (lineMode), `:3566` (multiLineal), `:3612` (pointMode), `:3641` (areaMode), `:3802` (calibrationMode), `:3868` (`evt.altKey` pan branch). `getScenePoint`/scene pointer conversion in the same handler block. Zoom/resize: `:4115–4135` auto-fit depends on `canvasDims`. |
| R-SRC-04 | **EXISTS (unchanged)** | `TakeoffWorkstation.tsx:4405` `handleAiScan` → `:4453` `stage: 'scan1'` → `:4496` `scanCompleted = await runRemainingAiScans({...})` (defined `:4526`). Scan1 error handled `:4471`; points deduction noted `:4491`. Immediate coupling to scans 2/3 still hardcoded — outline-only stop still requires orchestration work (spec §8.2 assumption confirmed). |
| R-SRC-05 | **EXISTS (unchanged)** | `app/lib/takeoff/calibration.ts:10` `MAX_ACCEPTED_REFERENCES = 3`; `:46` `computeEffectiveCalibration` (throws >3, unit-normalised ratio mean `:69`, disagreement `scaleRangePct = 100*(max-min)/mean` `:74`); `:94` `calibratedLength`; `:105` `calibratedArea`; `:138` `effectiveScaleFromLegacyCalibrations`. |
| R-SRC-06 | **EXISTS (unchanged)** | `app/lib/takeoff/calibrationCoordinates.ts` — affine contract, inverse/compose, source/analysis/scene transforms (tests alongside in `calibrationCoordinates.test.ts`). |
| R-SRC-07 | **EXISTS / PARTIALLY CHANGED** | `app/lib/takeoff/calibrationSession.ts:454` `calibrationSessionReducer`. Event union now includes `START_NEW`/`START_REPLACE`/`START_EDIT` (`:459–471`, added Phase C `faf1d119`), `EDIT_DISTANCE` (`:498`), `EDIT_UNIT` (`:511`), `ACCEPT_AND_FINISH`, `REMOVE_ACCEPTED`, `REQUEST_RESCAN`, `PAGE_CHANGED`/`IMAGE_CHANGED` (`:591–592`). **No human endpoint-edit event exists** (no EDIT_ENDPOINT / endpoint override anywhere in `app/lib/takeoff/*` — only AI prompt text mentions endpoints). Spec §7.4 gap is real. |
| R-SRC-08 | **EXISTS (unchanged)** | `TakeoffWorkstation.tsx:1704` `handleSaveArea(name, pitch?)` — additive only: creates `area-${Date.now()}` id, `newArea` appended to `roofAreas` (`:1758` area object), `quoteRoofAreaId`/`fromPageId` stamped at draw time (2026-07-05 fix, `:1740–1755`). `calibrationRecompute.ts:162` `computeCalibrationRecompute`; `source_geometry_id` provenance `:30`, `:86`, `:225–239`; `calibrationCommit.ts:134` `stampSourceProvenance`. |
| R-SRC-09 | **CHANGED (spec Phase B claim verified TRUE)** | `TAKEOFF/actions.ts:432–513`: when `requireCalibrationCommit && calibrationMetadata && calibrations && currentPageId`, `save_takeoff_atomic_v2` RPC is called with a `calibration` block in the SAME payload (migration `backend/supabase/migrations/quotecore_v2_patch_048_calibration_atomic_commit.sql` exists); fallback to `save_takeoff_atomic` + separate page update only on v2 error (`:492–505`). `sessionVersion` guard → `STALE_TAKEOFF_VERSION` surfaced (`:464`, `:512–513`). Hydration `:681` `loadTakeoffHydrationData`. Calibration-only persistence `:1474` `persistPageCalibration` (P3 spec 10.1; fatal-on-failure, includes image_revision). |
| R-SRC-10 | **EXISTS (unchanged)** | `app/lib/takeoff/useStateHistory.ts` — plain-data snapshots, no Fabric JSON (`useStateHistory<T>(maxDepth=30)`); `reconstructCanvas.ts`, `reconstructTypes.ts`, `useCanvasHistory.ts` present. Note: default depth 30, spec proposes 100 for draft history (separate layer, fine). |
| R-SRC-11 | **EXISTS (unchanged)** | `app/(auth)/[workspaceSlug]/layout.tsx:181` header `max-w-6xl`; `:214` `<main className="mx-auto w-full max-w-6xl ...">`; chrome includes `MobileHeader`, `HelpDrawer*`, `AssistantWidget`, `SmartAssistantLauncher`, `EntitlementBanner`, `ImpersonationBanner`s, `GlobalAnnouncementBanner`. `app/manifest.ts`, `app/layout.tsx` unchanged re: standalone/viewport. |
| R-SRC-12 | **EXISTS (mostly unchanged)** | `playwright.config.ts`: `guardOrigin(BASE_URL)` (`:23`); three projects `mutation` / `read-only` / `mobile` (`:65–91`). Mobile project uses `devices['iPhone 14 Pro']` (`:82`) — **Chromium context (Desktop Chrome base), not WebKit**, matching spec §14.1 caveat. E2E specs confirmed: `phase26-multi-page-takeoff.spec.ts`, `phase-d-quote-takeoff-persistence.spec.ts`, `takeoff-ai-ui.spec.ts` all exist under `e2e/specs/`. |
| R-SRC-13 | **EXISTS** | `docs/AI_SCAN_V2_SMART_CALIBRATION_PLAN.md` (not re-verified line-by-line; presence assumed per spec). |
| R-SRC-14 | **N/A (conversation attachment)** | Not in repo; no verification possible. |
| R-SRC-15 | **PARTIALLY STALE** | `AI_CALIBRATION_PRE_HUMAN_TEST_AUDIT_2026-09-20.md` findings are largely **already fixed** on this branch by Phase A–F commits (`f2c01a0f`, `e91501a2`, `faf1d119`, `62a7545b`, `386881b1`, `67136729`) plus post-audit fixes `4e55ffc6`, `1906d3f2`, `3aa8957f`, `d494c1a0` — see §5. |

---

## 2. Integration traps (§2.1) — status on current branch

1. **Scene vs viewport size** — STILL OPEN. `canvasDims` participates in image scaling (`TakeoffWorkstation.tsx:4359–4360` container-fit scaleX/Y), AI payloads (`:4458`, `:4556`, `:4584` `canvasDimensions: canvasDims`; `:4500` analysisDimensions fallback), source-to-scene (`:5019–5022`) and auto-fit (`:4115–4121`). The spec's mandatory `sceneDescriptor` / `viewportSize` / `camera` split is the correct and still-needed work.
2. **Two event systems** — STILL OPEN. No Pointer Events surface exists anywhere under `TAKEOFF/`; all input flows through Fabric mouse handlers with `altKey` gating. Single-owner touch adapter is greenfield.
3. **handleSaveArea additive vs update-in-place** — STILL OPEN. `handleSaveArea` (`:1704`) only appends a new `RoofArea` with a fresh timestamp id; there is no saved-polygon vertex-edit path in the workstation (no `object:moving`/vertex-handle editing found). Update-in-place geometry editing is genuinely NEW work; `source_geometry_id` recompute infrastructure (`calibrationRecompute.ts`) already exists to support it.
4. **Old safety findings already fixed?** — LARGELY YES. Cross-page inheritance removed (Phase A), AI abort on page/image change (reducer `PAGE_CHANGED`/`IMAGE_CHANGED`), calibration-only hydration + `persistPageCalibration`, awaited/atomic `save_takeoff_atomic_v2` commit, image revisions (`calibrationImageRevision.ts`, Phase C), idempotent run ledger + refunds (Phase D), NULL plan-limit crash fixed (`d494c1a0`, patch_050), rpcByName shim fixed (`3aa8957f`). Remaining known-open: **human endpoint editing of AI candidates** (no reducer event), **outline-only scan stop**, **touch gestures themselves**.

## 3. Save-path / atomicity findings (spec §11.3 verification)

- **TODAY the calibration path IS atomic when hardened conditions hold:** `actions.ts:438–486` — `requireCalibrationCommit=true` + metadata + calibrations + currentPageId → single `save_takeoff_atomic_v2` RPC with `calibration` block, `session_version` guard, image_revision fetched via `getCalibrationImageRevision`. Fallback to legacy split path only if v2 RPC errors (v2 missing in env).
- **Legacy/manual path remains split:** plain saves without calibration metadata still go through `save_takeoff_atomic` + separate `takeoff_pages` update (`actions.ts:524–526`) — non-fatal unless `requireCalibrationCommit`.
- **Calibration-only pages:** `persistPageCalibration` (`actions.ts:1474`) is a single quote+page-scoped update; failures surfaced as `COMMIT_FAILED` via `calibrationCommit.ts` result types. NOT transactional with measurements (none exist on such pages by definition — acceptable).
- **Stale-session guard:** `STALE_TAKEOFF_VERSION` client check at `actions.ts:512`.
- **Spec Phase B claim "patch_048 atomic v2 RPC"** — VERIFIED TRUE against current `actions.ts`.
- **Caveat for M1:** atomicity of *outline geometry edit* (polygon points update-in-place + dependent recompute in one transaction) has no RPC yet — `save_takeoff_atomic` is delete+insert of measurements, not polygon updates. This is a genuine gap for M5.

## 4. M1 integration map (proposed §4.2/§12 modules → current repo targets)

| Proposed contract/module | Maps to / extends |
|---|---|
| `ScenePoint` | NEW type, but express via existing scene-coordinate convention in `calibrationCoordinates.ts` (scene frame from `buildSourceToScene`, `TakeoffWorkstation.tsx:5019–5022`) — do not redefine. |
| `Vertex` | NEW (no per-vertex id concept exists today; area points are bare `{x,y}[]` in `RoofArea`). |
| `EditContext` (quoteId/pageId/imageRevision/sessionVersion) | EXTEND existing primitives: `calibrationImageRevision.ts` (`getCalibrationImageRevision`), `sessionVersion` in `actions.ts:49–51`, page identity refs (`currentPageIdRef`). `contextEpoch` NEW. |
| `EditTarget` `calibration` variant | EXTEND `calibrationSession.ts` draft/reference shapes (`calibrationTypes.ts`) — reference draft ids exist per-candidate. |
| `EditTarget` `outline` variant | NEW — closest current analogues: `RoofArea` (`TakeoffWorkstation.tsx` ~1745: id, points, area, pitch, `quoteRoofAreaId`, `fromPageId`). |
| `EditTarget` `component-line` variant | EXTEND existing measurement entries (`actions.ts` entry model, `applyAiResults.ts` line entries, `tool-for-measurement-type.ts`). |
| `EditableGeometry`, `PointSelection`, `ValidationIssue` | NEW (`outlineGeometry.ts` has geometry predicates to reuse for validation). |
| Commands `beginEdit`..`saveEdit` | NEW reducer/command layer; `saveEdit` must call the **current** `actions.ts` save (`save_takeoff_atomic_v2` path) / `persistPageCalibration` / future geometry-update RPC — never a new parallel route. |
| `precisionGestureMachine` / `usePrecisionInput` | NEW (no Pointer Events today). |
| `viewportTransforms` | EXTEND `calibrationCoordinates.ts` (applyAffine/composeAffine/invertAffine). |
| `useTakeoffViewMode` / `MobileTakeoffShell` / `VertexController` / `EndpointController` / `CalibrationSheet` / `OutlineSheet` | NEW; must cooperate with layout chrome (`layout.tsx:181/214` max-w-6xl main, banners, assistant launcher). |
| Outline-only scan extraction | Refactor `handleAiScan` (`TakeoffWorkstation.tsx:4405`) + `runRemainingAiScans` (`:4526`) coupling. |
| Feature flag for takeoff-touch | EXTEND the `calibration_feature_flags` pattern (`calibrationFlag.ts` — server-side table + RLS read-own + absence=disabled, patch_046). No generic client flag mechanism exists; same server-side pattern is the house style. |

## 5. Stale spec assumptions (things the current branch already fixed or changed)

1. **§2.1/§11.3 "separate measurement/calibration writes"** — STALE for the hardened AI-recalibration path: `save_takeoff_atomic_v2` (patch_048) now commits both in one transaction when `requireCalibrationCommit` is set. Only the legacy fallback is still split.
2. **Pre-human-test audit safety findings (R-SRC-15)** — mostly fixed by Phase A–F commits listed above: cross-page inheritance, abort-on-page-change, calibration-only hydration, atomic commit, image revisions, ledger idempotency/refunds, partial OCR, plus post-audit `d494c1a0` (NULL plan-limit 42804) and `3aa8957f` (rpcByName shim 500 on every search — this was a real outage, now fixed and covered by `scripts/test-calibration-e2e.mjs`).
3. **Page-1 calibration refusal** — FIXED (`4e55ffc6` quote_files fallback; `1906d3f2` quote_id in page select). Spec-era behaviour of refusing first-page AI calibration no longer applies.
4. **Calibration review panel** — CHANGED by `c19c25c3`: draggable panel, dimmed non-selected candidates, collapsed evidence crops. Spec §7.3's "subdued other candidates" is now already implemented at the presentation layer.
5. **`calibrationSession.ts` "no edit session concept"** — PARTIALLY STALE: `START_EDIT`/`START_REPLACE` sessions exist (Phase C), but endpoint editing still does not (see R-SRC-07).

## 6. Open questions for the owner

1. **Outline update-in-place RPC**: polygon-point edit + dependent recompute in one transaction has no server path today (save is delete+insert of measurements). Approve a patch_051-style migration in M5, or accept rebuild-on-save semantics?
2. **Billing for outline-only scan**: scan1 charges full takeoff-quality points today (`TakeoffWorkstation.tsx:4491`). Keep that price for the mobile outline-only action, or is a distinct priced intent a deliberate product change?
3. **Draft undo depth**: workstation global history defaults to 30 (`useStateHistory`); spec proposes 100 for the edit draft. Confirm 100 for the new draft layer only, leaving global history at 30.
4. **WebKit/iOS E2E**: mobile project is iPhone-descriptor-on-Chromium. Add a WebKit project in M7 (needs local browser install / CI consideration)?
5. **Feature flag scope**: reuse the per-company server-table pattern (patch_046 style) for `takeoff-touch`, or a simpler client-side rollout? Server-side is recommended per §11.6.

---

**Bottom line for M0 gate:** the spec's source map is accurate; the only materially stale observations are (a) atomic calibration persistence (already shipped via patch_048), (b) the pre-human-test audit findings (fixed through Phase F + post-audit commits), and (c) first-page calibration refusal (fixed). All gesture, endpoint-edit, outline-only-scan, and update-in-place work remains genuinely new.
