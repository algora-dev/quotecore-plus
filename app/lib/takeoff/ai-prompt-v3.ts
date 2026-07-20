/**
 * AI Takeoff V3 prompts - 3-scan pipeline.
 *
 * Scan 1 = Outline only (GPT traces roof perimeter polygon)
 * Scan 2 = Internal line detection (GPT traces visible lines inside confirmed outline, angle-constrained)
 * Scan 3 = Classification only (GPT names each labeled line, no coordinate changes)
 *
 * Core principle: each scan does ONE thing. Simpler prompts = better accuracy.
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
  return `You are an expert roofing plan analyst. Two images are provided:

1. ORIGINAL PLAN IMAGE - the raw architectural roof plan at ${width}×${height} pixels.
2. ADAPTIVE LINEWORK IMAGE - a high-contrast extraction where narrow strokes appear as black lines on white.

Return integer coordinates in the original image-pixel coordinate system (0,0 = top-left).

## YOUR ONLY TASK
Trace the COMPLETE outer perimeter of EVERY roof structure visible on the plan. Return each structure as a polygon - an ordered list of {x, y} points.

## CRITICAL - TRACE THE FULL PERIMETER
- You MUST trace the ENTIRE perimeter of each roof structure. Do NOT skip or approximate any section.
- Complex roofs have many protrusions, notches, wings, and re-entrant corners. EVERY one must be included as a vertex.
- Walk the perimeter edge-by-edge. If the edge direction changes, even slightly, place a vertex there.
- It is far better to have too many vertices than too few. A 30-vertex outline that captures every corner is correct; a 10-vertex outline that skips corners is WRONG.
- Missing sections of the roof outline is the #1 failure mode. Scan carefully around the entire boundary.

## OUTLINE RULES
- Follow the visible perimeter evidence. The linework image is your primary source.
- Include every visible step, notch, wing, and re-entrant corner no matter how small.
- If the plan shows a single connected roof, return one polygon.
- If two or more physically separate roof structures are visible, return one polygon per structure.
- Do NOT detect internal lines, ridges, hips, valleys, or any internal structure.
- Do NOT return dimensions, text, or annotations as part of the outline.
- Ignore non-roof marks: dimensions, text, leaders, grids, borders, hatching, arrows.

## OUTLINE QUALITY
- Each point should be at a real corner or direction change in the perimeter.
- Do not place points mid-edge on a straight run - only at vertices.
- Minimum 4 points (rectangle). Typical roofs have 8-30+ vertices. Complex roofs may have 40+.
- When in doubt about whether a direction change qualifies as a vertex, include it.

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

  return `You are an expert roofing plan geometry tracer. You are given:

1. ORIGINAL PLAN IMAGE - the raw architectural roof plan at ${width}×${height} pixels.
2. ADAPTIVE LINEWORK IMAGE - high-contrast extraction where structural lines are black on white.
3. OUTLINE OVERLAY IMAGE - the original plan with the confirmed roof outline drawn as a blue dashed polygon.

## CONFIRMED ROOF OUTLINE
The roof outline has already been traced and confirmed. Its vertices (in image pixel coordinates) are:
${outlineStr}

This outline is AUTHORITATIVE. Do not modify it. Do not return outline edges as internal lines.

## YOUR ONLY TASK
Find ALL visible structural lines INSIDE the confirmed roof outline. For each line:
- Return its start point {x, y} and end point {x, y} in image pixel coordinates.
- Assign it a label: "L1", "L2", "L3", etc. (sequential, starting at L1).
- Return a confidence score (0.0 to 1.0) for how clearly visible the line is.

## ANGLE CONSTRAINT - CRITICAL
Lines on roof plans are ALWAYS one of these orientations:
- **Horizontal** (0°): runs left-right
- **Vertical** (90°): runs up-down
- **Diagonal at 45°**: runs bottom-left to top-right
- **Diagonal at 135°**: runs top-left to bottom-right

A line is considered to match an allowed angle if its actual angle is within **±8 degrees** of one of these four directions. For example:
- 0° to 8° or 172° to 180° → horizontal
- 82° to 98° → vertical
- 37° to 53° → 45° diagonal
- 127° to 143° → 135° diagonal

If a visible line falls outside ALL of these ranges, do NOT include it.

## LINE DETECTION RULES
1. **Only trace what you can SEE.** If there is no visible line on the plan, do not create one. Do not infer or fabricate lines.
2. **Trace the full extent of each visible line** from where it starts to where it ends or meets another line.
3. **If a line crosses or meets another line**, still return it as a single line from its true start to its true end. Do not split lines at intersections.
4. **Include lines that touch the outline boundary** - if a visible internal line extends to the roof perimeter, include the full extent.
5. **Exclude non-structural marks:** text, labels, dimension lines, leader lines, arrows, dashed wall lines, grids, hatching, borders, skylights, chimneys, vents, fixtures, decorative marks.
6. **Merge collinear segments:** If two short segments on the same line have a tiny gap, return them as one continuous line.

## WHAT TO RETURN
For each detected line, return:
- \`id\`: "L1", "L2", "L3", ... (sequential)
- \`start\`: {x, y} in pixel coordinates
- \`end\`: {x, y} in pixel coordinates
- \`confidence\`: 0.0 to 1.0 (1.0 = very clearly visible, 0.5 = faint but present)

Do NOT classify lines (no ridge/hip/valley/barge/spouting labels).
Do NOT create nodes or junctions - just start/end points per line.
Do NOT modify the outline.

If no internal lines are visible, return an empty array.

Return only the structured JSON required by the schema.`;
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
1. ANNOTATED ORIGINAL - the original plan with the confirmed outline (blue dashed) and all detected lines drawn in orange with their labels (L1, L2, etc.) visible.
2. CLEAN OVERLAY - just the outline and labeled lines on white background, no plan image.
3. The original plan image for reference.

## CONFIRMED ROOF OUTLINE
${outlineStr}

## DETECTED LINES TO CLASSIFY
${lineTable}

## CLASSIFICATION OPTIONS
For each line ID, choose exactly one:
- **ridge** - the horizontal or vertical top line of a roof slope
- **hip** - a diagonal line starting from an EXTERNAL (convex) corner of the outline, running inward
- **valley** - a diagonal line starting from an INTERNAL (concave/re-entrant) corner of the outline, running inward
- **barge** - a perimeter-parallel line at a gable end, perpendicular to the ridge
- **spouting** - the remaining perimeter edges that are not barges
- **broken_hip** - a diagonal internal line that doesn't touch the perimeter, branching from a hip/valley junction
- **broken_barge** - an internal gable-edge segment not on the perimeter
- **uncertain** - you cannot confidently classify this line

## CLASSIFICATION RULES

### RIDGE
- Usually horizontal or vertical.
- Connects two internal junctions, or an internal junction to a gable end.
- The highest line on a roof slope - other lines (hips/valleys) typically slope down from it.

### HIP
- Diagonal (45° or 135°).
- Starts at an EXTERNAL/CONVEX perimeter corner (a corner that points outward).
- Runs inward to a junction or ridge endpoint.

### VALLEY
- Diagonal (45° or 135°).
- Starts at an INTERNAL/CONCAVE perimeter corner (a corner that points inward, like an L-shape notch).
- Runs inward to a junction or ridge endpoint.

### BARGE
- Horizontal or vertical.
- Runs perpendicular to the ridge at a gable end.
- Is on or near the roof perimeter (not internal).
- Where a ridge endpoint meets the perimeter, the two perimeter edges leaving that point perpendicular to the ridge are barges.

### SPOUTING
- Horizontal or vertical perimeter edges that are NOT barges.
- These are the edges where spouting/guttering would go.
- Spouting = perimeter minus barges.

### BROKEN_HIP
- Diagonal, fully internal (doesn't touch perimeter).
- Connects to other hip/valley/ridge lines at a junction.

### BROKEN_BARGE
- Horizontal or vertical, fully internal.
- At a gable edge, perpendicular to ridge.

### UNCERTAIN
- Use when you genuinely cannot tell. Better to say uncertain than guess wrong.

## OUTLINE EDGES
The outline polygon edges (between consecutive outline vertices) are also candidates for barge or spouting classification. Outline edge ${0}→${1} is the first edge, ${1}→${2} is the second, etc. (wrapping around). Include these in your classification - each outline edge gets a line ID starting with "E0", "E1", etc.

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
