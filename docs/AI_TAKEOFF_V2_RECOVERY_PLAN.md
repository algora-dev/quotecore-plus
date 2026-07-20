# AI Takeoff V2 Recovery Plan

Status: Approved architecture, implementation pending  
Owner: Gavin  
Approved by: Shaun  
Date: 2026-07-20

## 1. Objective

Build a fast, reviewable two-stage roof takeoff flow:

1. **Scan 1 — Geometry:** produce a complete parent roof outline and a complete unclassified internal skeleton.
2. **User review:** show the exact outline, orange nodes, and orange skeleton segments that will be used downstream.
3. **Scan 2 — Meaning:** classify only the existing skeleton segments. It must not add, move, extend, split, merge, or reconnect geometry.
4. **Server accounting:** deterministically derive gable barges and spouting from the confirmed outline and classified ridge topology.

The system must always retain a manual path after Scan 1.

## 2. Non-Negotiable Product Rules

- Scan 1 must not report success with an incomplete outline.
- Every Scan 1 skeleton line must terminate at the roof outline or another skeleton line.
- V1 directions are horizontal, vertical, 45 degrees, and 135 degrees.
- Short supported diagonal connectors must not be omitted because they are shorter than surrounding lines.
- The review modal must show the exact skeleton sent to Scan 2.
- Scan 2 classifies segment IDs only and cannot alter geometry.
- Partial uncertainty must not cause total failure.
- Users can choose `Add Components (Manual)` after Scan 1.
- V1 remains available through a real runtime mode switch until V2 passes regression testing.

### Canonical Gable/Barge Rule

> When a horizontal or vertical ridge terminates at, or clearly projects to, a straight roof-outline face, that endpoint forms a gable T-junction. Classify the internal line as a ridge. The two roof-outline runs leaving the projected ridge endpoint in opposite directions, both perpendicular to the ridge, are gable barges that run until the next corner or obvious junction. They are not spouting. Do not require the ridge coordinate to touch the outline exactly when its axis clearly terminates at that face.

## 3. Confirmed Current Failures

- Combined outline and skeleton generation overloads Scan 1 and regresses outline accuracy.
- Complex Scan 1 used 6,122 prompt tokens and 5,685 completion/reasoning tokens and took about 1 minute 45 seconds.
- Orange skeleton data is stored client-side but is not passed to or rendered by the review modal.
- Scan 1 pixel-support validation is described but not implemented.
- Degree-one pruning can remove genuine partial geometry after a neighbouring line is missed.
- Scan 2 receives generic `PERIMETER` endpoint labels instead of convex, concave, or straight-face topology.
- Gable barges rely on a fixed 35px ridge-endpoint tolerance.
- Scan 1 is not persisted and Scan 2 persistence errors are ignored.
- V2 is hard-wired in the client; the documented feature flag does not exist.

## 4. Target Architecture

The user performs one Scan 1 action, but the server performs two specialised internal steps:

1. **Outline extraction:** deterministic filled-roof silhouette extraction, with outline-only GPT fallback when deterministic confidence is insufficient.
2. **Skeleton extraction:** a compact GPT-5.6 geometry-only call inside the validated outline.

This prevents skeleton complexity from damaging outline detection and removes unnecessary coordinate work from Scan 2.

### Source of Truth

- Vector JSON is authoritative.
- Original-overlay and clean-skeleton images are rendered views.
- Model output is never accepted without deterministic normalization and validation.

## 5. Phase 0 — Rollback, Diagnostics, and Persistence

### Deliverables

- Add `AI_TAKEOFF_MODE=v1|v2` and route the client through the selected mode.
- Keep `/api/takeoff/ai-scan` unchanged.
- Keep `/api/takeoff/ai-scan-v2` isolated until release gates pass.
- Add request IDs and timings for auth, image decode, outline extraction, skeleton preparation, model call, normalization, rendering, classification, perimeter accounting, and persistence.
- Log model, response ID, prompt tokens, completion tokens, dimensions, outline vertices, coverage, nodes, accepted segments, uncertain segments, rejected segments, and reasons.
- Persist normalized Scan 1 data before opening review.
- Check every database update result and return/log persistence errors.

### Gate

V1/V2 can be changed without reverting commits, and every test request can be reconstructed from stored vector data and logs.

## 6. Phase 1 — Deterministic Outline Spike

### Algorithm

1. Decode and auto-orient the plan.
2. Detect whether the image supports filled-roof segmentation by measuring the contrast between the dominant non-white roof mass and white background.
3. Build a roof-fill mask from luminance/color clusters rather than black line connectivity.
4. Remove thin exterior annotation and dimension tendrils using thickness-aware opening and connected-component filtering.
5. Select the dominant connected roof-fill region.
6. Fill internal holes caused by text, fixtures, ridges, valleys, and hatching.
7. Trace the outer contour.
8. Simplify the contour while preserving all genuine steps and re-entrant corners.
9. Snap V1 outer edges to horizontal or vertical when within tolerance.
10. Validate the resulting polygon.

