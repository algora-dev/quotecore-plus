/**
 * AI Takeoff V2 prompts — skeleton-first approach.
 *
 * Scan 1 = Geometry: detect roof outline + unclassified internal skeleton
 *           (nodes + segments, no component types).
 * Scan 2 = Classification: classify each existing segment only;
 *           never create, move, extend, or reconnect geometry.
 *
 * Behind AI_TAKEOFF_SKELETON_V2 feature flag.
 */

// ── Scan 1: Outline + Unclassified Skeleton ─────────────────────────────

export function buildV2Scan1Prompt(width: number, height: number): string {
  return `You are an expert roofing-plan geometry analyst. Two aligned images are provided:

1. ORIGINAL PLAN IMAGE — the raw architectural roof plan at ${width}×${height} pixels. Use it to understand context and reject annotations, fixtures and non-roof marks.
2. CONSERVATIVE LINEWORK IMAGE — a high-contrast extraction of the same plan. Use it to locate candidate strokes, but confirm every candidate against the original image.

Both images use the original image-pixel coordinate system where (0,0) is top-left. Return integer coordinates.

You have exactly two ordered tasks:
A. Trace each complete parent roof outline.
B. Inside each traced outline, build an UNCLASSIFIED geometry skeleton from clearly visible connected roof strokes.

Do not classify any skeleton segment as ridge, hip, valley, broken hip, barge or spouting. This scan detects geometry only.

## TASK A — TRACE PARENT ROOF OUTLINES
- Trace the complete outer perimeter of each physically separate roof structure.
- Include every visible step, notch and re-entrant corner.
- Return a separate parent area only when a visible gap physically disconnects it.
- Do not divide one connected roof into individual sloping faces.
- Ignore non-roof marks: dimensions, text, leaders, grids, borders, hatching, arrows, vents, skylights, walls.
- Suggest a pitch only when a pitch annotation is clearly visible. Otherwise use null.
- Detect a dimension line only when both endpoints and its real length are clearly visible and readable.

## TASK B — BUILD UNCLASSIFIED SKELETON
Inside each confirmed outline, find every clearly visible internal stroke that represents roof structure.

### REQUIRED EVIDENCE TESTS
Include a segment only when ALL THREE tests pass:
1. VISIBLE STROKE SUPPORT — A continuous solid line is visible along the proposed path in the original plan and is supported by the conservative linework image. Do not create a segment from empty space, shading, a fill boundary or geometric expectation alone.
2. VALID CONNECTIVITY — Both ends terminate at one of: a confirmed perimeter vertex, a clearly supported point on a straight perimeter edge, or a shared internal junction where another accepted segment visibly meets. A segment may not stop freely in empty roof space.
3. VALID V1 DIRECTION — The segment is horizontal, vertical or approximately 45 degrees. Slight drafting variation is acceptable, but do not force an unrelated stroke onto one of these directions.

### SKELETON CONSTRUCTION RULES
- Create one node for each true shared junction and reuse its exact ID and coordinates for every connected segment.
- Split a visible stroke at each real junction or intersection.
- Every explicit internal junction must connect at least two returned segments.
- Do not return isolated points. A point exists only because accepted visible segments connect there.
- Do not duplicate the perimeter vertices as internal nodes.
- Do not return perimeter outline edges as skeleton segments.
- Do not return component names or types.
- Do not infer a missing connection merely because two nodes align.
- Do not bridge a gap caused by text or an obstruction unless the same stroke visibly resumes on the same axis and the continuation is unmistakable. If not unmistakable, omit it and add a concise unresolved_geometry entry.
- Set inferred=false for every directly visible segment.

### NOISE REJECTION
Reject strokes belonging to: text, labels or leader lines; dimensions, extension lines or arrows; dashed wall lines, grids, hatching or borders; skylights, chimneys, vents or other fixtures; decorative marks, logos or page furniture.

### SELF-CHECK
Before returning, verify:
1. Every segment has two distinct node endpoints.
2. Every node ID referenced by a segment exists in the nodes array.
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
1. ENDPOINT TOPOLOGY — What kind of node does each end connect to? (perimeter vertex, perimeter point, internal junction)
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

const scaleSchema = {
  type: 'object' as const,
  properties: {
    detected: { type: 'boolean' as const },
    ratio: { type: ['string', 'null'] as const },
    dimension_line: {
      type: ['object', 'null'] as const,
      properties: {
        p1: pointSchema,
        p2: pointSchema,
        real_length: { type: 'number' as const },
        unit: { type: 'string' as const },
      },
      required: ['p1', 'p2', 'real_length', 'unit'] as const,
      additionalProperties: false,
    },
  },
  required: ['detected', 'ratio', 'dimension_line'] as const,
  additionalProperties: false,
};

const pitchSchema = {
  type: 'object' as const,
  properties: {
    detected: { type: 'boolean' as const },
    global_degrees: { type: ['number', 'null'] as const },
  },
  required: ['detected', 'global_degrees'] as const,
  additionalProperties: false,
};

const roofAreaSchema = {
  type: 'object' as const,
  properties: {
    name: { type: 'string' as const },
    points: { type: 'array' as const, items: pointSchema },
    pitch_degrees: { type: ['number', 'null'] as const },
  },
  required: ['name', 'points', 'pitch_degrees'] as const,
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
 * Scan 1 response: outline + unclassified skeleton.
 * Perimeter vertices are implicit (a{area}v{index}), not duplicated as nodes.
 * internal_nodes only contains junctions and perimeter_points (where internal
 * strokes meet the middle of a straight edge).
 */
export const V2_SCAN1_SCHEMA = {
  type: 'object' as const,
  properties: {
    error: { type: ['string', 'null'] as const },
    scale: scaleSchema,
    pitch: pitchSchema,
    roof_areas: { type: 'array' as const, items: roofAreaSchema },
    internal_nodes: { type: 'array' as const, items: skeletonNodeSchema },
    segments: { type: 'array' as const, items: skeletonSegmentSchema },
    unresolved_geometry: { type: 'array' as const, items: { type: 'string' as const } },
    notes: { type: 'array' as const, items: { type: 'string' as const } },
  },
  required: ['error', 'scale', 'pitch', 'roof_areas', 'internal_nodes', 'segments', 'unresolved_geometry', 'notes'] as const,
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
    error: { type: ['string', 'null'] as const },
    classifications: { type: 'array' as const, items: classificationSchema },
    notes: { type: 'array' as const, items: { type: 'string' as const } },
  },
  required: ['error', 'classifications', 'notes'] as const,
  additionalProperties: false,
};
