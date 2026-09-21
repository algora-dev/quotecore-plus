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

---

## Phase M3 — Precision gestures and the four-button point controller

Base commit: `29b836be`. Result commit: this commit (not pushed — owner reviews).
Status: complete per the M3 task scope (pure gesture state machine + Pointer Events single-owner adapter + relative off-point drag + two-finger view + four-button controller + fine-adjust nudges wired to a DISPOSABLE geometry harness; NO M4 calibration flows, NO M5 real-outline persistence).
Existing modules reused:
- M1 `precisionEditor.ts` commands are the ONLY geometry mutator — every tap/drag/arrow/±/nudge dispatches `selectVertex/appendVertex/previewMove/commitMove/cancelGesture/insertAfter/deleteVertex/closeOutline/undo/redo`; zero direct state writes.
- M2 `sceneViewport.ts` — `fitCamera`, `pinchCamera` (anchor + clamp + clamped-zoom translation recompute), `sceneDeltaFromCameraClientDelta` (linear-part-only remote-drag delta), `scenePointToViewport`; M2 rail buttons (Fit plan / Zoom ± / Move plan) are now live via the harness, Move plan temporarily disarms (§5.4).
- M2 `TouchWorkspaceShell` — unchanged skeleton; new optional `overlay`/`rail`/`bottom` props render M3 content in touch presentation only (defaults preserved; desktop/flag-off paths bit-for-bit).
New / changed modules:
- `precisionGestureMachine.ts` (+test) — PURE §5.3 machine: single gesture owner, explicit phases `idle|pending|moving|panning|twoPointer|cancelled`, active pointer map, per-gesture base snapshot (press start, marker hit at pointerdown, two-finger start pair), completion token (`completedSequences`). Every §5.3 row implemented: pending+second-touch→two-pointer; pending+slop→armed remote move ELSE one-finger pan (never append after pan); pending release within slop→tap priority (marker > armed-keeps > placement-once > review-never); moving+second-touch→full uncommitted rollback then pinch; moving release→one bounded commit; cancel/lost-capture→rollback; two-pointer one-lift/third-touch→suppress-until-all-lift; layoutInterrupt cancels preserving draft; ghost `syntheticClick` structurally inert (suppression by sequence state, not timeout); `lostpointercapture` after a completed pointer-up is inert (T08). Exports `TOUCH_SLOP_PX=6`, `HIT_RADIUS_PX=24`.
- `usePrecisionPointerInput.ts` — DOM adapter (§5.6): pointer capture, pointercancel/lostpointercapture/blur/ResizeObserver→layoutInterrupt rollback, `touch-action:none` ONLY on the interaction surface, surface-only contextmenu suppression, RAF-coalesced previews (§10.5), camera FROZEN at gesture start for exact client→scene math (DPR never enters), full listener/capture/RAF cleanup on unmount/deactivate (T16), mouse-left-only in touch view, env/handlers read via effect-synced refs so every decision uses CURRENT state (T11/no stale closures).
- `pointNavigation.ts` (+test) — §6.2 previous/next in STORED perimeter order (closed wraps, open ends disabled, no-selection→first), §6.3 insert enablement (real successor only), §6.4 delete enablement (closed 3-minimum), §5.7 nudge scene-delta (1/5 CSS px steps via inverse-camera linear vector — zoom = finer), §5.5 `minimalRevealTranslation` (zoom unchanged, instant → reduced-motion respected).
- `PointControllerRail.tsx` — §6/§3.3/§3.5 rail UI: “Points” label + 2×2 48×48 grid (‹ › + −) + counter (“Point 7 of 12”) + Adjust point (re-arm) + collapsible §5.7 fine-adjust panel (4 nudge buttons, 1/5 px step radios, Done — separate from the perimeter selector) + separately-labelled View controls; +/−/Adjust disabled mid-gesture; states not colour-only (counter text, armed cue “Drag anywhere to move · release to set” vs “Point set”, ARIA labels/live regions, selected = halo + crosshair, invalid = “!” marker + blocking message).
- `PrecisionTouchHarness.tsx` — the DISPOSABLE §13-M3 harness (no persistence): deterministic 4/40/200-point fixtures (+ open-path mode, Close/Reset for placement/journey coverage), transparent interaction surface above the workstation canvas (single gesture owner → legacy Fabric paths never see touch contacts, T15; controls sit outside the surface, T09), SVG overlay (screen-space markers zoom-independent 24px hit radius, nearest-wins tie-break by perimeter order, incident-edge highlight, preview vertex renders layer-3), camera state (fit on mount, pinch via machine effects, centre-anchored zoom buttons, pan, §5.5 post-gesture offscreen reveal after arrow nav).
- `TouchWorkspaceShell.tsx` — additive optional `overlay`/`rail`/`bottom` props (touch-only rendering; M2 defaults intact; rail scrolls for dense content).
- `TakeoffPage.tsx` — harness hook composed; flag-off early-return untouched, desktop presentation receives `null` nodes so no touch code path executes (L09/L10).
Schema / compatibility impact: none (no migrations, no server changes; harness data is in-memory only).
Requirements and test IDs covered: §5.2 slop/delta (6px exclusive threshold, full-delta-from-start, linear-only inverse); §5.3 every transition-table row + 4 tap-priority rules; §5.4 pinch/pan/Move-plan-disarm (anchor math from M2 tests); §5.5 reveal; §5.7 nudge math; §6.2–6.4 controller semantics incl. T11 current-index chains; T01/T03/T05/T06/T07/T08 pure subsets; structural T09/T15 guarantees (single-owner surface); L07 non-colour state cues; L10 clean build/lint on all new files.
Commands run and results:
- `npm run test:precision` → 110 pass / 0 fail (74 M1+M2 + 36 new: 20 gesture-machine + 16 navigation).
- `npm run test:calibration` → 202 pass / 0 fail (unchanged).
- `npx eslint` on all new/changed files → 0 problems.
- `npm run build` → success.
Evidence paths: precisionGestureMachine.test.ts, pointNavigation.test.ts; this commit.
Physical / live-service tests not run: Playwright browser projects NOT added — the existing harness targets the deployed dev host, so uncommitted touch code cannot be covered there without new infrastructure (deliberate non-trivial change, deferred as permitted). Browser-level assertions remaining for M7: L03 touch-operability at 568×320 + rotation (geometry subset proven in M2 unit tests; shell/browser check pending), L05 fullscreen-denied journey, L06 48×48 target-box measurement + no-overlap + zoom-controls-distinguishable DOM assertions, L07 non-colour state distinguishability with assertions (cues implemented), plus T02/T04/T09/T12/T13/T16 browser-event runs against the harness surface. Physical-device ergonomic proof (§15) not run — no hardware available to the agent.
Decisions or deviations, with reason:
1. Sixth phase `panning` beyond the task's five listed states: §5.3 explicitly requires one-finger pan-when-disarmed as a distinct gesture; a separate phase keeps pan/move arbitration explicit instead of a mode flag inside `moving`.
2. `cancelled` doubles as the §5.3 suppress-until-all-lift state (spec wording: “suppress contacts until all lift”); it persists while contacts remain, then returns to idle. This satisfies the explicit-state requirement without a second boolean.
3. Tap hit-testing captures the marker hit at POINTERDOWN but resolves the tap on RELEASE (both are machine-side; the adapter's `hitMarker` reads the live camera). Placement uses the release-time environment (fresh armed/append state), satisfying the no-stale-closure rule.
4. `tapPlace` maps the tap position through the inverse camera ABSOLUTELY (correct for placement); only drag DELTAS use the linear-part-only rule (§5.2 forbids absolute mapping for remote drags, not for taps).
5. Harness defaults to a CLOSED 4-point fixture (review mode per §5.3 priority 4); “Open path” toggle + Close button exercise the open-creation/placement modes. Fixtures are deterministic (no RNG) so future E2E assertions are stable.
6. Zoom bounds = [0.5×fit, 16×fit] (§10.3 view-dependent bounds proposal; tunable with evidence).
7. Keyboard-arrow nudging (§5.7 optional) deferred to the browser phase — buttons are the WCAG-required single-pointer path and are implemented.
8. Repo-wide `tsc --noEmit` still reports pre-existing errors in `(public)/free-roofing-takeoff-builder/baseline.test.ts` (untouched by this work; `next build` type-check passes for the app graph).
Known risks / blockers: none blocking M4. Harness is disposable by design — M4/M5 replace its fixture session with real calibration/outline adapters; the gesture machine, adapter and controller carry over unchanged.
Next phase entry conditions (M4): A/B calibration wizard on top of this input stack; AI endpoint overrides in the real calibration reducer.

---

## Phase M4 — Manual calibration and human repair of AI references

Base commit: `8499ddee` (M3). Result commit: this commit (not pushed — owner reviews).
Status: complete per the M4 task scope (reducer endpoint-edit events + manual A/B wizard + AI endpoint repair + provenance codec + persistence through the calibration-only save path + touch UI). Desktop calibration flow unchanged (C16).
Existing modules reused:
- `calibrationSession.ts` reducer — EXTENDED (gap review gap 4): new events `BEGIN_MANUAL_REFERENCE` / `SET_MANUAL_ENDPOINT` / `CLEAR_MANUAL_ENDPOINTS` / `ACCEPT_MANUAL` / `EDIT_ENDPOINT` / `RESET_ENDPOINTS` / `ACKNOWLEDGE_DISAGREEMENT` / `DETACH_REFERENCE`; state gains `endpointOverrides` (per-candidate human override layer, §7.4), `manualDraft`, `disagreementAcknowledged`. All existing events/tests untouched (223 pass).
- `useCalibrationController` — reused AS-IS by the touch workspace (same reducer, search lifecycle, ledger/billing, commit contract — R14); one additive option `autoStart:false` so entering touch view never auto-spends credits (§7.1); desktop default unchanged.
- `calibration.ts` computeEffectiveCalibration — the ONLY scale math (no new formulae); `calibrationCodec.ts` v1 envelope extended additively with source `ai_adjusted` + `endpointsEdited` (older decoders degrade `ai_adjusted`→`manual`, never reject).
- `actions.ts persistPageCalibration` — the touch commit writes the SAME legacy + calibrationMetadata payload the desktop path builds (`buildCalibrationCommit` mirrors the workstation mapping exactly; proven by the legacy↔metadata scale-equality test).
- `calibrationRecompute.computeCalibrationRecompute` — reused for page-scoped recalibration preview (C13).
- M3 stack: precisionEditor commands drive the A/B pair (tap place, off-point relative drag, disarm on release, undo); usePrecisionPointerInput + sceneViewport camera (pinch/pan/fit) unchanged.
New / changed modules:
- `precision/touchCalibration.ts` (+ covered by the new calibration test file) — pure helpers: `finishBlockers` (C12 gate), `buildCalibrationCommit`, `pageScopedDependents`/`pageDependentRecompute` (C13), `manualPairValid`, `calibrationDescriptorFromSource` (same 2000-long-edge scene frame as the workstation → touch-placed points are valid workstation scene coordinates, R14).
- `calibrationSessionEndpointEdit.test.ts` — 21 new tests (C01–C13 pure-logic subset, provenance codec round-trip, duplicate/reversed-pair guard C11, edit-exclusion-until-reconfirm C08, evidence currency C09, override persistence across candidate switching C10, ack-gate C12, page-scoped recompute C13).
- `precision/EndpointControllerRail.tsx` — A/B rail (Start/End select, Point is correct, Adjust point, Undo, view controls; copy per §1.3).
- `precision/CalibrationSheet.tsx` — known distance + unit entry, Use this calibration / Save & add another, accepted 1–3 list with remove + “as manual” detach, disagreement warning + Use this average anyway, candidate review (stable 1/2/3, Adjust points / Accept / Skip / Accept & finish, Finish with N always visible).
- `precision/TouchCalibrationWorkspace.tsx` — stateful parts provider: shared controller session, manual A/B wizard on the M3 gesture stack, candidate repair into the same A/B draft (EDIT_ENDPOINT on Done — reducer-level, never marker-only), persistence via persistPageCalibration.
- `TakeoffPage.tsx` — Calibrate tool toggle in the touch bottom strip; calibration parts replace the point grid while calibrating; harness/calibration hooks both stay mounted so tool/view switches preserve drafts (C16).
- `calibrationTypes.ts` / `calibrationCodec.ts` — additive provenance fields (see above).
Schema / compatibility impact: none (no migrations; codec change is additive within v1).
Requirements and test IDs covered (pure-logic subset): C01, C02 (incl. mixed manual/AI 3-cap), C04, C05, C06, C07, C08, C09 (selector + detach), C10, C11, C12, C13 (page-scope), C14 (codec round-trip hydration semantics), R02 (no provider call on endpoint edits), R03. C03 mean math was already covered by `calibration.test.ts`; re-verified via buildCalibrationCommit legacy-equality test.
Commands run and results:
- `npm run test:calibration` → 223 pass / 0 fail (202 + 21 new).
- `npm run test:precision` → 110 pass / 0 fail (unchanged M1–M3).
- `npx eslint` on all new/changed files → 0 problems.
- `npm run build` → success (type-check passes).
Evidence paths: calibrationSessionEndpointEdit.test.ts; this commit.
Physical / live-service tests not run: browser/E2E for the touch calibration UI (harness targets the deployed dev host; deferred to M7 per the established pattern); no live AI search executed (reducer/controller-level coverage only; no credits spent). C-series items needing browser/DB go to the M7 list: C01/C02 UI journey, C13 real-DB recompute commit, C14 reload-hydration, C15 failed-save UI, C16 view-switch preservation in-browser.
Decisions or deviations, with reason:
1. **C12 gate placement**: the reducer still allows FINISH with a disagreement (desktop tests/behaviour unchanged); the explicit acknowledgement is enforced by the pure `finishBlockers` selector + touch UI disabling finish until “Use this average anyway”. Never silent outlier removal — the warning text always states the disagreement %.
2. **Recalibration on pages WITH measurements/areas from touch is blocked** (surface message + commit gate `DEPENDENTS_PRESENT`) rather than persisted without recomputed dependents. The desktop workstation already owns the atomic recompute+save orchestration; wiring that full path into the touch layer is M5 work (needs the shared save adapter). Calibration-only pages — the primary M4 journey — persist end to end. **Decision needed:** whether M5 should extract the desktop commit orchestration into a shared adapter (recommended) or the touch layer stays calibration-only.
3. **AI search from touch**: “Find with AI” reuses the desktop controller + real executor (ledger/billing intact), mounted with `autoStart:false`. New searches are deliberate; endpoint edits never call the provider (R02).
4. **Provenance codec**: kept schemaVersion 1 with additive `ai_adjusted` + `endpointsEdited`. An older build decoding a new row degrades `ai_adjusted` → `manual` (information loss only, no rejection) — matches the spec's “additive compatible field only if needed” guidance. New builds read it exactly.
5. **RESET_ENDPOINTS** returns the candidate to the raw proposal but leaves a previously-accepted reference in `needs_reconfirmation` until re-accepted (conservative; re-acceptance then reproduces the original record).
6. Touch calibration scene frame is built from the plan image natural size with the SAME 2000-long-edge normalisation (`sceneDimsFromSource`) — persisted coordinates are workstation-compatible without mounting the workstation's internals at the TakeoffPage layer.
Known risks / blockers: touch recalibration-with-dependents gap (decision 2); browser-level verification deferred to M7; PDF-sourced pages render via planUrl image only (a PDF that fails image load shows a load error — PDF page support in the touch calibration surface may need the PdfPagePicker raster path in M5/M7).
Next phase entry conditions (M5): manual outlines + update-in-place editing on this stack; extract the shared calibration/outline commit adapter.

---

## Phase M4 � Manual calibration and human repair of AI references

Base commit: `8499ddee`. Result commit: this commit (not pushed � owner reviews).
Status: complete per the M4 task scope (reducer/manual wizard/endpoint overrides + pure touch calibration helpers; controller `autoStart` gate; NO touch calibration UI mount � that rides the M5+ presentation).
Existing modules reused: `calibrationSession.ts` reducer contract, `computeEffectiveCalibration`, `calibrationCodec` v1 envelope, `computeCalibrationRecompute`.
New / changed modules: `calibrationSession.ts` (BEGIN_MANUAL_REFERENCE/SET_MANUAL_ENDPOINT/ACCEPT_MANUAL/EDIT_ENDPOINT/RESET_ENDPOINTS/ACKNOWLEDGE_DISAGREEMENT/DETACH_REFERENCE + endpoint overrides + disagreementAcknowledged), `calibrationTypes.ts` (`AcceptedReferenceSource` incl. `ai_adjusted`, `endpointsEdited?`), `calibrationCodec.ts` (additive encode/decode of `ai_adjusted`+`endpointsEdited`), `useCalibrationController.ts` (`autoStart?: boolean` � touch presentations require a deliberate search), `precision/touchCalibration.ts` (finishBlockers C12, buildCalibrationCommit R14, pageScopedDependents/pageDependentRecompute C13, manualPairValid, calibrationDescriptorFromSource), tests `calibrationSessionEndpointEdit.test.ts`.
Schema / compatibility impact: none (codec change is additive/optional; older decoders map `ai_adjusted`?`manual`).
Commands run and results: `npm run test:precision` ? 110 pass; `npm run test:calibration` ? 223 pass; eslint clean on changed files; `next build` success.
Decisions or deviations, with reason: reducer-first (per M1�M3 pattern); touch calibration sheet mount deferred to the presentation phase that consumes `touchCalibration.ts`.
Known risks / blockers: none blocking M5.
Next phase entry conditions: M5 manual outlines + update-in-place persistence.
