/**
 * AI Takeoff prompts and strict structured-output schemas.
 *
 * Stage 1 detects parent roof outlines only. The user confirms the parent
 * names and pitches before Stage 2 detects a connected component graph.
 */

export interface PromptRoofArea {
  name: string;
  pitch_degrees: number | null;
  points: Array<{ x: number; y: number }>;
}

export interface PromptCornerCandidate {
  area_index: number;
  point_index: number;
  corner_type: 'internal' | 'external';
  likely_component: 'valley' | 'hip';
}

export function buildAiTakeoffOutlinePrompt(width: number, height: number): string {
  return `You are an expert roofing plan analyst. Two images are provided:

1. ORIGINAL PLAN IMAGE — the raw architectural roof plan at ${width}×${height} pixels. Use this for context, reading labels, and understanding the overall structure.
2. ADAPTIVE LINEWORK IMAGE — a high-contrast extraction of the same plan where narrow strokes appear as black lines on white, and uniform shading has been removed. Use this as your primary geometry evidence.

Return integer coordinates in the original image-pixel coordinate system (0,0 = top-left). Both images share the same dimensions.

## LINEWORK PRIORITY
1. Use the adaptive linework image as the primary source for tracing geometry. Black pixels in that image ARE the roof lines.
2. Cross-reference the original plan to distinguish roof structure lines from annotations (dimensions, text, arrows, borders).
3. If the linework image shows no clear perimeter in a section, fall back to the original plan and use the next strongest visible boundary.

## TASK: TRACE THE VISIBLE PARENT ROOF OUTLINE
Trace the complete outer perimeter of each physically separate roof structure using the linework image. Do not detect internal components (ridges, hips, valleys) in this stage.

## OUTLINE RULES
- Follow the black pixels in the linework image. They are the authoritative perimeter evidence.
- Include every visible step, notch and re-entrant corner — the linework image makes these obvious.
- Return a separate parent area only when a visible gap physically disconnects one roof structure from another.
- Do not divide one connected roof into individual sloping faces.
- Ignore non-roof marks visible in the original: dimensions, text, leaders, grids, borders, hatching, arrows, vents, skylights, walls.
- Suggest a pitch only when a pitch annotation is clearly visible in the original plan. Otherwise use null.
- Detect a dimension line only when both endpoints and its real length are clearly visible and readable in the original.
- If no reliable perimeter evidence can be found, set error to "unreadable".

Return only the structured JSON requested by the schema.`;
}

export function buildAiTakeoffComponentsPrompt(params: {
  width: number;
  height: number;
  areas: PromptRoofArea[];
  corners: PromptCornerCandidate[];
}): string {
  const areaContext = params.areas.map((area, areaIndex) => {
    const points = area.points.map((point, pointIndex) => (
      `a${areaIndex}v${pointIndex}=(${point.x},${point.y})`
    )).join(', ');
    return `Area ${areaIndex}: ${area.name}, pitch ${area.pitch_degrees ?? 'unknown'}°, perimeter vertices: ${points}`;
  }).join('\n');
  const cornerContext = params.corners.map(corner => (
    `a${corner.area_index}v${corner.point_index}: ${corner.corner_type}, likely ${corner.likely_component}`
  )).join('\n');
  return `You are an expert roofing plan analyst. Two images are provided:

1. ORIGINAL PLAN IMAGE — the raw architectural roof plan at ${params.width}×${params.height} pixels. Use this for context and to distinguish roof lines from annotations.
2. ADAPTIVE LINEWORK IMAGE — a high-contrast extraction where narrow strokes appear as black lines on white, and uniform shading has been removed. This image is CROPPED to the confirmed roof outline — everything outside is white. Use this as your primary geometry evidence.

Return integer coordinates in the original image-pixel coordinate system (0,0 = top-left). Both images share the same dimensions.

## LINEWORK PRIORITY
1. Use the adaptive linework image as the primary source. Black pixels ARE roof component lines.
2. Cross-reference the original plan to classify what each black line IS (ridge vs hip vs valley vs annotation to reject).
3. If a line appears in the original but not the linework image, it is likely shading or a fill boundary — do not treat it as a component.

## CONFIRMED PARENT AREAS
${areaContext}

## EXPECTED CORNERS
These are geometric candidates only, not evidence that a component exists:
${cornerContext || 'None'}

## TASK: DETECT EVERY VISIBLE INTERNAL STROKE
Find every continuous black line in the linework image that lies INSIDE the confirmed roof outline. Each such line is a roof component. Classify it using the rules below.

## COMPONENT TYPES (internal only — no perimeter types)
- ridge: A visible internal line connecting two roof planes. May be horizontal, vertical, or angled. Follows the black stroke exactly.
- hip: A diagonal line from an EXTERNAL perimeter corner (convex vertex) into the roof interior. Must have one endpoint at an external perimeter vertex.
- valley: A diagonal line from an INTERNAL perimeter corner (concave/re-entrant vertex) into the roof interior. Must have one endpoint at an internal perimeter vertex.
- broken_hip: A diagonal line inside the roof that branches from a valley or hip, not touching the perimeter.
- broken_barge: A line inside the roof, perpendicular to a ridge, not on the perimeter.

Do NOT return barge or spouting edges. The application calculates perimeter barges and spouting deterministically.

## CLASSIFICATION RULES
- A line ending on a STRAIGHT perimeter face (not at a corner) is a RIDGE.
- A line starting at an EXTERNAL corner (convex vertex) is a HIP.
- A line starting at an INTERNAL corner (concave vertex) is a VALLEY.
- A line branching from another hip/valley without touching the perimeter is a BROKEN_HIP.
- A line perpendicular to a ridge, inside the roof, not on the perimeter, is a BROKEN_BARGE.

## GRAPH FORMAT
- Create nodes at: perimeter vertices (a{area}v{index}), stroke endpoints, and stroke intersections.
- Every edge must reference start_node_id and end_node_id.
- Junction nodes must connect ≥2 edges.
- Set inferred=false for all edges — no guessing.
- For each expected corner, return status=resolved only if a visible edge connects to it, else status=unresolved.

## COMPLETENESS CHECK
After detecting, scan the linework image top-to-bottom, left-to-right. Every continuous black line inside the roof outline should be in your response. If you missed any, add them now.

Return only the structured JSON requested by the schema.`;
}