### Validation

- Closed polygon with at least four vertices.
- No self-intersections.
- At least 98% coverage of the dominant roof-fill mask.
- Minimal spill into white background.
- Every detected roof-fill extremity is enclosed.
- Re-entrant corners and external steps survive simplification.
- Outline edges satisfy V1 orthogonal geometry.

### Fallback

If deterministic confidence is insufficient, call the proven outline-only GPT prompt. Validate its polygon against the same fill mask. Reject or repair any outline that leaves a connected roof-fill region outside.

### Gate

The complex and basic fixtures produce complete, stable outlines three consecutive times. Deterministic processing target: under 2 seconds.

## 7. Phase 2 — Skeleton-Only Scan 1 Model Call

### Inputs

After outline validation:

- Crop to the outline bounding box with padding.
- Mask everything outside the polygon.
- Send a high-detail original crop with the validated outline overlay.
- Send high-detail conservative linework masked to the same polygon.
- Supply the authoritative outline vertices and IDs in structured text.

### Output Contract

```text
internal_nodes[]:
  id
  area_index
  kind: internal_junction | straight_perimeter_point
  x
  y
  confidence

segments[]:
  id
  area_index
  start_node_id
  end_node_id
  confidence
  inferred

unresolved_geometry[]
notes[]
```

Perimeter vertices remain implicit IDs such as `a0v3`.

### Model Settings

- GPT-5.6.
- Start with low reasoning; move to medium only if the regression pack proves necessary.
- Start with a 3,500–4,000 completion-token cap.
- Do not include scale, pitch, outline generation, perimeter reconstruction, or component classification in this call.

### Revised Skeleton Prompt Requirements

```text
The roof outline supplied below is authoritative and complete. Do not redraw,
shorten, expand, or reinterpret it. Detect only the unclassified internal roof
skeleton inside that outline.

Trace the skeleton as one connected network. Start at every perimeter vertex
and straight-perimeter connection that has a solid inward stroke, then follow
that stroke to its next junction. At each internal junction, rotate around the
point and return every solid outgoing horizontal, vertical, 45-degree, or
135-degree stroke.

Short diagonal connectors are valid and important when both ends join other
roof lines. Do not omit them because they are shorter than surrounding hips or
valleys. Re-check congested central junctions for short missing diagonals.

Every segment must satisfy all three tests:
1. Visible stroke support in the original and linework images.
2. Both endpoints terminate at the outline or a shared returned junction.
3. Direction is horizontal, vertical, 45 degrees, or 135 degrees.

Do not classify segments. Do not return perimeter edges. Do not include text,
leaders, dimensions, dashed walls, fixtures, fill boundaries, or isolated marks.
Do not invent a segment merely because two nodes align.

Before returning, perform a node-degree audit and a top-to-bottom, left-to-right
completeness pass. Put uncertain supported geometry in unresolved_geometry;
never delete a supported line merely because an adjacent line is missing.
```

## 8. Phase 3 — Deterministic Skeleton Validation

### Validation Pipeline

1. Rebuild perimeter vertex nodes from the validated outline.
2. Classify each perimeter vertex as external/convex or internal/concave.
3. Snap straight-perimeter points to their owning outline edge.
4. Snap near-identical internal nodes together.
5. Snap segment directions to 0, 45, 90, or 135 degrees within tolerance.
6. Split segments at supported intersections.
7. Score each segment against masked linework using a corridor, not a one-pixel centerline.
8. Reject duplicates, zero-length geometry, outside-polygon geometry, impossible directions, and unsupported strokes.
9. Keep supported degree-one geometry as `uncertain`; do not cascade-delete it.
10. Audit every junction for unreturned supported spokes.

### Gate

The complex fixture contains every visible internal segment, including both short broken hips, with zero unsupported invented lines.

## 9. Phase 4 — Scan 1 Review UX

### Review Modal

- Render the validated blue outline.
- Render accepted skeleton segments in orange.
- Render accepted nodes as orange dots.
- Render uncertain segments with an orange dashed style and warning count.
- Add `Original + Skeleton` and `Clean Skeleton` toggle views.
- Show outline vertex, node, accepted-segment, uncertain-segment, and rejected-candidate counts.
- Keep area name and pitch fields.
- Keep buttons:
  - `Discard`
  - `Add Components (Manual)`
  - `Scan for Components (AI Assist)`
- Disable Scan 2 until the exact skeleton has rendered successfully.

### Gate

The skeleton displayed to the user is byte-for-byte equivalent in IDs and coordinates to the skeleton sent to Scan 2.

## 10. Phase 5 — Scan 2 Classification

### Structured Facts Per Segment

