/**
 * AI Takeoff V2 prompts — skeleton-only approach (Recovery Plan).
 *
 * Scan 1 = Geometry:
 *   1. Deterministic outline extraction (v2Outline.ts) — no GPT
 *   2. Skeleton-only GPT call inside validated outline — nodes + segments only
 *
 * Scan 2 = Classification:
 *   Classify each existing segment only; never create/move/extend geometry.
 */

// ── Scan 1 Step 2: Skeleton-Only GPT Call ───────────────────────────────

export function buildV2SkeletonPrompt(params: {
  width: number;
  height: number;
  outlineVertices: Array<{ x: number; y: number }>;
  outlineVertexIds: string[];
}): string {
  const { width, height, outlineVertices, outlineVertexIds } = params;

  // Build outline vertex reference text
  const vertexList = outlineVertices.map((v, i) => `${outlineVertexIds[i]}: (${v.x}, ${v.y})`).join(', ');

  return `You are an expert roofing-plan geometry analyst. You are given:

1. MASKED ORIGINAL PLAN — the original roof plan cropped to the outline bounding box, with everything outside the validated roof outline masked to white. Dimensions: ${width}×${height} pixels.
2. MASKED LINEWORK — a high-contrast extraction of the same cropped region.

The roof outline is AUTHORITATIVE and COMPLETE. It has already been deterministically extracted. Do NOT redraw, trace, simplify, or modify the outline. Do NOT return outline edges as skeleton segments.

## AUTHORITATIVE OUTLINE VERTICES
${vertexList}

These vertices are implicit perimeter nodes. Use their IDs when a skeleton segment terminates at the outline. You may also create 'perimeter_point' nodes where an internal stroke meets the MIDDLE of a straight outline edge (not at a vertex).

## YOUR ONLY TASK
Detect the unclassified internal roof skeleton inside the validated outline. Trace every clearly visible internal stroke that represents roof structure.

### REQUIRED EVIDENCE TESTS
Include a segment only when ALL THREE tests pass:
1. VISIBLE STROKE SUPPORT — A continuous solid line is visible along the proposed path in the masked original plan and is supported by the masked linework image.
2. VALID CONNECTIVITY — Both ends terminate at: an outline vertex from the list above, a 'perimeter_point' on a straight outline edge, or a shared internal junction where another accepted segment visibly meets.
3. VALID V1 DIRECTION — The segment is horizontal, vertical, or approximately 45°/135° diagonal.

### SKELETON CONSTRUCTION RULES
- Create one node for each true shared internal junction. Reuse its exact ID and coordinates for every connected segment.
- Split a visible stroke at each real junction or intersection.
- Every internal junction must connect at least two returned segments.
- Do not return isolated points.
- Do not return perimeter outline edges as skeleton segments.
- Do not classify segments (no ridge/hip/valley/barge/spouting labels).
- Do not infer a missing connection merely because two nodes align.
- Short diagonal connectors are valid and important when both ends join other roof lines. Do not omit them because they are shorter than surrounding hips or valleys.
- Re-check congested central junctions for short missing diagonals.

### NOISE REJECTION
Reject strokes belonging to: text, labels, leader lines, dimensions, extension lines, arrows, dashed wall lines, grids, hatching, borders, skylights, chimneys, vents, fixtures, decorative marks, logos, page furniture.

### SELF-CHECK
Before returning, verify:
1. Every segment has two distinct node endpoints.
2. Every node ID referenced by a segment exists in the nodes array or in the outline vertex list above.
3. No segment is duplicated or overlaps another returned segment.
4. Every internal junction has degree at least 2.
5. No unsupported geometry was introduced.
6. Put uncertain suspected strokes in unresolved_geometry instead of fabricating them.

Return only the structured JSON required by the schema.`;
}

// ── Scan 2: Classify Existing Segments Only ─────────────────────────────

