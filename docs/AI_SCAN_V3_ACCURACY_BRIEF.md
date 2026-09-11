# AI Takeoff V3 - Accuracy Improvement Brief

**Author:** Gavin (audit on GLM 5.3, 2026-09-11)
**Status:** IMPLEMENTED 2026-09-11 (post Astra review). See 'Implementation log' at bottom.
**Goal:** Fix misclassifications (valleys/hips on non-45 degree lines, dotted-line confusion) in the deterministic rules layer so accuracy improves for ALL model tiers, then route medium/complex scans to GPT-6 Astra low.

## Context

Pipeline: 3 scans. Scan 1 = outline polygon. Scan 2 = internal line segments (deterministic angle-snap + connectivity filter). Scan 3 = classification (ridge/hip/valley/barge/spouting/broken_hip/broken_barge/uncertain), followed by two deterministic passes: `enforceHipValleyVertexRule` (outlineGeometry.ts) and `perimeterAccountingPass` (applyAiResults.ts).

Current model routing (deployed 2026-09-11): low = gpt-5.6-luna, medium = gpt-6-astra (low effort), high = gpt-6-astra (high effort).

## Observed defects (from Shaun's live tests, 2026-09-11)

1. **Valleys assigned to horizontal/vertical lines.** Happened on BOTH gpt-5.6-luna and gpt-6-astra (low AND high) on the same plan. This proves it is a rules-layer gap, not a model-intelligence gap.
2. **Dotted/dashed plan lines sometimes traced as components** or treated as line-terminating intersections.

## Audit findings (root causes)

### F1. No 45-degree rule exists in code at all
`enforceHipValleyVertexRule` only checks: does the line's endpoint sit on a convex (hip) / concave (valley) outline vertex? It NEVER checks line orientation. A line at 0 or 90 degrees whose endpoint happens to land on a concave vertex passes as a valley. The scan 3 prompt mentions angle only as "supporting evidence". So the "45 degree rule" Shaun expects is not actually implemented anywhere - the belief that it exists is wrong. THIS is the primary bug.

### F2. Hip/valley orientation must be measured RELATIVE to the roof, not the image
Plans are often rotated/skewed. The correct reference frame is the dominant axis of the roof itself: derived from the outline edges (e.g. the longest outline edge direction = local "0 degrees"). Hips/valleys must sit within tolerance of +/-45 degrees from that axis. Absolute image angles would break on rotated plans.

### F3. Dotted lines are only guarded by prompt text
Scan 2 prompt says to ignore dotted/dashed lines, but there is no deterministic check. Coordinates alone cannot prove a stroke was dotted, so this cannot be fully solved in code - but two real mitigations exist:
- Connectivity validation already drops "floating" lines that touch neither the outline nor another endpoint. Dotted annotation lines usually violate this - verify the tolerance (currently 10px) is not too permissive.
- Dotted lines that were traced often become spurious junction points splitting solid lines. Prompt can be hardened: "a dotted line crossing a solid line is NOT a junction; continue the solid line through it" (partially present, needs strengthening).
- Scan 3 could receive a "suspicion" flag for lines whose endpoints touch no other line endpoint and no outline vertex (orphans) and reject them instead of classifying them.

### F4. Angle-snap after scan 2 can amplify F1
`filterAngleValid` snaps lines within 5 degrees of 0/45/90/135 to exact angles (keeps all others as-is). This is good, but it means h/v lines exist in the pool that scan 3 may mislabel as valleys. An angle gate after classification would catch these deterministically.

### F5. Minor: uncertain fallback asymmetry
Lines with no vertex match classified as hip/valley become 'uncertain' - correct. But a true hip/valley whose vertex snap failed (vertex tolerance 15px in matchEndpointsToVertices) also becomes uncertain. Consider re-snapping with a larger tolerance before demoting.

## Proposed implementation

