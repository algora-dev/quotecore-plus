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
  return `Trace the external roof perimeter clockwise.

Start at any clear external corner and follow only the line that continues around the outside of the roof.

Record a vertex whenever the external perimeter changes direction.

At any point where an internal line meets the perimeter, do not follow that line inward. Continue along the outermost boundary unless the perimeter itself visibly turns.

A line touching the perimeter does not create a corner unless the outside edge changes direction at that exact point.

Never leave the external perimeter, cross through the roof, or rejoin it later.

Follow every genuine external step, notch and projection. Do not simplify or shortcut the outline.

Ignore all internal roof lines, dashed lines, text, dimensions and symbols.

Return one closed clockwise vertex list in original-image pixel coordinates (0,0 = top-left, x increases right, y increases down). Image is ${width}×${height} pixels.

Do not repeat the first vertex as the final vertex — the polygon is implicitly closed.

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

1. OUTLINE OVERLAY IMAGE — the original plan with the confirmed roof outline shown in blue.
2. ORIGINAL PLAN IMAGE — the raw roof plan at ${width}×${height} pixels.

Use the ORIGINAL PLAN IMAGE to detect linework.

Use the OUTLINE OVERLAY IMAGE only to locate the confirmed roof boundary.

Use original-image pixel coordinates:
- (0,0) is top-left
- x increases right
- y increases down

Confirmed outline vertices:
${outlineStr}

Return every visible solid internal roof line inside the confirmed outline.

Do not classify, interpret, simplify, merge, extend, invent, or discard any visible solid line.

Trace each line from one genuine endpoint or junction to the next.

A segment must stop whenever the solid line:
- ends
- changes direction
- meets another solid line
- reaches the confirmed roof perimeter

Every junction splits every participating line.

Do not allow any returned segment to pass through a solid-line junction.

Dotted lines, dashed lines, text, dimensions, symbols, hatching, and shading do not split or terminate solid roof lines.

If a solid line is briefly obscured by an annotation but clearly continues on the same path, trace it through.

Include:
- short or faint solid lines
- linking segments
- segments whose endpoints are already used by other segments
- segments that terminate on the roof perimeter

Do not return:
- the confirmed roof perimeter
- dotted or dashed lines
- text or annotations
- duplicate or reversed duplicate segments

Before returning, sweep the entire roof and confirm that every visible solid stroke between adjacent endpoints or junctions has its own segment object.

Return only the structured JSON required by the schema.`;
}

// ─── Scan 3: Classification Only ─────────────────────────────────────────

export function buildV3ClassificationPrompt(params: {
  outlinePoints: V3Point[];
  lines: V3Line[];
  vertexMetadata?: Array<{ id: string; index: number; x: number; y: number; cornerType: string }>;
  augmentedLines?: Array<V3Line & {
    startOutlineVertexId: string | null;
    startOutlineCornerType: string | null;
    endOutlineVertexId: string | null;
    endOutlineCornerType: string | null;
  }>;
}): string {
  const { outlinePoints, lines, vertexMetadata, augmentedLines } = params;
  const outlineStr = outlinePoints
    .map((p, i) => `  ${i}: (${p.x}, ${p.y})`)
    .join('\n');

  // Build vertex type table if metadata is provided
  const vertexTypeTable = vertexMetadata && vertexMetadata.length > 0
    ? vertexMetadata.map(v => `${v.id} | x=${v.x} | y=${v.y} | ${v.cornerType}`).join('\n')
    : '';

  // Build line table — use augmented data if available, otherwise plain lines
  const linesForTable = augmentedLines ?? lines;
  const lineTable = linesForTable
    .map(l => {
      const dx = l.end.x - l.start.x;
      const dy = l.end.y - l.start.y;
      const angle = Math.round(Math.atan2(-dy, dx) * 180 / Math.PI);
      const normalizedAngle = ((angle % 360) + 360) % 360;
      const length = Math.round(Math.sqrt(dx * dx + dy * dy));

      // Add vertex match info if available
      const augmented = l as V3Line & {
        startOutlineVertexId: string | null;
        startOutlineCornerType: string | null;
        endOutlineVertexId: string | null;
        endOutlineCornerType: string | null;
      };
      const startVertex = augmented.startOutlineVertexId
        ? `${augmented.startOutlineVertexId}(${augmented.startOutlineCornerType})`
        : 'none';
      const endVertex = augmented.endOutlineVertexId
        ? `${augmented.endOutlineVertexId}(${augmented.endOutlineCornerType})`
        : 'none';

      return `  ${l.id}: (${l.start.x},${l.start.y}) → (${l.end.x},${l.end.y}) | angle=${normalizedAngle}° | length=${length}px | startVertex=${startVertex} | endVertex=${endVertex}`;
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

Classify each supplied ID exactly once.

Do not invent IDs or missing geometry.

## CLASSIFICATION PRINCIPLES

• Use endpoint locations and network connections first; use angle and length only as supporting evidence.
• The start/end order of an L segment is arbitrary.
• Treat an endpoint as touching an outline corner, edge or another line when the overlay visibly coincides within normal pixel tolerance; exact coordinate equality is not required.
• Judge orientation relative to the local roof geometry. The plan may be rotated, skewed or imperfectly scanned.
• Scan 2 splits lines at every junction. Adjacent segments may still be parts of the same roofing component and may receive the same classification.
• A junction or segmentation boundary does not by itself change the component type.

## AUTHORITATIVE OUTLINE VERTEX TYPES

The following corner types were calculated deterministically from the ordered roof outline.
These values are authoritative. Do not visually reinterpret or override them.

${vertexTypeTable}

## PERIMETER VERTEX RULE

For every internal segment that terminates at an outline vertex, use the supplied vertex ID and corner type:

• supplied convex vertex → hip
• supplied concave vertex → valley
• supplied collinear vertex → do not classify automatically as hip or valley

A segment terminating partway along an outline edge (not at a vertex) is NOT a hip or valley.

Never classify a segment terminating at a supplied concave vertex as a hip.
Never classify a segment terminating at a supplied convex vertex as a valley.

Do not use this rule for a segment terminating partway along an outline edge — such segments may be ridge, broken_barge, uncertain, or another valid internal classification.

Do not determine convexity or concavity visually. The supplied vertex data is authoritative.

## ALLOWED CLASSIFICATIONS

ridge
An internal high-line segment. It commonly connects hips, valleys, broken hips or other ridge segments, and may terminate at an internal junction or at a gable-end perimeter edge. A ridge may have any image orientation.

hip
An internal segment that terminates at a supplied convex outline vertex and runs inward toward a ridge or internal junction. The supplied convex vertex type is authoritative.

valley
An internal segment that terminates at a supplied concave outline vertex and runs inward toward a ridge or internal junction. The supplied concave vertex type is authoritative.

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

1. every hip terminates at a supplied convex outline vertex;
2. every valley terminates at a supplied concave outline vertex;
3. no segment without an outline-vertex endpoint is classified as hip or valley;
4. no segment terminating partway along an outline edge is classified as hip or valley solely because it touches the perimeter;
5. every broken_hip is internal and does not touch the perimeter;
6. ridge segments form a coherent high-line network and remain ridge across a split junction when their role continues;
7. adjacent or collinear Scan 2 segments receive consistent types unless their roof role visibly changes;
8. every E edge is classified exactly once as barge or spouting;
9. barge and spouting together account for all E edges;
10. every supplied L and E ID appears exactly once;
11. uncertain is used sparingly, but no classification is guessed when evidence is insufficient.

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
