# QuoteCore+ — Mobile Takeoff and Precision Geometry Editor

**Implementation specification · 21 September 2026 · Version 1.0**

**Primary release:** a touch-optimised digital takeoff workspace in which a user can calibrate manually or repair AI calibration, create a roof outline manually or repair an AI outline, and save/reopen the result. Linear components follow in a separate phase using the same editor.

**Core principle:** AI proposes geometry; the user can always create or correct it. Mobile takeoff must not depend on improving AI calibration detection first.

**Delivery status:** specification, not an applied code patch. Repository observations below were checked against the supplied 20 September archive. No application build, browser suite, database migration, or device test is claimed by this document.

---

<a id="s0"></a>
## 0. Read this first: authority, scope and implementation order

### 0.1 Which material is authoritative?

The user's latest requirements in this conversation are authoritative for the product behaviour defined here. The implementing agent's **current repository** is authoritative for actual functions, schemas, permissions, entitlements and business rules. This document maps the supplied snapshot and proposes the smallest coherent integration; it does not assume later fixes are absent.

The inspected source is `quotecore-plus-smart-assistant-2026-09-20.zip`, SHA-256:

```text
8a775f1f21709374f6bf10770ad11f81b1b78159a5812a21dcb46542affd06f2
```

This document supersedes earlier **mobile interaction priorities**, any suggestion that AI endpoints cannot be edited, and any implication that mobile must wait for accurate AI calibration. It does **not** supersede the existing calibration calculation, measurement ownership, authentication, billing, database integrity, or other app features. The preceding vision-accuracy specification remains a separate, deferrable detector-improvement track. The prior pre-human-test audit's safety findings remain checks to verify, not instructions to reimplement already-fixed code.

The earlier “improved archive prototype” is **not a dependency**. All symbols explicitly labelled **proposed** in this document are new contracts or suggested modules, not claims that files already exist. Do not import a ghost implementation.

### 0.2 Confirmed requirements versus engineering choices

**Confirmed:** landscape-first mobile workspace; automatic and manual desktop/touch selection; approximate point placement followed by off-point dragging; two-finger pan/zoom; a compact four-button perimeter selector; editable manual and AI calibration; one accepted calibration sufficient, maximum three; average accepted, unit-normalised scales; editable manual and AI outlines; save/reopen; optional components using the same point interaction.

**Specified engineering defaults:** target sizes, touch slop, breakpoint heuristic, local undo depth, camera behaviour, test thresholds and module boundaries below. These are implementation proposals, not measurements of existing usability. The agent may tune a default with evidence while preserving the confirmed behaviour. Record deviations rather than silently changing the product.

### 0.3 Release boundary

**M0–M7 are the first mobile release.** It must work with all AI services unavailable. Where entitled and enabled, it must also let users repair AI calibration and AI outlines. M8 adds mobile linear components; it must not delay the calibration-and-outline release.

Do not include a new CV pipeline, model migration, automated pitch inference, whole-app redesign, general polygon boolean editor, offline synchronisation engine, or automatic 3D/perspective rectification in M0–M7.

### 0.4 Reading map

