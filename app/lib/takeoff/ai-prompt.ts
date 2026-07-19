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
  return `You are an expert roofing plan analyst. Analyse this top-down architectural roof plan.

The supplied image is the original plan image at ${width} pixels wide and ${height} pixels high. Return integer coordinates in this exact image-pixel coordinate system. Ignore dimensions, labels, leaders, grids, borders, hatching, arrows, vents, skylights and other annotations.

## ONE TASK: FIND PARENT ROOF OUTLINES
Trace the complete visible perimeter of each physically separate roof structure.

Rules:
- Follow the centre of the actual perimeter stroke.
- Include every visible step, notch and re-entrant corner. Never simplify the polygon.
- Return connected dormers and extensions as part of the same parent outline.
- Return a separate parent area only when the roof structure is physically disconnected.
- Do not divide one roof into individual sloping faces.
- Do not detect ridges, hips, valleys, barges or spouting in this stage.
- Suggest a pitch only when a pitch annotation is visible. Otherwise use null.
- Detect a labelled dimension line only when its endpoints and real length are readable.
- If part of an outline is genuinely ambiguous, still return the best continuous polygon and describe the ambiguity in notes.
- If this is not a usable roof plan, set error to unreadable.

## CORNER AUDIT
After tracing each polygon, inspect every polygon vertex:
- internal: a re-entrant/concave corner pointing into the roof footprint; this is a likely valley origin.
- external: a convex corner pointing away from the roof footprint; this may be a hip origin.
Return one corner candidate for every polygon vertex. Use the polygon point index exactly.

Return only the structured JSON requested by the schema.`;
}

export function buildAiTakeoffComponentsPrompt(params: {
  width: number;
  height: number;
  areas: PromptRoofArea[];
  corners: PromptCornerCandidate[];
  repairContext?: string;
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
  const repair = params.repairContext
    ? `\n## REQUIRED REPAIR\nA previous graph failed validation. Correct every listed violation while preserving valid detections:\n${params.repairContext}\n`
    : '';

  return `You are an expert roofing plan analyst. Detect every roof component inside the confirmed parent roof area(s).

The supplied image is the original plan image at ${params.width} pixels wide and ${params.height} pixels high. Return integer coordinates in this exact image-pixel coordinate system. The confirmed polygons below are authoritative and must be returned unchanged.

## CONFIRMED PARENT AREAS
${areaContext}

## EXPECTED CORNER ORIGINS
${cornerContext || 'No corner candidates supplied.'}

## BUILD ONE CONNECTED ROOF GRAPH
Work in this exact order:
1. Create all confirmed perimeter vertex nodes using their required IDs (for example a0v0).
2. Identify internal junction nodes before drawing component edges.
3. Detect every visible ridge run.
4. Resolve every internal/re-entrant corner with a valley unless clear roof geometry proves otherwise.
5. Resolve relevant external corners with hips. A gable/eaves-only corner does not require a hip.
6. Connect ridges, hips and valleys into one coherent internal skeleton.
7. Classify perimeter runs as barges or spouting only after the internal skeleton is complete.
8. Audit every node, edge and expected corner before returning.

## COMPONENT MEANINGS
- ridge: highest internal junction between roof planes. Usually drawn as a short horizontal or angled line at the peak.
- hip: external high junction, normally connecting an external perimeter corner to a ridge endpoint or shared internal junction.
- valley: internal low junction, normally connecting an internal/re-entrant perimeter corner to a ridge endpoint or shared internal junction.
- barge: gable-edge perimeter run that does not collect water. A barge is ALWAYS perpendicular to the ridge, branching off from a ridge endpoint to the perimeter. Where a ridge endpoint meets the perimeter, TWO barges branch off at right angles to the ridge, running along the perimeter in opposite directions.
- spouting: eaves/gutter perimeter run where water leaves the roof. Spouting is everything on the perimeter that is NOT a barge.

## CRITICAL BARGE RULES
- Every ridge endpoint that touches or nearly touches the perimeter MUST have barges branching from it.
- Barges run PERPENDICULAR to the ridge direction, along the perimeter.
- If a ridge runs horizontally, barges run vertically along the perimeter at the ridge's endpoints.
- If a ridge runs vertically, barges run horizontally along the perimeter at the ridge's endpoints.
- A mono-pitch roof (single slope, no ridge) gets 3 barges + 1 spouting.
- Barges and spouting together must cover the ENTIRE perimeter with no gaps or overlaps.
- Ridges NEVER end at spouting — only at barge, hip, valley, or another ridge.

## NON-NEGOTIABLE TOPOLOGY RULES
- Every edge endpoint must reference a node ID. Never return free-floating line endpoints.
- Every ridge, hip and valley must end at a confirmed perimeter node or a shared internal junction.
- Never stop a component short in empty roof space. If a printed annotation obscures the stroke, extend it to the geometrically valid junction and set inferred=true.
- A junction node inside the roof must connect at least two component edges.
- Use separate edges for visibly broken runs, joined through the same junction node.
- Every expected internal corner must resolve to a valley edge or an explicit unresolved record explaining contrary visible geometry.
- Follow actual visible strokes. Do not reject a line merely because it is not exactly horizontal, vertical or 45 degrees.
- Return high-recall candidates with confidence. Do not silently omit uncertain components.
- Barges and spouting must together reconstruct each complete perimeter exactly once, with no overlaps or gaps.
- Do not copy dimension lines, text, hatching, pitch arrows, leaders or borders into the roof graph.
- All component geometry must belong to its area_index.

## CORNER RESOLUTIONS
Return one resolution for every expected corner. List the connected edge IDs. Use status=resolved when the graph accounts for it. Use status=unresolved only when visible roof geometry genuinely contradicts the expected hip/valley and explain why.
${repair}
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
    corner_candidates: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          area_index: { type: 'integer' as const },
          point_index: { type: 'integer' as const },
          corner_type: { type: 'string' as const, enum: ['internal', 'external'] as const },
          likely_component: { type: 'string' as const, enum: ['valley', 'hip'] as const },
          confidence: { type: 'number' as const },
          note: { type: ['string', 'null'] as const },
        },
        required: ['area_index', 'point_index', 'corner_type', 'likely_component', 'confidence', 'note'] as const,
        additionalProperties: false,
      },
    },
    notes: { type: 'array' as const, items: { type: 'string' as const } },
  },
  required: ['error', 'scale', 'pitch', 'roof_areas', 'corner_candidates', 'notes'] as const,
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
          type: { type: 'string' as const, enum: ['ridge', 'hip', 'valley', 'barge', 'spouting'] as const },
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

export const AI_TAKEOFF_MODEL = process.env.AI_TAKEOFF_MODEL || 'gpt-5.4';
