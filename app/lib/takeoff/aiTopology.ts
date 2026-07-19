import type { AiScanData, CanvasPoint } from './applyAiResults';
import type { PromptCornerCandidate, PromptRoofArea } from './ai-prompt';

export type GraphNodeKind = 'perimeter_vertex' | 'perimeter_point' | 'junction';
export type GraphEdgeType = 'ridge' | 'hip' | 'valley' | 'broken_hip' | 'barge' | 'spouting';

export interface AiGraphNode extends CanvasPoint {
  id: string;
  area_index: number;
  kind: GraphNodeKind;
}

export interface AiGraphEdge {
  id: string;
  area_index: number;
  type: GraphEdgeType;
  start_node_id: string;
  end_node_id: string;
  confidence: number;
  inferred: boolean;
}

export interface AiComponentGraph {
  error: string | null;
  nodes: AiGraphNode[];
  edges: AiGraphEdge[];
  corner_resolutions: Array<{
    area_index: number;
    point_index: number;
    status: 'resolved' | 'unresolved';
    edge_ids: string[];
    note: string | null;
  }>;
  unresolved: string[];
  notes: string[];
}

export interface GraphValidationResult {
  graph: AiComponentGraph | null;
  violations: string[];
}

const EDGE_KEY: Record<GraphEdgeType, keyof AiScanData['components']> = {
  ridge: 'ridges', hip: 'hips', valley: 'valleys', broken_hip: 'hips', barge: 'barges', spouting: 'spouting',
};

function isPoint(value: Record<string, unknown>): boolean {
  return typeof value.x === 'number' && Number.isFinite(value.x)
    && typeof value.y === 'number' && Number.isFinite(value.y);
}

function isInsidePolygon(point: CanvasPoint, polygon: CanvasPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const current = polygon[i];
    const previous = polygon[j];
    const crosses = ((current.y > point.y) !== (previous.y > point.y))
      && point.x < ((previous.x - current.x) * (point.y - current.y))
        / ((previous.y - current.y) || Number.EPSILON) + current.x;
    if (crosses) inside = !inside;
  }
  return inside;
}

export function classifyPolygonCorners(areas: PromptRoofArea[]): PromptCornerCandidate[] {
  const candidates: PromptCornerCandidate[] = [];
  areas.forEach((area, areaIndex) => {
    const points = area.points;
    if (points.length < 3) return;
    let signedArea = 0;
    for (let i = 0; i < points.length; i++) {
      const current = points[i];
      const next = points[(i + 1) % points.length];
      signedArea += current.x * next.y - next.x * current.y;
    }
    const clockwise = signedArea > 0;
    for (let i = 0; i < points.length; i++) {
      const previous = points[(i - 1 + points.length) % points.length];
      const current = points[i];
      const next = points[(i + 1) % points.length];
      const cross = (current.x - previous.x) * (next.y - current.y)
        - (current.y - previous.y) * (next.x - current.x);
      const internal = clockwise ? cross < 0 : cross > 0;
      candidates.push({
        area_index: areaIndex,
        point_index: i,
        corner_type: internal ? 'internal' : 'external',
        likely_component: internal ? 'valley' : 'hip',
      });
    }
  });
  return candidates;
}