| Topic | Section |
|---|---|
| Product invariants and journeys | [1](#s1) |
| Actual source map and integration risks | [2](#s2) |
| Desktop/touch switch, landscape and workspace layout | [3](#s3) |
| Shared editor architecture and data contracts | [4](#s4) |
| Exact touch/gesture state machine | [5](#s5) |
| Previous / next / insert / delete controls | [6](#s6) |
| Manual and repairable AI calibration | [7](#s7) |
| Manual, AI and saved roof outlines | [8](#s8) |
| Components follow-on | [9](#s9) |
| Coordinates, image quality and rendering | [10](#s10) |
| Save, undo, concurrency and failure handling | [11](#s11) |
| Proposed modules and integration tasks | [12](#s12) |
| Gated implementation phases | [13](#s13) |
| Automated acceptance suite | [14](#s14) |
| Hardware and owner acceptance | [15](#s15) |
| Agent-start instructions and checkpoints | [16](#s16) |
| Sources, defaults and worked examples | [17](#s17) |

---

<a id="s1"></a>
## 1. Product contract

### 1.1 The journey

```text
Open Digital Takeoff for the selected quote / plan page
    -> resolve Desktop or Touch workspace
    -> load/select a PDF page or image using the existing upload path
    -> Calibrate: manual points OR AI proposals, both editable
    -> accept 1–3 references and establish this page's scale
    -> Roof outline: manual creation OR entitled AI scan
    -> accept directly, or move / insert / delete vertices and then accept
    -> save and return to the quote, or continue to Components when supported
```

Re-entry resumes saved data; it does not force a calibrated page through onboarding again. “Calibrate → Outline → Components” is the guided starting sequence, not a prohibition on revisiting calibration or editing a saved outline.

### 1.2 Non-negotiable invariants

| ID | Requirement |
|---|---|
| R01 | Manual calibration and manual outlines remain available without AI entitlement, credits, successful detection or a live AI request. Normal takeoff access permissions still apply. |
| R02 | An AI-origin point is editable just like a manually placed point. Moving it locally does not call AI, charge points or require renewed AI entitlement. |
| R03 | One accepted reference is enough. At most three contribute to a page's working calibration, including mixed manual/AI references. |
| R04 | AI initially prioritises the longest **eligible, reliable** references. It never fills three slots with fabricated geometry just to reach three. This work does not redesign that ranking algorithm. |
| R05 | Effective scale is the arithmetic mean of accepted real-distance-per-scene-pixel ratios after unit conversion. No longest-only substitution, length weighting, mean-of-inverses or averaging of raw distances. |
| R06 | Selection and coordinate placement are separate. A large tap target can select a tiny precise marker. Remote dragging moves the marker by a relative delta; it never teleports to the finger. |
| R07 | The perimeter controller selects previous/next vertices in stored perimeter order, not by screen-left/screen-right position. |
| R08 | Insert creates a vertex at the midpoint of the selected vertex and its successor. Delete removes only the selected vertex. The two adjacent edges update; other vertices do not translate. |
| R09 | Two fingers manipulate the view, never the measurement. A cancelled gesture cannot leave half a point move or a stray point. |
| R10 | Releasing a drag commits that move to the **edit draft** and disarms it. It does not accept calibration, accept an outline, save the quote or submit a server request. |
| R11 | Layout switches, zoom, device rotation and screen pixel density never change stored scene coordinates or measurement scale. |
| R12 | Calibration, geometry and pending AI results belong to a specific quote, page and immutable image revision. No cross-page scale inheritance or late-result application. |
| R13 | Editing an existing calibration/outline is reversible until explicit save. Cancel preserves the last saved working version and all unrelated measurements. |
| R14 | Desktop and touch use the same domain and save paths. A new mobile database or separate measurement engine is not part of this feature. |
| R15 | The touch workspace is available in a normal browser and an installed PWA. Installation is not a prerequisite; a desktop PWA is not automatically a phone. |
| R16 | Geometry, units, pitch semantics, quantities, permissions and entitlements remain deterministic and validated. A nicer gesture is not permission to bypass existing checks. |

### 1.3 What the user should understand without technical terminology

Use **Point**, **Outline**, **Known distance**, **Start**, **End**, **Previous point**, and **Next point** in customer-facing copy. “Vertex”, “scene coordinates”, “m/px”, “affine transform” and “aggregation policy” belong in code/debug tooling, not the main toolbar.

Teach the interaction once, inline:

> Tap to place a point. Then drag elsewhere on the plan to move it without covering it. Lift your finger to set it. Use two fingers to move or zoom the plan.

For an existing point:

> Select a point, then drag elsewhere on the plan to adjust it.

The point remains a precise centre/crosshair. A larger selection halo must not obscure the actual intersection being aligned.

---

<a id="s2"></a>
## 2. What is actually in the supplied code

Paths below are **observations from the archive**, not assertions about the agent's newer branch. Let `TAKEOFF` mean:

```text
app/(auth)/[workspaceSlug]/quotes/[id]/takeoff
```

| Existing surface | Observed behaviour / reuse opportunity |
|---|---|
| `TAKEOFF/TakeoffPage.tsx` | Client-only dynamic workstation import; wrapper uses `w-[125%] -ml-[12.5%]`. That desktop widening must not be carried into the touch workspace. |
| `TAKEOFF/TakeoffWorkstation.tsx` | Large stateful Fabric workstation with calibration, roof areas, component measurements, history, page/area caches and save orchestration. Extract adapters instead of duplicating it. |
| Workstation canvas initialisation / events | Image-based scene capped at 2000 on the long edge; `Canvas`, `FabricImage`, `getScenePoint`, `mouse:down/move/up`; existing pan uses `altKey`. These are not the required mobile gestures. |
| Workstation `handleAiScan` | Sends `stage: 'scan1'` and then calls `runRemainingAiScans` for internal lines/classification. Stopping at an editable outline requires orchestration work even though outline detection exists. |
| `app/lib/takeoff/calibration.ts` | `computeEffectiveCalibration`, `calibratedLength`, `calibratedArea`, `effectiveScaleFromLegacyCalibrations`; maximum three accepted references; unit-normalised arithmetic mean. Reuse. |
| `app/lib/takeoff/calibrationCoordinates.ts` | Explicit source/analysis/scene affine transforms and inverse/bounds helpers. Reuse rather than writing another coordinate convention. |
| `app/lib/takeoff/calibrationTypes.ts`, `calibrationSession.ts` | Candidates, accepted references, session context and reducer. In this snapshot the event union has value/unit changes but no human endpoint-edit event. Extend the live implementation. |
| `TAKEOFF/calibration/useCalibrationController.ts`, `CalibrationReviewPanel.tsx`, `calibrationOverlay.ts` | Existing request/review/overlay integration. Separate reusable state from desktop presentation; do not mount a second independent review controller in touch view. |
| `app/lib/takeoff/calibrationCodec.ts`, `calibrationRecompute.ts` | Versioned persisted calibration and deterministic value recomputation, including provenance-linked derived measurements. Preserve compatibility and extend carefully. |
| `app/lib/takeoff/useStateHistory.ts`, `reconstructCanvas.ts` | Plain-data history and reconstruction, not Fabric JSON as the authoritative model. Use this direction. |
| `app/lib/takeoff/applyAiResults.ts`, `outlineGeometry.ts`, `scanPostprocess.ts` | AI-to-domain conversion and geometry utilities. Reuse only the appropriate parts; do not turn all AI components into committed data when accepting only an outline. |
| `TAKEOFF/actions.ts` | Save/hydration, session versions, page calibration, and roof-area ownership. Reuse the **current hardened** save service; see M0 and §11. |
| `app/components/PdfPagePicker.tsx` | Existing PDF selection/render path. Keep this and make its presentation usable on touch; do not rebuild PDF ingestion. |
| `app/(auth)/[workspaceSlug]/layout.tsx` | Global header, max-width main layout, help drawer, entitlement/impersonation banners and assistant launcher. Immersive takeoff must cooperate with this chrome rather than merely overlay it. |
| `app/manifest.ts`, `app/layout.tsx` | Existing standalone manifest and viewport configuration including safe-area support. Do not impose global landscape orientation. |
| `playwright.config.ts`, `e2e/` | Existing origin-guarded dev harness, serial mutation policy and mobile device emulation. Extend it; do not remove the safety guard to make tests easier. |

The archive declares Fabric `^7.3.1`, Next `16.2.12`, React `18.3.1`, and TypeScript-based tests. These are **manifest declarations**, not independently installed/resolved versions for this review. Read the current lockfile and installed library types. `AGENTS.md` explicitly directs the coding agent to the installed Next documentation before changing framework integration. Fabric's official upgrade guide documents the `getScenePoint`/`getViewportPoint` distinction; do not paste old `getPointer` examples. [B8]

### 2.1 Four integration traps to address before gestures

**Scene size versus viewport size.** In the snapshot `canvasDims` participates in image processing and AI coordinate mapping. Replacing it with the phone's display width would corrupt measurements. Split the concepts, preserving the page's coordinate frame (§10).

**Two event systems handling one touch.** Adding Pointer Events while leaving legacy Fabric/DOM handlers active can place two points, start an old pan or trigger a modal. Establish a single interaction owner per workspace mode (§5.6).

**Drawing a new area is not editing an existing area.** `handleSaveArea` is an additive, ownership-sensitive flow. Do not call it for every repaired polygon and create duplicate roof areas. Introduce/reuse an explicit update-in-place command (§8.5).

**Old safety findings may already be fixed.** The inspected archive still shows separate measurement/calibration writes and a mock-style image descriptor in parts of the workstation. The current branch may differ. M0 must verify page identity, transaction boundaries and hydration using actual code/tests. Do not copy these old paths into the mobile adapter or declare later fixes missing without checking.

---

<a id="s3"></a>
## 3. Workspace mode, landscape and compact layout

### 3.1 One product, two presentations

Expose a persistent, discoverable **Workspace view** control within Digital Takeoff:

```text
Auto
Desktop
Mobile / touch
```

On desktop place it near existing takeoff view/zoom controls. In touch view keep it in the always-accessible workspace menu, reachable without finishing or discarding a draft. It must not be hidden behind AI access, PWA installation, landscape orientation or a paid feature.

Store the preference **locally for this browser/device**, under a versioned takeoff-only key; account-scoped keying is preferable on shared devices. Do not sync a phone's choice into the user's desktop profile. Storage access failures fall back to session memory.

**Precedence:** explicit preference → automatic recommendation. An explicit Desktop choice stays Desktop even on a phone; Mobile/touch also works with a mouse for testing and users who prefer it. Auto selection must never oscillate when a user touches a hybrid laptop or opens the on-screen keyboard.

Suggested Auto heuristic, to tune in M0/M2:

- At takeoff entry, use layout viewport dimensions and input capabilities, not user-agent string alone.
- Prefer touch when primary pointer is coarse and the shorter layout-viewport edge is at most 820 CSS px.
- For ambiguous mixed-input devices, retain the initial presentation and offer a non-blocking “Use touch controls?” suggestion on relevant touch input.
- Resolve orientation changes **inside** the chosen presentation. Do not recompute Auto from the smaller visual viewport caused by the keyboard.
- PWA display mode is contextual information only. It does not establish screen size or pointer precision. The `pointer` and `display-mode` media features describe different properties. [B3][B4]

The heuristic is a proposed starting point, not a claim that every phone is correctly classified. The manual switch is mandatory precisely because detection can be wrong.

### 3.2 Landscape-first, not a forcibly rotated page

When touch view opens in portrait, show a dismissible hint:

> Turn your phone sideways for more drawing space. You can continue in portrait.

**Do not CSS-rotate the entire app by 90 degrees.** The user physically rotates the phone and the layout responds. Otherwise pointer coordinates, browser controls, text input and accessibility become harder to reason about.

Touch mode fills the usable browser viewport without requiring the Fullscreen API. An optional **Expand workspace** action may request fullscreen and, where supported, landscape orientation after a user action. Handle denial/absence without blocking editing. Orientation locking has limited availability and commonly requires a fullscreen context; it is an enhancement, not the implementation foundation. [B2]

Do not set the whole PWA manifest to landscape: quotes, account pages and other features retain their own layouts. On exiting takeoff, restore any screen lock/fullscreen state acquired by takeoff where appropriate.

### 3.3 Landscape layout

Reserve space for controls; do not permanently cover the plan with the desktop sidebar.

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Back   Plan / page   Calibrate › Outline › Components    Save   Menu │
├───────────────────────────────────────────────────────────┬──────────┤
│                                                           │ Point    │
│                                                           │ 7 / 12   │
│                 PLAN + GEOMETRY CANVAS                     │          │
│                                                           │  ‹   ›   │
│                                                           │  +   −   │
│                                                           │          │
│                                                           │ Adjust   │
│                                                           │ Done     │
├───────────────────────────────────────────────────────────┴──────────┤
│ Context hint / draft status / undo / redo / view controls as space allows│
└──────────────────────────────────────────────────────────────────────┘
```

This is a layout contract, not a pixel-perfect mock-up. Use the app's branding and existing control components where suitable.

The right controller is for outline editing. Calibration replaces it with **A / B** endpoint selection and the relevant next/confirm action; no vertex insert/delete grid. Small landscape heights may put undo/redo in the top strip and hide the long hint after first use. Do not shrink the actual touch targets to fit more controls.

Proposed dimensions: 48×48 CSS px grid buttons, 8 px gaps, 8 px rail padding; approximately 120 px rail width before the device safe inset. A compact portrait version relocates the controller below or beside the canvas while preserving the same interactions. A 568×320 CSS-pixel landscape viewport must remain operable; long forms scroll independently. The proposed 48 px targets are a product choice above WCAG's 24 px minimum, not a statement that 48 px is its minimum. [B5]

### 3.4 Canvas and chrome rules

Use an explicit immersive-workspace context/contract with the app shell. Hide or collapse nonessential navigation and the floating assistant launcher while drawing. Restore them on exit. Do not hide required entitlement, impersonation or security notices without an equivalent compact, accessible indication. Menu/dialog portals must appear inside the active fullscreen container when fullscreen is used.

Prefer a stable canvas element with responsive sibling controls. Do not conditionally mount two workstations and hope their state remains aligned. Avoid body-class changes without cleanup, global CSS that affects other routes, and reparenting that unexpectedly remounts the canvas.

Use safe-area insets on both landscape sides and bottom. Support dynamic viewport height and `VisualViewport` for keyboard-obscured forms. The visual viewport can shrink independently when the software keyboard appears. [B6][B7] Reposition the distance sheet without changing the page's scene frame or resetting the user's zoom.

### 3.5 Minimal controls and clear intent

Show only actions relevant to the current step. Keep **Undo**, **Redo**, **Fit plan**, **Save/Done** and **Exit/Menu** reachable. Distinguish geometric `+ / −` from zoom: label the four-button group **Points** and put **Zoom in / Zoom out** in a separate view control. Never put two visually identical unlabeled plus/minus groups next to each other.

The selected point uses an orange halo and a precise centre mark. Connected edges and a “Point 7 of 12” label provide additional cues. Selection, armed-to-move, accepted and invalid states must not be distinguished solely by colour.

---

<a id="s4"></a>
## 4. Shared architecture and command model

### 4.1 Separate data, rendering, interaction and persistence

```text
Existing takeoff domain + current authorised save/hydration service
                         ↑
          domain adapters / explicit commands
                         ↑
    shared edit draft + validation + local operation history
                ↑                        ↑
     calibration A/B adapter      outline / component adapter
                         ↑
              precision gesture controller
                         ↑
       Pointer Events + accessible buttons / keyboard

Fabric renders the draft and saved geometry.
Desktop and touch presentations select an input adapter, not a database.
```

Prefer a small extraction around the current workstation rather than a wholesale rewrite. Maintain **one authoritative plain-data state owner** above presentation changes. Temporary gesture previews are disposable; they must not become a second persistent geometry model.

### 4.2 Proposed editor-level contracts

The following types specify responsibilities. They are not existing repo APIs and must be mapped to current types by the agent. Do not create duplicate `Point`, affine or working-unit definitions when importing the existing domain equivalents is possible.

```ts
// Proposed contracts; plain serialisable data. No Fabric / DOM objects.
type ScenePoint = Readonly<{ x: number; y: number }>;
type Vertex = Readonly<{ id: string; point: ScenePoint }>;

type EditContext = Readonly<{
  quoteId: string;
  pageId: string;
  imageRevision: string;
  coordinateFrame: 'takeoff-scene-v1';
  sessionVersion: number;       // expected server version at edit start
  contextEpoch: number;         // invalidates stale client/AI work
}>;

type EditTarget =
  | { kind: 'calibration'; referenceDraftId: string }
  | { kind: 'outline'; geometryId: string; quoteRoofAreaId: string | null }
  | { kind: 'component-line'; measurementId: string; componentId: string;
      quoteRoofAreaId: string | null };

type EditableGeometry = Readonly<{
  target: EditTarget;
  context: EditContext;
  vertices: readonly Vertex[];
  closed: boolean;
  localGeometryRevision: number;
}>;

type PointSelection = Readonly<{
  vertexId: string | null;       // inspection / next / previous context
  moveArmed: boolean;           // next off-point drag may move this vertex
}>;

type ValidationIssue = Readonly<{
  code: string;
  severity: 'warning' | 'blocking';
  message: string;
  vertexIds?: readonly string[];
}>;
```

Vertex IDs are stable **within the edit session and undo history**. Generate them when importing an existing point array; do not derive them from coordinates that change during a drag. Index is display order, not identity. A database vertex-ID migration is unnecessary unless the actual repo already requires persistent per-vertex links. Persist the existing polygon/measurement ID and points through the adapter. If a future component feature needs persistent anchors, design that separately.

### 4.3 Required commands

Implement equivalent operations in the existing architecture:

| Command | Effect |
|---|---|
| `beginEdit(target, context)` | Copy saved primitives into a draft and retain an immutable base version. |
| `selectVertex(id, arm)` | Change selection only; no geometry/history/save. |
| `appendVertex(point)` | Open-outline creation only; create, select and arm a new point. |
| `previewMove(id, point)` | Transient frame update; no server write and no history entry. |
| `commitMove(id, point)` | One logical draft move; increment local geometry revision, validate and invalidate affected confirmations. |
| `cancelGesture()` | Restore pre-gesture geometry; no history entry. |
| `insertAfter(id)` | Midpoint insertion with a new stable ID; see §6. |
| `deleteVertex(id)` | Remove one permitted vertex; reconnect neighbours; see §6. |
| `closeOutline()` | Switch an open path to a closed draft without duplicating its first point. |
| `discardEdit()` | Restore base; clear gesture/selection/draft-only derived values. |
| `saveEdit(expectedContext)` | Validate primitives, recompute dependencies, await current authorised atomic save, then adopt the server version. |

Domain adapters decide whether a gesture completion advances a calibration wizard, returns to outline creation, or just updates a selected vertex. The gesture engine must not open a specific calibration modal or create roof-area database rows itself.

### 4.4 Reuse does not mean automatic linkage

A point snapped to a nearby roof vertex shares coordinates, not necessarily ownership or a live topological relationship. Do not silently move independent components when a roof vertex moves. Only established, explicitly recorded dependencies propagate; see §8.5 and §11.


---

<a id="s5"></a>
## 5. Exact precision-touch interaction

### 5.1 Two distinct concepts: selected and armed

A point may remain **selected for inspection/navigation** after a drag while being **disarmed for movement**. This preserves the user's requirement that release fixes the point and the next unrelated touch cannot move it.

- Creating a point, selecting its marker, selecting A/B, or pressing previous/next arms that point.
- The active point number or an **Adjust point** button can re-arm the same point without requiring another precise canvas tap. This is necessary when the user reaches the edge of their finger's travel and needs another drag.
- Completing a move disarms it. The halo/counter may remain, but the “Drag elsewhere to move” cue is replaced with “Point set”.
- A calibration wizard may then advance to the next placement step. Outline review retains its navigation context.
- Navigation and local movement never count as accepting the reference or outline.

Do not require the user to hit a tiny marker repeatedly. Direct marker selection remains available, but the rail and A/B controls are sufficient on their own.

### 5.2 Relative off-point movement

When a point is armed, a one-finger press-and-drag beginning anywhere in the permitted canvas input surface moves that point **relative to its previous position**. The finger may start on blank paper, over the roof, or in the view margin. It must start outside toolbars, sheets and form controls.

Capture the selected point, pointer start and coordinate transform on `pointerdown`. At each move:

```text
deltaScene = inverse(sceneToClientAtGestureStart).vector(deltaClient)
previewPoint = originalScenePoint + deltaScene
```

Use only the inverse matrix's linear part for the delta. Do not apply its translation to a delta. Do not assign `point = screenToScene(fingerPosition)` for remote dragging. That would jump the point under the finger and defeat this feature.

At ordinary sensitivity the visible point moves the same CSS-pixel distance as the finger. More zoom means less scene movement for the same finger travel. Initial touch slop: 6 CSS px. Once exceeded, use the complete delta from the press start rather than repeatedly adding rounded increments. No movement is committed below the threshold. A long-press timer is not necessary for V1: “press, then drag” should be immediate once movement is intentional. Suppress the canvas context menu, not text-input selection elsewhere.

A direct drag beginning on a point may use the same relative-delta rule, preserving the initial finger-to-point offset. This is optional convenience; remote dragging and button-based selection are the primary path.

### 5.3 Gesture states and transitions

Maintain an active pointer map, a single gesture owner and a base snapshot. Use explicit states, not scattered booleans that allow drag and pan to run simultaneously.

| State/event | Required result |
|---|---|
| Idle; pointer down in a control/sheet | Control owns input; canvas does nothing. |
| Idle; pointer down on canvas | Record a pending press. Do not place a point yet. |
| Pending press; second touch arrives | Cancel pending tap/move; begin two-pointer view gesture. |
| Pending press; movement exceeds slop | Armed point → remote move. Otherwise → one-finger pan. Never append a point after a pan. |
| Pending press; release within slop | Resolve a single tap by the priority rules below. |
| Moving point; second touch arrives | Roll back the entire uncommitted one-finger move to its start, then begin pinch/pan using the current camera. No geometry/history event survives. |
| Moving point; normal release | Commit one finite, bounded draft move, disarm and run the tool's completion transition. A resulting polygon may still need repair before it can be saved; see §8.4. |
| Moving point; cancel/lost capture/page change | Restore the pre-gesture point, disarm and clear the gesture. |
| Two-pointer gesture; move | Pan and pinch simultaneously; geometry is unchanged. No twist-to-rotate in V1. |
| Two-pointer gesture; one finger lifts | Suppress all remaining contacts until all are lifted; the remaining finger cannot turn into a point drag or tap. |
| Any gesture; third touch appears | Cancel the uncommitted gesture, preserve its pre-gesture geometry, suppress contacts until all lift. Do not guess which two fingers the user intended. |
| Idle; explicit previous/next/insert/delete | Execute the corresponding editor command. These buttons do not forward events to the canvas. |
| Any gesture; layout resize/rotation/modal opening | Cancel the active gesture before changing view geometry; preserve the overall edit draft. |

For a cancelled view-only gesture, retain the last coherent camera or restore its starting camera consistently; either choice must leave geometry and its undo history unchanged. A geometry validation failure is not a pointer cancellation: keep a finite, bounded but self-intersecting polygon editable, with saving blocked until repaired.

**Tap priority when no gesture has occurred:**

1. A canvas marker hit selects/arms that existing point. Only markers of the active geometry/reference are editable.
2. A blank-canvas tap while a point is already armed leaves it armed and does not create another point. The user can press there again and drag, or use **Point is correct** / **Next**.
3. In an explicit placement state with no point armed, a blank-canvas tap creates exactly one point and arms it.
4. In closed-outline review/browse, blank taps never add vertices. Adding is the `+` action or an explicit insert command.

Do not place on `pointerdown`: the contact may be the first half of a pinch. Do not use both a raw `pointerup` handler and a later synthetic `click` to place geometry. A point is created once per resolved input sequence.

### 5.4 View gestures

Two fingers always pan/zoom, including while a point is armed. Starting a two-finger gesture disarms movement; after releasing both fingers, the current point can be re-armed from the rail/A/B button. This avoids a surprise move after zooming.

For a camera with uniform zoom `z` and translation `t`, let `c0` be the starting two-finger midpoint, `d0` their distance, and `q = (c0 - t0) / z0` the scene anchor. During the gesture:

```text
z1 = clamp(z0 * d1 / d0, minZoom, maxZoom)
t1 = c1 - z1 * q
```

Guard a near-zero `d0`. When zoom reaches a bound, recompute translation using the clamped zoom so the anchor remains stable. Coordinates here are local viewport CSS coordinates, not raw device pixels. Pan bounds should still permit examining all image edges and leave enough view margin for remote dragging.

One finger pans only when no point is armed. Provide explicit **Move plan**, **Fit plan**, zoom buttons, and a small view-controls sheet with pan buttons for users who cannot perform a two-finger gesture. **Move plan** temporarily disarms any point; it does not discard selection or draft geometry.

### 5.5 Touch targeting and exact point visibility

Use screen-space hit testing: about a 24 CSS px radius around a marker as a starting default, independent of zoom. The drawn centre can remain approximately 6–8 CSS px across, with an additional halo. Match all halo/label rendering to zoom so a marker does not become enormous at high magnification.

Where several markers are in range, select the nearest with a deterministic tie-break by perimeter order. Do not implement a fragile “keep tapping and hope” requirement: the right-hand previous/next controller must always resolve any ambiguity. Only the active outline's vertices participate; choosing another roof area is a separate action.

When arrow navigation selects an offscreen vertex, minimally pan it into the unobstructed canvas region after any current gesture has ended. Keep zoom unchanged, respect reduced-motion preferences and do not re-fit the entire plan each time. If the user is typing, do not move the camera under the form.

### 5.6 Pointer Events and Fabric integration

Use Pointer Events for the new touch adapter, with pointer capture, explicit cancellation and listener cleanup. `touch-action` must be configured before the gesture begins. Pointer capture keeps the event stream associated with the interaction surface; it is not a substitute for cancellation handling. These mechanics are defined in the Pointer Events specification. [B1]

**Recommended minimal integration:** a transparent touch interaction surface exactly over the canvas viewport, with DOM controls above it. In touch mode it is the only gesture owner. Disable/gate legacy Fabric drawing, object selection/transforms, double-click completion and old pan handlers. In desktop mode remove/disable this surface and retain desktop controls. A single unified adapter is also acceptable if proven with the same tests.

Requirements whichever approach is chosen:

- No duplicate native touch, mouse, pointer or Fabric paths may mutate geometry for the same interaction.
- Use `touch-action: none` only on the dedicated editing surface; do not disable browser gestures or text selection globally. Panels/forms retain normal scrolling and focus behaviour.
- Capture the pointer on the input surface. Release normally; treat unexpected `pointercancel`, unexpected `lostpointercapture`, blur and page lifecycle cancellation as rollback.
- A `lostpointercapture` arriving after a completed pointer-up must not undo the completed draft move. Keep a gesture completion token/state.
- Suppress ghost taps after a drag/pinch by pointer-sequence state, not a blanket timeout that makes legitimate next taps disappear.
- Toolbars handle their own events and sit outside the canvas gesture surface. If another pointer touches a toolbar during a canvas gesture, ignore the command until the gesture is cancelled/finished; never delete a point mid-drag.
- Clear listeners, captures, RAF callbacks and transient overlays on unmount or adapter change. Do not use broad Fabric `off(eventName)` calls that remove someone else's listeners; dispose only owned handlers. [B9]
- Stylus/mouse behaviour is explicit. Mouse-left drag works in touch view; no app action relies on mouse hover or `Alt`. Ignore conflicting multi-device input until the active gesture completes.

### 5.7 A non-drag precision alternative

Provide **Fine adjustment** in the point/context menu: four directional nudge buttons and a step choice (for example 1 or 5 visible CSS px), with **Done**. A nudge moves by the corresponding inverse-transformed screen vector, so zooming offers finer scene adjustment. Each tap is a logical command; a grouped press-repeat, if added later, must be undoable as one operation.

Keep these buttons separate from the perimeter previous/next selector: one changes position, the other changes selection. Keyboard arrows may nudge when the editor has focus; they must never intercept keys in a numeric/text field.

This is not just a desktop keyboard fallback. WCAG's dragging criterion calls for an equivalent single-pointer, non-drag operation where dragging is not essential; keyboard-only equivalence is not sufficient for touch-only users. [B10] Provide button-based pan/zoom as well, and preserve readable labels, focus order and screen-reader announcements for selection/commit, not every animation frame.

---

<a id="s6"></a>
## 6. The right-hand four-button perimeter controller

### 6.1 Exact meaning

```text
        Point 7 of 12
       ┌──────┬──────┐
       │  ‹   │  ›   │  Previous point / Next point
       ├──────┼──────┤
       │  +   │  −   │  Insert point after / Delete selected point
       └──────┴──────┘
         Adjust point
```

The visual arrows do **not** mean coordinate-left and coordinate-right. They traverse the perimeter in its stored order, including concave corners. Clockwise/counter-clockwise input is acceptable; preserve it. Do not reorder vertices by x/y, nearest neighbour or convex hull.

### 6.2 Previous and next

For a closed polygon with `n` vertices and current index `i`:

```text
previous = (i - 1 + n) mod n
next     = (i + 1) mod n
```

Wrap at the ends. For an open path, do not wrap; disable the missing neighbour. With no selection, either arrow selects the first vertex; the helper text makes that clear. Selection arms the chosen point and updates its two incident edges and point counter. Rapid taps must use current reducer state, not stale closure state.

### 6.3 Insert (`+`)

For selected point `P_i` and successor `P_j`, insert:

```text
P_new = ((P_i.x + P_j.x) / 2, (P_i.y + P_j.y) / 2)
```

Give it a new ID, insert it **after** `i`, select/arm it and preserve all other coordinates. Highlight the outgoing edge before insertion so the insertion side is obvious. The closed polygon's last point uses the first as successor; the new point is appended just before the closing edge returns to the first.

On an open path, insertion is available only when a real successor exists. At the last point, disable midpoint insertion and use the separate **Place next point** action/tap-creation state. Do not silently invent a closing edge or reinterpret `+` as append.

A midpoint is deliberately collinear until moved. Do not have simplification code immediately delete it. Insertion itself must preserve area and perimeter within floating-point tolerance. Keep insertion and the later move as **two** understandable undo steps: first Undo restores the midpoint, second Undo removes the inserted point. This also gives gesture cancellation an unambiguous pre-move state.

### 6.4 Delete (`−`)

Delete the selected point on a completed button activation, not pointer-down. Reconnect its predecessor and successor; select the successor in the reduced ordering and leave movement disarmed until explicitly selected/adjusted. Disable deletion when a closed outline has only three points. Explain: **An outline needs at least 3 points.**

For an open draft, deletion can reduce the path to two, one or zero points. Return to the corresponding placement state. Deleting a vertex is not deleting the entire roof area; whole-outline deletion is a separate confirmed action outside the four-button grid.

If deleting a vertex creates a crossing polygon, keep the editable draft visible with a blocking validation message and Undo available; do not persist it or silently rearrange the remaining vertices. No confirmation modal is required per ordinary vertex deletion because local Undo is immediately available. Disable `+ / −` during a gesture or save.

### 6.5 Navigation across several roofs

The grid operates on one selected outline, not a concatenation of every point on the page. Use a compact **Roof / Area** selector sheet to choose the target outline. Show its name in the rail. Visibility toggles and neighbouring outlines must not change this selection's identity.

With forty points, a stable counter and auto-reveal are required. A point-list picker can be a later convenience, not a prerequisite. The user must be able to reach every vertex with the four-button controller without a precision tap on the canvas.

---

<a id="s7"></a>
## 7. Calibration: manual creation and repairable AI proposals

### 7.1 Entry and re-entry

On a new, uncalibrated page show **Set scale manually** as a first-class action; also show **Find with AI** when the actual server-entitled feature is available. Do not auto-spend credits merely because the user entered touch view. Show cost/availability before a deliberate search, using existing canonical billing information.

For an already calibrated page, show **Scale set · 1/2/3 references** and **Edit calibration**. Editing opens a draft of the existing accepted set. Cancel restores the existing calibration. A layout switch never starts a new calibration session.

### 7.2 Manual A/B wizard

| Step | Canvas behaviour | Compact control |
|---|---|---|
| Place A | Tap approximately at the start of a known distance. Create A and arm it. | “Tap to place the start point.” |
| Position A | Drag elsewhere to position A. On release, disarm and advance to Place B. | “Drag elsewhere to adjust A”; **Point is correct** advances without a drag. |
| Place B | Tap approximately at the other end. Create B and arm it. | “Tap to place the end point.” |
| Position B | Drag elsewhere; line A–B updates live. On release, disarm and show distance review. | **Point is correct** also advances. |
| Distance review | A/B remain visible and selectable; tapping A or B in the rail arms that endpoint for further correction. | **Known distance** input, visible unit selector, **Use this calibration**, **Save & add another**. |

Opening the distance panel should not automatically summon the keyboard while the user is inspecting endpoints. Focus the numeric input when the user taps it. Keep A/B controls accessible or collapse the form on **Adjust A / Adjust B** and preserve typed input.

On the first calibration, “Use this calibration” validates and durably saves one accepted reference, then advances to Outline. “Save & add another” durably saves the accepted set, then opens another two-point draft until three are accepted. The third reference offers finish, not a fourth. Do not label an in-memory-only addition “saved”. On an existing calibration edit, final saving uses the same transactional rules; saving one edited reference cannot accidentally drop other accepted references.

Cancelling an unaccepted second/third reference preserves references already saved. Cancelling an edit to a previously saved set restores the base unless the user explicitly completed a save checkpoint. Distinguish **Cancel this reference**, **Finish with saved references**, and destructive **Remove saved reference** rather than using ambiguous “Skip” actions.

### 7.3 AI proposals use the same A/B editor

Preserve the established up-to-three candidate review: all proposal segments visible with clear `1 / 2 / 3` labels; the active one prominent and the others subdued. Candidate switching is via large numbered buttons. Numbers remain stable during human editing; do not reorder the list because a corrected span became shorter.

For the active proposal offer:

- **Accept & start outline** — one valid reference is sufficient.
- **Accept & check another** — keep the current accepted draft and review another.
- **Adjust points** — expose A/B selection and the precision editor.
- **Skip this reference** — does not add it to calibration.

Distance/unit correction is always available. Retain **Find different measurements** only under the existing deliberate rescan rules; manual editing is not a rescan. “Finish with 1 reference” or equivalent must remain visible after accepting one, even if two proposals remain unreviewed. Do not make the user skip every unused candidate to finish.

The user can repair one, two or all three proposals; accept the shortest only; mix one untouched candidate with a repaired candidate; or discard AI and create manual references. One combined accepted set has a maximum of three — not three AI plus three manual. After successful persistence, transition to Outline only on the finish action.

### 7.4 Separate raw AI evidence from edited geometry

Do not mutate the original server proposal in place. Add an endpoint-override layer or equivalent draft structure:

```ts
// Proposed local override contract, not an existing API response.
type CalibrationEndpointOverride = Readonly<{
  candidateId: string;
  sceneP1: Readonly<{ x: number; y: number }>;
  sceneP2: Readonly<{ x: number; y: number }>;
  localRevision: number;
  associationConfirmed: boolean;
  replacesPhysicalReference: boolean;
}>;
```

Acceptance reads **effective edited endpoints**, not the old candidate's cached pixel length. Recompute the pixel span from those endpoints. Extend the real reducer/controller with equivalent commands for starting endpoint edit, previewing, committing, cancelling and reconfirming; do not manage overrides only inside a React panel while the reducer still accepts stale coordinates.

Rules after any accepted endpoint, distance or unit changes:

1. Mark that reference **needs reconfirmation** and remove its old contribution from the draft effective scale. The saved working calibration remains unchanged until a successful commit.
2. Preserve the typed number as a draft, but visibly ask the user to verify that it still belongs to the edited span. Disable acceptance until the endpoints and known distance/unit are reconfirmed.
3. If the user moves the pair to a completely different printed dimension, provide **Use as a different/manual reference**. Generate a new physical-reference identity or clear the detector reference link according to the current domain; do not pretend the old label/evidence verifies a new span.
4. Original evidence crops become **Original AI suggestion**, not proof of the edited points. Hide stale crops by default during repair. A new local crop/loupe must be generated from the current source/transform, not reused from the old endpoints.
5. Preserve provenance: manual, AI confirmed unchanged, or AI suggested and human adjusted. Map to the current codec explicitly; introduce a versioned/additive compatible field only if needed. Do not add an enum value that the existing decoder rejects.
6. An in-flight AI result cannot overwrite local repairs. Gate by page/image/session context and local draft revision. Present any genuinely new proposals as proposals, not replacements for human work.

A geometry edit is human input, so it does not have to remain within the detector's small refinement radius. However, the final span must still be in bounds, nondegenerate and tied to a real known distance the user confirms. Human repositioning must not bypass safeguards for an image that cannot support a single consistent scale.

### 7.5 The exact scale calculation

Reuse the existing `computeEffectiveCalibration` service. For accepted references `i = 1..n`:

```text
P_i = hypot(B_i.x - A_i.x, B_i.y - A_i.y)
D_i = confirmed length converted into the working unit
S_i = D_i / P_i
S   = sum(S_i) / n                   with 1 <= n <= 3
line length = scene length * S
plan area   = scene polygon area * S²
```

Only reconfirmed references contribute. Accepted means both endpoints and the associated distance/unit have been reviewed. Unreviewed, skipped, invalid, superseded or edited-but-not-reconfirmed entries contribute nothing.

Reject zero/non-finite lengths, missing units, non-finite/out-of-image points and exact/reversed duplicates of the same reference. Do not automatically merge distinct parallel/nested dimensions because their spans overlap. Warn on short references rather than forbidding a shorter but accurate accepted reference.

Keep the existing scale disagreement calculation and threshold unless the current repo has a deliberate replacement. The inspected implementation uses `100*(max(S_i)-min(S_i))/mean(S_i)` and warns above 10%. Show which references disagree and offer **Review references** or **Use this average anyway** with acknowledgement. Do not silently delete an outlier or switch to longest-only scaling.

### 7.6 Recalibration after measurements exist

Recalibration changes the page's effective scale and every dependent materialised length/area. It is not a purely visual endpoint edit. Use the current hardened recomputation + atomic commit path (§11), including calibration-only pages with zero measurements.

Do not recompute only what is visible or selected. Include the page's saved outlines, relevant independent components and explicitly derived area-dependent entries, preserving their business semantics. If the required geometry/provenance is missing, report the affected entries instead of inventing replacements. Other pages keep their own calibration.

---

<a id="s8"></a>
## 8. Roof outline creation and correction

### 8.1 Manual creation

After calibration, provide **Draw outline manually** and, when available, **Scan outline with AI**. Both enter the same editable geometry model.

Manual creation is an open path:

1. Tap to create the first approximate point; it becomes armed.
2. Drag elsewhere, release to set it, or use **Point is correct** to accept its initial location.
3. Return to **Place next point**. A new blank-canvas tap adds the next corner and arms it. Repeat.
4. **Close outline** becomes available once at least three distinct points exist. This button joins the last point to the first; no precise tap on the first point and no double-tap is required.
5. Review the closed outline with the four-button controller. **Use outline** opens/confirms the existing required name/area/pitch fields and saves through the domain adapter.

The point-setting button permits rapid approximate placement without compulsory dragging. The four-button controller can select earlier points while drawing. Returning from an earlier-point correction resumes the previous creation intent; it must not accidentally close the path.

Use a transient next-edge preview where useful, but do not store an extra ghost point or compute final area from an open path. **Close outline** changes topology; **Use outline** accepts and saves. They are separate actions with separate labels.

### 8.2 AI outline import

Reuse the existing detector; improving its localisation is not a prerequisite. For M0–M7 the desired AI operation is **outline only**, followed by user review, not automatic full component takeoff.

In the snapshot, `handleAiScan` runs scan1 then immediately proceeds to scans2/3. Extract/reuse an outline request service and stop before `runRemainingAiScans` for this mobile action. Apply the returned polygons to an **edit draft**, not directly to persisted components or roof-area rows.

Do not silently change billing. Inspect the current route: the snapshot charges scan1 according to the existing quality policy. The agent must either expose the supported outline-only intent at its approved price or visibly use the existing approved charge for this action. It must not claim a cheaper/free scan because later stages were omitted, nor bypass authorisation by calling a stage endpoint directly. Any pricing change is an explicit product/backend change, separate from the editor.

Acceptable flow:

```text
User chooses Scan outline with AI and sees the actual cost
    -> existing authorised outline detection
    -> transform output once into this page's scene frame
    -> create one or more unsaved outline drafts
    -> show outline and all vertices
    -> Use outline OR Adjust points
    -> save only explicitly accepted geometry
```

An AI failure leaves **Draw manually** available. Cancelling the request must not clear saved or locally edited geometry. Unusable AI points can be exposed as an invalid editable draft when the coordinate context is trustworthy; block acceptance until valid. Do not fabricate missing points, auto-convex-hull a concave roof, or accept unknown coordinate frames.

### 8.3 Editing behaviour

Selecting a vertex highlights it and its previous/next edges. Moving it updates **that vertex and those incident edges**, not the whole polygon and not another roof. The plan-area preview recomputes from the current draft when valid. Other saved quantities do not become authoritative until a successful save.

The `+ / −` controller in §6 is the primary insertion/deletion path. A tap-edge **Insert here** command may be added later; the initial release must not depend on precise edge targeting. Disable free-object scaling/rotation/group translation in this editor unless a separate, explicitly designed tool is active.

Manual and AI-created polygons use identical edit and validation commands. **Reset to AI suggestion** may be provided as an undoable reset of the current draft, never as an automatic replacement of human edits.

### 8.4 Geometry validity and multiple outlines

Minimum valid outline: a closed, simple polygon with at least three distinct vertices and nonzero area. Triangles and concave roofs are valid. Reject non-finite coordinates, zero-length edges, duplicate nonadjacent vertices, self-intersections and overlapping edges that invalidate the boundary. Permit an intentional collinear midpoint pending adjustment.

During a drag, render an invalid preview with specific feedback, not a valid-looking area. On release it can remain in the **unsaved draft** for repair, with acceptance disabled. Undo and Cancel always remain available. This avoids trapping a user who needs to move several AI vertices to fix a crossing. Hard image-bound violations from user movement should be visibly clamped to the image boundary; do not allow an invisible off-image point to be accepted. Raw AI out-of-bounds output is flagged, not silently clamped and labelled correct.

Do not simplify away user-created points automatically. A later simplification tool must be explicit and reversible. Preserve winding and the first-vertex identity through ordinary edits.

When AI returns several roofs, show named draft choices and accept them individually or through an explicit reviewed set. Do not merge disconnected roofs or turn them into one polygon. Existing hole/cutout representations must be preserved on load; if a complex representation is not yet safely editable in touch V1, show it read-only with a clear desktop path rather than flattening it into an incorrect single boundary.

### 8.5 Saved-outline editing and business dependencies

**Edit outline** clones the target polygon into a draft and retains its existing measurement ID, `fromPageId`, `quoteRoofAreaId`, name, pitch and other business metadata. Do not recreate it as a new area on save. A newly created outline uses the existing create-area flow once, after confirmation; do not create orphan rows just to display an AI preview.

On save of a modified outline:

- Recompute raw plan area from the edited points and this page's effective scale.
- Preserve pitch and let the established calculation pipeline apply it exactly once. Do not infer pitch from a satellite footprint or silently treat unknown pitch as known zero.
- Update entries explicitly linked to this polygon (for example `source_geometry_id`/stored area-source provenance) through the existing dependency rules.
- Do not update manually entered unrelated quantities or move independent component endpoints merely because they are close to a moved vertex.
- Invalidate cached AI classifications/edge associations whose source geometry changed. Do not automatically spend credits to regenerate them.
- Persist the changed polygon and dependent values atomically, with a stale-session check. Failure retains the prior saved version and recoverable draft.

A polygon geometry edit at constant calibration scale is **not** the same as recalibration. A function that only multiplies existing values by a scale ratio will miss the changed polygon area. Reuse a recompute helper only after tests show it derives the relevant values from the new primitive points at the current scale.

### 8.6 Area meaning and image limitations

Label the unpitched measurement **Plan area** where confusion is possible, and retain the app's existing roof/pitch conversion flow. A top-down outline alone is not a complete roof-surface-area model. For multi-pitch work, preserve the project's existing multi-area/facet workflow; this plan introduces no new pitch mathematics.

Touch precision cannot make a blurry boundary unambiguous or remove perspective distortion. Use a known span on the same image/view. Where perspective or inconsistent image scaling prevents a reliable global calibration, explain the limitation and request a suitable plan/top-down image rather than presenting false accuracy. This specification does not provide photogrammetric rectification or certification of satellite-image accuracy.


---

<a id="s9"></a>
## 9. Components: separate follow-on phase, same precision primitive

M8 implements the user's next journey without changing the earlier gesture model:

```text
Choose the owning roof/area and an existing linear component
    -> place A, precision-adjust, set
    -> place B, precision-adjust, set
    -> review the computed length
    -> save component measurement
```

Use A/B controls, not polygon insert/delete, for a two-point component. Reuse the same undo, remote drag, view gestures and point-nudge functionality. Reopening a saved component edits its existing measurement rather than adding a duplicate. A multi-segment component can later use an open-path adapter with explicit append and the same ordering rules.

Resolve component ID, measurement type, owning roof area and page before drawing. Preserve the real repository's required extra inputs and derived formulas. Ridge, hip, valley, eave and barge labels do not make every component a simple line: length×height, volume, count and freestyle types exist in the supplied source. Do not route those through a two-point length-only save accidentally.

Initial component release can support only the types the agent explicitly maps and tests. Unsupported types retain a clear desktop route. Save the completed calibration/outline before a deliberate workspace switch needed for those features; do not imply the earlier work is lost or redo it.

Do not introduce automatic shared-node propagation between components and the roof. Any future attached endpoint must have an explicit anchor/dependency contract and migration. Until then, snapping aligns coordinates only.

---

<a id="s10"></a>
## 10. Coordinate, source-image and rendering contract

### 10.1 Keep four spaces distinct

| Space | Meaning | May change on phone rotation? |
|---|---|---|
| Immutable source | Authoritatively oriented uploaded image / selected rendered PDF page | No |
| Takeoff scene | Existing page measurement frame (`takeoff-scene-v1`), with stable source-to-scene transform | No |
| Canvas viewport | Visible logical drawing surface and camera pan/zoom | Yes |
| CSS client / device backing pixels | Browser pointer coordinates / raster resolution | Yes; neither is a measurement unit |

A PDF document can contain differently scaled pages or views. Calibration is per selected page/image view, not inherited from page 1. A refreshed signed URL does not create a new image revision; an actual source replacement does.

**Mandatory decoupling:** rename/split variables where necessary into `sceneDescriptor`, `viewportSize` and `camera`. The AI `canvasDimensions` payload, if its existing meaning is scene dimensions, must continue using scene dimensions. Do not substitute the physical canvas element size after adapting it to the mobile viewport.

Mobile layout should make the drawing viewport match the available screen area without using a giant scrollable 2000px-wide DOM canvas. The background is still placed using the stable source-to-scene transform. How Fabric's backing canvas is sized is a renderer detail; stored geometry must not be resized to match it.

### 10.2 One transform owner

Maintain explicit `sceneToViewport`, `viewportToClient` and their composition/inverse. `viewportToClient` includes the canvas bounding rectangle and any actual CSS scaling. Avoid nonuniform CSS stretching; handle it explicitly in tests if legacy desktop CSS still permits it.

Reuse `applyAffine`, `composeAffine` and `invertAffine` where appropriate. Map raw input through the measured interaction surface rect. A DOM overlay is not necessarily located at `(0,0)` in the window. Fabric-specific adapters may use `getScenePoint` for event-to-scene conversion, but remote dragging still needs a correct **delta** conversion. [B8]

Device pixel ratio affects render backing resolution, not scene coordinates. Do not multiply a CSS pointer delta by DPR and then divide by zoom. Do not divide by zoom twice after using an API that already returned scene coordinates.

Freeze the mapping at gesture start; if its viewport/layout changes, cancel that gesture before adopting a new mapping. Pinch owns camera updates and never overlaps a point-move gesture. Preserve floating-point coordinates through save; round only human-readable numeric displays.

### 10.3 Camera policy

Initial entry and explicit **Fit plan** use fit-to-unobstructed-viewport. Pinch/manual zoom transfers ownership to the user. Opening a temporary panel should not refit the plan or jump away from the point being inspected.

On orientation/layout switch, preserve the selected point's visibility where possible and the scene point under the prior viewport centre. Clamp zoom to the current usable range without changing points. Reposition the camera, not the geometry. During Auto-fit mode a recalculated fit is permissible; during user-controlled zoom preserve zoom unless impossible to operate.

Suggested zoom bounds are view-dependent: minimum sufficient to see the whole plan, maximum allowing inspection of the available source detail. Do not cap effective inspection merely because the original desktop button used a hardcoded limit. More magnification is not a claim of more source information.

### 10.4 Image and PDF quality

Keep the existing PDF picker and image normalisation pipeline. Load/render only selected pages at practical resolutions and release temporary bitmaps. If progressive higher-resolution rendering is added, it must preserve the same logical page frame with an explicit transform; re-rendering cannot silently invalidate all accepted coordinates.

Keep source details available for inspection when feasible rather than repeatedly encoding the canvas screenshot with overlays. AI requests must use the clean source/image pipeline, not a panned, zoomed, cropped mobile screenshot or a canvas containing markers. Do not request OCR/CV calls on every user adjustment.

When the source is too blurry to identify a corner, say so through existing quality guidance. A magnifier may help see available pixels but must not imply the app knows a boundary that is not visible. A loupe is optional after the remote-drag experience is tested; it is not required for M0–M7.

### 10.5 Rendering and performance

Keep gesture preview updates in a dedicated RAF-driven renderer/state channel. At most one visual update per animation frame; commit domain history on release. Do not deep-clone the entire quote or persist on every pointermove.

Prefer updating the active draft's overlay and incident edges. On release, rebuild/redraw the relevant saved/draft objects from canonical scene points using the established reconstruction path. If updating a Fabric `Polygon` in place, correctly update its bounds/path offset/coordinate state for the installed version. Never recover authoritative geometry by reading the visual object's transformed `left/top/scale` and assuming they equal scene points.

Markers, labels and hit radii are screen-sized. Selected-point overlays must use the same transform as the image and polygon. No stale evidence crop, CSS-positioned marker or retained Fabric control should lag behind a camera change.

Initial profiling fixtures: 4-, 40- and 200-point outlines, multiple visible areas, and a representative PDF-derived image on a mid-range physical phone. Proposed target: p95 input-to-visible-preview no worse than 50 ms, with no sustained interaction stalls. Record hardware, image dimensions and method; this is a target to measure, not a promise. Memory/object counts should return near baseline after repeated edit/cancel/page-switch cycles. Do not sacrifice correctness to a nominal frame-rate number.

---

<a id="s11"></a>
## 11. Save, undo, lifecycle and safety

### 11.1 Three layers of state and the meaning of “set”

1. **Saved base:** last acknowledged server state for the page/target.
2. **Edit draft:** local accepted point moves/topology/number changes, with local undo.
3. **Gesture preview:** disposable motion since the current press started.

Release moves layer 3 into layer 2. **Use this calibration**, **Save & add another**, **Use outline**, or **Save changes** validates and persists an appropriate layer-2 checkpoint through the existing service. Only an acknowledged save updates layer 1. Selection and camera changes update none of the measurement values.

If the existing app's outer **Save takeoff** performs an additional navigation/quote finalisation, reuse it without resubmitting already acknowledged geometry as new rows. The UI must distinguish **Draft**, **Saving**, **Saved**, and **Save failed**. Never use “saved” for a local-only draft.

### 11.2 Local history

Within an edit session, one completed point move is one undoable operation. Tap-create, midpoint-insert, delete, close/reopen and explicit reset are separate logical operations. Selection, pan/zoom, cancelled motion and typing focus changes are not geometry history entries.

Use the existing plain-data history approach or a small adapter around it. The snapshot must preserve target identity, page/area ownership, draft vertex IDs, geometry, calibration confirmation status, required component inputs and dependency provenance. Do not serialize Fabric objects. Do not lose metadata because one legacy `RoofArea`/snapshot interface is narrower than the live record.

A new edit after undo clears redo. Cancelling an edit restores the saved base regardless of local undo position. While an edit is open, local Undo takes precedence over quote-level undo. Do not accidentally undo a different page or a previous saved calibration. After a successful save, establish a new base; any app-level undo of persisted operations must itself follow the authorised save/recompute path.

Suggested draft history capacity: 100 logical operations, with a bounded memory policy. This is enough to repair a forty-point outline without a few gestures exhausting the history. Preserve current global-history behaviour unless deliberately migrated.

### 11.3 Atomic persistence and dependencies

Treat a saved calibration change as one transaction covering calibration primitives/metadata, effective scale caches, recomputed values, required roof-area totals and relevant provenance. Treat a saved outline change as one transaction covering polygon points, plan area and explicitly dependent materialised entries.

The live agent must verify the current RPC/action boundary. The supplied archive's `save_takeoff_atomic` followed by a separate calibration update is **not** proof that recalibration is atomic. If still present, close that gap before releasing saves from the mobile editor. Do not implement “client rollback” and claim the database rolled back too.

Server-side requirements:

- Recheck authenticated quote/company/page/area ownership, permissions and normal takeoff entitlement.
- Validate finite/bounded geometry, allowed point counts, units and positive distance. Do not trust client-computed area, scale or AI provenance as authority.
- Check source image revision and expected session version/concurrency token.
- Recompute/cache through the established canonical units and pitch/quantity rules; avoid double conversion to metric or applying pitch twice.
- Update existing record IDs for edits; create a new record once for a new outline/reference set.
- Retain compatible calibration codec decoding and page hydration. Additional human-edit provenance needs an explicit, tested compatible codec change if the current shape cannot store it.

Do not add a new persistence route merely for touch presentation. Extend/reuse the real shared command/service. If a migration is unavoidable, include upgrade/rollback strategy and tests against older saved documents. The agent chooses the actual table/field names from the current repository.

### 11.4 Conflicts, failures and retries

Save is asynchronous. Disable duplicate save triggers, await the result and transition to “Saved” only on success. Keep the recoverable draft on failure. A retry of an uncertain network outcome must be idempotent or reconcile the server's operation/version before resubmitting; it must not create a second roof area.

Capture `{quote, page, imageRevision, contextEpoch, baseVersion, localGeometryRevision}` at each asynchronous operation boundary. A stale AI response cannot replace newer local geometry. A stale save response cannot redraw the now-active different page. A version conflict offers reload/review while retaining the user's unsaved draft; it is not an invitation to force-overwrite another device's work.

AI cancellation is not proof the provider stopped or points were refunded. Reuse the current request ledger and server accounting. Local edit operations never use that billing path. AI access revoked/credits exhausted must not prevent editing already-present geometry through manual controls.

### 11.5 Page, layout and app lifecycle

| Event | Required behaviour |
|---|---|
| Desktop ↔ Touch switch | Cancel only the live gesture; preserve the complete draft, IDs, active tool and saved data. Same scene frame. Do not reload/remount the workstation. |
| Phone rotation / keyboard resize | Cancel live gesture if mapping changes; preserve draft, form values and selection; update view only. |
| Change page / change quote / replace source image | Resolve dirty draft first (save/discard/stay), abort/invalidate requests, clear active gesture/selection and load the correct page state. Never inherit another image's calibration. |
| Switch roof area on same page | Resolve current outline draft; retain page calibration; select the requested target by its real ownership ID. |
| Background / visibility loss / OS gesture cancellation | Cancel live motion. Keep the draft in memory where possible. Do not auto-save a half-gesture. |
| Reload / tab termination | Restore saved server data. Do not promise draft recovery unless it is actually implemented and tested. |
| Browser Back / exit takeoff | Show a meaningful dirty-state guard for in-app navigation. Treat lifecycle prompts as best effort, not the only data-safety mechanism. |
| Loss of network | Show Unsaved/Offline; retain current in-memory draft and allow safe local adjustments. No false save success or hidden AI retries. |

PWA installation does not itself provide offline editing/synchronisation. Offline-first persistence, IndexedDB draft recovery and conflict merging are deferred unless the app already supports them. Any optional local recovery must be scoped to account/quote/page/image/version, private, bounded, cleared appropriately on logout and never treated as a server save.

### 11.6 Safety, privacy and access boundaries

The workspace-mode preference is not authorisation. Client AI flags are not authorisation. Keep existing server permissions, storage restrictions, upload validation and abuse limits. No API key or service-role credential enters client code.

Treat returned AI text as untrusted display content; use ordinary text rendering. Do not log signed image URLs, drawings, raw provider payloads or customer data in general analytics. Measure interaction counts/timing with minimal non-content metadata. Bound server point counts to prevent pathological geometry payloads; do not silently truncate legitimate roofs at forty points just because that was an example.

Keep the existing E2E origin guard, serial mutation settings, test-account restrictions and run manifests. This plan never authorises production test mutations or unapproved paid AI usage.

---

<a id="s12"></a>
## 12. Proposed modules and file-level integration tasks

**All new names in this table are proposed.** The agent may consolidate them or use existing equivalents. Keep pure geometry/gesture logic independent of React, Fabric, Supabase and provider SDKs so it can be tested rapidly.

| Proposed location | Responsibility |
|---|---|
| `app/lib/takeoff/precisionEditorTypes.ts` | Draft target/context/vertex/selection contracts, importing existing point/affine types. |
| `app/lib/takeoff/precisionEditorReducer.ts` | Select, append, move commit, insert, delete, close, undo/redo and cancellation semantics. |
| `app/lib/takeoff/precisionGeometry.ts` | Topology changes, midpoint, validation and stable-ID helpers; reuse existing geometry predicates when correct. |
| `app/lib/takeoff/precisionGestureMachine.ts` | Pure pointer-sequence arbitration and actions; no direct DOM writes or API requests. |
| `app/lib/takeoff/viewportTransforms.ts` | Explicit CSS/viewport/scene transforms and camera calculations, reusing calibration affine functions. |
| `TAKEOFF/precision/usePrecisionInput.ts` | DOM pointer map, capture, RAF scheduling, lifecycle cleanup and dispatch to the pure machine. |
| `TAKEOFF/precision/precisionOverlay.ts` | Draft geometry, selected-point/edge rendering and screen-space markers. |
| `TAKEOFF/mobile/useTakeoffViewMode.ts` | Auto/Desktop/Touch preference, capability detection and per-device persistence. |
| `TAKEOFF/mobile/MobileTakeoffShell.tsx` | Landscape/portrait chrome, right rail, contextual sheets and accessible workspace menu. |
| `TAKEOFF/mobile/VertexController.tsx` | The four-button grid, point counter and re-arm action. |
| `TAKEOFF/mobile/EndpointController.tsx` | A/B selection and point-placement progression. |
| `TAKEOFF/mobile/CalibrationSheet.tsx` | Compact distance/unit entry, reference review, repair and finish actions. |
| `TAKEOFF/mobile/OutlineSheet.tsx` | Manual/AI entry, multi-outline selection, validity feedback and acceptance. |
| `TAKEOFF/precision/takeoffEditAdapter.ts` | Explicit create-versus-update commands mapped to current domain/ownership/save services. |
| `TAKEOFF/useOutlineScan.ts` or current equivalent | Existing authorised outline-only request lifecycle and draft import, not a detector rewrite. |

**Modify existing surfaces deliberately:**

`TakeoffPage.tsx` and `TakeoffWorkstation.tsx`: lift mode-independent state; keep the canvas stable; separate scene dimensions from viewport sizing; gate legacy interaction paths; expose shared commands rather than simulate desktop clicks.

Calibration types/session/controller/codec/overlays: add human endpoint overrides, reconfirmation, provenance and corrected primitive acceptance. Reuse request/billing logic without auto-searching on mount of a layout variant.

`actions.ts` and current RPCs: use existing hardened commits; extend only genuine gaps for geometry update-in-place, dependent recomputation and compatible provenance. No public unprotected mobile save endpoint.

`reconstructCanvas.ts`, `reconstructTypes.ts`, history capture: preserve every identity/ownership/input/provenance field during save, reload, undo and layout change. Keep mutable Fabric references out of serialised history.

Workspace layout/context: opt-in immersive takeoff chrome; no broad style or navigation regression. `manifest.ts` does not need global orientation changes.

`PdfPagePicker.tsx`: touch target and sheet sizing only unless a measured raster-memory issue needs a separate change.

Testing: proposed `precision*.test.ts`, dedicated touch-workspace E2E specs and a disposable geometry harness. Any `window.__test...` instrumentation must be test-only and unavailable in production.


---

<a id="s13"></a>
## 13. Gated implementation phases

Implement in reviewable batches. A phase is complete only when its tests and evidence exist, not when the UI looks plausible. Reuse working changes already present in the real repo. An unresolved business-rule or schema conflict is a checkpoint to surface, not permission to guess.

### M0 — Reconcile the current branch and establish a baseline

**Goal:** eliminate source ambiguity and agree the integration boundary before writing new interaction code.

Read current `AGENTS.md`, the relevant installed framework/library documentation, the current takeoff domain/actions and existing agent plans. Record commit SHA, installed/resolved versions, actual source-image coordinate contract, current page/area ownership and save/recompute paths. Map every row in §2 to the live equivalent.

Verify the prior safety findings rather than assuming them fixed: image-specific calibration; actual image revision; current-page hydration including calibration-only pages; awaited and atomic commits; stale result guards; protected billing/idempotency. Inspect the current outline-edit capabilities and any shared command layer the agent already added.

Run baseline lint/build and applicable existing unit/E2E suites under the existing safe test rules. Mark blocked checks honestly. Produce `MOBILE_TAKEOFF_GAP_REVIEW.md` with the source map, no-regression checklist, proposed modules reused/new, schema changes if any, existing scan1 billing behaviour, and supported first-release component/area types.

**Gate:** there is a real owner for scene transforms, edit drafts and persisted commits; no unidentified ghost APIs. Safety gaps on the save path are assigned to M1/M4/M5 before those paths ship. Do not rewrite app-wide database rules based on this document.

**Checkpoint:** `docs(takeoff): reconcile mobile editor plan with current repository`.

### M1 — Shared draft, commands, geometry validation and save boundary

**Goal:** establish testable, UI-independent operations before mobile events start mutating data.

Implement/reuse editor contracts, stable session vertex IDs, local operation history, midpoint insertion, previous/next selection, deletion rules, valid/invalid draft state and create/update distinction. Map target ownership into existing domain records. Separate scene/image metadata from renderer dimensions. Extract the minimal save/recompute adapter and close relevant transactional/metadata gaps discovered in M0.

Implement unit/property tests for operations, transforms, identity preservation and cancellation. Persistence adapter tests can use fakes here, but cannot be reported as proof of actual database atomicity.

**Gate:** insertion is area-preserving; one-vertex movement leaves all others unchanged; triangles/concavity/collinear insertion work; undo restores exact primitives and metadata; scene coordinates survive view changes. No mobile-only measurement formulas.

**Checkpoint:** `feat(takeoff): add shared precision edit commands and scene contract`.

### M2 — Stable touch workspace shell and manual view switching

**Goal:** get the layout and camera right without changing existing measurement behaviour.

Implement Auto/Desktop/Mobile preference, client capability detection, explicit switching, immersive chrome, safe-area landscape/portrait layouts, right rail and contextual sheets. Keep the canvas/state owner stable; remove the desktop widening/sidebars only in touch presentation. Implement camera resizing and optional fullscreen with safe failure. Preserve forms when keyboard appears.

Add E2E/screenshot coverage for entry, manual override, reload preference, rotation, small landscape sizes, PWA-style layout, exit cleanup and existing desktop route. Verify no mode switch triggers AI or writes geometry.

**Gate:** the entire page image and all mandatory controls are reachable; source scene identity is unchanged after repeated mode/viewport switches; a denied fullscreen/orientation request does not block work.

**Checkpoint:** `feat(takeoff): add landscape-first touch workspace shell`.

### M3 — Precision gestures and the four-button vertex controller

**Goal:** prove the general input mechanism before wiring calibration and real quote mutations.

Build the pure gesture machine and the single-owner Pointer Events adapter. Implement relative off-point dragging, selection/armed distinction, two-finger pinch/pan, one-finger pan when disarmed, cancellation, pointer capture cleanup and accessible nudges. Wire previous/next/insert/delete to a disposable geometry harness containing dense 4/40/200-point examples.

Run deterministic pointer-sequence tests plus browser event tests with screenshots/state assertions. Use a physical phone for a brief ergonomic proof if one is available to the agent/test team: select by arrows, drag with the finger away from the dot, release, re-arm, pinch and recover. A failed basic gesture should be corrected here, before integrating all business flows.

**Gate:** no marker jump on press; no spurious point after pinch; no whole-polygon movement; release disarms; insert/delete and Undo work without precise canvas targeting. Any physical-device gap remains explicitly pending, not counted as an emulation pass.

**Checkpoint:** `feat(takeoff): implement remote point drag and compact vertex controls`.

### M4 — Manual calibration and human repair of AI references

**Goal:** complete the calibration step without depending on detector improvements.

Integrate the A/B wizard, manual one-and-done and save/add-up-to-three flow. Add endpoint overrides/reconfirmation to the real AI calibration reducer/controller. Preserve raw AI proposals and annotate human corrections. Accept effective edited endpoints through the shared calculation/codec/save path. Make saved-reference editing and Cancel safe; test recalibration with existing measurements and mixed units.

Use intentionally bad AI fixtures: three wrong pairs, only the shortest useful, correct endpoints with wrong OCR, missing unit, accepted reference edited later, and a repaired pair moved to a different physical dimension. Local repair must produce no AI calls or point charges.

**Gate:** a user can save/reload one manual reference, three manual references and mixed corrected AI/manual references; average scale and all recomputed dependencies match independent expectations. Failed saves/empty-page hydration/page switching are covered. Manual works with AI disabled.

**Checkpoint:** `feat(takeoff): support touch calibration and editable AI endpoints`.

### M5 — Manual outlines and update-in-place editing of saved outlines

**Goal:** make the initial mobile product useful end to end without any AI.

Integrate open-path placement and explicit closure, the four-button controller, validation, required name/pitch/ownership fields, save/reopen and update-in-place. Preserve the existing create-new/add-to-existing area rules. Handle multi-area selection. Recompute explicitly linked quantities from edited geometry, not only scale changes.

Test dense/concave roofs, an inserted midpoint, a removed erroneous point, crossing drafts, missing pitch inputs, ownership on parent/child pages, dependent quantities and transactional failure. Verify history/renderer round trips do not drop identity/provenance.

**Gate:** PDF/image → one manual calibration → manual outline → save → reopen/edit → save works on touch presentation; an unchanged desktop fixture produces identical scale and quantities. No AI request occurs anywhere in this manual journey.

**Checkpoint:** `feat(takeoff): add editable mobile roof outlines with safe persistence`.

### M6 — Existing AI outline scan as an editable draft source

**Goal:** let AI accelerate the working manual flow, never replace it.

Extract the actual outline-only orchestration from the current V3 pipeline while preserving authorisation and agreed billing. Import correct scene-frame polygons into the same editor. Allow direct acceptance, correction, insert/delete, multiple-roof review and fallback to manual. Prevent automatic internal-component persistence in the outline-only path and ignore late/stale scan results.

Run mocked provider/API integration tests first. With authorised funded test access, run a small real integration smoke to verify the real response contract and coordinate mapping. This is not a new detector-quality benchmark and must not be reported as proving that every outline is accurate.

**Gate:** a deliberately inaccurate AI outline can be repaired and saved exactly like a manual one; switching page/cancelling/searching again cannot overwrite edits; actual displayed cost matches backend policy. Any live-provider test not run is disclosed. Manual release remains possible with the unvalidated AI entry feature-flagged off.

**Checkpoint:** `feat(takeoff): import AI outline proposals into shared touch editor`.

### M7 — Regression, device verification and release-candidate handoff

**Goal:** remove machine-testable failures before the owner spends time on usability acceptance.

Run §14's integration/failure suite, browser projects, dependency/security checks appropriate to changed code, production build and test-only instrumentation checks. Profile the real editing surface, resize/keyboard behaviour, object/listener leaks, save conflicts and entitlement-off journeys. Apply route/feature flags for rollout and preserve a working Desktop escape path.

Execute the hardware matrix in §15 using real devices available to the agent/test team; list anything unavailable. Produce a release-candidate report with commit, applied migrations, test commands/results, screenshots/traces, measured performance, residual risks and the short owner checklist. Do not mark all touch testing done from a desktop iPhone emulation descriptor.

**Gate:** all mandatory automated tests pass or have an explicit release-blocking status. Physical/ergonomic checks have an identified tester; data-loss/incorrect-measurement defects are not handed to the owner as routine UX testing.

**Checkpoint:** `test(takeoff): harden touch editing and prepare mobile release candidate`.

### M8 — Mobile linear components (follow-on)

**Goal:** extend the same A/B primitive to tested component types, without delaying the first release.

Map actual component categories and measurement semantics. Implement selection, two-point creation/edit, required extra inputs, ownership, save/reopen and independent-versus-derived dependency handling. Add component-specific E2E and deterministic length/conversion tests. Unsupported types retain a clear desktop path.

**Gate:** line measurements are identical in Desktop and Touch; point/area/volume or required-height types cannot accidentally take a line-only route; editing one component does not move unrelated roof geometry.

**Checkpoint:** `feat(takeoff): extend precision touch editor to linear components`.

---

<a id="s14"></a>
## 14. Automated acceptance suite

### 14.1 Evidence policy and test layers

Use deterministic pure tests for geometry/gesture state, component/controller tests for workflow, mocked API browser tests for full interaction, and real test-database integration for atomicity/ownership. Paid model calls are unnecessary for testing point correction, selection, scaling, undo and layout.

Playwright device emulation supports viewport/touch settings; it is not physical-phone certification. [B11] In the supplied configuration, the mobile project uses an iPhone descriptor without selecting WebKit. Extend browser projects deliberately: an iPhone-sized Chromium run is not an iOS Safari run. WebKit engine automation is useful too, but still does not reproduce every iOS keyboard/OS gesture.

Use a pure event-trace fixture runner for multi-pointer sequences. Synthetic `dispatchEvent(new PointerEvent(...))` tests prove application event handling, not all trusted browser behaviour. Where available, add browser-level multi-touch injection (for example approved Chromium protocol tooling) and retain separate physical pinch/cancellation checks.

Every failing test must report context, operation, before/after primitives and expected invariant. Screenshots alone do not prove correct coordinates; unit assertions alone do not prove the user sees the correct marker. Combine both.

### 14.2 Deterministic geometry and transforms

| ID | Required test / expected outcome |
|---|---|
| G01 | Closed previous/next wraps correctly; open-path ends do not wrap; no-selection behaviour deterministic. |
| G02 | Insert after any vertex, including the last closed vertex, uses the correct midpoint and stable new ID. |
| G03 | Midpoint insertion leaves area and perimeter unchanged within declared numeric tolerance; collinear midpoint remains editable. |
| G04 | Move one vertex: every other vertex is bit-for-bit unchanged; only the incident edges change. |
| G05 | Delete preserves remaining order; reconnects neighbours; closed three-point minimum enforced. |
| G06 | Open draft can be reduced to zero; Close is disabled until at least three distinct valid points exist. |
| G07 | Triangles, concavity, winding reversal and non-axis-aligned roofs handled correctly; no convex-hull substitution. |
| G08 | Crossings, zero-area polygons, adjacent duplicate points, nonadjacent duplicate vertices, NaN/Infinity and invalid bounds block acceptance. |
| G09 | Open/close representation has no duplicate closing vertex; serialisation preserves exact scene coordinates. |
| G10 | Screen↔scene round trips under pan, zoom, CSS offsets/scaling and DPR 1/2/3 remain within 1e-6 scene px for representative finite transforms. |
| G11 | Remote drag does not jump; 40 CSS px at zoom 0.5 moves 80 scene px, at zoom 2 moves 20; changing DPR alone changes neither result. |
| G12 | Transform translation is not applied to movement deltas; negative pan and nonzero canvas origin included. |
| G13 | Pinch keeps its scene anchor at the new midpoint, including zoom clamps; two-finger pan leaves every geometry point unchanged. |
| G14 | Repeated viewport/orientation/keyboard changes leave stored endpoints, polygons and effective scale identical. |
| G15 | Undo/redo for create, move, insert, delete, close and reset restores IDs/ownership/provenance exactly; new edit clears redo. |
| G16 | A drag adds one history operation, not hundreds; cancelled gestures and camera changes add none. |
| G17 | Page-specific state/history and renderer reconstruction never leak geometry/scale between pages or roof areas. |
| G18 | Seeded/randomised operation traces preserve invariants; persist seed and shrinking/minimal failing trace when a property test fails. |

### 14.3 Gesture arbitration and UI controls

| ID | Required test / expected outcome |
|---|---|
| T01 | Tap creates once on release, arms once; a later synthetic click does not create a second point. |
| T02 | Select via right arrow or A/B, press far from marker, drag, release: exact relative movement and disarmed final state. |
| T03 | Blank tap while armed creates nothing and moves nothing. **Point is correct** advances the wizard without a drag. |
| T04 | After release, blank one-finger drag pans rather than moving the disarmed point; Adjust re-arms the same ID. |
| T05 | Second pointer during pending tap: no point is added. Second pointer during move: full uncommitted move is rolled back. |
| T06 | One finger remaining after pinch cannot place/move a point; input resumes only after all contacts end. |
| T07 | Third touch, pointercancel, unexpected lost capture, blur and rotation produce the documented safe state. |
| T08 | Normal capture loss following committed pointer-up does not roll back the completed move. |
| T09 | Toolbar/form touches do not propagate to the canvas; a Delete press cannot execute mid-drag. |
| T10 | Dense overlapping marker targets remain navigable via the grid; selected outline only participates in hit testing. |
| T11 | Rapid next/previous taps do not skip unpredictably or use a stale index after insert/delete. |
| T12 | Selected offscreen point is revealed without zoom reset or geometry movement. |
| T13 | User can repair points using only selection and nudge buttons; no drag or multi-touch required for essential operations. |
| T14 | Numerical/text input keeps keyboard arrows/selection; global editor shortcuts never intercept input editing. |
| T15 | Only one adapter owns mutations: desktop Fabric handlers do not fire when touch surface owns the interaction. |
| T16 | Repeated view switches/unmounts leave no captured pointers, orphan listeners, stale overlays or active timers. |

### 14.4 Calibration workflows and numerical truth

| ID | Required test / expected outcome |
|---|---|
| C01 | A→adjust→B→adjust→distance/unit→Use saves one reference and proceeds to Outline. |
| C02 | Save & add another stores up to three, no fourth. Cancel the next unsaved pair preserves saved references. |
| C03 | Mixed unit references yield the unit-normalised arithmetic mean of ratios, not ratio of totals or longest-only. |
| C04 | One short accepted reference can finish while two longer candidates remain unreviewed/skipped. |
| C05 | Three wrong AI proposals: repair candidate 2 and accept only it; saved endpoints are exactly the edited points. No new provider call/charge. |
| C06 | Repair two of three and retain one untouched; only the explicitly accepted, reconfirmed set contributes. |
| C07 | Correct endpoints/wrong number, correct number/missing unit, and both unknown all have a usable manual override. |
| C08 | Editing an accepted pair excludes its old contribution until reconfirmed; effective length caches use new endpoints. |
| C09 | Reusing an AI pair for a different physical dimension requires new association confirmation and does not display stale evidence as current. |
| C10 | Switching proposals preserves each endpoint/value draft; stable candidate numbering does not jump after a repair. |
| C11 | Duplicating/reversing the same accepted pair cannot double-count it; distinct nested references remain possible. |
| C12 | Reference disagreement uses the shared range formula; acknowledgement/review actions work; no hidden outlier removal. |
| C13 | Recalibration with saved measurements recomputes all page-dependent values and no other page's values. |
| C14 | Empty-measurement page saves/hydrates calibration; reload does not return it to uncalibrated state. |
| C15 | Failed/calibration-conflict save preserves old saved metadata/values and recoverable draft; no false success. |
| C16 | Auto/Desktop/Touch switch while reviewing or editing preserves all drafts and does not remount an auto-search controller. |

### 14.5 Outlines, integration and failure injection

| ID | Required test / expected outcome |
|---|---|
| O01 | Manual-only PDF/image→calibration→4-point outline→save/reopen journey succeeds with AI disabled. |
| O02 | 40-point concave outline can be corrected using only the grid and remote drag; edges, counter and plan area match primitives. |
| O03 | Close outline uses explicit button; no double-tap or first-point precision hit required. |
| O04 | AI outline fixture can be accepted unchanged or edited through the identical draft/save path. |
| O05 | Edit an existing outline updates the same target ID and retains page/area/name/pitch metadata; no duplicate area row. |
| O06 | Deletion creates an invalid draft: error visible, area not presented as valid, Save disabled, Undo repairs it. |
| O07 | Changing outline geometry at constant scale recomputes source-linked quantities correctly; independent lines/typed quantities remain unchanged. |
| O08 | Area/pitch/storage-unit conversion occurs once; compare Desktop and Touch for metric and imperial examples. |
| O09 | Multiple roofs/pages preserve ownership; unsupported holes/facets are not flattened or overwritten. |
| O10 | Outline-only scan does not silently apply internal components or auto-run the remaining stages; actual point cost matches UI. |
| O11 | Delayed scan after manual edits, page switch, image replacement or cancellation is discarded or explicitly offered, never silently applied. |
| O12 | Save response lost after server commit: retry/reconciliation does not duplicate rows. |
| O13 | Concurrent second device changes session version: conflict preserves user draft and forbids stale overwrite. |
| O14 | Inject failure midway through calibration/outline-dependent transaction; read back DB and prove all related records stayed at prior version. |
| O15 | Cross-company/page/area IDs and invalid geometry payloads rejected server-side even when the client UI is bypassed. |
| O16 | Exit/back/cancel/new page with dirty draft offers safe resolution; approved save checkpoint is not rolled back by cancelling a later draft. |
| O17 | Network/provider/storage failures never disable manual creation, and never claim unacknowledged work is saved. |
| O18 | Old compatible persisted records load; provenance/codec upgrade preserves information and does not trust stale scale caches. |

### 14.6 Layout, accessibility and regression

| ID | Required test / expected outcome |
|---|---|
| L01 | Auto chooses the intended view for explicit fixtures; manual preference always wins and survives refresh where storage is available. |
| L02 | Desktop PWA is not treated as a phone solely for being standalone; mobile browser can use touch without installation. |
| L03 | Portrait↔landscape, both landscape directions, safe insets and 568×320 viewport remain operable without changing data. |
| L04 | Software-keyboard-sized visual viewport does not switch workspace mode, hide confirmation permanently or reset scene scale. |
| L05 | Fullscreen/lock APIs absent, denied or exited: editing and all menus remain usable; no rotated-DOM fallback. |
| L06 | Right-hand 2×2 point grid has at least the specified 48 px target boxes; no overlapping hit targets; zoom controls are distinguishable. |
| L07 | Point selection, armed state, invalid state and acceptance are distinguishable without colour alone; labels/focus/nudge actions usable. |
| L08 | Immersive route hides only intended chrome, restores it on exit and preserves required notices/help access. |
| L09 | Desktop calibration/area/component/save behaviour and the existing multi-page suites remain unchanged. |
| L10 | App build/lint pass, no production test hooks, no client secrets, and no new uncontrolled logs/network calls while dragging. |

### 14.7 Suggested commands and reporting

The agent should add a `test:precision` script for the new pure tests using the repository's existing Node/tsx convention. Example **proposed** script body:

```text
node --import tsx --test "app/lib/takeoff/precision*.test.ts" "app/lib/takeoff/viewportTransforms.test.ts"
```

Use actual test filenames; do not leave a glob that matches nothing and report a passing suite. Run existing `test:calibration`, applicable `test:roof-takeoff`, lint and build. Extend the existing safe E2E config with explicitly named touch Chromium/WebKit projects and the required tags, then record the actual commands used. Do not imply those project names exist before adding them.

Release report must distinguish:

```text
Pure tests                 PASS / FAIL / BLOCKED, counts and command
Controller / mocked API    PASS / FAIL / BLOCKED
Real DB transaction tests  PASS / FAIL / BLOCKED
Chromium touch browser     PASS / FAIL / BLOCKED
WebKit browser             PASS / FAIL / BLOCKED
Real iOS browser / PWA     PASS / FAIL / NOT RUN
Real Android browser / PWA PASS / FAIL / NOT RUN
Real provider integration  PASS / FAIL / NOT RUN; approved cost
Owner usability review    PASS / ISSUES / PENDING
```

A screenshot, a TypeScript compile, synthetic pointer tests and a real device run are different evidence. None may be substituted silently for another.


---

<a id="s15"></a>
## 15. Physical-device verification and the owner's final review

### 15.1 Device checks an agent/test team should complete first where hardware is available

Test at least one supported real iPhone and one supported real Android phone in ordinary browser mode, and the installed PWA on supported devices. Record model, OS/browser version, viewport, orientation, pointer type and network conditions. “Supported” must use the app's real support policy, not an invented universal browser claim.

Verify remote-drag tracking with the finger genuinely away from the dot; two-finger pinch; browser/OS gesture cancellation; rotation both ways; software keyboard entry; safe-area controls; fullscreen denied/exit; background/return; and saved-state reload. Include a narrow landscape phone, a dense roof plan and a low-quality satellite image with a readable scale. Add tablet and mouse/trackpad-in-touch-view coverage as available.

Agent/browser emulation can automate much of the surrounding flow, but an agent without connected hardware must mark these hardware tests **not run**. The owner or another tester must then perform that explicitly identified remainder. Do not call the build “fully mobile-tested” from browser size emulation alone.

### 15.2 What remains for the owner

After the automated and available hardware checks, the owner should assess the product experience, not discover arithmetic or transaction defects. Supply a small ready-to-use test project with a plan image and a top-down satellite example, plus deliberately inaccurate AI fixture options that do not consume credits.

| Owner task | What to judge |
|---|---|
| Enter Digital Takeoff from a phone, then manually switch Desktop/Touch | Does the intended workspace appear, is switching obvious, and can they always get back? |
| Place and remotely adjust A/B; enter a known distance and finish with one reference | Is the finger clear of the marker? Is “one and done” obvious? Is the keyboard/panel unobtrusive? |
| Add a second reference, cancel a third, and reopen calibration | Do saved versus draft references feel predictable? |
| Repair one of three wrong AI pairs; accept only the repaired one | Can they ignore bad proposals and finish without another AI scan? Are stale numbers/evidence clearly not being trusted? |
| Draw a simple outline, close it and adjust a concave outline using arrows | Are previous/next and selected-point highlighting obvious? Does release reliably stop movement? |
| Insert at the closing edge, move the new point, delete an error and Undo | Is the insertion side understandable, and does deletion feel safe? |
| Pinch while editing; re-arm the same point; rotate; save and reopen | Can they recover without accidentally adding points or losing position/work? |
| Repair an AI outline with several wrong corners | Does fixing it feel faster/easier than redrawing? Are any controls obscuring the corner they need to see? |

Measure completion time and count accidental moves/undo corrections to guide improvements; do not impose an unsupported “every user finishes in two minutes” claim. The first owner session should focus on whether this remote-drag model is understandable and controllable. Touch sensitivity, halo appearance and rail placement may need tuning even when all correctness tests pass.

### 15.3 Release criteria and blockers

First-release readiness requires a demonstrable manual-only journey, repairable AI-origin geometry when those entries are enabled, persistent reload correctness, zero known cross-page/ownership errors, safe cancellation, independent Desktop regression tests, and the automated gates above. Ship behind a takeoff-touch feature flag with an explicit Desktop fallback and record any supported-type restrictions.

Release blockers include: points moving on pinch or unrelated taps; changed scale after rotation; duplicate/wrong-owner saved areas; stale AI overwriting edits; non-atomic recalibration; disappearance of saved work on Cancel; invalid polygons accepted as valid quantities; inaccessible save/exit controls; or a charged AI search triggered only by changing layout.

A complete absence of live AI service can be handled by hiding/disabling that entry and keeping the manual journey available. It is not a reason to block all mobile takeoff. Conversely, do not enable an untested paid path and imply manual fallback makes billing/integration defects acceptable.

---

<a id="s16"></a>
## 16. Coding-agent start prompt and checkpoint protocol

### 16.1 Paste this with the complete document

> Implement the QuoteCore+ Mobile Takeoff and Precision Geometry Editor specification, version 1.0 dated 2026-09-21. Start with M0 against the current repository, not the older prototype archive. Preserve the application's actual domain, ownership, permissions, billing and save/recompute rules. Report the current commit and map existing equivalents before adding new files.
>
> The first release is M0–M7: touch workspace, shared precision point interaction, editable manual/AI calibration and editable manual/AI roof outlines. Components are M8. AI detector improvement is a separate backlog item and is not a prerequisite. Manual workflows must work with AI disabled.
>
> Use one state owner and stable scene coordinates. The right-hand grid is previous/next in perimeter order, insert after the selected point at its successor midpoint, and delete the selected point with a three-point closed-outline minimum. Calibration uses A/B instead of the grid. Off-point drag is relative; release commits to the draft and disarms. Two fingers operate the view only. All saved edits use authorised, version-checked persistence and deterministic recomputation.
>
> Preserve one-reference-is-enough and the unit-normalised arithmetic mean of one to three accepted references. Human endpoint corrections must reach acceptance and persistence; do not only move their visual markers. Reconfirm changed accepted references and do not present original AI crops as evidence for new endpoints.
>
> Work phase by phase, with tests and a checkpoint commit for each. Do not redesign unrelated features, perform production mutations, weaken E2E guards, invent cheaper scan pricing, introduce new API keys, or change model/dependency versions for convenience. Resolve conflicts from real code, documenting deviations. Stop for approval only on genuinely unresolved business rules, unsafe migrations, pricing changes or another blocking ambiguity; otherwise continue through the defined phase gates.
>
> Hand back the implementation diff, migration details, current source map, exact test results, screenshots/traces, remaining hardware checks and the short owner acceptance checklist. Do not describe mocked/synthetic/emulated tests as live provider, real database or physical-device evidence.

### 16.2 Per-phase progress record

Maintain one small project-local progress file, for example `docs/MOBILE_TAKEOFF_IMPLEMENTATION_PROGRESS.md`:

```markdown
## Phase Mx — title
Base / result commit:
Status: not started | in progress | blocked | complete
Existing modules reused:
New / changed modules:
Schema / compatibility impact:
Requirements and test IDs covered:
Commands run and results:
Evidence paths:
Physical / live-service tests not run:
Decisions or deviations, with reason:
Known risks / blockers:
Next phase entry conditions:
```

At a context-window handoff, include the current phase, exact unfinished tasks, current commit and failing test IDs. Do not reload only the first part of the specification and guess the persistence or acceptance requirements.

### 16.3 Final implementation handoff checklist

The handoff must contain the entire latest implementation diff/archive or a reviewable commit, not just screenshots. Include a summary of changes to scene transforms, gesture ownership, calibration acceptance, outline save/update, dependency recomputation and feature flags. Identify source changes made after the supplied 20 September archive.

Distinguish:

**Implemented:** code and migrations actually present.

**Proven automatically:** tests run, with outputs and environment.

**Proven on hardware:** devices/browser versions and scenarios actually exercised.

**Remaining:** specific manual/hardware/live-provider checks and any intentionally deferred M8 features.

The owner should not have to reverse-engineer whether “mobile support” means a narrow desktop layout or the precision touch interaction described here.

---

<a id="s17"></a>
## 17. Reference appendix, defaults and specification checks

### 17.1 Source evidence map

Line ranges are navigation aids for the **supplied archive only**. They will move in the current branch. Use the function names/paths rather than assuming exact line numbers remain stable.

| Reference | Source and relevant evidence |
|---|---|
| R-SRC-01 | `TAKEOFF/TakeoffPage.tsx`, approximately lines 1–101: dynamic client import, forwarding domain props and desktop widening wrapper. |
| R-SRC-02 | `TAKEOFF/TakeoffWorkstation.tsx`, approximately 180–242 and 302–304: 2000-long-edge scene calculation, calibration fields, plain-state snapshot, scene dimensions. |
| R-SRC-03 | Workstation, approximately 3270–3918: one-shot Fabric setup, source-scaled background, scene pointer conversion, drawing paths and Alt-based pan. Approximately 3978–4039: zoom ownership / resize behaviour. |
| R-SRC-04 | Workstation, approximately 4309–4409: scan1 outline request and immediate `runRemainingAiScans`; approximately 4638 onward: AI application integration. |
| R-SRC-05 | `app/lib/takeoff/calibration.ts`, lines 1–161: canonical ratio mean, maximum three, length/area math and legacy adapter. |
| R-SRC-06 | `app/lib/takeoff/calibrationCoordinates.ts`, lines 1–179: affine contract, inverse/composition, source/analysis/scene transforms and bounds. |
| R-SRC-07 | `calibrationTypes.ts`, `calibrationSession.ts`, `calibrationCodec.ts` under `app/lib/takeoff/`: candidate/accepted-reference shapes, reducer actions, v1 metadata. `TAKEOFF/calibration/useCalibrationController.ts`: current AI controller lifecycle. |
| R-SRC-08 | Workstation, approximately 1617 onward: additive `handleSaveArea`, draw-time `quoteRoofAreaId` and `fromPageId` ownership. `calibrationRecompute.ts`: geometry/provenance-derived value recomputation. |
| R-SRC-09 | `TAKEOFF/actions.ts`, approximately 458–513: snapshot's atomic measurement RPC followed by separate calibration write; approximately 630 onward: hydration; 1425 onward: calibration-only persistence. Verify later hardening in the live branch. |
| R-SRC-10 | `app/lib/takeoff/useStateHistory.ts`, `reconstructCanvas.ts`, `reconstructTypes.ts`, and workstation snapshot capture: plain-data undo/rebuild architecture and metadata preservation concerns. |
| R-SRC-11 | `app/(auth)/[workspaceSlug]/layout.tsx`, approximately 132–235: app chrome, notices, constrained main width and assistant surfaces. `app/manifest.ts`: standalone display. `app/layout.tsx`: viewport configuration. |
| R-SRC-12 | `playwright.config.ts`: origin guard, serial mutation policy, device-emulation mobile project. `e2e/specs/phase26-multi-page-takeoff.spec.ts`, `phase-d-quote-takeoff-persistence.spec.ts`, `takeoff-ai-ui.spec.ts`: existing regression surfaces. |
| R-SRC-13 | `docs/AI_SCAN_V2_SMART_CALIBRATION_PLAN.md`: original calibration/outline/component/assistant roadmap. This document complements that broader project instead of replacing its unrelated phases. |
| R-SRC-14 | Conversation attachment `calibration-vision-escalation-2026-09-20.md` and the supplied screenshot: reported endpoint/reference detection failure, supporting the requirement for manual repair; not proof of a specific model/CV root cause. |
| R-SRC-15 | Conversation attachment `AI_CALIBRATION_PRE_HUMAN_TEST_AUDIT_2026-09-20.md`: previous safety findings to reconcile. `AI_CALIBRATION_VISION_ACCURACY_IMPLEMENTATION_SPEC_2026-09-20.md`: separate detector-improvement track, not a required implementation dependency. |

### 17.2 Primary browser/library references

These references were opened while preparing this plan. They support platform/API facts, not the proposed product choices or an assertion that a feature has passed on the user's devices. Check the installed library version and current browser support again during implementation.

**B1 — W3C Pointer Events:** unified pointer input, pointer capture, cancellation and `touch-action`. Source: `https://www.w3.org/TR/pointerevents3/`

**B2 — MDN ScreenOrientation.lock:** limited availability, orientation-lock behaviour and fullscreen-related constraints. Source: `https://developer.mozilla.org/en-US/docs/Web/API/ScreenOrientation/lock`

**B3 — MDN pointer media feature:** primary input pointer precision. Source: `https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/pointer`

**B4 — MDN display-mode media feature:** browser/standalone/fullscreen presentation mode; separate from pointer capability. Source: `https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/display-mode`

**B5 — W3C WCAG 2.2 Target Size (Minimum):** 24×24 CSS px criterion and exceptions; larger product targets are permitted. Source: `https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html`

**B6 — MDN VisualViewport:** layout versus visual viewport and software-keyboard effects. Source: `https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport`

**B7 — MDN CSS env():** safe-area inset environment variables. Source: `https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/env`

**B8 — Fabric official 7.0 upgrade guide:** removed `getPointer`, explicit scene/viewport point APIs and current canvas API considerations. Source: `https://www.fabricjs.com/docs/upgrading/upgrading-to-fabric-70/`

**B9 — Fabric official event guide:** event subscriptions and ownership; avoid using events as an unnecessary app-wide command bus. Source: `https://www.fabricjs.com/docs/events/`

**B10 — W3C WCAG 2.2 Dragging Movements:** provide a single-pointer non-drag equivalent where required; keyboard-only handling does not establish touch equivalence. Source: `https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html`

**B11 — Playwright official emulation documentation:** device, viewport and touch emulation configuration. Source: `https://playwright.dev/docs/emulation`

### 17.3 Proposed defaults to record and tune

| Item | Initial proposal | Important constraint |
|---|---|---|
| Touch Auto heuristic | Coarse primary pointer + shorter layout edge ≤820 CSS px | Explicit override wins; not a keyboard-triggered toggle. |
| Grid/control target | 48×48 CSS px with 8 px gap | Do not reduce to tiny icons to fit landscape. |
| Marker selection radius | About 24 CSS px | Screen-space target; exact visible centre stays small. |
| Drag slop | 6 CSS px | Tap versus gesture distinction; no mandatory long-press timer. |
| Remote movement | 1:1 visible CSS-pixel delta | Convert through inverse transform; no DPR multiplier. |
| Nudge steps | 1 or 5 visible CSS px | Independent of previous/next selection controls. |
| Local draft undo | 100 logical operations, bounded memory | One gesture = one operation; no Fabric objects. |
| Closed outline minimum | 3 distinct vertices, nonzero simple area | Collinear insertion point allowed; full polygon cannot be degenerate. |
| Calibration count | 1–3 accepted references | Includes mixed origins; one can finish immediately. |
| Calibration disagreement | Existing shared policy; snapshot uses >10% range/mean | Warning with explicit acknowledgement, never hidden longest-only replacement. |
| Tested viewport floor | Include 568×320 CSS px landscape | Not a claim of support for every older OS/browser. |
| Gesture profiling | Proposed p95 preview latency ≤50 ms on declared test hardware | Measure; do not replace hardware evidence with assumptions. |

A maximum point-count guard must come from the current application's supported input limits. Test at least forty points as a normal case and two hundred for stress. Do not silently truncate geometry to meet an arbitrary UI limit.

### 17.4 Worked examples for independent test oracles

**A. Mixed-origin, mixed-unit calibration.** Reference A has 1000 scene px for 10 m: `S_A = 0.01 m/px`. Reference B has 304.8 scene px for 10 ft, which converts to 3.048 m: `S_B = 0.01 m/px`. Their effective scale is `0.01 m/px`. A 500-scene-pixel line is 5 m. A polygon of 10,000 scene-pixel² has plan area 1 m². Origin (manual versus AI) does not change the calculation.

**B. Mean of ratios, not ratio of totals.** Two accepted spans are 10 m / 1000 px and 8 m / 400 px. The policy yields `(0.01 + 0.02) / 2 = 0.015 m/px`, not `18 / 1400`. The disagreement is `100*(0.02-0.01)/0.015 = 66.666…%`, which requires the existing warning/acknowledgement path. This deliberately inconsistent example is a policy test, not a good calibration recommendation.

**C. Human endpoint correction changes scale.** A reference still labelled 10 m changes from 1000 to 800 scene px after endpoint repair. Its scale becomes `0.0125 m/px`. A fixed 10,000-scene-pixel² polygon now has plan area `1.5625 m²`. Retaining its earlier 1 m² would prove that only markers, not the underlying calibration, were edited.

**D. Insertion on the closing edge.** A square in order `[(0,0),(100,0),(100,100),(0,100)]` has area 10,000 and perimeter 400 in scene units. Select its last vertex; `+` inserts `(0,50)` after that vertex, before the return to `(0,0)`. Area and perimeter are unchanged. The new vertex remains selected and editable even though it is initially collinear.

**E. Remote-drag invariance.** A point at scene `(100,80)` with scene-to-client zoom 2 and arbitrary translation moves to `(120,70)` for a finger delta of `(40,-20)` CSS px. At zoom 0.5, the same delta moves it to `(180,40)`. DPR 1, 2 or 3 must not change either result.

**F. Outline edit at unchanged scale.** For a square `[(0,0),(100,0),(100,100),(0,100)]`, move only `(100,100)` to `(120,100)`. Scene area becomes 11,000, not 10,000. At `0.01 m/px`, plan area becomes `1.1 m²`. Any explicitly area-derived entry must update even though calibration did not change; independent component lines must not move.

### 17.5 Completeness marker

This specification contains sections **0 through 17**, phases **M0 through M8**, automated tests **G01–G18, T01–T16, C01–C16, O01–O18 and L01–L10**, and the agent checkpoint instructions in §16. A copy ending earlier is incomplete and must not be implemented from alone.

The companion handoff bundle contains the same full document, smaller ordered parts, a start-here note and SHA-256 checksums. The parts are reading aids, not a separate specification. Use the full document for internal section links.

**END OF SPECIFICATION — MOBILE-TAKEOFF-PRECISION-V1.0 — 2026-09-21**
