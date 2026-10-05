# Mobile takeoff: keyboardless implementation handoff

**Date:** 22 September 2026

**Status:** Source changes implemented; isolated validation completed; configured application and owner-device gates remain.

**Baseline:** `quotecore-plus-mobile-handoff-2026-09-22.zip`, exported from upstream `76c8ae5c`.

**Original archive SHA-256:** `d44faedf8e191980e434139d142ac58decaa9d9320e1579db7f48d8cc71a032e`.

This is the handoff for an applied implementation, not a request to rebuild an earlier prototype. The patch and changed-files archive contain the same repository-relative source and tests. Neither needs any previous “improved archive”. The original repository remains the integration baseline. Do not apply both delivery formats.

## 1. Product contract implemented

The normal phone takeoff journey is now **canvas + contextual right rail**. Distance and pitch use a button-based numeric keypad in the rail. There is no editable text field, voice entry or roof-name form in the core calibration/outline/save journey. Dashboard job creation and the quote builder remain outside that keyboardless scope.

The normal rail is 208 CSS pixels wide; the keypad rail is 272 pixels wide. Its width is capped to preserve canvas space. Number entry replaces the normal controls rather than covering them or opening an additional panel. The numeric rail has four rows of keys with 48-pixel minimum height. Standard tasks put their primary action in a fixed footer and permit secondary controls to scroll inside the rail. A rare destructive-exit confirmation may still use the existing floating sheet.

### 1.1 Manual calibration

1. **Find a measurement.** The plan is fitted as soon as both its actual image dimensions and its actual canvas container are available. The user can tap, pan and pinch without creating a point. The rail explains the task and offers **Ready**. Ready remains disabled while the page/image is preparing.
2. **First point.** Ready starts placement. Tap the first end. Lift the finger, then press elsewhere on the canvas and drag to adjust the selected point relatively. It does not jump under the finger. Releasing sets its position, but does not advance the step. Tap **Confirm first point**.
3. **Second point.** Repeat, then tap **Confirm second point**. Start/End selectors permit correction. Points must stay on the plan, and the two points must form a valid span.
4. **Known distance.** The rail becomes the numeric keypad. Enter the length, using `.` for decimals, then **Enter**. Backspace and clear are available. Empty, zero, negative, non-finite and malformed distances are rejected. A previous value remains editable when returning to the endpoints.
5. **References.** Show the accepted reference and offer **Confirm calibration** as the primary action or **Calibrate another length** as the secondary action. The user needs only one reference; the maximum remains three. Additional references begin with Find/Ready again. The existing reducer rejects duplicates, validates references, normalises units and computes the arithmetic mean of accepted distance-per-pixel scales. Existing disagreement acknowledgement remains explicit.
6. **Acknowledged transition.** Only a successful server response advances to the outline choices. A failure retains the reference draft and displays its error.

The quote's metric/imperial setting supplies the default calibration unit. The small visible unit button can change the input to `m`, `mm`, `cm`, `ft`, `in` or `yd`; this is optional, not another required step. This matters when a metric quote uses a dimension printed in millimetres. For example, `9150 mm` must not become `9150 m`. The override changes the reference's input unit, not the quote's working unit.

### 1.2 Pitch

The new-roof session defaults to **25 degrees**. The user can leave it untouched, change it one degree per arrow tap, or tap the number to open the same keypad for exact entry. Pitch must be at least zero and less than 90 degrees. Decimal pitch entry is supported. The first digit typed over an existing pitch replaces that value; backspace still permits editing it. The user's pitch is shared from calibration through final confirmation and is not overwritten by AI output.

Pitch is available before calibration and on the outline choice/final screens, so a missed adjustment does not require repeating calibration. Editing an already saved roof retains that roof's existing name and pitch; this patch does not silently apply the new-roof default to existing data.

### 1.3 Roof outline

After calibration, the rail presents **Manual Outline** and, when entitled, **AI Scan Assist**. Lack of AI entitlement or credits does not block manual work. The existing scan API and billing remain in use; touch uses the low/Easy quality tier and its corresponding point cost. The desktop quality choice is unchanged.

Manual outlining appends corners, permits off-point adjustment, and offers **Close outline** after at least three vertices. An open draft is drawn as an open polyline, not misleadingly as a closed roof. An AI result shows its points immediately, with **Done** or **Edit points**. An unchanged, valid AI outline can be accepted without moving a vertex.

