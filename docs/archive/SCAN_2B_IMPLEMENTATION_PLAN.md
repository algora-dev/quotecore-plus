# Scan 2B Missing-Line Audit - Implementation Plan

Status: Ready for implementation after Shaun's explicit go-ahead.

- Planning model: GPT-5.6
- Implementation model: GLM 5.2
- Target branch: `development`

## Goal

Add a lightweight visual audit after existing internal-line detection so the model can fill solid roof-line gaps before Scan 3 classification.

```text
Scan 1 outline
-> Scan 2A internal-line detection
-> render thin Scan 2A audit overlay
-> Scan 2B missing-line audit
-> validate, snap, split, and deduplicate
-> assign final line IDs
-> Scan 3 classification
```

Keep the browser's three visible stages. Scan 2A and Scan 2B run inside the existing backend `scan2` request.

## Current-Code Constraints

- Live route: `app/api/takeoff/ai-scan-v3/route.ts`.
- Browser orchestration: `TakeoffWorkstation.tsx` calls `scan1`, `scan2`, then `scan3`.
- Lines use transient `L1...Ln` IDs. There are no individual database segment rows.
- Intermediate and final results are JSON snapshots in `takeoff_pages.ai_scan_result`.
- Scan 3 already renders annotated and clean overlays from the supplied line list.
- Images are normalized to an analysis image capped at 2000 pixels. Keep all 2A/2B geometry in this coordinate system until canvas scaling.

## Files

Modify:

- `app/lib/takeoff/ai-prompt-v3.ts`
- `app/lib/takeoff/scanOverlay.ts`
- `app/api/takeoff/ai-scan-v3/route.ts`
- `app/(auth)/[workspaceSlug]/quotes/[id]/takeoff/TakeoffWorkstation.tsx`

Add:

- `app/lib/takeoff/scan2AuditGeometry.ts`

Do not substantially modify Scan 1 or Scan 3 classification logic.

## 1. Scan 2A Contract

Keep the existing Scan 2 prompt and processing behavior for the first build. Rename internal comments, timers, and logs to Scan 2A where useful.

Add this visibility contract to the Scan 2A prompt/context:

> Render Scan 2A detected segments as thin, high-contrast coloured lines.
>
> The coloured overlay must not fully obscure the original black source stroke. Scan 2B must be able to distinguish:
>
> - black source line already traced by a coloured overlay;
> - black source line still uncovered and therefore potentially missing.
>
> Use a stroke width that remains visually thinner than the source line where possible.

The renderer enforces this rule; the prompt documents the downstream visual-audit contract.

Before Scan 2B, log Scan 2A raw, angle-rejected, floating, and accepted counts plus coordinates. Do not alter Scan 2A's current hard angle/connectivity filtering in this first build. Scan 2B audits accepted output and can recover model omissions or post-processing losses.

## 2. Audit Overlay

Add `renderScan2AuditOverlay()` to `scanOverlay.ts`.

- Original normalized plan as background.
- Existing blue outline, no fill.
- Accepted Scan 2A lines in cyan or magenta.
- Initial internal stroke width: 2 pixels.
- Keep the coloured stroke narrower than the black source stroke where possible.
- Round line caps.
- No IDs, labels, endpoint circles, component colours, or classifications.

The visual must distinguish a traced black line with a coloured centreline from a fully uncovered black path.

## 3. Scan 2B Prompt and Schema

Add `buildV3MissingLineAuditPrompt()` and `V3_SCAN2B_SCHEMA`.

Use strict structured output with matching prompt/schema:

```json
{
  missing_segments: [
    {
      start: { x: 100, y: 200 },
      end: { x: 150, y: 250 }
    }
  ]
}
```

No additional properties. Each entry contains only `start` and `end`; each point contains integer `x` and `y`.

Inputs, in order:

1. Original normalized plan.
2. Scan 2A audit overlay.
3. Confirmed outline coordinates.
4. Accepted Scan 2A segment table with temporary IDs.
5. Analysis width and height.

Prompt requirements:

- Return only solid dark source segments absent from the coloured overlay.
- Never return the complete existing set.
- Black visible beside a thin coloured overlay is already traced when the coloured centreline follows the same path.
- A black centreline/path with no coloured coverage is potentially missing.
- Inspect short connectors between existing junctions and uncovered branches.
- Existing endpoint coordinates do not prove an edge exists between them.
- Split at every solid-line endpoint or junction; never pass through a junction.
- Ignore dotted/dashed lines, text, and dimensions.
- Never return perimeter edges or infer invisible geometry.
- Generate no IDs, notes, confidence values, or classifications.
- Return an empty `missing_segments` array when nothing is missing.

Use low reasoning effort, a small output allowance, and a 60-second request timeout.

## 4. Validation and Merge

Implement pure helpers in `scan2AuditGeometry.ts` with one exported configuration object.

Initial thresholds:

- minimum length: 5 pixels;
- endpoint snap: 4-8 pixels scaled by analysis-image size;
- canonical-angle snap: 5 degrees;
- collinear angle tolerance: 5 degrees;
- perpendicular tolerance: half the endpoint snap, minimum 2 pixels;
- substantial overlap: 80% of candidate projected length;
- bounds clamp allowance: 2 pixels.

Candidate processing order:

1. Validate each candidate independently.
2. Require finite numeric coordinates and round to integers.
3. Clamp only 1-2 pixel overflow; reject farther-out coordinates.
4. Reject zero-length and under-5-pixel segments.
5. Snap lines near 0/45/90/135 degrees; preserve valid non-canonical angles.
6. Snap endpoints to existing endpoints within tolerance.
7. If needed, snap to a nearby point on an existing segment representing a junction.
8. Split at existing intermediate junctions; never merge through one.
9. Canonicalize endpoint order.
10. Reject exact and reversed duplicates.
11. Reject substantially covered collinear candidates.
12. Reject candidates substantially overlapping the perimeter.
13. Accept a connector between existing junctions when no existing edge joins them.

Never reject solely because both endpoints already exist. Record the original candidate and a machine-readable rejection reason such as `malformed`, `non_finite_coordinate`, `out_of_bounds`, `too_short`, `duplicate`, `reversed_duplicate`, `covered_collinear_overlap`, `perimeter_overlap`, or `invalid_after_snap`.

## 5. Final IDs and Scan 3

- Keep Scan 2A lines first in current order.
- Append accepted Scan 2B atomic lines in deterministic response order.
- Assign final sequential `L1...Ln` IDs once, after merge.
- If 2B adds nothing or fails, preserve current 2A ID ordering.
- Do not expose 2A/2B provenance to Scan 3.
- Return the merged canvas-coordinate list through the existing Scan 2 response.
- Let Scan 3 render its existing final annotated and clean overlays and classify all lines identically.

Only update Scan 3 comments/prompt wording where it implies every line came from one model pass.

## 6. Failure Handling

Scan 2B is best-effort. On timeout, API error, empty output, schema/JSON failure, invalid-only output, overlay failure, or merge exception:

- log `scan2b_failed` with request ID and error;
- record debug status `failed`;
- return successful Scan 2A-only output;
- continue to Scan 3 normally;
- do not record the entire scan as failed in route-level usage logging.

## 7. Debug Data

Carry a compact `scan2Debug` object from Scan 2 into the Scan 3 request and final `ai_scan_result` JSON:

```text
scan2a.raw_count
scan2a.accepted_count
scan2a.angle_rejected_count
scan2a.floating_count
scan2b.status
scan2b.raw_json
scan2b.raw_candidate_count
scan2b.accepted_count
scan2b.rejected_candidates[]
scan2b.error
final_merged_count
```

Do not store base64 images in the database. Under `AI_TAKEOFF_DEBUG_ARTIFACTS=true`, include audit/final overlay data URLs in debug-only API output. Normal production logs contain request IDs, dimensions, byte sizes/hashes, coordinates, counts, and rejection reasons.

No database migration or new storage bucket is needed for the first build.

## 8. Browser Copy

Keep `outline | lines | classify`. Change the `lines` status to:

```text
Detecting and auditing roof lines...
```

Add no extra user modal or confirmation step.

## 9. Validation Cases

1. Reject exact duplicate.
2. Reject reversed duplicate.
3. Snap near endpoints, then reject resulting duplicate.
4. Reject covered collinear candidate.
5. Accept a missing connector between existing junctions.
6. Split a candidate at an intermediate junction.
7. Preserve a valid non-canonical angle.
8. Reject malformed entry without losing valid siblings.
9. Clamp 1-2 pixel bounds overflow.
10. Reject larger bounds overflow.
11. Reject a perimeter edge.
12. Fall back successfully on 2B timeout/error.
13. Preserve IDs when 2B accepts nothing.
14. Include accepted 2B lines and IDs in Scan 3's table.

## 10. End-to-End Acceptance

Use a known failing roof where Scan 2A finds two junctions but misses a short dark connector.

Expected:

- Audit overlay leaves the connector uncovered.
- Scan 2B returns only that connector.
- Backend snaps it to the existing junctions.
- It is accepted because no current edge joins those points.
- Final combined overlay includes it with an `L` ID.
- Scan 3 classifies it, commonly as `broken_hip`.
- Debug data records raw/accepted 2B counts and decisions.
- Forced 2B failure still completes Scan 3 using 2A lines.

## Completion Checklist

- [ ] Scan 2A context includes the thin-overlay visibility contract.
- [ ] Dedicated marker-free audit overlay exists.
- [ ] Scan 2B prompt and strict schema agree.
- [ ] Scan 2B runs inside existing backend `scan2`.
- [ ] Validation is per-entry and deterministic.
- [ ] Snapping and overlap thresholds are configurable.
- [ ] Existing-junction connectors are handled correctly.
- [ ] Final IDs are assigned after merge.
- [ ] 2B failure falls back to 2A.
- [ ] Scan 3 receives only merged geometry.
- [ ] Debug candidates and rejection reasons are retained.
- [ ] Debug images are gated and not stored in the database.
- [ ] UI copy is updated.
- [ ] Focused validation cases pass.
- [ ] `npm run lint` passes for changed files.
- [ ] `npm run build` passes.
- [ ] Known failing roof passes end-to-end acceptance.

## Non-Goals

- No Scan 1 rewrite.
- No Scan 3 taxonomy change.
- No permanent segment database rows.
- No debug-image storage migration in the first build.
- No source-stage information sent to classification.
- No full-job failure caused by Scan 2B.