const pointSchema = {
  type: 'object' as const,
  properties: { x: { type: 'integer' as const }, y: { type: 'integer' as const } },
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
        p1: pointSchema, p2: pointSchema,
        real_length: { type: 'number' as const }, unit: { type: 'string' as const },
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

export const AI_TAKEOFF_OUTLINE_SCHEMA = {
  type: 'object' as const,
  properties: {
    error: { type: ['string', 'null'] as const },
    scale: scaleSchema,
    pitch: pitchSchema,
    roof_areas: { type: 'array' as const, items: roofAreaSchema },
    notes: { type: 'array' as const, items: { type: 'string' as const } },
  },
  required: ['error', 'scale', 'pitch', 'roof_areas', 'notes'] as const,
  additionalProperties: false,
};

export const AI_TAKEOFF_COMPONENT_GRAPH_SCHEMA = {
  type: 'object' as const,
  properties: {
    error: { type: ['string', 'null'] as const },
    nodes: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          id: { type: 'string' as const }, area_index: { type: 'integer' as const },
          kind: { type: 'string' as const, enum: ['perimeter_vertex', 'perimeter_point', 'junction'] as const },
          x: { type: 'integer' as const }, y: { type: 'integer' as const },
        },
        required: ['id', 'area_index', 'kind', 'x', 'y'] as const,
        additionalProperties: false,
      },
    },
    edges: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          id: { type: 'string' as const }, area_index: { type: 'integer' as const },
          type: { type: 'string' as const, enum: ['ridge', 'hip', 'valley', 'broken_hip', 'broken_barge'] as const },
          start_node_id: { type: 'string' as const }, end_node_id: { type: 'string' as const },
          confidence: { type: 'number' as const }, inferred: { type: 'boolean' as const },
        },
        required: ['id', 'area_index', 'type', 'start_node_id', 'end_node_id', 'confidence', 'inferred'] as const,
        additionalProperties: false,
      },
    },
    corner_resolutions: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          area_index: { type: 'integer' as const }, point_index: { type: 'integer' as const },
          status: { type: 'string' as const, enum: ['resolved', 'unresolved'] as const },
          edge_ids: { type: 'array' as const, items: { type: 'string' as const } },
          note: { type: ['string', 'null'] as const },
        },
        required: ['area_index', 'point_index', 'status', 'edge_ids', 'note'] as const,
        additionalProperties: false,
      },
    },
    unresolved: { type: 'array' as const, items: { type: 'string' as const } },
    notes: { type: 'array' as const, items: { type: 'string' as const } },
  },
  required: ['error', 'nodes', 'edges', 'corner_resolutions', 'unresolved', 'notes'] as const,
  additionalProperties: false,
};

export const AI_TAKEOFF_MODEL = process.env.AI_TAKEOFF_MODEL || 'gpt-5.6';