Editing uses the compact previous/next/insert/delete grid. Navigation follows stored perimeter order. Insert uses the midpoint between the selected vertex and its successor; delete reconnects neighbours subject to the existing minimum-geometry rules. Selection arms a point for relative dragging. Releasing disarms movement; the point counter re-arms it without requiring a precise tap on the canvas. Connected edges update live. Undo/redo and view controls remain available. Two fingers remain reserved for view gestures.

**Done** opens final confirmation in the rail. The new name is **Main Roof**; no text entry is requested. The user sees the pitch and **Save & finish**. Save awaits the real persistence result, then navigates to:

```text
/{workspaceSlug}/quotes/{quoteId}/build?step=roof-areas
```

This is the desktop builder destination, not the quote detail page. The existing parent-area action still supplies a unique label when necessary for repeated roof creation.

## 2. What was changed and why

### 2.1 Initial plan fitting and camera lifecycle

The earlier touch surface could miss its first fit when image loading, page creation and container measurement completed in different orders. `usePlanRaster` now owns image loading/error/retry, and `usePrecisionCamera` binds directly to the mounted surface and observes its size. Both calibration and outline canvases use these hooks. The same existing takeoff-scene coordinate frame is retained.

A new frame fits once. Rail resizing fits an untouched fitted view or preserves a user-adjusted view's scene centre and zoom. Rendering/viewport coordinates never become saved geometry. A delayed page id cannot make the temporary placeholder dimensions into accepted calibration points. The Fit action remains available for recovery.

The shell continues to use its existing visual-viewport service and safe-area handling. The return-to-touch button now also follows the visual viewport in Desktop mode. A hit-tested browser reproduction showed that the deliberately oversized desktop layout could otherwise place this button beyond a phone's visible viewport. No browser policy or obstruction was bypassed to obtain the passing result.

### 2.2 Calibration and parent orchestration

`TouchCalibrationWorkspace` remains an adapter around `useCalibrationController` and `calibrationSessionReducer`; it does not introduce a second scale engine. The local Find/Start/End/Distance/References steps describe presentation only. Pointer release cannot advance A/B confirmation.

`TakeoffPage` now subscribes to the stable workstation bridge instead of relying on a stale adapter read. It resolves calibration metadata for the actual active page, not page one's metadata with a substituted id. After the calibration server acknowledgement, `applyConfirmedCalibration` adopts the scale into the existing workstation state/cache before the parent advances. This removes the refresh/readiness race.

`persistPageCalibration` now checks that a page was actually updated and returns the server-resolved image revision. The metadata envelope and page revision are kept consistent. Failure is surfaced rather than reported as success after a zero-row update.

### 2.3 Save & finish and retry behaviour

The old touch callback was not completed in every target-area branch. The implementation now reports the measurement save result for new parent roofs, pre-created target roofs and add-to-existing-area targets, using the existing workstation save orchestration and `saveTakeoffMeasurements` action.

A synchronously acquired single-flight lock prevents two taps from producing competing saves. The old artificial client timeout has been removed: a slow, still-running request is not converted into a retryable failure while it may still commit. Pending save disables conflicting actions and displays progress.

A retry after acknowledged parent creation keeps the **same parent id** and applies the user's current corrected geometry/pitch. It does not freeze the first failed polygon or create a second roof parent. Same-target/page measurements are carried into the existing scoped save path. On a known parent-creation failure, the optimistic touch-created roof is removed from the workstation. On a transport failure where creation is uncertain, the app reports that uncertainty and asks for reload/checking the quote rather than blindly creating another parent. These are client-orchestration protections, **not a claim of server-wide idempotency**.

Saved outline editing still uses the existing update-in-place action. Failed saves retain the visible edit draft. Late scan responses are discarded after cancellation; scan cancellation no longer invalidates an unrelated human edit context. A stale frame blocks saving. A completed save does not navigate a presentation that has already unmounted.

The session-version ref is published synchronously when advancing versions, so the next awaited save cannot accidentally read a version that React has not committed yet.

### 2.4 Scoped access-control fix

`createNewTakeoffArea` performs admin-client writes, which bypass row-level security. It now explicitly verifies that the requested quote belongs to the caller's company before those writes. This follows the neighbouring action's ownership-check pattern. It is a scoped fix, not a comprehensive security audit or a schema change. Company-isolation checks belong in the agent's database validation.

