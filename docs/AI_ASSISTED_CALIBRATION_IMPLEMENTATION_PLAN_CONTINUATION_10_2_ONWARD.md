### 10.2 Recompute according to each value's actual meaning

The existing measurement types do not all store values in the same units or dimensional power. Follow the actual handlers and save conversion rules, not a blanket “multiply everything by scale ratio” implementation. [C10]

| Item/type | Recompute source | Result convention to preserve |
|---|---|---|
| Roof polygon `RoofArea.area` | Validated polygon points → shoelace pixel area. | Plan area in page working-unit squared; pitch remains separate. |
| `line` | Two endpoints. | Length in page working unit. |
| `multi_lineal` | Sum successive segment distances. | Total length in page working unit; do not close the polyline. |
| `multi_lineal_lxh` | Same polyline length. | Its stored `value` is length, not area; existing save logic applies component height. |
| `area` with geometry | Polygon points. | Plan area in page working-unit squared; existing save logic may apply a preset depth. |
| `volume_3d` | Plan polygon area converted to m² × authoritative entered depth in m. | Existing `value` is already m³. Do not apply an imperial conversion again. |
| `length_x_height_freestyle` | Line length converted to m × authoritative entered height in m. | Existing `value` is already m². |
| `multi_lineal_lxh_freestyle` | Polyline length converted to m × entered height in m. | Existing `value` is already m². |
| `point` | Existing count. | Count unchanged by calibration. |
| Attached/reused roof-area component | Durable source polygon link plus plan/pitched basis. | Update its plan-value snapshot and derive display/save values exactly once. |

Entered real-world heights/depths remain unchanged. They are not pixel-derived dimensions. A volume with a fixed entered depth scales with the drawn plan area, not with the cube of the calibration ratio. Likewise, line × entered height scales with length, not area.

Preserve pitch, visibility, component identity, page ownership, quote-area ownership and user input metadata. Do not apply pitch or waste in both the recomputation helper and the existing save/pricing engine.

### 10.3 Add durable provenance for geometry-free dependent entries

`handleConfirmAreaAttach()` creates an area component with no points and only a `plan_value`/`value_basis` snapshot. The parent `quoteRoofAreaId` is not enough to identify a unique polygon because sibling polygons can share it. [C11]

Introduce a stable `geometryId` for each source polygon, preserved across save/reload/redraw and across any RPC that replaces database rows. Prefer a dedicated `geometry_id` UUID on stored geometry-bearing measurements and a typed `source_geometry_id` on dependent entry metadata. Inspect the real SQL first, but implement an actual durable link rather than relying on a display name, array index, shared parent-area ID or ephemeral client row ID.

For new attached entries, preserve:

```ts
export interface MeasurementEntryInputs {
  height_m?: number | null;
  depth_m?: number | null;
  value_basis?: 'plan' | 'pitched';
  plan_value?: number;                 // in the page's recorded working unit²
  pitch_applied?: boolean;             // legacy compatibility, not a new default
  source_geometry_id?: string;
}
```

Update reconstruction/hydration/types so these fields do not require unsafe casts and are not stripped. Update comments that call all `entryInputs` “display only”: verified source height/depth and source links now participate in recomputation.

For legacy entries without an unambiguous source link or trustworthy source inputs, report the exact affected entries and block committing a scale change until they are resolved or removed explicitly. Never leave them silently on the old scale, guess a source polygon, or infer a missing depth from a rounded final volume. Re-linking to a chosen source polygon is acceptable when the user explicitly confirms it.

### 10.4 Page and area scoping

A page can appear under several area contexts in the workstation. Recompute **all entries belonging to that page**, including hidden/cached area entries, not just whatever is currently rendered. Do not rescale another page because its components roll up to the same quote roof area.

Resolve page-less legacy entries before recalibration. Do not stamp them with the active page solely because it is active. Reconcile/invalidate `pageCalibrationsRef`, `areaCanvasStatesRef` and other caches after a committed update so an area switch cannot restore stale values. [C07, C10]

### 10.5 Undo/redo

Use the existing state-only history. One calibration commit is one undoable document mutation containing the prior calibration and its dependent values; do not create an undo step per preview line, candidate selection or OCR field edit. [C12]

If undo/redo changes a persisted calibration, persist that as a new version-checked document revision rather than rewinding a database version number. Undo must never silently roll back to a different source-image revision. Rebuild previews only from the active review state; committed-state history contains no rejected/pending AI markers.

---

## 11. Persistence, compatibility and atomic save

### 11.1 Versioned page calibration

Use `takeoff_pages.scale_calibration` as the logical storage location, subject to the actual schema. Introduce a versioned envelope and a reader that also recognises the old array shape. [C09]

```ts
export interface StoredPageCalibrationV2 {
  schemaVersion: 2;
  revision: number;
  image: CalibrationImageDescriptor;
  workingUnit: WorkingUnit;
  aggregationPolicy: 'mean-distance-per-scene-pixel-v1';
  references: Array<{
    id: string;
    point1: Point;               // scene frame
    point2: Point;
    actualDistance: number;      // in workingUnit
    unit: WorkingUnit;
    pixelDistance: number;       // recomputed cache
    scale: number;               // recomputed cache
    source: 'manual' | 'ai_confirmed';
    confirmedInput: { distance: number; unit: DistanceUnit };
    ai: {
      referenceId: string;
      candidateId: string;
      candidateRevision: number;
      sourceLabelText: string | null;
      valueCorrected: boolean;
    } | null;
  }>;
  effectiveScale: number;        // recomputed cache, not authoritative input
  discrepancyAcknowledgement: {
    acceptedSetDigest: string;
    acknowledgedAt: string;
  } | null;
  confirmedAt: string;           // server timestamp
  confirmedBy: string;           // authenticated user
}
```

