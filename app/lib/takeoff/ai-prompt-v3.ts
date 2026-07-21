/**
 * AI Takeoff V3 prompts - 3-scan pipeline.
 *
 * Scan 1 = Outline only (GPT traces roof perimeter polygon)
 * Scan 2 = Internal line detection (GPT traces visible lines inside confirmed outline, angle-constrained)
 * Scan 3 = Classification only (GPT names each labeled line, no coordinate changes)
 *
 * Core principle: each scan does ONE thing. Simpler prompts = better accuracy.
 * No adaptive linework — original plan images are clear enough for GPT-5.6 vision.
 */

// ─── Shared Types ────────────────────────────────────────────────────────

export interface V3Point {
  x: number;
  y: number;
}

export interface V3Line {
  id: string;       // "L1", "L2", etc.
  start: V3Point;
  end: V3Point;
  confidence: number; // 0-1, how clearly visible the line was
}

export interface V3Classification {
  line_id: string;
  type: 'ridge' | 'hip' | 'valley' | 'barge' | 'spouting' | 'broken_hip' | 'broken_barge' | 'uncertain';
  confidence: number;
  reason: string;
}

// ─── Scan 1: Outline Only ────────────────────────────────────────────────

export function buildV3OutlinePrompt(width: number, height: number): string {
  return `You are an expert CAD roof outline tracer.

An image is provided:

ORIGINAL PLAN IMAGE — the architectural roof plan at ${width}×${height} pixels.

Return all coordinates in the original image pixel coordinate system (0,0 = top-left, x increases right, y increases down).

## YOUR TASK

Trace the visible outer roof edge exactly as if using a CAD polyline tool.

Do not estimate the roof shape.

Do not simplify the outline.

Do not think about polygons first.

Simply follow the roof edge visually, one edge at a time.

## HOW TO TRACE

1. Start at any external roof corner.
2. Follow the visible outer roof edge clockwise.
3. Stay directly on the roof edge at all times.
4. Whenever the roof edge changes direction, create a new vertex.
5. Continue until you return to the starting corner.

Imagine you are manually tracing the roof with a CAD polyline tool.

## VERTEX RULES

Create a new vertex whenever:

- the roof edge changes direction
- a corner is reached
- a step begins
- a step ends
- an external projection begins
- an external projection ends

Do not add unnecessary vertices along straight edges.

Do not skip any genuine change of direction.

Each straight roof edge should exist between exactly two consecutive vertices.

## OUTLINE RULES

Follow only the outermost continuous roof edge.

Never cut across an indentation.

Never shortcut between corners.

Never smooth multiple corners into one.

Never invent corners.

Never remove visible corners.

Ignore everything inside the roof outline.

Ignore:

- ridges
- hips
- valleys
- internal roof lines
- dashed lines
- dotted lines
- text
- dimensions
- leaders
- arrows
- symbols
- hatching
- shading

Trace only the external roof perimeter.

## SELF CHECK

Before returning the result, walk the outline clockwise one complete time.

For every edge verify:

- it follows the visible roof edge
- it ends exactly where the roof changes direction
- every visible external corner has a corresponding vertex
- the outline forms one continuous closed loop

## OUTPUT

Return one ordered clockwise polygon of {x, y} points.

Each polygon point must contain:

{
  "x": number,
  "y": number
}

Do not repeat the first point as the final point — the polygon is implicitly closed.

Return only the structured JSON required by the schema.`;
}

// ─── Scan 1B: Outline Visual Audit ───────────────────────────────────────