export function validateComponentGraph(
  value: unknown,
  areas: PromptRoofArea[],
  expectedCorners: PromptCornerCandidate[],
  width: number,
  height: number,
): GraphValidationResult {
  if (!value || typeof value !== 'object') {
    return { graph: null, violations: ['Response is not an object.'] };
  }
  const raw = value as Record<string, unknown>;
  if (!Array.isArray(raw.nodes) || !Array.isArray(raw.edges)) {
    return { graph: null, violations: ['Response is missing graph nodes or edges.'] };
  }

  const violations: string[] = [];
  const nodes: AiGraphNode[] = [];
  const nodeIds = new Set<string>();
  for (const rawNode of raw.nodes) {
    if (!rawNode || typeof rawNode !== 'object') continue;
    const node = rawNode as Record<string, unknown>;
    if (typeof node.id !== 'string' || nodeIds.has(node.id) || !isPoint(node)
      || typeof node.area_index !== 'number'
      || !['perimeter_vertex', 'perimeter_point', 'junction'].includes(String(node.kind))) {
      violations.push('Graph contains an invalid or duplicate node.');
      continue;
    }
    const x = node.x as number;
    const y = node.y as number;
    if (x < 0 || x >= width || y < 0 || y >= height) {
      violations.push(`Node ${node.id} is outside the analysis image.`);
      continue;
    }
    nodeIds.add(node.id);
    nodes.push({ id: node.id, area_index: node.area_index, kind: node.kind as GraphNodeKind, x, y });
  }

  const nodeMap = new Map(nodes.map(node => [node.id, node]));
  areas.forEach((area, areaIndex) => {
    area.points.forEach((point, pointIndex) => {
      const nodeId = `a${areaIndex}v${pointIndex}`;
      const node = nodeMap.get(nodeId);
      if (!node || node.kind !== 'perimeter_vertex') {
        violations.push(`Confirmed perimeter vertex ${nodeId} is missing from the graph.`);
        return;
      }
      if (Math.hypot(node.x - point.x, node.y - point.y) > 2) {
        violations.push(`Perimeter vertex ${nodeId} moved away from the confirmed outline.`);
      }
    });
  });
  const edges: AiGraphEdge[] = [];
  const edgeIds = new Set<string>();
  const degree = new Map<string, number>();
  for (const rawEdge of raw.edges) {
    if (!rawEdge || typeof rawEdge !== 'object') continue;
    const edge = rawEdge as Record<string, unknown>;
    if (typeof edge.id !== 'string' || edgeIds.has(edge.id)
      || typeof edge.start_node_id !== 'string' || typeof edge.end_node_id !== 'string'
      || typeof edge.area_index !== 'number'
      || !['ridge', 'hip', 'valley', 'broken_hip', 'barge', 'spouting'].includes(String(edge.type))) {
      violations.push('Graph contains an invalid or duplicate edge.');
      continue;
    }
    const start = nodeMap.get(edge.start_node_id);
    const end = nodeMap.get(edge.end_node_id);
    if (!start || !end) {
      violations.push(`Edge ${edge.id} references a missing node.`);
      continue;
    }
    if (start.id === end.id || Math.hypot(start.x - end.x, start.y - end.y) < 2) {
      violations.push(`Edge ${edge.id} has zero length.`);
      continue;
    }
    const area = areas[edge.area_index];
    if (!area) {
      violations.push(`Edge ${edge.id} references an unknown parent area.`);
      continue;
    }
    if (!['barge', 'spouting'].includes(String(edge.type))) {
      const midpoint = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
      if (!isInsidePolygon(midpoint, area.points)) {
        violations.push(`Edge ${edge.id} falls outside its confirmed roof area.`);
      }
    }
    edgeIds.add(edge.id);
    degree.set(start.id, (degree.get(start.id) ?? 0) + 1);
    degree.set(end.id, (degree.get(end.id) ?? 0) + 1);
    edges.push({
      id: edge.id,
      area_index: edge.area_index,
      type: edge.type as GraphEdgeType,
      start_node_id: edge.start_node_id,
      end_node_id: edge.end_node_id,
      confidence: typeof edge.confidence === 'number' ? edge.confidence : 0,
      inferred: edge.inferred === true,
    });
  }

  for (const node of nodes) {
    if (node.kind === 'junction' && (degree.get(node.id) ?? 0) < 2) {
      violations.push(`Internal junction ${node.id} is dangling.`);
    }
  }

  const rawResolutions = Array.isArray(raw.corner_resolutions) ? raw.corner_resolutions : [];
  for (const corner of expectedCorners.filter(candidate => candidate.corner_type === 'internal')) {
    const nodeId = `a${corner.area_index}v${corner.point_index}`;
    const hasValley = edges.some(edge => edge.type === 'valley'
      && (edge.start_node_id === nodeId || edge.end_node_id === nodeId));
    const explicitlyUnresolved = rawResolutions.some(resolution => {
      if (!resolution || typeof resolution !== 'object') return false;
      const item = resolution as Record<string, unknown>;
      return item.area_index === corner.area_index && item.point_index === corner.point_index
        && item.status === 'unresolved' && typeof item.note === 'string' && item.note.trim().length > 0;
    });
    if (!hasValley && !explicitlyUnresolved) {
      violations.push(`Internal corner ${nodeId} has no valley and no explicit resolution.`);
    }
  }

  const cornerResolutions = rawResolutions
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
    .map(item => ({
      area_index: typeof item.area_index === 'number' ? item.area_index : -1,
      point_index: typeof item.point_index === 'number' ? item.point_index : -1,
      status: item.status === 'resolved' ? 'resolved' as const : 'unresolved' as const,
      edge_ids: Array.isArray(item.edge_ids)
        ? item.edge_ids.filter((id): id is string => typeof id === 'string') : [],
      note: typeof item.note === 'string' ? item.note : null,
    }));

  return {
    graph: {
      error: typeof raw.error === 'string' ? raw.error : null,
      nodes,
      edges,
      corner_resolutions: cornerResolutions,
      unresolved: Array.isArray(raw.unresolved)
        ? raw.unresolved.filter((item): item is string => typeof item === 'string') : [],
      notes: Array.isArray(raw.notes)
        ? raw.notes.filter((item): item is string => typeof item === 'string') : [],
    },
    violations: Array.from(new Set(violations)),
  };
}

export function graphToComponents(graph: AiComponentGraph): AiScanData['components'] {
  const components: AiScanData['components'] = {
    ridges: [], hips: [], valleys: [], broken_hips: [], barges: [], spouting: [],
  };
  const nodes = new Map(graph.nodes.map(node => [node.id, node]));
  for (const edge of graph.edges) {
    const start = nodes.get(edge.start_node_id);
    const end = nodes.get(edge.end_node_id);
    if (!start || !end) continue;
    components[EDGE_KEY[edge.type]].push({
      points: [{ x: start.x, y: start.y }, { x: end.x, y: end.y }],
    });
  }
  return components;
}