Store the minimal provenance required for support and reproducibility, not entire prompts, source-image base64 or provider reasoning. Only accepted records enter `references`; request/candidate history belongs in short-lived session records, not in the measurement list.

### 11.2 Legacy decoding

Return structured results such as `{status: 'valid' | 'needs_review' | 'invalid', calibration, diagnostics}`. Recompute cached span/scale from primitives; do not trust a stale `scale` field. Do not silently truncate an array of more than three records or quietly drop a malformed accepted record and call the original calibration intact.

For legacy records, verify the source raster and historical scene transform before binding them to the new descriptor. The old shape does not record which aggregation policy produced materialised values; do not assume every legacy takeoff used either the original mean or the improved prototype's longest-only rule.

Preserve historical values on load. For a demonstrably compatible same-unit legacy calibration, retain the existing meaning. Where units, geometry frame or calculation provenance are ambiguous, require explicit review before a new calibration commit recomputes existing quantities. **Opening a historical quote must not silently reprice it because this code shipped.**

### 11.3 Transaction contract

Find the real `save_takeoff_atomic` definition and its version guard during Phase 0. Extend it, or add a narrowly scoped calibration commit RPC sharing its permission/version mechanisms, so the transaction contains:

- the page's calibration envelope and incremented revision;
- its geometry-derived raw measurement values and required dependency metadata;
- affected roof-area entries and deterministic component quantity inputs;
- an expected document/session version and expected source-image revision.

Verify tenant/quote/page relationships inside the database boundary as appropriate. Do not use a second best-effort update after a successful measurement save. A calibration failure must roll back the linked numeric update and return a user-visible error. Check Supabase's returned error explicitly rather than relying only on exceptions. [C09, E5]

Do not let a page-scoped commit delete measurements from other pages or area contexts. Preflight the complete current page working document, including unsaved edits, rather than sending only the visible list to a delete-and-reinsert RPC. Preserve stable geometry IDs across that RPC.

Existing deterministic price recalculation may occur after the raw transaction, depending on repository design. If it fails, expose a pending/failed derived-total state and prevent presenting stale totals as fully updated. Either make it transactional in the existing supported way or make its status and retry idempotent; do not hide failure behind a success toast.

### 11.4 Rolling deployment

Deploy backward-compatible readers before enabling versioned writers. Inspect all consumers of `scale_calibration`, including mobile/import routes, not only the desktop workstation. Old clients that understand only arrays must be upgraded, gated or explicitly blocked from overwriting a new envelope.

Keep the feature off until the schema/RPC/type changes are deployed. Test rollback of the AI feature without loss of manual calibration or an inability to read already-created calibration records.

---

## 12. API, request ledger, security and point costs

### 12.1 Preferred search contract

Introduce the dedicated calibration endpoint rather than expanding the full-scan route further. The existing `stage: 'calibrate'` can delegate temporarily during client migration. The full roof-scan queue must not be invoked merely to find endpoints. [C06, C13]

Example request shape:

```ts
export interface CalibrationSearchRequest {
  contractVersion: 2;
  requestId: string;            // idempotency key generated once per attempt
  retryOfRequestId: string | null; // only for explicit retry of terminal technical failure
  sessionId: string | null;     // null only for the first request
  quoteId: string;
  pageId: string;
  imageRevision: string;
  expectedCalibrationRevision: number;
  round: 0 | 1;
  strategy: 'initial' | 'different_references' | 'refine_reference';
  refineReferenceId: string | null;
  retainedReferences: AcceptedReferenceDraft[]; // max 3, validated as draft input
  decisions: Array<{
    candidateId: string;
    decision: 'unreviewed' | 'skipped' | 'accepted';
    reason: 'endpoints' | 'wrong_reference' | 'unsure' | null;
  }>;
}
```

Client-supplied retained references/decisions are user input, not evidence of previously committed scale. Resolve AI endpoints from the stored server candidate by ID; validate manual points separately. Resolve all prior candidate IDs within this same session/page/image. Reject a request whose idempotency key was previously used with different meaningful content.

A successful completed search returns:

```ts
export interface CalibrationSearchResponse {
  contractVersion: 2;
  requestId: string;
  sessionId: string;
  round: 0 | 1;
  pageId: string;
  imageRevision: string;
  image: CalibrationImageDescriptor;
  status: 'candidates' | 'no_candidates' | 'unsuitable_image';
  candidates: CalibrationCandidate[];  // new/replacement slots only, at most 3-N
  notes: string[];
  completedSearchRounds: 1 | 2;
  rescanAvailable: boolean;
  pointsCharged: number;
  pointsRemaining: number | null;
  detectorVersion: string;
}
```

Use a typed error envelope with safe user text and machine codes, including `UNAUTHORISED`, `PAGE_NOT_FOUND`, `IMAGE_CHANGED`, `UNSUPPORTED_IMAGE`, `REQUEST_CONFLICT`, `SESSION_EXHAUSTED`, `INSUFFICIENT_POINTS`, `MODEL_REFUSAL`, `MODEL_INCOMPLETE`, `MODEL_TIMEOUT`, `INVALID_MODEL_OUTPUT`, and `SAVE_CONFLICT`. Do not expose raw provider exceptions, storage URLs or secrets in error strings.

An authenticated status/recovery GET keyed by the request ID lets a client retrieve an existing terminal result after a dropped response. An in-flight duplicate may return `202` with a retry hint; do not start another provider call. Returning `202` is not permission to rely on unscheduled work after a serverless request terminates: use an actual worker mechanism if execution must outlive the request.