export function buildV3Scan1BPrompt(params: {
  width: number;
  height: number;
  polygonPoints: V3Point[];
}): string {
  const { width, height, polygonPoints } = params;
  const polyStr = polygonPoints
    .map((p, i) => `  ${i}: (${p.x}, ${p.y})`)
    .join('\n');

  return `You are a CAD outline auditor.

Two images are provided:

1. OUTLINE AUDIT IMAGE — the original roof plan with a thin high-contrast polygon drawn over it, including small vertex markers at every polygon point.
2. ORIGINAL PLAN IMAGE — the raw architectural roof plan at ${width}×${height} pixels.

Use integer coordinates in the original image coordinate system:

• (0,0) is top-left.
• x increases right.
• y increases down.

## CURRENT POLYGON

The current polygon vertices are:
${polyStr}

## YOUR ONLY TASK

Verify whether the rendered polygon follows the complete true external roof silhouette.

If the polygon is already correct, return the same full polygon unchanged.

If the polygon is wrong, return one corrected full polygon.

Do not return patch instructions. Return the complete corrected polygon.

## WHAT TO CHECK

Inspect the rendered polygon against the original plan for:

• omitted external steps or projections;
• omitted recesses or notches;
• skipped direction changes;
• polygon edges that cut through the roof interior;
• polygon edges that follow an internal roof line instead of the external boundary;
• inaccurate corner placement;
• incorrect point ordering;
• self-intersections;
• failure to close.

## RULES

• Preserve the original image-pixel coordinate system.
• Return one ordered polygon.
• Follow the external roof silhouette only.
• Include every genuine perimeter direction change, however small.
• Never add internal roof lines.
• Never simplify multiple perimeter segments into one.
• Never omit a visible external corner.
• The polygon is implicitly closed — do not repeat the first point at the end unless the schema requires it.

## EXTERNAL-BOUNDARY RULE

A true perimeter segment separates the roof footprint on one side from the exterior on the other.

An internal roof line has roof geometry on both sides and must not be followed.

When an internal line meets the perimeter, continue along the external boundary.

## FINAL CHECK

Before returning the polygon:

1. Compare every polygon edge against the original plan.
2. Confirm that every edge follows the external perimeter, not an internal line.
3. Confirm that every visible perimeter direction change has a vertex.
4. Confirm that no visible corner lies between consecutive vertices.
5. Confirm that the polygon is closed and does not cross itself.

Return only the structured JSON required by the schema.`;
}

// ─── Scan 2: Internal Line Detection ─────────────────────────────────────

export function buildV3LineDetectionPrompt(params: {
  width: number;
  height: number;
  outlinePoints: V3Point[];
}): string {
  const { width, height, outlinePoints } = params;
  const outlineStr = outlinePoints
    .map((p, i) => `  ${i}: (${p.x}, ${p.y})`)
    .join('\n');

  return `You are a CAD line-segment tracer.

Two images are provided:

1. OUTLINE OVERLAY IMAGE — the original plan with the confirmed roof outline drawn as a thin solid blue polygon.
2. ORIGINAL PLAN IMAGE — the raw architectural roof plan at ${width}×${height} pixels.

Use integer coordinates in the original image coordinate system:

• (0,0) is top-left.
• x increases right.
• y increases down.

## SOURCE PRIORITY

Use the ORIGINAL PLAN IMAGE as the source of all internal line evidence.

Use the OUTLINE OVERLAY IMAGE only to locate the confirmed roof boundary.

The blue polygon is not roof linework to detect.

## CONFIRMED ROOF OUTLINE

Outline vertices:
${outlineStr}

The confirmed outline is AUTHORITATIVE.

Do not modify it or return its perimeter edges.

## YOUR ONLY TASK

Return every visible solid atomic roof line segment inside the confirmed outline, including segments that terminate on the perimeter.

Do not classify or interpret the roof.

## ATOMIC SEGMENT DEFINITION

A stop point is a location where a visible solid roof line:

• ends;
• changes direction;
• meets another visible solid roof line;
• terminates at the endpoint of another visible solid roof line;
• terminates partway along another visible solid roof line;
• reaches the confirmed roof perimeter.

An atomic segment is the visible solid stroke between two consecutive stop points.

No returned segment may contain a solid roof-line stop point between its start and end.

## SOLID INTERSECTION RULE

Every intersection with another visible solid roof line splits every participating line.

A line must terminate at the intersection and, when it continues beyond that intersection, restart as a new line object from the same coordinate.

No returned segment may pass through another solid roof line or solid roof-line junction.

## ANNOTATIONS ARE TRANSPARENT

Dotted lines, dashed lines and text are not roof-line junctions.

They never:

• terminate a solid roof line;
• split a solid roof line;
• create a segment endpoint.

When a solid roof line passes through or underneath a dotted line, dashed line or text:

• follow the solid line through the obstruction;
• continue it to the next genuine solid roof-line stop point;
• do not end it at the annotation.

If the solid stroke is briefly hidden but resumes on the same clear path beyond the annotation, treat it as continuous.

## ENDPOINT-COUNT RULE

At every solid roof-line junction, count the visible solid branches leaving that coordinate.

The number of returned segment endpoints at that coordinate must equal the number of visible branches.

Examples:

• isolated line end: 1 branch and 1 returned endpoint;
• direction change: 2 branches and 2 returned endpoints;
• T-junction: 3 branches and 3 returned endpoints;
• crossing of two solid roof lines: 4 branches and 4 returned endpoints;
• five-way junction: 5 branches and 5 returned endpoints.

Every branch must have its own line object.

A straight line continuing through a junction creates one segment on each side of the junction.

## SHARED-ENDPOINT RULE

Multiple line objects may use exactly the same endpoint coordinate.

A coordinate is not a detected line.

A visible segment is detected only when its start and end coordinates appear together in its own output object.

Never omit a visible connecting segment because:

• both endpoint coordinates already appear on other segments;
• both junctions have already been detected;
• neighbouring segments already use those points.

A visible connector between two existing junctions must be returned as an additional independent line object. It adds one endpoint occurrence to each junction.

## COORDINATE PLACEMENT

At a solid roof-line junction:

• locate the centreline of every participating stroke;
• use one shared coordinate at their centreline intersection;
• do not create several nearby endpoint coordinates for lines that visibly meet at one point.

When a line terminates on the confirmed perimeter, place its endpoint at the intersection of the line centreline and the confirmed perimeter centreline.

## COVERAGE RULES

• Return every visible solid atomic segment exactly once.
• Trace every visible branch from one stop point to the next.
• Include short, faint, secondary and linking segments.
• Include segments whose two endpoints are already used by other segments.
• Include distinct solid lines that are close together or parallel.
• Do not return a segment that merely retraces a confirmed perimeter edge.
• Do not bridge a genuine break unless the continuation is visually unambiguous.
• If a visible solid line may be roof linework, include it rather than omit it.

## FINAL COVERAGE CHECK

Before returning the JSON:

1. Inspect every visible solid endpoint and junction.
2. Compare the visible branch count with the number of returned endpoints at that coordinate.
3. For every pair of adjacent stop points joined by a visible solid stroke, confirm that one segment object exists between them.
4. Specifically search for visible linking segments whose two endpoint coordinates already occur on other line objects.
5. Confirm that dotted lines, dashed lines and text have not caused any solid line to terminate early.
6. Confirm that no returned segment passes through a solid roof-line junction.
7. Remove exact duplicates, including reversed duplicates.
8. Sweep the complete roof once more and add every uncovered visible solid segment.

## IGNORE

Do not return:

• dotted or dashed lines;
• text.

## OUTPUT

Return an array of line-segment objects. Each object must contain only:

{
  "start": {"x": number, "y": number},
  "end": {"x": number, "y": number}
}

Do not generate IDs. The system will assign them.

## DOWNSTREAM VISUAL-AUDIT CONTRACT

Render Scan 2A detected segments as thin, high-contrast coloured lines.

The coloured overlay must not fully obscure the original black source stroke. Scan 2B must be able to distinguish:

- black source line already traced by a coloured overlay;
- black source line still uncovered and therefore potentially missing.

Use a stroke width that remains visually thinner than the source line where possible.

Return only the required JSON.`;
}