### P1. Hip/valley angle gate (fixes defect 1) - outlineGeometry.ts + route.ts
After `enforceHipValleyVertexRule`, add `enforceHipValleyAngleRule`:
1. Compute the roof's dominant axis: take the longest outline edge direction; fold all outline edge directions into 0-90 degree canonical range weighted by length; pick the dominant bucket. (Simple robust version: use the longest edge.)
2. For every line classified hip or valley: compute its orientation relative to the dominant axis, normalized to 0-90.
3. If not within tolerance of 45 degrees (tolerance = 12 degrees, configurable constant), reclassify:
   - If the line's endpoint matched a valid vertex: keep the vertex rule (convex=hip/concave=valley) ONLY if the angle test passes; otherwise reclassify to 'ridge' if it connects into the ridge network, else 'uncertain'.
   - Log every correction (line id, angle, from, to) like existing enforcement corrections.
4. Both directions covered automatically by normalizing to 0-90 (X-shape: both diagonals are 45 in canonical form).

### P2. Prompt updates - ai-prompt-v3.ts
- Scan 2: strengthen dotted-line clause: "Dotted or dashed lines NEVER form junctions. If a dotted line crosses or meets a solid line, the solid line is unaffected - keep tracing it through. Never return a dotted/dashed line as a segment."
- Scan 3: add angle rule to the prompt as supporting evidence: "Hips and valleys almost always run diagonally at roughly 45 degrees to the roof's main axis. A horizontal or vertical line (relative to the roof) is never a hip or valley."

### P3. Orphan rejection (mitigates defect 2) - route.ts scan 3 postprocess
Lines whose endpoints (within 15px) touch neither the outline, nor any other line endpoint/junction, AND are shorter than a minimum length (e.g. 30px) → drop from classification entirely (they survive today as 'uncertain' entries or misclassifications). Keep a console log of dropped ids.

### P4. Model routing (already deployed) + point costs - route.ts
- Keep: low = 5.6-luna, medium = 6-astra low.
- Decision pending Shaun: high = 6-astra low (cheap) vs 6-astra high ($0.75/scan, 3 min). If Astra high is kept, POINT_COST for high must rise materially (currently low=2/medium=4/high=8; suggested high=16-20 given ~5x real cost of medium) - final numbers on implementation.
- Rework POINT_COST after Shaun picks the tier line-up.

### P5. Verification
- Re-run Shaun's two test plans (the "1" quote scans) at low and medium, compare before/after classification counts and the specific lines Shaun flagged as wrong.
- Add a smoke-test checklist line.
- Unit-style spot check script for the new angle gate using synthetic polygons (rotated rectangle + concave L-shape) to prove rotation-invariance.

## Out of scope (parked)
- Outline completeness on complex roofs (separate workstream, still the known V3 weakness).
- Barge detection misses at some gable ends.
- Any UI changes.

## Implementation log (2026-09-11)

Implemented with Astra's review amendments folded in:
- P1 angle gate implemented as `enforceHipValleyAngleRule` (corner-relative, both incident edges, 12 deg tolerance, demote-to-uncertain only, never relabel).
- Angle failures + floating (unconnected) lines demote to 'uncertain' - never auto-relabel to ridge, never silently dropped.
- Uncertain components now render as loud pink dashed lines (was faint slate grey) and the results modal shows a callout: 'N uncertain components - check, delete wrong ones, add correct component manually'.
- Scan 2 prompt hardened: dotted/dashed lines are never junctions or breakpoints; scan 3 prompt adds the diagonal-45 prior.
- Models: low = gpt-5.6-luna, medium + high = gpt-6-astra (all low reasoning per Shaun 2026-09-11).
- POINT_COST: low=2, medium=6, high=10 (was 2/4/8). Worst case cost per plan period stays under ~10% of subscription revenue.
- Astra review findings 1-5 incorporated; findings 6-9 (tolerance scaling, raster ink sampling, full test harness) parked as follow-ups.

- app/lib/takeoff/outlineGeometry.ts (P1 gate function)
- app/api/takeoff/ai-scan-v3/route.ts (P1 wiring, P3 orphan drop, P4 costs)
- app/lib/takeoff/ai-prompt-v3.ts (P2 prompt text)
- docs/smoke-tests/CHECKLIST.md (P5)