### 12.2 Source retrieval and limits

Prefer a small request referring to an authorised persisted page image. Resolve the storage object server-side and read its bytes through the existing storage client; do not accept an arbitrary remote URL and fetch it. This avoids a second full-image upload and reduces mobile transfer overhead.

Vercel documents a 4.5 MB function request/response payload limit; the prototype's server-side 12 MB raw image check cannot protect a request rejected before it reaches the handler. A JSON request containing large base64 images is therefore the wrong default. Verify the actual deployment constraints during integration. [C05, C06, E6]

Validate content type, supported raster format, decoded pixel dimensions and resource limits before costly decoding or model work. Handle decompression-bomb-sized rasters, unsupported multi-frame formats, corrupt images and missing originals safely. Use the existing upload/rasterisation flow for PDFs; do not add PDF processing to the calibration endpoint casually.

### 12.3 Permissions and untrusted content

Authenticate the user, authorise company and quote, then verify the requested page belongs to that quote and resolve its current image revision. Repeat equivalent checks on status, rescan, commit and any crop retrieval. Do not accept a client's `companyId` as authority.

Retain current product availability/trade restrictions unless separately changed. Add a calibration-specific feature flag so testing does not require replacing the full roof-scan product flag. Keep model/API keys and storage service credentials server-only.

Treat image text and returned label/reason fields as untrusted content. Bound text/array sizes, render plain text, and do not feed extracted instructions to tools. Do not log plan images, signed URLs, raw base64, customer drawings or full model payloads by default. Debug artefacts require existing controlled-access/retention policy; they are not public diagnostic assets.

### 12.4 Idempotency and billing policy

The prototype has a one-point calibration constant, but deducts before the model call without a complete terminal-failure refund path. It also charges each retry request independently. Replace this with a durable request ledger. [C06, C15, C16]

**Proposed launch policy:** one AI calibration point for each completed user-visible search round, including that round's bounded internal refinement. Candidate selection, value correction and acceptance are free. The initial and optional rescan can therefore use at most two calibration points in a normal session. Keep this in the shared point-cost policy; confirm commercial suitability before rollout rather than treating it as a new user-approved price.

A successful search that finds no candidates still counts as a performed search. A technical/provider/schema failure releases/refunds the reservation. Show the charge before a deliberate rescan; never deduct again merely because a response was lost and recovered.

**Recovery is not re-execution.** Replaying the same request ID returns its existing status/result, including a terminal error, and cannot start new model work. If the user explicitly retries a terminal technical failure, create a new request ID with `retryOfRequestId` pointing to that failed attempt. The server verifies the same session/image, that the previous attempt is terminal and refunded, and that the round has not completed or been claimed elsewhere. It may then reserve quota again for the same round; there must be only one net charge when that round eventually completes. Include request/session/round context in authenticated error envelopes where those records exist. Bound technical retries per round (proposed: two explicit retries) and apply rate limits; do not create an infinite free provider loop. A new-reference search after a valid completed result is round 1, not a technical retry.

Use existing Supabase/Postgres infrastructure, not a new queue/service by default. Create or extend session/request records with ownership, page/image binding, request content hash, status, lease/expiry, round, cached normalised result, quota reservation/settlement state and detector version.

The atomic lifecycle is:

```text
Transaction: authorise + lock session + validate key/round + reserve quota + claim request
Outside transaction: read image + run bounded provider work
Transaction: cache normalised result + settle one charge + mark completed round
On technical failure: record failure + release/refund exactly once
```

Never hold a database transaction open during a model call. If the existing quota RPC cannot provide this lifecycle, implement the missing transaction/refund semantics in a migration rather than calling an invented refund function. A process crash must leave a recoverable reservation/lease; a reconciliation path must refund terminally failed work exactly once.

Configure provider retry behaviour explicitly. Bound internal retries, output size, model-call count and timeouts. Do not infer parameter support solely from a model-name regex. Use the repository's verified provider/model configuration and run a real structured-output smoke test with that configuration; this plan does not require a particular newly named model.

---

## 13. Phased implementation plan

### Phase dependency order

```text
P0: repository baseline and contracts
 → P1: shared maths, types and coordinates
 → P2: state machine and desktop review with mocked candidates
 → P3: deterministic recalculation and source dependencies
 → P4: versioned persistence, atomic commit and request ledger
 → P5: bounded vision detection/refinement service
 → P6: integrated desktop search/rescan/manual/commit journey
 → P7: complete validation and controlled desktop rollout
 → P8: later mobile presentation adapter, using the proven contract
```

P0–P7 define the desktop deliverable. P8 is a follow-on implementation phase, not permission to postpone mobile-safe domain design until later. P3 and P4 must not be skipped merely because initial calibration appears to work on an empty canvas.

### P0 — Establish the real repository baseline

**Objective:** Resolve packaging paths and missing environment details before changing production behaviour.

**Read:** the workstation, calibration helpers/modals, `actions.ts`, `reconstructTypes.ts`, `reconstructCanvas.ts`, `applyAiResults.ts`, scan route/engine, point costs, actual database migrations and existing test scripts.

**Tasks:**

1. Record whether the original prototype changes are already present in the real branch. Do not apply the large audit patch blindly.
2. Locate actual UI route paths and every consumer of `scale_calibration`. Identify manual draw, live preview, AI apply, hydration, page switching and save paths.
3. Inspect the installed package/lockfile versions and supported Fabric/OpenAI/Sharp APIs. Use the repository's package manager and scripts; do not invent missing commands or change frameworks as part of this feature.
4. Inspect `save_takeoff_atomic`, quota RPCs, ownership policies, row-ID preservation and version handling. Identify any outside-package import/mobile consumer that needs a compatible reader.
5. Reproduce baseline manual calibration, a one-reference finish, a three-reference finish, save/reload and page switching. Record existing failures separately.
6. Mark earlier Markdown calibration instructions as superseded by this file without deleting audit history.