// ─── Scan 3: Classification Only ─────────────────────────────────────────

export function buildV3ClassificationPrompt(params: {
  outlinePoints: V3Point[];
  lines: V3Line[];
}): string {
  const { outlinePoints, lines } = params;
  const outlineStr = outlinePoints
    .map((p, i) => `  ${i}: (${p.x}, ${p.y})`)
    .join('\n');

  const lineTable = lines
    .map(l => {
      const dx = l.end.x - l.start.x;
      const dy = l.end.y - l.start.y;
      const angle = Math.round(Math.atan2(-dy, dx) * 180 / Math.PI);
      const normalizedAngle = ((angle % 360) + 360) % 360;
      const length = Math.round(Math.sqrt(dx * dx + dy * dy));
      return `  ${l.id}: (${l.start.x},${l.start.y}) → (${l.end.x},${l.end.y}) | angle=${normalizedAngle}° | length=${length}px`;
    })
    .join('\n');

  return `You are a roofing-plan component classifier.

Geometry has already been detected. Your ONLY task is to classify every supplied line ID.

Three images are provided:

1. ANNOTATED ORIGINAL — the original plan with the confirmed outline in blue and detected internal segments in orange, each labeled L1, L2, etc.
2. CLEAN OVERLAY — the confirmed outline and labeled segments on a white background.
3. ORIGINAL PLAN IMAGE — the raw plan for reference.

## CONFIRMED ROOF OUTLINE
${outlineStr}

## DETECTED INTERNAL SEGMENTS
${lineTable}

## OUTLINE EDGES

Each consecutive pair of outline vertices is an outline edge:

• E0 = vertex 0 → vertex 1
• E1 = vertex 1 → vertex 2
• continue in order
• the final E edge connects the final vertex back to vertex 0

## GEOMETRY IS FIXED

Do not add, remove, merge, split, extend, shorten or move any line.

Classify each supplied ID exactly once. Do not invent IDs or missing geometry.

## CLASSIFICATION PRINCIPLES

• Use endpoint locations and network connections first; use angle and length only as supporting evidence.
• The start/end order of an L segment is arbitrary.
• Treat an endpoint as touching an outline corner, edge or another line when the overlay visibly coincides within normal pixel tolerance; exact coordinate equality is not required.
• Judge orientation relative to the local roof geometry. The plan may be rotated, skewed or imperfectly scanned.
• Scan 2 splits lines at every junction. Adjacent segments may still be parts of the same roofing component and may receive the same classification.
• A junction or segmentation boundary does not by itself change the component type.

## ALLOWED CLASSIFICATIONS

ridge
An internal high-line segment. It commonly connects hips, valleys, broken hips or other ridge segments, and may terminate at an internal junction or at a gable-end perimeter edge. A ridge may have any image orientation.

hip
An internal segment with one endpoint at an external convex outline corner and the other running inward to a ridge or internal junction.

valley
An internal segment with one endpoint at an internal concave or re-entrant outline corner and the other running inward to a ridge or internal junction.

barge
An outline edge forming a gable or rake end. A ridge commonly terminates on it or points toward it, usually approximately perpendicular in the local roof geometry.

spouting
An outline edge where guttering or spouting would normally run. Use for every outline edge that is not a barge.

broken_hip
An internal segment that does not touch the outer perimeter and acts as a diagonal connector or continuation within the hip, valley and ridge junction network.

broken_barge
An internal gable-edge segment that is not itself an outline edge, commonly associated with stepped or internal gable geometry.

uncertain
Use only when the type remains genuinely ambiguous after checking both endpoints, connected segments, nearby outline-corner type and the original plan.

## ID RULES

• E IDs may be classified only as barge or spouting.
• L IDs may be classified only as ridge, hip, valley, broken_hip, broken_barge or uncertain.
• Do not classify an L ID as barge or spouting.
• Do not classify an E ID as an internal component.

## TOPOLOGY CHECKS

Before returning the JSON, verify that:

1. every hip touches a convex outline corner;
2. every valley touches a concave outline corner;
3. every broken_hip is internal and does not touch the perimeter;
4. ridge segments form a coherent high-line network and remain ridge across a split junction when their role continues;
5. adjacent or collinear Scan 2 segments receive consistent types unless their roof role visibly changes;
6. every E edge is classified exactly once as barge or spouting;
7. barge and spouting together account for all E edges;
8. every supplied L and E ID appears exactly once;
9. uncertain is used sparingly, but no classification is guessed when evidence is insufficient.

Return only the structured JSON required by the schema.`;
}

