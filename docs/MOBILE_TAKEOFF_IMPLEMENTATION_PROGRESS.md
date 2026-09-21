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