**Validation:** Run available baseline typecheck, unit tests, lint and application build; distinguish environment failures from code failures. Record the actual results, not a claim inherited from the audit.

**Done when:** a short repository map and compatibility/migration notes exist; all relevant calculation/save paths are identified; missing production prerequisites are explicit.

**Suggested checkpoint:** `chore(takeoff): document calibration baseline and integration map`.

### P1 — Shared contracts, correct averaging and coordinate safety

**Objective:** Establish the deterministic foundation without relying on AI output.

**Files:** `calibration.ts`, new `calibrationTypes.ts`, `calibrationCoordinates.ts`, `calibrationCodec.ts` scaffolding, shared type imports and tests.

**Tasks:**

1. Implement the effective arithmetic mean and common-unit conversion from primitive confirmed inputs.
2. Replace longest-only result metadata with contributing IDs and disagreement range. Keep any temporary compatibility wrapper delegating to the new function.
3. Introduce the image/frame descriptor and explicit source/analysis/scene transforms.
4. Consolidate duplicate types; preserve working-unit and entry metadata through reconstruction.
5. Replace inline scale computations in existing callers, retaining the current UI until later phases. Prevent an unnoticed change to loaded historical materialised values.
6. Implement strict value parsing helpers, including unknown-unit and unreadable-text states. Do not make them depend on React.

**Tests:** golden mean examples; mixed-unit equivalence; shortest-only acceptance; printed-unit correction versus display-unit conversion; invalid inputs; cached-scale tampering; fractional-coordinate round trips; EXIF/crop/zoom scenarios; source-revision mismatch.

**Done when:** one shared function produces scale for manual, AI and recomputation consumers, and viewport changes cannot alter a measured distance.

**Suggested checkpoint:** `fix(takeoff): unify unit-normalised calibration averaging`.

### P2 — Review state machine and desktop UX with mocked proposals

**Objective:** Prove the required user decisions before introducing provider variability or billing.

**Files:** `calibrationSession.ts`, `useCalibrationController.ts`, `CalibrationChooser.tsx`, `CalibrationReviewPanel.tsx`, `calibrationOverlay.ts`, `CalibrationEvidenceZoom.tsx`, manual modal and a small workstation integration adapter.

**Tasks:**

1. Implement pure reducer events and committed-versus-draft separation.
2. Render all 1–3 proposals; use stable IDs, active/subdued/accepted/skipped states and precise marker centres.
3. Implement both accept-and-finish and accept-and-check-another, plus finish-already-accepted.
4. Allow direct candidate selection, nullable OCR fields, unit/value correction, remove/reconfirm and manual mixing up to three.
5. Add an explicit first-manual-reference save-and-finish path. Retain existing two-click operation and hints.
6. Make cancel/recalibration non-destructive; do not enable measurement tools based on a draft array.
7. Tag every preview with a session/candidate-specific role. Cleanup by tag/object reference, never by colour; exclude previews from history, exports and saves.

**Tests:** every example in §1.2 with mocked responses, first-reference manual finish, direct selection of candidate 3, identical labels with distinct IDs, marker-centre alignment and overlay cleanup on all exits.

**Done when:** the complete workflow works deterministically with fixtures, without any model call or point charge.

**Suggested checkpoint:** `feat(takeoff): add multi-candidate calibration review`.

### P3 — Recalculation and dependency provenance

**Objective:** Ensure a newly committed scale cannot leave any affected takeoff values on the old scale.

**Files:** `calibrationRecompute.ts`, shared measurement types, area-attachment creation, hydration/reconstruction adapters and pure recomputation tests.

**Tasks:**

1. Implement exhaustive handling of all current measurement types using the table in §10.2.
2. Add stable geometry identity to new source polygons and `source_geometry_id` to area-derived entries.
3. Preserve and validate height/depth/value-basis fields; update misleading “display only” comments and remove casts hiding missing metadata types.
4. Recompute all page-owned geometry and attached entries, including hidden area caches, but not another page's values.
5. Return a structured preflight error list for missing source geometry, missing real-world inputs or ambiguous legacy ownership. Do not apply a partial recalibration.
6. Produce an immutable next-document result suitable for one state/history/database transaction.

**Tests:** length and area scale exponents; fixed-depth volume; fixed-height freestyle area; unchanged counts/heights/depths; pitch applied once; attached-area dependencies; legacy missing-source block; another page unaffected.

**Done when:** no measurement type can silently bypass the recalculation policy, and geometry-free derived entries have an explicit source or a blocking diagnostic.

**Suggested checkpoint:** `fix(takeoff): recompute page measurements on calibration changes`.

### P4 — Persistence and request lifecycle

**Objective:** Make calibration-only saves, recalibration and AI request accounting safe across reloads, errors and concurrent tabs.

**Files:** `calibrationCodec.ts`, `actions.ts` adapter, actual database migrations/RPC definitions, generated database types and integration tests.

**Tasks:**

1. Implement versioned-envelope decoding plus diagnostic legacy compatibility.
2. Add persistent geometry identity/source-link fields and ensure any delete/reinsert save operation preserves them.
3. Implement the page-scoped atomic commit with expected document version and expected image revision, including the zero-measurement case.
4. Update all readers/writers and caches; do not leave mobile/import consumers with array-only assumptions.
5. Implement or extend the calibration session/request ledger, quota reservation/settlement and exactly-once technical-failure refund/recovery.
6. Add server-side one-rescan enforcement, request-content hash checks, ownership policies and lease/terminal state handling.
7. Make failure of calibration persistence user-visible; update dependent-total status handling as required by the existing pricing path.