## 3. Scope boundaries

- No dependency, lockfile, database migration or GitHub workflow changes.
- No new calibration reducer, measurement engine, coordinate frame or vision provider.
- The existing AI roof-outline scan is integrated. **Mobile AI calibration remains disabled**, matching the supplied branch's policy; this patch does not enable or improve its detector. The manual editor is the guaranteed path. Existing candidate-edit integration remains in the calibration hook for its separate future enablement.
- Recalibration of a page with existing dependent measurements remains blocked in this mobile path with an explicit Desktop instruction. This patch does not invent a second atomic recalculation mechanism.
- No component-drawing extension, OCR redesign, speech entry or automatic phone orientation lock.
- Normal touch forms have been replaced, but historical sheet/rail modules have not been deleted indiscriminately; other call sites and existing pure tests may still use them.
- Desktop markup/feature-off presentation is intentionally retained. The shared version/action changes and bridge callbacks still require the desktop regression suite. Do not label desktop parity as independently proven here.

## 4. File map

All new presentation/domain helpers are under `app/lib/takeoff/precision/`:

| File | Responsibility |
|---|---|
| `NumericRail.tsx`, `touchNumberEntry.ts` | Reusable button keypad, decimal editing/validation, pitch stepping/defaults. |
| `TouchRailControls.tsx` | Task layout with fixed primary footer, action buttons, pitch and view controls. |
| `usePlanRaster.ts` | Real image dimensions, asynchronous loading, source errors and retry. |
| `usePrecisionCamera.ts`, `touchCamera.ts` | Surface binding, initial fit and resize-safe view transforms. |
| `CalibrationCanvas.tsx`, `OutlineCanvas.tsx` | Opaque plan rendering and precise geometry overlays. |
| `touchCalibrationFlow.ts` | Presentation-only calibration placement gates and plan bounds. |
| `TouchOutlineRail.tsx` | Outline choices, edit grid, review and final save rail. |
| `touchSaveFlight.ts` | Promise sharing for one outstanding action. |
| `keyboardlessTouch.test.ts` | 38 new deterministic regression tests. |

Modified presentation hooks: `TouchCalibrationWorkspace.tsx`, `TouchOutlineEditor.tsx`, `TouchWorkspaceShell.tsx`.

Modified takeoff integration files: `TakeoffPage.tsx`, `TakeoffWorkstation.tsx`, `actions.ts` under `app/(auth)/[workspaceSlug]/quotes/[id]/takeoff/`.

Browser tests: new `e2e/helpers/keyboardless-takeoff.ts`; updated `e2e/specs/takeoff-touch-precision.spec.ts` and `takeoff-touch-ux.spec.ts`. The old field/voice/sheet assertions are replaced by the new product contract, not left passing against obsolete controls. The entry-failure, desktop and flag-off baseline cases are retained. New primary-action helpers assert containment before tapping; there are no forced clicks, hidden overlays or automatic reloads to rescue a failed journey.

## 5. Validation actually performed

| Tier | Result | Exact limitation |
|---|---|---|
| Precision/domain tests | **184 passed**, zero failures: original 146 plus 38 new. | External TypeScript loader, not the installed project `tsx` runtime. |
| Calibration tests | **192 passed**, zero failures in the selected files. | `calibrationVision.test.ts` contains 31 further tests and was excluded because the required OpenAI package is unavailable. This is not the full 223-test gate. |
| Pure strict TypeScript | Passed for `keyboardlessTouch.test.ts` and its imported pure-domain graph. | Not the complete Next/React application typecheck. |
| Changed TypeScript source | 21 source/test files transpile with zero syntax errors. | Transpilation does not establish type correctness or lint compliance. |
| Isolated browser UI | **8 journeys passed**, using actual presentation modules and honest taps. | Mock workstation/actions/router; review-only React 19.1.1 and Tailwind 4.1.10, not the target React 18/Next 16 build. |
| Normal project build/lint/tests | Attempted, blocked before their real execution. | `next`, `eslint`, `tsx` and project Playwright are not installed. Registry access was unavailable; no package changes were made to bypass this. |
| Authenticated database/Next E2E | Added/updated, **not executed here**. | Requires configured app dependencies, local environment and the agent's development accounts/database. |
| Physical iPhone Safari/PWA | **Not executed.** | Emulation cannot establish OS-keyboard behaviour, browser chrome, home-indicator/notch interference, or thumb usability. |

