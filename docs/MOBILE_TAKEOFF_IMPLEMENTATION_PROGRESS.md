# Mobile Takeoff & Precision Geometry Editor — Implementation Progress

Per spec §16.2 (`docs/MOBILE_TAKEOFF_PRECISION_EDITOR_IMPLEMENTATION_PLAN_2026-09-21.md`).
Companion gap review: `docs/MOBILE_TAKEOFF_M0_GAP_REVIEW.md`.

---

## Phase M0 — Reconcile the current branch and establish a baseline

Base / result commit: `c19c25c3` (audited) — no code changes in M0.
Status: complete (audit only; see `MOBILE_TAKEOFF_M0_GAP_REVIEW.md`).
Existing modules reused: n/a (audit).
New / changed modules: none (three untracked docs: spec, gap review, start-here note).
Schema / compatibility impact: none.
Requirements and test IDs covered: R-SRC-01..R-SRC-15 source map; §2.1 integration traps; §11.3 save-path verification.
Commands run and results: repo inspection; lint/build baseline established (repo-wide lint has 8288 pre-existing problems; build passes).
Evidence paths: `docs/MOBILE_TAKEOFF_M0_GAP_REVIEW.md`.
Physical / live-service tests not run: n/a.
Decisions or deviations, with reason: none.
Known risks / blockers: outline update-in-place RPC gap (M5); outline-only scan billing question; WebKit/iOS E2E absent — all recorded as owner questions in the gap review §6.
Next phase entry conditions: met.

---

## Phase M1 — Shared draft, commands, geometry validation and save boundary

Base commit: `c19c25c3`. Result commit: see git log (this commit; not pushed — owner reviews).
Status: complete.
Existing modules reused:
- `app/lib/takeoff/calibrationTypes.ts` — `Point` re-exported as `ScenePoint` (no duplicate point type); `coordinateFrame: 'takeoff-scene-v1'` convention.
- `app/lib/takeoff/calibrationCoordinates.ts` — affine conventions + raster-bounds/`COORD_TOLERANCE` policy mirrored (no redefined transforms).
- `app/lib/takeoff/calibration.ts` — `calibratedArea` / `calibratedLength` used for plan-area derivation (§17.4 F) — no mobile-only measurement formulas.
- `app/lib/takeoff/outlineGeometry.ts` — corner classification reviewed; its V3-AI-scoped types (V3Point/V3Line) are not imported because M1 needs polygon-level predicates, not scan-3 matching; winding-sign approach reused conceptually.
New / changed modules:
- `app/lib/takeoff/precision/precisionTypes.ts` — §4.2 contracts: Vertex, EditContext, EditTarget, EditableGeometry, PointSelection, ValidationIssue, session/history/preview types.
- `app/lib/takeoff/precision/precisionGeometry.ts` — stable random vertex IDs (crypto.randomUUID), shoelace area/perimeter/winding, self-intersection (proper crossing + collinear-overlap; shared joints exempt), target-relevant validation codes with blocking/warning severities, remote-drag inverse-linear delta helper (§5.2/§17.4 E).
- `app/lib/takeoff/precision/precisionEditor.ts` — command engine §4.3: beginEdit, selectVertex, appendVertex, previewMove, commitMove, cancelGesture, insertAfter (§6.3 midpoint, new stable ID, collinear preserved), deleteVertex (§6.4 min-3 closed rule, successor selected disarmed), closeOutline (no duplicated first point), discardEdit, undo/redo over full plain-data draft snapshots bounded at 100 logical ops (§11.2, one gesture = one op, new-edit-clears-redo), and the pure `saveEdit` boundary returning a SavePlan routed to EXISTING paths only (`page-calibration-persist` / `atomic-takeoff-save-v2` / `outline-geometry-update` update-in-place intent for M5).
- Tests: `precisionGeometry.test.ts`, `precisionEditor.test.ts`, `precisionWorkedExamples.test.ts` (§17.4 D/E/F; §6.2 stored-order navigation; §6.3 two-undo-step insert+move; §8.1 creation journey).
- `package.json`: added `"test:precision"`.
Schema / compatibility impact: none. No migrations, no UI, no changes to existing files' behaviour (only additive files + one script line).
Requirements and test IDs covered (spec §14.2 geometry/command subset): insertion area-preserving (worked D), one-vertex movement leaves others unchanged (F), triangles/concave/collinear-insert accepted, min-3 + nonzero-area + simple-polygon rules, undo restores exact primitives/metadata/IDs, bounded history 100, stale-context + blocking-validation save rejection, ID stability across move/undo/redo, remote-drag invariance (E), out-of-raster warning (non-blocking).
Commands run and results:
- `npm run test:precision` → 49 pass / 0 fail.
- `npm run test:calibration` → 202 pass / 0 fail.
- `npx eslint "app/lib/takeoff/precision/**"` → 0 problems (repo-wide `npm run lint` fails with 8288 pre-existing problems; verified identical at baseline via `git stash` — not introduced by M1).
- `npm run build` (`next build`) → success.
Evidence paths: test files above; this commit.
Physical / live-service tests not run: none applicable (pure logic; no UI/persistence in M1). Persistence adapter execution is delegated by design; fakes not yet needed.
Decisions or deviations, with reason:
1. `ScenePoint` is a type alias of the existing `Point` (spec: do not duplicate).
2. Module location is `app/lib/takeoff/precision/` subdirectory rather than spec §12's flat `precision*.ts` names — same responsibility, tidier grouping; M2+ gesture/viewport modules will sit alongside.
3. `saveEdit` is a pure plan-producer (no await/IO inside) — the spec's "await current authorised atomic save" happens in the adapter layer (M2+) executing the plan; this keeps M1 UI/IO-free as the phase demands. Context staleness check covers quote/page/imageRevision/epoch (sessionVersion carried for the adapter's RPC guard).
4. "Delete creates a crossing" behaviour is proven via a move-produced bowtie (a symmetric bowtie has zero net area which trips the degenerate rule instead); semantics identical: invalid draft stays editable, save blocked, undo restores.
5. `insertAfter` on an open path requires a real successor (spec §6.3) — rejected at the last vertex.
6. Calibrated plan values reuse `calibratedArea`/`calibratedLength` via `calibratedPlanFromSave` helper.
Known risks / blockers:
- Outline update-in-place RPC does not exist yet (gap review §6 Q1) — `outline-geometry-update` route in the SavePlan is an intent the M5 adapter must back with a real transactional path (or approved rebuild-on-save semantics).
- Repo-wide lint failures are pre-existing and out of M1 scope.
Next phase entry conditions (M2): pure command layer proven (this phase); M2 wires the touch shell + view-mode preference without changing measurement behaviour.