**Tests:** transaction rollback; calibration-only reload; no cross-page deletion; concurrent-tab version conflict; image replacement conflict; old/new codec round trips; request idempotency; duplicate settlement/refund; unknown session/page access rejected.

**Done when:** a forced failure cannot save measurements with the wrong calibration, and repeating a request cannot spend points twice.

**Suggested checkpoint:** `feat(takeoff): persist calibration and request lifecycle atomically`.

### P5 — Vision discovery and endpoint refinement service

**Objective:** Implement perception as a bounded, replaceable service returning validated proposals, never committed scale.

**Files:** `ai-calibration-v2.ts`, `calibrationCandidates.ts`, `calibrationServer.ts`, provider configuration and detector tests/fixtures.

**Tasks:**

1. Replace the raw schema/prompt so unreadable text or units are explicitly nullable.
2. Resolve authorised source bytes and record exact orientation/crop transforms.
3. Implement the bounded overview discovery plus native-detail refinement path.
4. Validate evidence, parse text deterministically, deduplicate reference geometry and sort longest first after eligibility/refinement.
5. Implement same-reference refinement revisions and different-reference exclusion logic.
6. Handle refusal, truncation, invalid output, missing crops, timeouts and unknown model configuration without returning a fake successful candidate.
7. Version prompt/schema/preprocessing/detector outputs; record bounded diagnostic metrics without raw customer images by default.

**Tests:** captured provider-response mocks for every failure/nullable field; reversed endpoints; same-text distinct dimensions; repeated physical reference with jitter; short valid bar; mixed-scale/perspective rejection; crop-ID mapping. Run a controlled live provider smoke test in the full environment and report it separately from mocks.

**Done when:** the service returns zero to three correctly framed candidates and no authoritative calibration or takeoff quantities.

**Suggested checkpoint:** `feat(takeoff): detect and refine explicit calibration references`.

### P6 — Integrate search, rescan and desktop commit

**Objective:** Connect the proven UI, service and persistence without changing the locked product rules.

**Files:** dedicated API route, temporary full-scan compatibility adapter, controller, workstation hooks, manual entry and shared point-cost UI.

**Tasks:**

1. Wire authenticated search/recovery to the request ledger and provider service. Use server-resolved page images, not arbitrary client URLs.
2. Implement accepted-reference retention and available-slot limits on rescan.
3. Add request/session/page/revision/epoch guards; cancel or ignore stale completions.
4. Expose cost and one remaining rescan explicitly; ensure “next” is local and never charges.
5. Wire initial/recalibration finish through preflight recomputation and atomic commit. Preserve prior committed state on failure/cancel.
6. Clean up all old single-candidate state and longest-only UI wording. Remove the prototype's direct `setCalibrations([candidate])` completion path.
7. Retire or strictly delegate the old `stage: 'calibrate'` route once clients migrate; preserve the existing full roof scan behaviour.

**Tests:** full mocked E2E matrix; live end-to-end happy path; lost-response recovery; accepted candidate plus failed/empty rescan; page switch mid-search; simultaneous tabs; points exhaustion with manual fallback.

**Done when:** all nine user acceptance examples pass through the real desktop integration and saved reload state.

**Suggested checkpoint:** `feat(takeoff): integrate human-confirmed AI calibration workflow`.

### P7 — Validation and controlled desktop release

**Objective:** Establish what the system actually achieves before broad enablement.

**Tasks:**

1. Run the full real-repository build, lint, typecheck and relevant unit/integration/browser suites.
2. Evaluate the labelled image set in §14, including negative/ambiguous images and OCR-correction cases.
3. Record candidate/endpoint/scale metrics separately; inspect failure examples and verify that model confidence is not reported as measured accuracy.
4. Test manual-only fallback with AI disabled, unavailable, quota-exhausted and on old documents.
5. Confirm transactional saves, stale-response protection, billing reconciliation, log privacy and recovery behaviour in the deployment environment.
6. Enable the calibration-specific flag for a small controlled cohort only after the safety gates pass. Keep manual available.
7. Document known limitations, measured model/configuration, fixture version and rollback procedure.

**Done when:** the release evidence exists, not merely when a demo succeeds. Failing quantitative perception goals means iterate on P5/fixtures while retaining the functioning manual path; failing any save/ownership/calculation safety gate blocks release.

**Suggested checkpoint:** `test(takeoff): validate calibration release gates`.

### P8 — Mobile adapter, after desktop acceptance

Reuse `CalibrationReviewState`, events, candidate IDs, coordinate transforms, request lifecycle, mean scale, commit and recalculation without forking the measurement engine. Replace only the desktop presentation adapter with touch-friendly controls/capture and appropriate image guidance.

Test phone rotation, viewport resize, high device-pixel ratio, interrupted networks, numeric keyboard/unit selection, source-image orientation and a complete no-precise-taps calibration journey. Precise finger placement is not part of its acceptance criteria; verifying AI markers and entering a distance is.

Do not claim that this phase also solves mobile roof-outline editing or a camera's perspective distortion. Those remain independently testable features.

---

## 14. Test plan and acceptance suite

### 14.1 Required automated suites

Use the repository's existing test tools where possible. Name/group tests by behaviour rather than coupling them to private component implementation details.