- Segment ID.
- Start and end coordinates.
- Endpoint topology: `external_corner`, `internal_corner`, `straight_perimeter_point`, or `internal_junction`.
- Direction and angle.
- Length.
- Pixel-support score.
- Connected segment IDs and their directions.

### Classification Contract

Scan 2 returns one result for every supplied segment ID:

```text
classification: ridge | hip | valley | broken_hip | broken_barge | reject | unresolved
confidence
reason_code
```

It cannot return coordinates or modify topology.

### Deterministic First Pass

- Diagonal from an external corner: hip candidate.
- Diagonal from an internal corner: valley candidate.
- Horizontal/vertical segment from an internal junction to a straight perimeter point: ridge/gable candidate.
- Internal diagonal between supported hip/valley junctions: broken-hip candidate.
- Impossible classifications are rejected server-side after GPT returns.

GPT classifies only ambiguous candidates where topology and image context do not decide the result.

## 11. Phase 6 — Gable, Barge, and Spouting Accounting

### Prompt Rule

Include the canonical gable/barge rule from Section 2 in Scan 2.

### Server Algorithm

For each classified horizontal or vertical ridge endpoint:

1. If it touches a straight perimeter face, create a gable T-junction there.
2. Otherwise project its axis forward to the nearest unobstructed perpendicular perimeter face.
3. Require directional alignment, compatible topology, and a scale-relative maximum projection distance.
4. Create the projected gable junction.
5. Split the perimeter at that junction.
6. Walk both directions along collinear/perpendicular-to-ridge perimeter runs.
7. Mark both runs as barges until the next corner or obvious roof junction.
8. Mark those intervals as covered so they cannot become spouting.
9. Build spouting only from the uncovered perimeter remainder.

Do not use the existing fixed 35px endpoint tolerance as the deciding rule.

### Gate

All three known complex-plan gables produce paired full-length barges and none of those barge intervals appear as spouting.

## 12. Phase 7 — Performance

- Cache processed source, fill mask, validated outline, masked crop, and linework between stages.
- Do not resend full-page whitespace to skeleton or classification calls.
- Keep Scan 1 skeleton output compact.
- Deterministically classify obvious Scan 2 segments and send only ambiguous segments to GPT.
- Record median and slowest timings across the regression pack.

Targets:

- Deterministic outline: under 2 seconds.
- Skeleton model call: 20–40 seconds.
- User-visible Scan 1 total: under 45 seconds.
- Scan 2: under 20 seconds, with 30 seconds temporarily acceptable if accuracy is correct.

## 13. Phase 8 — Regression and Release

Run every fixture at least three times.

### Required Results

- Complex outline complete and identical 3/3.
- Basic outline complete and identical 3/3.
- Orange overlay visible before Scan 2.
- Every visible internal component line represented in the skeleton.
- Both short broken hips present.
- Zero unsupported invented segments.
- All known ridge-to-gable endpoints generate paired barges.
- Barge intervals never duplicate spouting.
- No dangling-node hard failures.
- Manual path applies the roof area without running Scan 2.
- Scan 1 and final results persist successfully.
- V1 rollback mode verified.
- `npm run build` passes before push.

### Deployment Sequence

1. Implement and test Phase 0.
2. Implement the Phase 1 outline spike and stop for visual inspection.
3. Implement Phases 2–4 and stop for orange-skeleton inspection.
4. Implement Phases 5–6 and test classifications and perimeter accounting.
5. Complete performance and regression work.
6. Push to `development` and test there.
7. Do not merge to production without Shaun's approval.

## 14. Planned File Ownership

- `app/api/takeoff/ai-scan-v2/route.ts`: orchestration, timings, persistence, stage contracts.
- `app/lib/takeoff/ai-prompt-v2.ts`: skeleton-only and classification-only prompts/schemas.
- `app/lib/takeoff/v2Outline.ts`: deterministic mask, contour, simplification, coverage validation.
- `app/lib/takeoff/v2Geometry.ts`: normalization, topology facts, pixel support, completeness audit.
- `app/lib/takeoff/applyAiResults.ts`: projected gable junctions, barge intervals, spouting remainder.
- `app/(auth)/[workspaceSlug]/quotes/[id]/takeoff/modals/AiAreaReviewModal.tsx`: orange overlay and clean-skeleton toggle.
- `app/(auth)/[workspaceSlug]/quotes/[id]/takeoff/TakeoffWorkstation.tsx`: mode routing, Scan 1 state, manual/AI actions.
- Focused tests beside geometry/accounting utilities using fixed JSON/image fixtures.

## 15. Stop Conditions

- Stop after Phase 1 if deterministic contour coverage is not reliable; improve or use validated outline-only GPT fallback before proceeding.
- Stop after Phase 3 if the clean skeleton is incomplete. Scan 2 must never be used to compensate for missing geometry.
- After two failed focused fixes on the same defect, pause and re-plan rather than stacking prompt patches.