---

## Phase M2 — Stable touch workspace shell and manual view switching

Base commit: `24f4c6e3`. Result commit: this commit (not pushed — owner reviews).
Status: complete per the M2 task scope (shell + view switching + scene/viewport split + flag; NO M3 gestures, NO M4/M5 calibration/outline flows).
Existing modules reused:
- `calibrationFlag.ts` (patch_046) — the exact server-flag pattern copied for `takeoffTouchFlag.ts` (real table + RLS read-own, service-role writes, absence = disabled, never throws).
- `calibrationCoordinates.ts` — `MAX_CANVAS_DIM` (2000), `Affine2D`, `applyAffine`, `composeAffine`, `invertAffine` reused for the scene/viewport split; no coordinate convention redefined (§10.2 one-transform-owner).
- M1 `app/lib/takeoff/precision/` module home, `test:precision` script (new tests auto-included).
New / changed modules:
- `app/lib/takeoff/precision/viewMode.ts` (+test) — PURE §3.1 logic: Auto heuristic (coarse primary pointer via `(pointer: coarse)` matchMedia + shorter layout-viewport edge ≤ 820 CSS px; UA string and PWA display-mode never used — L02), explicit-preference-always-wins resolution, versioned takeoff-only localStorage key `quotecore.takeoff.view-mode.v1` with shared session-memory fallback (storage failures non-fatal), layout-viewport-only capability reader (visual viewport/keyboard deliberately invisible — L04).
- `app/lib/takeoff/precision/sceneViewport.ts` (+test) — §2.1 trap 1 / §10 split: `SceneDescriptor` (source-derived, 2000 long-edge cap, feeds AI `canvasDimensions` semantics), `ViewportSize`, `Camera`, scene↔viewport affines, interaction-surface-rect composition (`sceneToClient`), fit camera, pinch camera (§5.4 anchor formula with clamped-zoom translation recompute), linear-part-only remote-drag delta. R11 invariant proven by tests: scene dims and stored geometry identical across desktop/568×320 landscape/portrait viewports and arbitrary cameras; DPR never enters scene math.
- `app/lib/takeoff/precision/useTakeoffViewMode.ts` — client hook; Auto resolved ONCE at entry (frozen decision → no oscillation on hybrid/keyboard events); explicit switch persists + resolves immediately.
- `app/lib/takeoff/precision/TouchWorkspaceShell.tsx` — §3.3 shell: top strip (Back / plan label / Calibrate›Outline›Components / compact-notice pill / Save / Menu with the view control), right rail M2 placeholder (Fit plan / Zoom ± / Move plan — disabled; four-button point controller is M3), bottom strip (context hint / Draft / Undo-Redo placeholders). 48×48 targets, 8px gaps, safe-area insets both landscape sides + bottom, `100dvh`, works at 568×320, dismissible portrait hint via `matchMedia('(orientation: portrait)')` — NO CSS rotation, NO orientation lock.
- `app/lib/takeoff/precision/immersiveWorkspace.tsx` — §3.4 contract: context + `useImmersiveTakeoffAttribute` owning `html[data-takeoff-immersive="touch"]` set/cleanup; globals.css hides ONLY `data-takeoff-chrome` (header, assistant launcher) under that attribute; entitlement/impersonation banners stay in DOM and are additionally surfaced compactly in the top strip (`takeoffCompactNotices` from page.tsx) — L08.
- `app/lib/takeoff/takeoffTouchFlag.ts` + `backend/supabase/migrations/quotecore_v2_patch_051_takeoff_touch_flag.sql` — `takeoff_touch_feature_flags` table mirroring patch_046 exactly (additive, RLS select-own, service-role-only `set_takeoff_touch_flag` RPC, absence = disabled). NOT applied to Supabase yet — flag default-off everywhere.
- `TakeoffPage.tsx` — integration point (see below); `page.tsx` reads the flag + builds compact notices; `layout.tsx` gains ONLY `data-takeoff-chrome` attributes/wrappers (zero behavioural change); `globals.css` gains the attribute-scoped hide rules.
Integration approach chosen: **single-workstation alternative presentation layer** (gap-review recommendation), NOT a second workstation. `TakeoffPage` renders the EXACT original `w-[125%] -ml-[12.5%]` wrapper when the flag is off (no new code paths, desktop bit-for-bit). When the flag is on, `TouchWorkspaceShell` wraps the same workstation: its DOM skeleton (root → mid row → canvas slot → children) is ALWAYS mounted with strips merely `hidden` in desktop presentation, so Desktop ↔ Mobile/touch switching never remounts the workstation (§11.5), and desktop presentation keeps the exact widening classes on the root with `display:contents` intermediates (layout-identical; extra zero-effect wrapper divs are the only DOM delta vs pre-M2 — accepted deviation).
Schema / compatibility impact: one ADDITIVE migration file (patch_051) shipped but not applied; no existing table touched; flag absence = disabled for every company.
Requirements and test IDs covered: L01 (Auto fixtures + explicit-wins + persistence round-trip + malformed-value fallback), L02 (PWA display-mode never flips), L04 (layout-viewport-only inputs; frozen Auto), L03 geometry subset (fit at 568×320 landscape + portrait; scene invariance across viewport/camera switches), L08 mechanism (attribute set/cleanup + compact notices), §5.4 pinch anchor + clamp math, §17.4 E delta invariance.
Commands run and results:
- `npm run test:precision` → 74 pass / 0 fail (49 M1 + 25 new).
- `npm run test:calibration` → 202 pass / 0 fail (unchanged).
- `npx eslint` on all new/changed files → 0 problems.
- `npm run build` → success.
Evidence paths: viewMode.test.ts, sceneViewport.test.ts; this commit.
Physical / live-service tests not run: Playwright e2e (harness targets the deployed dev host only, so uncommitted code cannot be covered); L03/L05/L08 browser-level checks deferred to M3 alongside the spec-required touch E2E projects. Desktop regression (L09) coverage statement: existing suites `e2e/specs/phase-d-quote-takeoff-persistence.spec.ts`, `phase26-multi-page-takeoff.spec.ts`, `takeoff-ai-ui.spec.ts` cover desktop takeoff on the dev host; with the flag off this commit's code path is the original wrapper (verified by code inspection + build), so those suites remain authoritative. Playwright touch projects NOT added (non-trivial vs deployed-host harness — deferred to M3 as permitted).
Decisions or deviations, with reason:
1. Integration choice documented above (single workstation, stable skeleton, `contents` intermediates).
2. Auto decision frozen at entry (no resize listener at all) — spec §3.1 permits retaining the initial presentation; manual switch covers misdetection. Explicit switches re-resolve immediately.
3. View-mode resolution deferred one microtask post-mount (react-hooks/set-state-in-effect lint) — one-shot external-system sync, not derived cascading state; phones see desktop skeleton for the first frame (workstation itself is `ssr:false` dynamic anyway, so no user-visible canvas flash).
4. Compact required notices are computed server-side in page.tsx (storage-over-limit, impersonation) rather than read from layout banners — layout.tsx stays server-rendered and untouched behaviourally; M3+ can extend the notice list if other required notices exist.
5. patch_051 not applied to the database: absence-of-row = disabled keeps every company on desktop until the owner deliberately enables the rollout.
Known risks / blockers: none blocking M3. Right-rail/bottom-strip actions are disabled placeholders by design (M3 wires the camera + point controller). L02/L03/L05 browser assertions pending M3 e2e.
Next phase entry conditions (M3): gesture machine + Pointer Events single-owner adapter against this shell; the `sceneViewport` camera math here is its foundation.