| Suite | Minimum cases |
|---|---|
| `calibration-math` | One/two/three accepted; arithmetic mean rather than ratio-of-sums; mixed feet/metres; mm/inches conversion; stale scale field; invalid/non-finite/negative/zero inputs; rejected longest ignored; full precision retained. |
| `calibration-coordinates` | Full image, crop offsets, fractional ratios, orientation, source/scene inverse, zoom/pan, resize, high device-pixel ratio, wrong revision, missing crop ID, out-of-bounds points. |
| `calibration-candidates` | Ten hypotheses yield best eligible three; descending pixel span; longest bad geometry excluded; nullable OCR retained; repeated labels at different positions; reversed endpoints; duplicate jitter; refinement versioning. |
| `calibration-state` | Direct candidate selection; accept-and-finish; finish-already-accepted excludes active unaccepted; value/unit edit invalidation; remove/reopen; manual mixing; accepted cap; rescan allowance and retention; cancel restore. |
| `calibration-overlays` | All current pairs visible; exact marker centres; active/passive/accepted distinction; source-text inspectability; no colour-based cleanup; no persistence/history/export contamination. |
| `calibration-recompute` | Every type in §10.2; fixed physical heights/depths; pitch/waste once; attached-area dependency; cached/hidden entries; other page untouched; legacy blockers; no partial result. |
| `calibration-persistence` | Calibration-only save; old/new format; geometry-ID stability; atomic rollback; stale version; replaced source; reload consistency; conflicting old client cannot overwrite; undo/redo revision behaviour. |
| `calibration-api` | Wrong tenant/quote/page; malformed/big image; unavailable source; refusal/truncation/timeout; one rescan enforced; forged previous candidate ID; empty normal result; typed safe errors. |
| `calibration-billing` | Duplicate initial/search/finish; same-key content conflict; lost result retrieval; technical failure refund once; terminal-error replay does not re-execute; linked technical retry stays in the same round; valid empty search charge once; process/lease recovery; no charge for selecting/accepting. |

### 14.2 Desktop end-to-end scenarios

1. On a clean page, AI shows three candidates together. Accept the first and start measuring without touching the others.
2. Skip the first two. Accept the shortest, with a typed distance, and verify the correct one-reference scale after reload.
3. Accept the first, correct and accept the second, skip the third. Verify the exact two-ratio arithmetic mean.
4. Accept all three; verify every accepted record survives save/reload and contributes once.
5. Return one candidate with null distance and null unit. Finish is disabled until both are provided; no extra AI call occurs.
6. Choose candidate 3 directly. Candidate 1 must not become accepted or rejected merely because focus changed.
7. Accept candidate 1, then select an unaccepted candidate 2 and click **Use 1 accepted measurement**. Candidate 2 does not enter the scale.
8. Edit an accepted value. Confirm the displayed accepted count/finish behaviour matches the reconfirmation policy.
9. Accept a manual reference then add an AI-confirmed reference in the same draft. The shared cap and unit-normalised mean apply.
10. Use the single rescan after skipping all proposals. Reversed/jittered repeats are not advertised as new references.
11. Explicitly refine a rejected reference. The revision is labelled/reconfirmed; no previously accepted pair changes automatically.
12. Accept one and rescan. An empty result, timeout or quota failure leaves the accepted reference intact.
13. Lose the network response after a completed charged search. Recover the cached result without another charge or another round.
14. Switch page or replace the image before the response returns. No marker or scale appears on the wrong image.
15. Cancel recalibration after editing proposals. The previous measurements and scale remain unchanged.
16. Finish a recalibration with existing roof areas, lineal components, attached-area entries and hidden area caches. Every affected value updates; another page does not.
17. Force a database failure during commit. Neither new calibration nor dependent values are partially persisted; the draft remains retryable.
18. Recalibrate a legacy attached entry with no source link. Show the specific resolution requirement instead of silently keeping stale data.
19. Undo and redo a committed calibration. Calibration, measurements, labels and save state remain coherent.
20. Disable AI or exhaust points. Manual one-reference calibration still finishes normally.

### 14.3 Ground-truth image corpus

No labelled image corpus or live-provider accuracy results are supplied with this Markdown handoff. Build one before making accuracy claims. The archive itself is source code and documents, not evidence of endpoint performance.

**Proposed initial held-out set:** 40 eligible positive images and 20 negative/unsupported images, separate from prompt-development fixtures. Aim for roughly equal plan and top-down map positives, with metric/imperial dimensions, large sheets, portrait/rotated files, short scale bars, several competing dimensions and low/readability cases where a human can supply the missing value.

Negative/unsupported categories should include no explicit reference, area/angle-only labels, bent-path totals, perspective/tilted views and independently scaled/mismatched drawing views. Define eligibility and expected behaviour before running the detector; do not reclassify difficult failures after seeing the answers.

For each positive image annotate all relevant usable references, not just the one expected to rank first:

```json
{
  "fixtureId": "plan-metric-01",
  "imageRevision": "fixture-content-digest",
  "suitability": "suitable",
  "sourceWidth": 4000,
  "sourceHeight": 3000,
  "references": [
    {
      "referenceId": "dimension-A",
      "p1": { "x": 500.0, "y": 1000.0 },
      "p2": { "x": 3500.0, "y": 1000.0 },
      "printedDistance": 12.0,
      "printedUnit": "m",
      "viewId": "roof-plan",
      "labelText": "12.0 m"
    }
  ]
}
```

This is an illustrative schema, not a supplied real fixture. Ground truth should identify the correct tick/witness semantics, label association, permissible image region and any printed rounding/ambiguity. Keep customer drawings private and use permissioned or synthetic fixtures.

### 14.4 Separate perception metrics

Measure the following, tied to detector/model/preprocessing version:

- **Top-1 and top-3 usable endpoint recall:** whether a displayed candidate matches a genuine gold reference with acceptable endpoint and scale error.
- **Endpoint error:** symmetric maximum endpoint error, allowing swapped endpoints, in source coordinates and a standard 2,000-pixel-longest-edge evaluation frame.
- **Geometry-derived scale error:** use the human/gold distance with the AI endpoints. This isolates localisation from OCR.
- **Reading accuracy / manual-entry rate:** whether distance/unit were correctly read; score separately from endpoint usefulness.
- **Rescan usefulness and duplicate rate:** genuinely new usable references or accepted explicit refinements, not merely different IDs.
- **Journey outcomes:** finish with one reference, subset size, manual fallback, technical error rate, latency and actual provider usage/points per successful calibration.

A proposed usable-candidate test is endpoint error no greater than two pixels in the evaluation frame **and** scale error no greater than 1%, with correct reference/view association. These are engineering acceptance targets to evaluate, not guaranteed physical measurement accuracy. Scale error is relative to annotated image evidence, not an independent survey of the actual roof.

**Proposed pilot threshold:** at least 36/40 eligible images have a usable candidate in the initial three. **Proposed wider-release target:** at least 38/40, with each major image category also performing adequately, plus zero committable AI candidates for the predefined clearly unsupported/negative cases. Report the numerator/denominator and failure cases; a small fixture set does not establish a universal 95% production success rate.

All deterministic calculation, transaction, ownership, acceptance and stale-response tests are hard gates regardless of perception recall. Do not trade those off against a better average detection score.

---

## 15. Rollout, observability and maintenance

Use a calibration-specific flag separate from full roof AI. Keep manual available at every entitlement/error state. Ship compatible readers/schema first, then controlled writers and the AI UI. A rollback disables AI entry, not access to previously saved calibrations.

Log structured events such as search started/completed/failed, candidate accepted/skipped, value corrected, rescan requested, commit succeeded/failed, recalculation blocked and manual fallback. Include opaque request/session IDs, revision, model/configuration versions, counts, latency and billing state. Do not collect full plan images or label text as routine analytics.

Track technical failures separately from no-candidate results, and model self-confidence separately from measured accuracy. Use failures to improve evidence processing/fixtures, not to quietly alter the accepted-reference averaging policy.

Delete obsolete prototype branches after integration: single-candidate completion, repeated client image upload, unchecked page binding, unlimited rescan, longest-only labels and duplicate inline math. Keep a temporary compatibility adapter only with an owner/removal condition; do not maintain two calibration engines indefinitely.

### Definition of done

The feature is complete when a desktop user can load a suitable image, choose AI, see up to three correctly framed proposals, accept any subset of one to three with optional distance/unit correction, use at most one deliberate rescan, and save a consistent calibrated takeoff without precise manual endpoint placement. The manual method remains functional. Existing measurements, dependent components, history, persistence and page boundaries remain correct. The same domain/API flow is usable by a future mobile presentation adapter.

No acceptance criterion requires AI to read every number, find three references on every image or calibrate an unsafe perspective image. No criterion permits silently using an unaccepted reference, changing the mean policy, charging for local review actions or reporting success after a failed save.

---

## 16. Coding-agent start instructions and checkpoint format

Start with P0 and work in dependency order. This specification is the source of truth for the calibration product decisions. Existing code is evidence about integration, not authority to reintroduce conflicting prototype behaviour.

Useful initial repository searches:

```sh
git status --short
rg -n "scale_calibration|selectCalibrationScale|avgScale|averageScale" .
rg -n "handleSaveCalibration|handleConfirmAiCalibration|CalibrationModal" .
rg -n "getScenePoint|computeCanvasDimensions|MAX_CANVAS_DIM" .
rg -n "save_takeoff_atomic|check_and_deduct_ai_points" .
rg -n "plan_value|value_basis|height_m|depth_m|source_geometry_id" .
```

Exclude dependency/build directories according to repository convention. Read `package.json` and the actual test scripts before running package-manager commands. Use the existing dependency versions, error-handling conventions, UI components and test tools unless a specific change is justified.

At the end of each phase, update a small implementation log:

```markdown
## Phase Pn — <name>
Status: not started / in progress / complete / blocked

Changed files:
- <path>: <responsibility changed>

Requirements covered:
- <R IDs and relevant acceptance scenarios>

Validation actually run:
- <exact command or manual scenario> — <result>

Not yet validated:
- <specific missing environment, fixture or integration check>

Migration / compatibility notes:
- <legacy reader, SQL, model or feature-flag implication>

Remaining work and next phase:
- <concrete next task; no fabricated completion claims>
```

Do not mark a phase complete merely because mocked tests pass when its exit gate requires database/browser/provider validation. If a full-repository dependency is missing, implement and test the independent portions, document the exact blocker, and keep the production flag off. Do not weaken the product invariants to make a test pass.

---

## Appendix A. Code evidence and provenance

All code references below are to the supplied improved archive unless explicitly marked original. Line numbers identify the inspected snapshot and will shift after edits; use the named symbols as stable search anchors.

