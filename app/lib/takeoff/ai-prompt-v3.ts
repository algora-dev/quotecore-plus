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
  return `You are a CAD roof-perimeter tracer.

One image is provided:

ORIGINAL PLAN IMAGE — the raw architectural roof plan at ${width}×${height} pixels.

Use integer coordinates in the original image coordinate system:

• (0,0) is top-left.
• x increases right.
• y increases down.

## YOUR ONLY TASK

Trace the centre of the visible outer roof-perimeter stroke as one ordered, closed polygon.

Return one {x, y} vertex at every genuine change in perimeter direction.

## PERIMETER RULES

• Follow the outer roof boundary continuously in one direction until it returns to the starting point.
• Every pair of consecutive vertices must correspond to one directly visible perimeter segment.
• Include every visible step, notch, recess, projection, offset and re-entrant corner, however small.
• Never skip a visible corner or replace several visible perimeter segments with one simplified segment.
• Do not add redundant vertices along a straight, uninterrupted perimeter segment.
• Perimeter segments may have any angle. Do not assume horizontal, vertical or 45-degree geometry.
• Trace the centre of the perimeter stroke, not either side of its thickness.
• The final vertex connects back to the first vertex. Do not repeat the first vertex at the end unless the schema requires it.

When an internal roof line meets the perimeter:

• remain on the perimeter;
• do not turn inward onto the internal line;
• add a vertex only if the perimeter itself changes direction there.

## GAPS

Bridge a small obstruction caused by text, dimensions or image quality only when the same perimeter stroke is clearly visible on both sides and there is only one plausible continuation.

If a corner is partly obscured, infer it only when the visible incoming and outgoing perimeter segments uniquely determine its location.

## IGNORE

• Internal roof lines
• Dotted, dashed or hidden lines
• Text, dimensions, leaders and arrows
• Grids, borders, hatching, shading, fill colours and unrelated symbols

## FINAL CHECK

Before returning the polygon, verify that:

1. every visible direction change has a vertex;
2. no visible corner lies between consecutive vertices;
3. every consecutive edge, including the final-to-first edge, follows the visible perimeter;
4. no edge follows an internal line;
5. the polygon is closed and does not cross itself;
6. every perimeter segment is represented exactly once.

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

## CONFIRMED ROOF OUTLINE

Outline vertices:
${outlineStr}

The confirmed outline is AUTHORITATIVE. Do not modify or return its perimeter edges. The blue polygon is a boundary reference, not roof linework to detect.

## YOUR ONLY TASK

Return every visible solid atomic roof line segment inside the confirmed outline, including segments that terminate on the perimeter.

Do not classify or interpret the roof.

## ATOMIC SEGMENT DEFINITION

A stop point is any location where a visible solid line:

• ends;
• changes direction;
• meets or intersects another solid roof line;
• terminates at the endpoint of another line;
• terminates partway along another line;
• reaches the confirmed roof perimeter.

An atomic segment is the visible stroke between two consecutive stop points.

## HARD RULE

No returned segment may contain another stop point anywhere between its start and end.

Therefore:

• every intersection splits every participating line;
• a line that visually continues straight through a junction must be returned as separate segments on each side;
• a line terminating partway along another line creates three segments: the terminating branch and the two sides of the supporting line;
• two crossing lines create four segments meeting at the crossing;
• no returned segment may pass through another line or junction.

## SHARED ENDPOINTS

• Every visible segment must have its own explicit start and end coordinates.
• Any number of segments may share exactly the same endpoint coordinates.
• A shared coordinate does not mean all connected segments have been recorded.
• A coordinate is not a line segment.
• A segment is recorded only when its start and end appear together in its own output object.
• Never omit a visible segment merely because both endpoint coordinates already occur on other segments.

## TRACING RULES

• Return each visible atomic segment exactly once.
• Trace every branch from one stop point to the next stop point.
• When a segment reaches the perimeter, end it at the visible intersection with the centre of the confirmed outline stroke.
• Include short, faint, secondary and connecting solid segments.
• Include distinct solid lines that are close together or parallel.
• Do not return any segment that merely retraces a confirmed perimeter edge.
• Do not bridge a gap unless the continuation is visually unambiguous.
• If a visible solid line may be roof linework, include it rather than omit it.

## JUNCTION-FIRST CHECK

Before returning the JSON:

1. locate every visible endpoint, direction change and junction;
2. at each junction, count every visible branch leaving it;
3. verify that one returned segment uses that junction as an endpoint for every branch;
4. verify that every visible stroke between adjacent stop points has its own segment;
5. verify that no returned segment passes through a stop point;
6. remove exact duplicates, including reversed duplicates;
7. sweep the full roof once more and add any uncovered solid segment.

## IGNORE ONLY

• Dotted or dashed lines
• Text

If a solid line is close to a dotted or dashed line, trace the solid line.

## OUTPUT

Return an array of line-segment objects. Each object must contain only:

{
  "start": {"x": number, "y": number},
  "end": {"x": number, "y": number}
}

Do not generate IDs. The system will assign them.

Return only the required JSON.`;
}

// ─── Scan 3: Classification Only ─────────────────────────────────────────

export function buildV3ClassificationPrompt(params: {
  width: number;
  height: number;
  outlinePoints: V3Point[];
  lines: V3Line[];
}): string {
  const { width, height, outlinePoints, lines } = params;
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
