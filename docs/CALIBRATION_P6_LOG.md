# Phase P6 — Live desktop calibration integration

Status: complete (code + unit tests + build; live-provider/E2E smoke deferred to P7 per spec)

Changed files:
- `app/lib/takeoff/calibrationApiClientCore.ts` (new): client-safe PURE core of the API client. Request/response contracts mirroring the route; `classifyCalibrationHttpFailure` (4xx terminal unless 401/429; 5xx/network recoverable; terminal-technical flag for linked retry; specific copy for 402 quota / 409 rescan refusal); `parseCalibrationSearchResponse` structural validation (≤3 candidates, finite coords, crop kind/dataUri checks, ≤600px contract documented); `mapCandidatesToClientFrame` (uniform server-source → workstation-scene scale with a 1% aspect guard that fails honestly on anisotropic mismatch; recomputes `scenePixelLength`; re-stamps the client session `imageRevision` for the reducer frame guard while preserving the server `referenceId` verbatim for cross-round identity); `evidenceCropsForDisplay`.
- `app/(auth)/.../takeoff/calibration/calibrationApiClient.ts` (new): thin fetch wrapper. `newCalibrationRequestId()` (crypto.randomUUID), POST `/api/takeoff/calibration` with AbortSignal, typed `CalibrationApiError` with classification; malformed 200 bodies treated as terminal technical failures.
- `app/(auth)/.../takeoff/calibration/useCalibrationController.ts` (rewritten): mock provider REMOVED; live lifecycle. Composes request bodies from reducer state (round, strategy, roundToken from last round-0 success, `excludeReferenceIds` = every physical reference skipped this session per spec 7.2, `refineReferenceIds` from the new `refineReferenceId` state field); `SEARCH_SUCCEEDED` still validated by the reducer's full context guard; response mapped into the client frame before dispatch; server `imageRevision` stability enforced across responses (mismatch → `IMAGE_REVISION_CHANGED`); replay-safe retry per 12.4: recoverable failure arms a retry with the SAME `requestId` (`retrySearch()`); a fresh `REQUEST_RESCAN` clears the armed retry so only network recovery of the same attempt reuses its id; terminal 5xx classification exposes `terminalTechnical` (linked new-requestId retry remains available per spec if product wants it — not surfaced as a UI button for policy failures). Exposes `lastSearch` (status/notes for empty vs unsuitable copy) and `lastFailure`.
- `app/lib/takeoff/calibrationSession.ts`: additive `refineReferenceId` on state + optional field on `REQUEST_RESCAN` (strategy `refine_reference` carries the active skipped candidate's physical reference id). No existing behaviour changed; all prior tests pass unmodified.
- `app/api/takeoff/calibration/route.ts`: minimal P6 extension — for non-empty results, attaches real evidence crops (endpoint-A, endpoint-B, label-centre close-ups) generated ON DEMAND from the same immutable source object via sharp (EXIF-oriented once, 320px native crops, resized ≤600px longest edge, JPEG q80, base64 data-URIs; ≤9 crops keeps payload ≈300KB ≪ 2MB) and returns `sourceWidth`/`sourceHeight` (oriented source dims) the client needs for frame mapping. Crop-generation failure degrades to no crops — a charged successful search is never failed retroactively. Security posture unchanged (auth → company→quote→page ownership → flag → revision → token → points → provider); data-URIs are generated server-side from the company's own storage object, never from client input.
- `app/(auth)/.../takeoff/calibration/CalibrationReviewPanel.tsx`: live wiring (no mock provider import). Cost copy ("Each search uses 1 AI Assist point"). Empty vs unsuitable vs error states per spec 4.6: unsuitable uses the server's `suitabilityReason` plus top-down/crop guidance (manual not framed as a cure); empty shows the suggested copy + one remaining rescan + manual fallback; recoverable failures offer Retry (same requestId) and terminal/policy failures offer manual fallback; 409 `REQUEST_CONFLICT` surfaces "No more searches — accept a measurement or calibrate manually". Rescan UX per spec 7: "Search again — N remaining" (find-different, disabled at 0 remaining or 3 accepted; hidden entirely at 3 accepted) and "Improve these points" on the active skipped candidate (refine of that reference). Both consume the same single round-1 authorisation via roundToken. Local/unsaved pages (no server page id) get an honest unavailable panel with manual fallback instead of a doomed API call.
- `app/(auth)/.../takeoff/calibration/CalibrationEvidenceZoom.tsx`: renders the REAL server crops (Start point / End point / Label); mock copy removed; honest fallback when a candidate has no crops.
- `app/(auth)/.../takeoff/calibration/mockCalibrationCandidates.ts`: DELETED (no remaining importers).
- `app/(auth)/.../takeoff/TakeoffWorkstation.tsx`: review panel stays MOUNTED but hidden (`hidden` wrapper) once opened until commit / switch-to-manual — closing (Cancel) and reopening within the session preserves decisions, accepted set and the rescan budget (spec 7.1/7.2). Chooser auto-pop, "Calibrate manually" path and flag-off behaviour are unchanged (flag off renders nothing, byte-identical existing flow).
- `app/(auth)/.../takeoff/actions.ts`: deferred P4 item — `source_geometry_id` is now preserved on EVERY `entry_inputs` branch (live-basis, legacy `pitch_applied`, plain), not only the live-basis branch, so attached entries keep their durable source-polygon link for hydration/recompute even without a plan_value snapshot. Minimal diff, no behaviour change for existing branches.
- `app/lib/takeoff/calibrationTypes.ts`: additive `CalibrationEvidenceCrop` type + optional `evidence.crops`.

Tests: `app/lib/takeoff/calibrationApiClientCore.test.ts` (new): 12 pure tests — failure classification matrix (network/401/429 recoverable; 403/402/409 terminal with specific copy; 502 recoverable+terminal-technical), response parsing accept/reject, frame mapping (uniform scale, aspect-mismatch rejection, revision stamping, evidence preservation), display-crop labelling.

Requirements covered: P6 tasks 1-6 (authenticated search wiring, accepted-reference retention + slot limits via the reducer's existing `slots` logic, request/context guards, explicit cost + one-rescan UX, empty/failure states), spec 4.6, 7.1-7.3, 12.4 retry semantics, landing-flow polish.

Validation actually run:
- `npm run test:calibration` — 118 pass, 0 fail (106 pre-existing + 12 new).
- `npx eslint` on all new/changed calibration files — clean. actions.ts/TakeoffWorkstation.tsx pre-existing issues (unused `revalidatePath`/`profile`, legacy `any` warnings) untouched by the changed lines.
- `npm run build` — passed (one fix: readonly `crops` typing).
- Em-dash scan on new/changed files — clean.

Route payload additions (supersets of P5, all additive):
- Response now includes `sourceWidth`, `sourceHeight` (number|null) and each candidate's `evidence.crops` (`[{kind: 'endpoint-a'|'endpoint-b'|'label', dataUri}]`). No new request fields are REQUIRED; the client sends optional `requestId` (ignored server-side today, recorded for future ledger), `retryOf` (same).

Security notes:
- No new client-supplied trust: crop coordinates come from server-normalised candidates; crops are cut from the server-resolved storage object only.
- Known limitation carried from P5 (documented in route/vision comments): without a persistent request ledger, replayed requestIds cannot be detected and the round token is the only server-side rescan bound. The client honours 12.4 (same-requestId recovery; fresh rescan clears the retry arm) but server enforcement of attempt/rate limits beyond the token remains a ledger concern.

Known limitations / honest notes:
- Client-scene mapping assumes the workstation background is the same raster under a UNIFORM scale (true today: MAX_CANVAS_DIM 2000 uniform cap); an anisotropic canvas fails honestly (`anisotropic_frame_mismatch`) rather than stretching points.
- `imageRevision` on mapped candidates is the client session key; the authoritative server revision is consistency-checked across responses by the controller and is independently stamped into `takeoff_pages.image_revision` at save (P4 mechanism).
- Switching to manual still ends the AI review session (accepted-draft carry-over into the manual modal remains unimplemented, as in P2).
- Live end-to-end (real model, real storage, quota exhaustion, page-switch mid-search, simultaneous tabs) NOT run here — belongs to P7.

Remaining for P7:
- Controlled live fixture smoke of the full route (real key + labelled images incl. negatives/ambiguous/OCR-correction), endpoint/scale metrics vs fixtures.
- Full-repo lint/typecheck sweep, browser/E2E matrix (lost-response recovery, accepted + failed/empty rescan, page switch mid-search, simultaneous tabs, points exhaustion with manual fallback), saved-reload state verification, billing reconciliation, log-privacy check.
- Optional: dedicated `CALIBRATION_TOKEN_SECRET`; decision on whether terminal-technical (5xx) linked-retry should surface as a UI affordance.
- Then small controlled cohort flag enablement with manual always available.

No commit or push performed (working tree left uncommitted with prior phases, as instructed).