| Ref | Inspected source | Evidence used in this plan |
|---|---|---|
| C01 | `AUDIT_PACKAGE_README.md`; archive inventory; `TakeoffWorkstation.tsx` | Partial packaged route/UI source; no complete build environment; improved workstation has 7,045 lines. |
| C02 | **Original** `TakeoffWorkstation.tsx`, e.g. lines 2162, 3110, 3375, 5190, 5200, 5901 | Inline arithmetic averages of stored `cal.scale`; corresponding line/area/preview usage. |
| C03 | `app/lib/takeoff/calibration.ts`, lines 30–163, especially `selectCalibrationScale()` | Unit conversion; primitive-derived scale; longest-only selection and >10% warning; permissive legacy list parser. |
| C04 | `app/lib/takeoff/ai-calibration-v2.ts`, lines 12–225 | Mandatory numerical reading, unreadable-value exclusion, confidence gates, integer/rounded mapping, weighted ranking and local duplicate check. |
| C05 | `TakeoffWorkstation.tsx`, approximately lines 4218–4447 | Browser compression, single-image cache, one-candidate overlay, request, retry, single-record AI confirmation and manual fallback. |
| C06 | `app/api/takeoff/ai-scan-v3/route.ts`, approximately lines 482–721 | Quote authorisation, model mapping, calibration preprocessing, quota deduction, rejected-point conversion and response. |
| C07 | `TakeoffWorkstation.tsx`, `computeCanvasDimensions()` around 154–166; image setup around 3260–3300; `getScenePoint()` handlers; page/area caches | Capped stable scene, uniform background scaling, scene pointer input, page-specific calibration/hydration integration. |
| C08 | `modals/CalibrationModal.tsx`, lines 18–25 and 71–99; `handleSaveCalibration()` around 5111 | Manual two-point/value method, up-to-three count, first-reference button gap and draft flow. |
| C09 | `actions.ts`, `saveTakeoffMeasurements()`, particularly lines 384–463; hydration around 576–678 | Atomic measurement RPC followed by non-fatal calibration update; current JSON location; hydration metadata and version guard. |
| C10 | `TakeoffWorkstation.tsx`, measurement handlers around 2166, 2366, 2420, 3110, 3390; `actions.ts` around 245–345 | Stored value meanings; volume/freestyle already metric; heights/depths and pitch/waste treatment; recalibration implications. |
| C11 | `TakeoffWorkstation.tsx`, `handleApplyRoofAreaToComponent()` and `handleConfirmAreaAttach()`, approximately 2013–2076 | Derived attached-area entry has empty points and plan/basis snapshot; parent area is not unique source-polygon identity. |
| C12 | `app/lib/takeoff/useStateHistory.ts`; workstation `useStateHistory<TakeoffSnapshot>(2)` around 607 | Active state-only history and reconstruction architecture; avoid introducing the older canvas-JSON approach. |
| C13 | **Original** `ai-scan-v3/route.ts` around 1312; `scan-engine.ts`; `ai-prompt-v3.ts` | Original full roof-scan path did not actually populate detected calibration scale. |
| C14 | `outlineValidation.ts`, `outlineGeometry.ts`, `scanPostprocess.ts`, `scan-engine.ts`, `applyAiResults.ts` | Earlier geometry/shared-postprocessing corrections and deterministic AI-application integration to retain/retest. |
| C15 | `app/lib/takeoff/pointCost.ts` | Shared full-scan tier costs and prototype one-point calibration constant. |
| C16 | `IMPLEMENTATION_AUDIT_AND_SMART_CALIBRATION.md`; `AI_SCAN_V2_SMART_CALIBRATION_PLAN.md` | Prior implementation claims, reported focused tests, missing full-build context, recalibration/refund/fixture limitations and superseded recommendations. |

Archive fingerprints, SHA-256:

```text
qc-audit-takeoff-package.zip
  a274e25c9dec176ff316326ad271bf472ed41019a00d8bb49523a00d026cf80d

qc-audit-takeoff-package-improved.zip
  54d8cab01b3590b040fe5f709c36b6d2dfe8bf5f731e00f7ad9de775eda3787e
```

This handoff re-inspected the packaged source and the earlier audit documents. It did not run a production application build, exercise the user's database, call the vision model on their roof plans or establish live endpoint accuracy. Those are explicit implementation/release tasks above.

## Appendix B. Official technical references

Checked on 19 September 2026. These references support external platform behaviour, not the product-specific choices or proposed numerical acceptance targets.

**[E1] OpenAI — Images and vision.** Limitations include precise spatial localisation, small text and rotation; image-processing details are model-specific. Use the supported options for the actual configured model and validate them.

`https://developers.openai.com/api/docs/guides/images-vision`

**[E2] OpenAI — Structured model outputs.** Strict schemas require required fields with explicit null alternatives where appropriate, and response handling must account for refusals and incomplete output. A schema does not guarantee semantic truth.

`https://developers.openai.com/api/docs/guides/structured-outputs`

**[E3] Fabric.js — Transformations.** Distinguishes viewport, group and object transforms. Check the installed version when wiring scene/viewport APIs.

`https://www.fabricjs.com/docs/transformations/`

**[E4] Sharp — Image operations and input metadata.** Documents EXIF auto-orientation and that input metadata does not describe pending output transformations.

`https://sharp.pixelplumbing.com/api-operation/`

`https://sharp.pixelplumbing.com/api-input/`

**[E5] Supabase — JavaScript update.** Shows explicit returned `data`/`error` handling for update operations. Inspect and surface errors; a `try/catch` alone is not the demonstrated success check.

`https://supabase.com/docs/reference/javascript/update`

**[E6] Vercel — Functions limits.** Documents function payload limits; check the current deployment configuration as well as application-level validation.

`https://vercel.com/docs/functions/limitations`

**[E7] W3C WAI — Understanding target size (enhanced), SC 2.5.5.** Supports the 44 CSS-pixel enhanced target-size design choice, with the criterion's exceptions and conformance context.

`https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html`

---

**Final invariant:** AI proposes endpoint evidence. The human chooses one to three references and confirms their distances. The application averages only those normalised ratios, commits the result safely, and computes all dependent measurements deterministically. Longest-first helps the user find a good reference; it never overrides that choice.