// ─── Scan 2B: Missing-Line Audit ────────────────────────────────────────

export function buildV3MissingLineAuditPrompt(params: {
  width: number;
  height: number;
  outlinePoints: V3Point[];
  currentSegments: V3Line[];
}): string {
  const { width, height, outlinePoints, currentSegments } = params;
  const outlineStr = outlinePoints
    .map((p, i) => `  ${i}: (${p.x}, ${p.y})`)
    .join('\n');
  const segmentTable = currentSegments
    .map(l => `  ${l.id}: (${l.start.x},${l.start.y}) → (${l.end.x},${l.end.y})`)
    .join('\n');

  return `You are a CAD missing-line auditor.

Four inputs are provided:

1. ORIGINAL PLAN IMAGE — the raw architectural roof plan at ${width}×${height} pixels.
2. SCAN 2A AUDIT OVERLAY IMAGE — the same plan with the confirmed roof outline and every line segment already detected by Scan 2A drawn in a bright colour.
3. CONFIRMED ROOF OUTLINE:
${outlineStr}
4. CURRENT DETECTED SEGMENTS:
${segmentTable}

Use coordinates in the original image-pixel coordinate system:

• (0,0) is top-left.
• x increases right.
• y increases down.

## YOUR ONLY TASK

Find visible solid dark line segments in the ORIGINAL PLAN IMAGE that are not already covered by a coloured detected segment in the SCAN 2A AUDIT OVERLAY IMAGE.

Return only missing segments.

Do not return the complete existing line set.

## AUDIT METHOD

Compare the original image with the audit overlay.

A solid dark source segment is missing when:

• it is visible in the original plan;
• no coloured detected line covers the same start-to-end path in the audit overlay.

Pay special attention to:

• short connectors between two already detected junctions;
• segments whose start and end coordinates are already used by other segments;
• continuations that pass behind or through dotted or dashed lines;
• small diagonal segments between larger detected lines;
• solid branches leaving a junction that have no coloured overlay.

## SEGMENT RULES

• Return each missing segment from one visible endpoint or solid-line junction to the next.
• End a segment where it meets another solid dark line, including partway along that line.
• End a segment where it reaches the endpoint of another solid dark line.
• Never pass a returned segment through a solid-line junction.
• If a solid line continues beyond a junction, the continuation is a separate segment.
• Multiple missing segments may share identical endpoint coordinates.
• A segment may connect two junctions that already exist in the current detected geometry.
• Existing endpoint coordinates do not mean the line between them has already been detected.
• Do not return a segment already substantially covered by a coloured Scan 2A line.
• Do not return the confirmed roof-perimeter edges.

## ANNOTATION RULE

Ignore:

• dotted lines;
• dashed lines;
• text.

Dotted or dashed lines are transparent annotations.

If a solid dark line passes through or behind a dotted or dashed line, continue following the solid line to its true endpoint or next solid-line junction. Do not terminate it at the dotted or dashed crossing.

## FINAL CHECK

Before returning the JSON:

1. Inspect every area where black solid linework remains visible without a coloured overlay.
2. Inspect every pair of nearby existing junctions for an uncovered solid connector.
3. Inspect every junction for an uncovered solid branch.
4. Confirm that every returned segment is absent from the current detected set.
5. Confirm that no returned segment is dotted, dashed, text, or part of the confirmed perimeter.

## OUTPUT

Return an object containing a missing_segments array.

Each entry must contain only:

{
  "start": { "x": number, "y": number },
  "end": { "x": number, "y": number }
}

Return an empty missing_segments array if no missing segments are found.

Do not generate IDs.

Do not classify the segments.

Return only the structured JSON required by the schema.`;
}