export function buildV2Scan2Prompt(params: {
  width: number;
  height: number;
  segmentTable: string;
}): string {
  return `You are an expert roofing-plan component classifier. Geometry has already been detected and confirmed. Your only task is to classify the supplied existing skeleton segments.

Three aligned sources are provided:
1. ANNOTATED ORIGINAL — the original roof plan with the confirmed outline, nodes and numbered segment overlay.
2. CLEAN SKELETON — only the confirmed outline, nodes and numbered unclassified segments on white.
3. STRUCTURED SEGMENT TABLE — authoritative node coordinates, endpoint topology, direction, angle and pixel-support facts for every segment.

The clean skeleton and structured table are the geometry master. Use the original plan only to understand what an existing segment represents and to reject non-roof marks.

## STRUCTURED SEGMENT TABLE
${params.segmentTable}

## ABSOLUTE CONSTRAINTS
- Classify every supplied segment_id exactly once.
- Do not add segments, nodes or coordinates.
- Do not move, extend, shorten, split, merge or reconnect any segment.
- Do not invent a component that is absent from the supplied skeleton.
- If geometry is ambiguous, return unresolved.
- If an existing segment is not a roof component, return reject.
- Do not classify perimeter outline edges — they are not in the segment table.

## CLASSIFICATION FACTORS (use all three)
1. ENDPOINT TOPOLOGY — What kind of node does each end connect to? (external_corner/convex, internal_corner/concave, straight_perimeter_point, internal_junction)
2. DIRECTION CONNECTIVITY — Is the segment horizontal, vertical, or 45° diagonal? What does it connect to?
3. VISIBLE PLAN CONTEXT — What does the original plan show at this location?

A single factor is insufficient when the other factors contradict it.

## COMPONENT RULES

### RIDGE
- Usually horizontal or vertical in this V1 plan set.
- Connects two internal roof junctions, or an internal junction to a supported point on a straight perimeter face at a gable end.
- Must form part of the connected roof skeleton.
- Must not be an isolated short internal mark.

### HIP
- Diagonal segment beginning at an EXTERNAL/CONVEX perimeter corner.
- Runs inward to a shared internal junction or ridge endpoint.
- Cannot be a hip if neither endpoint is an external perimeter corner.

### VALLEY
- Diagonal segment beginning at an INTERNAL/CONCAVE re-entrant perimeter corner.
- Runs inward to a shared internal junction or ridge endpoint.
- Cannot be a valley if neither endpoint is an internal perimeter corner.

### BROKEN_HIP
- Diagonal internal segment joining supported internal junctions.
- Does not touch the roof perimeter.
- Branches from or continues a genuine hip/valley junction.
- Reject if isolated, unsupported or merely aligned with other geometry.

### BROKEN_BARGE
- A clearly visible internal gable-edge segment, not a roof-perimeter edge.
- Runs perpendicular to its connected ridge and belongs to a supported gable structure.
- Reject when ridge connectivity or original-plan evidence is absent.

### REJECT
Use reject for a supplied candidate that the original plan shows is text, a leader, dimension, dashed wall, fixture, fill boundary, decorative mark or other non-roof geometry.

### UNRESOLVED
Use unresolved only when the supplied geometry is genuine but the component type cannot be selected reliably from the three factors. Do not guess to make the graph look complete.

## CANONICAL GABLE/BARGE RULE
When a horizontal or vertical ridge terminates at, or clearly projects to, a straight roof-outline face, that endpoint forms a gable T-junction. Classify the internal line as a ridge. The two roof-outline runs leaving the projected ridge endpoint in opposite directions, both perpendicular to the ridge, are gable barges that run until the next corner or obvious junction. They are not spouting. Do not require the ridge coordinate to touch the outline exactly when its axis clearly terminates at that face.

## GLOBAL CONSISTENCY CHECK
After classifying individually, inspect the complete network:
- Hips must originate at convex perimeter corners.
- Valleys must originate at concave perimeter corners.
- Ridges must connect meaningfully at both ends.
- Broken hips must belong to an existing hip/valley junction.
- Fix any single misclassification that violates these rules.

Return only the structured JSON required by the schema.`;
}

// ── V2 Schemas ──────────────────────────────────────────────────────────

const pointSchema = {
  type: 'object' as const,
  properties: {
    x: { type: 'integer' as const },
    y: { type: 'integer' as const },
  },
  required: ['x', 'y'] as const,
  additionalProperties: false,
};

const skeletonNodeSchema = {
  type: 'object' as const,
  properties: {
    id: { type: 'string' as const },
    area_index: { type: 'integer' as const },
    kind: {
      type: 'string' as const,
      enum: ['junction', 'perimeter_point'] as const,
    },
    x: { type: 'integer' as const },
    y: { type: 'integer' as const },
    confidence: { type: 'number' as const },
  },
  required: ['id', 'area_index', 'kind', 'x', 'y', 'confidence'] as const,
  additionalProperties: false,
};

const skeletonSegmentSchema = {
  type: 'object' as const,
  properties: {
    id: { type: 'string' as const },
    area_index: { type: 'integer' as const },
    start_node_id: { type: 'string' as const },
    end_node_id: { type: 'string' as const },
    confidence: { type: 'number' as const },
    inferred: { type: 'boolean' as const },
  },
  required: ['id', 'area_index', 'start_node_id', 'end_node_id', 'confidence', 'inferred'] as const,
  additionalProperties: false,
};

/**
 * Scan 1 skeleton-only response.
 * Outline is already deterministic — GPT only returns internal nodes + segments.
 */
export const V2_SCAN1_SCHEMA = {
  type: 'object' as const,
  properties: {
    internal_nodes: { type: 'array' as const, items: skeletonNodeSchema },
    segments: { type: 'array' as const, items: skeletonSegmentSchema },
    unresolved_geometry: { type: 'array' as const, items: { type: 'string' as const } },
    notes: { type: 'array' as const, items: { type: 'string' as const } },
  },
  required: ['internal_nodes', 'segments', 'unresolved_geometry', 'notes'] as const,
  additionalProperties: false,
};

const classificationSchema = {
  type: 'object' as const,
  properties: {
    segment_id: { type: 'string' as const },
    classification: {
      type: 'string' as const,
      enum: ['ridge', 'hip', 'valley', 'broken_hip', 'broken_barge', 'reject', 'unresolved'] as const,
    },
    confidence: { type: 'number' as const },
    reason_code: {
      type: 'string' as const,
      enum: ['endpoint_topology', 'direction_connectivity', 'visible_plan_context', 'non_roof_mark', 'ambiguous'] as const,
    },
  },
  required: ['segment_id', 'classification', 'confidence', 'reason_code'] as const,
  additionalProperties: false,
};

/**
 * Scan 2 response: classify each segment ID exactly once.
 */
export const V2_SCAN2_SCHEMA = {
  type: 'object' as const,
  properties: {
    classifications: { type: 'array' as const, items: classificationSchema },
    notes: { type: 'array' as const, items: { type: 'string' as const } },
  },
  required: ['classifications', 'notes'] as const,
  additionalProperties: false,
};
