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

## ONLY TASK: TRACE THE VISIBLE PARENT ROOF OUTLINE
Trace the complete visible outer perimeter of each physically separate roof structure. Do not detect or classify ridges, hips, valleys, barges, spouting or any other internal component in this stage.

## BLACK-STROKE PRIORITY
- The roof outline is the thin black or darkest continuous perimeter stroke. Follow that stroke, not the boundary of a shaded, coloured or filled region.
- Ignore all roof shading, grey/blue fill, transparency, colour changes and tonal boundaries. A change in shading is not an outline unless a narrow dark ink stroke is visibly present on the same path.
- Where the black perimeter stroke and the shaded roof mass disagree, the black perimeter stroke is authoritative.
- Check projections, steps and notches especially carefully because shaded fill often hides or simplifies their true black outline.

## OUTLINE RULES
- Follow the centre of the thin black/dark outer perimeter stroke.
- Include every visible step, notch and re-entrant corner. Never simplify or regularise the polygon.
- Return a separate parent area only when a visible gap physically disconnects one roof structure from another.
- Do not divide one connected roof into individual sloping faces.
- Ignore internal roof lines and all non-roof marks, including dimensions, text, leaders, grids, borders, hatching, arrows, vents, skylights, walls and openings.
- Suggest a pitch only when a pitch annotation is clearly visible and readable. Otherwise use null.
- Detect a dimension line only when both endpoints and its real length are clearly visible and readable.
- If the thin dark perimeter cannot be followed reliably, set error to unreadable rather than closing the polygon from the shaded roof mass.

Before returning, verify that every polygon segment lies over the thin black/dark perimeter stroke and not merely along an edge of the shaded fill.

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
    ? `\n## MINIMAL REPAIR ONLY\nKeep every image-supported node and edge from the previous graph unchanged. Apply only the listed validation corrections. Reclassify a visible edge when its endpoints prove the old classification impossible, remove unsupported edges, and fix missing references or corner-resolution records. Do not redraw the graph, move valid geometry, or add replacement edges.\n${params.repairContext}\n`
    : '';

  return `You are an expert roofing plan analyst. Detect and classify every visible INTERNAL roof-component stroke within the confirmed parent roof area(s). Ignore everything outside the confirmed outlines. Do not classify the outer perimeter; the application calculates perimeter barges and spouting separately.

The supplied image is the original plan image at ${params.width} pixels wide and ${params.height} pixels high. Return integer coordinates in this exact image-pixel coordinate system. The confirmed polygons below are authoritative and must be returned unchanged.

## CONFIRMED PARENT AREAS
${areaContext}

## EXPECTED CORNERS
These are geometric candidates only, not evidence that a component exists:
${cornerContext || 'None'}

## ABSOLUTE VISIBLE-LINE RULE
This rule overrides every definition, topology expectation and geometric assumption below.
- Use only thin black or darkest continuous linework as component evidence. Ignore shaded/filled areas, colour boundaries and tonal changes.
- A change in roof shading is not a component. A narrow dark ink stroke must be visibly present along the complete returned path.
- Return a component edge only when a continuous dark roof-component stroke lies directly underneath the complete returned path.
- If there is no continuous dark stroke underneath any part of a proposed internal path, do not return that component.
- Never invent, extend, complete or connect a component from roof geometry alone.
- Never add a component merely because a roof of this shape would normally contain one.
- Never add an edge to make the graph connected, symmetrical or structurally plausible.
- Set inferred=false for every returned edge. This task does not permit inferred component geometry.
- Completeness means finding every eligible visible stroke. It does not mean filling expected gaps with guessed components.
- Return no edges with type=barge or type=spouting. Perimeter classification is performed deterministically by the application after this scan.

## DETECTION ORDER
1. Inspect the image systematically from top to bottom and left to right. Find every thin, continuous black/dark stroke inside each confirmed outline before considering roof topology.
2. Reject non-component marks: shaded-region boundaries, colour transitions, dimensions, text, leaders, pitch arrows, hatching, grids, dashed wall/building footprints, borders, vents, skylights, openings and closed rectangular symbols.
3. Create nodes only at visible stroke endpoints, visible stroke intersections and the supplied perimeter vertices. Add a junction only where visible component strokes actually meet.
4. Classify each retained visible internal stroke using the component meanings below. Geometry helps classification but can never replace visible-line evidence.
5. Audit the entire roof again for missed continuous dark component strokes, then remove any edge whose complete path is not visibly supported.

## COMPONENT MEANINGS
- ridge: a visible internal high junction between roof planes. It may be horizontal, vertical or angled. Return it only along the visible stroke, from one visible endpoint or intersection to the other.
- hip: external high junction connecting an external perimeter corner to a ridge endpoint or shared internal junction. A hip MUST have one endpoint at an external perimeter vertex. ONLY create a hip when a visible diagonal line runs from that external corner into the roof. A line ending on a straight perimeter face is never a hip.
- valley: internal low junction connecting an internal/re-entrant perimeter corner to a ridge endpoint or shared internal junction. A valley MUST have one endpoint at an internal/re-entrant perimeter vertex. ONLY create a valley when a visible diagonal line runs from that internal corner into the roof. A line ending on a straight perimeter face is never a valley.
- broken_hip: an angle run connecting from the internal point of a valley or another hip, inside the roof area, not connected to the perimeter. ONLY create when a visible line on the plan forms the same path — never infer from junction geometry alone.
- broken_barge: a barge run inside the roof outline, perpendicular to a ridge, not on the perimeter. ONLY create when a visible line on the plan forms the same path.

## RIDGE-TO-PERIMETER CLASSIFICATION
- A visible horizontal or vertical dark stroke with one endpoint at an internal roof junction and the other endpoint on a straight section of the roof perimeter is a ridge, provided it is not an excluded annotation.
- Do not classify a line ending on a straight perimeter face as a hip or valley. Hips and valleys must begin at their required external or internal perimeter corner.
- Detect only the visible ridge stroke. Do not return the two perimeter barges; the application generates them from the ridge endpoint.

## GRAPH FORMAT RULES
- Every edge endpoint must reference a node ID. Never return free-floating line endpoints.
- Every internal edge must stop at the visible end of its stroke, a confirmed perimeter node or a visible shared junction.
- A junction node inside the roof must connect at least two visibly meeting component edges.
- Use separate edges for visibly broken runs, joined through the same junction node.
- For every expected corner, use status=resolved only when visible component edges account for it. Otherwise use status=unresolved with a note that no supporting component stroke is visible.
- Follow actual visible strokes. Do not reject a line merely because it is not exactly horizontal, vertical or 45 degrees.
- Do not copy dimension lines, text, hatching, pitch arrows, leaders or borders into the roof graph.
- All component geometry must belong to its area_index.

## CORNER RESOLUTIONS
Return one resolution for every expected corner listed above. List only visibly connected edge IDs. A geometric candidate with no visible component stroke is unresolved and must not cause an edge to be created.
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
          type: { type: 'string' as const, enum: ['ridge', 'hip', 'valley', 'broken_hip', 'broken_barge', 'barge', 'spouting'] as const },
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