The external Node checks used Node 22.16.0 and global TypeScript. Calibration tests that need image transforms used the available `sharp` 0.34.1, not the repository's pinned 0.35.3. A review-only React runtime was used to load controller imports. Do not represent these as tests of the exact installed production dependencies.

The isolated browser bundled 41 actual application modules, including `TakeoffPage`, both editing hooks, geometry/controller code and the new rail/canvas components. It replaced server actions, routing and the large workstation adapter with deterministic fixtures. Tests ran on an `about:blank` page populated with local code because this sandbox's Chromium navigation policy blocks URL navigation; that policy was not changed. AI results were fixture polygons, not live-model accuracy tests.

### Eight isolated journeys

1. Initial fit, browse without A, relative drag, explicit A/B, numeric distance, unchanged AI outline and correct acknowledged builder destination.
2. Exact 31.5-degree pitch plus a one-degree increment, calibration failure/retry, manual polygon insert/delete, roof-save failure retaining the draft, successful retry.
3. 568x320 landscape, delayed initial page readiness, invalid/zero pitch handling, invalid distance, optional millimetre override and minimum 48-pixel keypad targets within the viewport.
4. Three genuinely distinct accepted references, maximum cap and arithmetic-mean scale payload.
5. Imperial quote default, pending save with no premature route, disabled competing controls and no second request from another tap.
6. Cancelled late AI result, subsequent AI edit through off-point dragging, Desktop/touch round trip preserving the selected draft.
7. Changed image revision visibly blocks save and makes no create request.
8. Dirty one-point outline, Back/Stay guard and draft preservation.

The validation archive contains final logs/results and screenshots. Screenshots show a labelled synthetic fixture, not a live customer quote. Review vendor runtimes are not included in the source ZIP.

## 6. Apply the delivery

Use a clean branch based on the supplied commit. Review any changes your branch has made since `76c8ae5c` before applying; do not overwrite them blindly.

```bash
# From the repository root, with the downloaded patch outside the repository:
git status --short
git switch -c mobile-keyboardless-review
git apply --check /path/to/quotecore-mobile-keyboardless-2026-09-22.patch
git apply /path/to/quotecore-mobile-keyboardless-2026-09-22.patch
git diff --stat
```

The baseline export uses CRLF in many existing files. The delivery preserves those original line endings for modified existing files; new files use LF. On a checkout intentionally normalised to LF, investigate an application failure before changing content. `git apply --ignore-space-change --check ...` and then the same option on apply can accommodate context-line normalisation, but are not a substitute for reviewing a branch conflict. Do not use `--reject` and leave partially applied code unnoticed.

Alternatively, extract **the changed-files-only ZIP into the repository root** and review the resulting Git diff. It contains full contents of added/modified files with their repository-relative paths and no unrelated source tree. There are no deletions to apply manually. Do not also apply the patch.

This Markdown is included at `docs/MOBILE_TAKEOFF_KEYBOARDLESS_HANDOFF_2026-09-22.md`. The validation delivery includes a baseline/modified-file SHA-256 manifest and patch-application verification results.

## 7. Agent integration gates before giving this to the owner

### Gate A: compile and contracts

Use the repository's pinned lockfile and installed framework docs. Keep the dependency versions unchanged.

```bash
npm ci
npm run lint
npm run build
npm run test:precision
npm run test:calibration
npx playwright test --config=playwright.touch.config.ts
```

Use the existing local/development-only safety guard and a fresh production build for E2E. Configure credentials through the established environment; never embed them in code or artifacts. Do not reuse an old `next start` process that serves a different build. The updated suites define ten scenarios, exercised by the configured Chromium/WebKit projects with the retained project-specific baseline skips.

Expected pure-suite counts on this source are 184 precision and 223 calibration. Fix genuine type/lint/integration failures before presenting the version as ready; do not suppress rules globally or weaken tests. The external loader used for this review is not a requested dependency change.

### Gate B: real save/database branches

These are important because the isolated browser deliberately did not fake proof of the actual workstation/database behaviour:

