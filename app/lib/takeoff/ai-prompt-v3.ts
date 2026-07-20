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
  return `You are an expert roofing plan analyst. An image is provided:

ORIGINAL PLAN IMAGE — the raw architectural roof plan at ${width}×${height} pixels.

Return integer coordinates in the original image-pixel coordinate system (0,0 = top-left).

## YOUR ONLY TASK

Trace the centre of the visible outer roof-perimeter stroke. Preserve every genuine direction change. Small gaps caused by labels, dimensions or image quality may be bridged only when the continuation is clear from the original image. Return the outline as a polygon — an ordered list of {x, y} points.

## OUTLINE RULES

- Follow the clear visible perimeter evidence.
- Include every visible step, notch, and re-entrant corner. Do not simplify the roof outline. Every connected roof projection, recess and offset visible on the perimeter must be included, even if it is small.
- Only trace continuous solid roof lines. Never trace dotted, dashed or hidden lines, even if they are parallel to the expected roof geometry.
- Ensure lines do not terminate at artifacts, text, or odd shapes, only at real outline junctions.
- Ignore shading or fill colours; follow external black or dark lines.
- Ignore any lines inside the outline of the roof.
- Ignore non-roof marks: dimensions, text, leaders, grids, borders, hatching, arrows.

## OUTLINE QUALITY

- Each point should be at any direction change in the perimeter.
- Each point should be anywhere a vertical, horizontal, or 45 degree angle ends on the perimeter.
- Minimum 4 points (rectangle). Maximum of 50 points.

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

  return `SCAN 2 — Internal Roof Line Detection

You are an expert CAD line tracer.

Two images are provided:
1. OUTLINE OVERLAY IMAGE — the original plan with the confirmed roof outline drawn as a blue dashed polygon.
2. ORIGINAL PLAN IMAGE — the raw architectural roof plan at ${width}×${height} pixels.

Assume this is a standard residential roof plan drawn using horizontal, vertical and 45° roof geometry.

The roof outline has already been confirmed.

## CONFIRMED ROOF OUTLINE

The roof outline vertices are:
${outlineStr}

The outline is AUTHORITATIVE.
Do not modify it.
Do not return the outline polygon itself.

## YOUR ONLY TASK

Copy every visible **solid roof line segment** that exists inside the confirmed roof outline or runs along part of the confirmed roof perimeter.

At this stage you are **NOT** identifying ridges, hips, valleys, barges or any other roof component.
You are only copying visible line segments.
If a solid roof line is clearly visible, return it.
Classification happens later.

**Completeness is more important than selectivity.**
It is better to return an extra visible roof line than to omit a genuine one.

## WHAT IS A ROOF LINE

Return any visible **solid** line that forms part of the roof geometry, including:
- long lines
- short lines
- ridges
- hips
- valleys
- broken hips
- broken barges
- barge candidates running along the roof perimeter
- small connecting roof segments

Do not attempt to determine which type they are.

## IGNORE

Never return:
- dotted lines
- dashed lines
- hidden lines
- spouting
- dimensions
- text
- arrows
- leaders
- grids
- symbols
- hatching
- borders

If two nearby lines exist, always prefer the visible solid line.
Never replace a solid roof line with a nearby dotted line.

## ANGLE CONSTRAINT

Every returned line must be approximately one of these orientations:
- Horizontal (0° ±5°)
- Vertical (90° ±5°)
- 45° diagonal (45° ±5°)
- 135° diagonal (135° ±5°)

If a visible line falls outside these orientations, do not return it.

## LINE TRACING RULES

1. Trace only visible solid lines.
2. Trace each line from one visible end until it reaches another visible end or intersects another roof line.
3. Return one object for each individual line segment.
4. Do not split one continuous line into multiple lines.
5. Merge small gaps only when the continuation is visually obvious.
6. Include roof lines that terminate on the roof perimeter.
7. Include roof lines that run along part of the roof perimeter.
8. Ignore isolated marks that clearly do not belong to the roof geometry.
9. If you are unsure whether a visible solid line is a genuine roof line or not, **include it**. It is better to return a questionable line than to omit a genuine roof line.

## RETURN

For every detected line return:
- \`id\`: "L1", "L2", "L3", ... (sequential)
- \`start\`: {x, y} in pixel coordinates
- \`end\`: {x, y} in pixel coordinates
- \`confidence\`: 0.0 to 1.0 (1.0 = very clearly visible, 0.5 = faint but present)

Do not classify any line.
Do not modify the outline.

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

  return `You are an expert roofing plan component classifier. Geometry has already been detected. Your ONLY task is to classify each labeled line.

Three images are provided:
1. ANNOTATED ORIGINAL — the original plan with the confirmed outline (blue dashed) and all detected lines drawn in orange with their labels (L1, L2, etc.) visible.
2. CLEAN OVERLAY — just the outline and labeled lines on white background, no plan image.
3. The original plan image for reference.

## CONFIRMED ROOF OUTLINE
${outlineStr}

## DETECTED LINES TO CLASSIFY
${lineTable}

## CLASSIFICATION OPTIONS

Classify each line using its visible position, orientation and connections. Do not invent missing lines or reclassify the geometry.

For each line ID, choose exactly one:

- **ridge** — Normally a vertical or horizontal line inside the roof outline. A ridge can connect to an internal end point of a valley, hip, and also end on the outline of the roof, perpendicular to it.
- **hip** — a 45 degree diagonal line always starting from an EXTERNAL (convex) corner of the outline, running inward connecting to another line.
- **valley** — a diagonal line normally starting from an INTERNAL (concave/re-entrant) corner of the outline, running inward connecting to another line.
- **barge** — a perimeter-parallel line at a gable end, normally perpendicular to ridge lines that land on the roof outline. Normally horizontal or vertical.
- **spouting** — a perimeter edge line that is NOT a barge. These are the edges where spouting/guttering would go. Use this for outline perimeter edges that are not perpendicular to a ridge (i.e. not barges).
- **broken_hip** — a diagonal internal line that doesn't touch the perimeter, branching from a hip/valley junction and joining to another hip or ridge line.
- **broken_barge** — an internal gable-edge segment not on the perimeter, normally vertical or horizontal.
- **uncertain** — use ONLY when you genuinely cannot determine the type. Better to say uncertain than guess wrong, but use sparingly.

## OUTLINE EDGES
The outline polygon edges (between consecutive outline vertices) are also candidates for barge or spouting classification. Outline edge 0→1 is the first edge, 1→2 is the second, etc. (wrapping around). Include these in your classification — each outline edge gets a line ID starting with "E0", "E1", etc.

## GLOBAL CONSISTENCY
After classifying each line individually, check:
1. Every hip starts at a convex corner. If not, reclassify.
2. Every valley starts at a concave corner. If not, reclassify.
3. Ridges connect meaningfully at both ends.
4. Barges are perpendicular to ridges.
5. Spouting + Barges = all perimeter edges.

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
          id: { type: 'string' as const },
          start: pointSchema,
          end: pointSchema,
          confidence: { type: 'number' as const },
        },
        required: ['id', 'start', 'end', 'confidence'] as const,
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