// ─── V3 Schemas ──────────────────────────────────────────────────────────

const pointSchema = {
  type: 'object' as const,
  properties: {
    x: { type: 'integer' as const },
    y: { type: 'integer' as const },
  },
  required: ['x', 'y'] as const,
  additionalProperties: false,
};

// Scan 1: Outline response
export const V3_SCAN1_SCHEMA = {
  type: 'object' as const,
  properties: {
    roof_areas: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          name: { type: 'string' as const },
          points: { type: 'array' as const, items: pointSchema },
          pitch_degrees: { type: ['integer', 'null'] as const },
        },
        required: ['name', 'points', 'pitch_degrees'] as const,
        additionalProperties: false,
      },
    },
    notes: { type: 'array' as const, items: { type: 'string' as const } },
  },
  required: ['roof_areas', 'notes'] as const,
  additionalProperties: false,
};

// Scan 1B: Outline audit response
export const V3_SCAN1B_SCHEMA = {
  type: 'object' as const,
  properties: {
    points: { type: 'array' as const, items: pointSchema },
    notes: { type: 'array' as const, items: { type: 'string' as const } },
  },
  required: ['points', 'notes'] as const,
  additionalProperties: false,
};

// Scan 2: Line detection response
export const V3_SCAN2_SCHEMA = {
  type: 'object' as const,
  properties: {
    lines: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          start: pointSchema,
          end: pointSchema,
        },
        required: ['start', 'end'] as const,
        additionalProperties: false,
      },
    },
    notes: { type: 'array' as const, items: { type: 'string' as const } },
  },
  required: ['lines', 'notes'] as const,
  additionalProperties: false,
};

// Scan 2B: Missing-line audit response
export const V3_SCAN2B_SCHEMA = {
  type: 'object' as const,
  properties: {
    missing_segments: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          start: pointSchema,
          end: pointSchema,
        },
        required: ['start', 'end'] as const,
        additionalProperties: false,
      },
    },
  },
  required: ['missing_segments'] as const,
  additionalProperties: false,
};

// Scan 3: Classification response
export const V3_SCAN3_SCHEMA = {
  type: 'object' as const,
  properties: {
    classifications: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          line_id: { type: 'string' as const },
          type: {
            type: 'string' as const,
            enum: ['ridge', 'hip', 'valley', 'barge', 'spouting', 'broken_hip', 'broken_barge', 'uncertain'] as const,
          },
          confidence: { type: 'number' as const },
          reason: { type: 'string' as const },
        },
        required: ['line_id', 'type', 'confidence', 'reason'] as const,
        additionalProperties: false,
      },
    },
    notes: { type: 'array' as const, items: { type: 'string' as const } },
  },
  required: ['classifications', 'notes'] as const,
  additionalProperties: false,
};