- Enter through **Measure a job**; calibrate; create Main Roof; confirm its saved polygon, pitch, page and parent id after builder navigation and reload.
- Repeat for a pre-created target roof area and add-to-existing target on the same page. Verify existing target measurements and other pages are preserved rather than overwritten or duplicated.
- Reopen a saved roof, alter vertices and save in place. Count parent and measurement rows before/after. Existing name/pitch must remain unchanged.
- Fail parent creation; fail measurement persistence after parent creation; repair the retained polygon/pitch and retry. A known parent id must be reused. Test a genuinely ambiguous network outcome separately and confirm no blind new-parent retry.
- Hold a save pending, double tap, attempt conflicting navigation and then acknowledge/fail it. No early success, second in-flight save, duplicate area or route before acknowledgement.
- Save one, two and three references; reload a calibration-only page; verify unit normalisation, active-page isolation and the server revision. An inaccessible/missing page cannot receive a success result.
- Test stale session/version conflicts, changed page/frame and late AI responses. Confirm rollback/error behaviour in the existing actions rather than removing the guard.
- Verify another company's quote cannot be passed to `createNewTakeoffArea`. Test permitted owner/company roles and existing desktop area creation too.

This patch does not make the database's separate parent-creation and measurement-save operations into one transaction. The retry protection is scoped to the known-id flow; server idempotency and unknown-outcome recovery should not be assumed.

### Gate C: presentation regression

Run the new authenticated E2E journeys using their honest containment/tap helpers. Retain evidence for desktop mode, flag-off mode and mode round trips. Validate the normal 844x390 landscape and the 568x320 compact layout; rotate during number entry and while a draft exists. Verify loading/error image states, no overlapping entry controls, and that the return-to-touch button is inside the visual viewport.

The actual default browser/PWA choice remains capability/preference based; mobile can be selected explicitly from takeoff. No new installed-PWA requirement has been introduced.

## 8. Owner's short physical-device check

After Gates A-C pass on the exact candidate build, provide the owner that build id and a known test quote. Ask them to check the normal experience, not to hunt for database races.

1. On the iPhone, enter via Measure a job in landscape. The plan appears without searching. Move around before Ready and confirm that no marker is created accidentally.
2. Place and remotely adjust Start and End. Each release sets the marker; explicit confirmation advances. It should be obvious which point is active and how to re-arm it.
3. Enter a real dimension in the right rail while keeping the printed value in view. The OS keyboard must not open. Test backspace, exact pitch and the one-degree arrows. Rotate once, then return to landscape; values and points must survive.
4. Finish with one calibration, AI-scan or manually draw, repair a vertex using the four-button controller and press Done. Main Roof and the chosen/default pitch are visible.
5. Save & finish. The builder opens after saving, contains the roof area, and survives reload. Repeat once in the installed PWA and once in mobile Safari, including browser chrome expanded/collapsed and the phone's opposite landscape orientation.

Record a screen capture and diagnostics reference for a failure, together with the exact device/iOS/build and whether the entry was Safari or the installed PWA. Do not claim the native keyboard or touch feel is verified from the supplied screenshots alone.

## 9. Implementation sequencing and rollback

The delivered patch completes these implementation slices: shared keypad/camera helpers; guided calibration; contextual outline/review/finalisation; workstation acknowledgement/retry integration; authenticated regression specifications. It is one coherent change set because the parent and hook contracts change together. Do not cherry-pick just the new JSX without its bridge/action changes.

Integration is now phased by Gates A-C, followed by owner testing. Keep the existing company touch feature flag dark-launched until those pass. A deployment rollback should revert the coherent patch and restore the previous application build; no migration rollback is required. Existing accepted calibration and measurement record schemas are retained.

## 10. Technical references consulted

Repository code and the owner's approved workflow determine the implementation. External documentation was used only for the browser/framework contracts, not to invent project requirements:

- React: `https://react.dev/reference/eslint-plugin-react-hooks/lints/set-state-in-effect` (measurement/ref-driven layout effects; the actual installed lint rules still need running).
- MDN: `https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport` (visible versus layout viewport and offset/size contracts).
- Next.js: `https://nextjs.org/docs/app/api-reference/functions/use-router` (App Router navigation API; target dependency remains the supplied version).

**Release status:** implemented and externally validated to the limits above; not yet a certified production build or a physical-iPhone acceptance pass.
