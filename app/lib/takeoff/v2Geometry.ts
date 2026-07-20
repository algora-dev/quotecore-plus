/**
 * V2 geometry normalization — server-side post-processing of Scan 1 output.
 *
 * Takes raw AI skeleton (nodes + segments) and produces a clean, validated
 * geometry graph ready for Scan 2 classification.
 */

export interface V2Node {
  id: string;
  area_index: number;
  kind: 'junction' | 'perimeter_point';
  x: number;
  y: number;
  confidence: number;
}

export interface V2Segment {
  id: string;
  area_index: number;
  start_node_id: string;
  end_node_id: string;
  confidence: number;
  inferred: boolean;
}

export interface V2RoofArea {
  name: string;
  points: Array<{ x: number; y: number }>;
  pitch_degrees: number | null;
}

export interface V2Skeleton {
  roof_areas: V2RoofArea[];
  internal_nodes: V2Node[];
  segments: V2Segment[];
  unresolved_geometry: string[];
  notes: string[];
}

export interface V2NormalizedSkeleton {
  roof_areas: V2RoofArea[];
  /** All nodes: implicit perimeter vertices + internal nodes (merged). */
  nodes: V2Node[];
  segments: V2Segment[];
  unresolved_geometry: string[];
  notes: string[];
  /** Segments rejected during normalization (for diagnostics). */
  rejected_segments: Array<{ segment: V2Segment; reason: string }>;
}

const SNAP_THRESHOLD = 8; // pixels — merge nodes within this distance
const MIN_SEGMENT_LENGTH = 5; // pixels — reject zero-length / tiny segments

/**
 * Build the complete node list: implicit perimeter vertices (a{area}v{index})
 * + internal nodes from the AI response.
 */
function buildPerimeterNodes(roofAreas: V2RoofArea[]): V2Node[] {
  const nodes: V2Node[] = [];
  for (let areaIdx = 0; areaIdx < roofAreas.length; areaIdx++) {
    const area = roofAreas[areaIdx];
    for (let vIdx = 0; vIdx < area.points.length; vIdx++) {
      const pt = area.points[vIdx];
      nodes.push({
        id: `a${areaIdx}v${vIdx}`,
        area_index: areaIdx,
        kind: 'perimeter_point',
        x: pt.x,
        y: pt.y,
        confidence: 1.0,
      });
    }
  }
  return nodes;
}

/**
 * Merge nodes that are within SNAP_THRESHOLD pixels of each other.
 * Returns a mapping from original ID → surviving ID.
 */
function mergeCloseNodes(
  nodes: V2Node[],
  threshold: number,
): { merged: V2Node[]; idMap: Map<string, string> } {
  const idMap = new Map<string, string>();
  const merged: V2Node[] = [];
  const consumed = new Set<string>();

  for (let i = 0; i < nodes.length; i++) {
    if (consumed.has(nodes[i].id)) continue;
    const survivor = { ...nodes[i] };
    consumed.add(survivor.id);
    idMap.set(survivor.id, survivor.id);

    for (let j = i + 1; j < nodes.length; j++) {
      if (consumed.has(nodes[j].id)) continue;
      const dx = nodes[i].x - nodes[j].x;
      const dy = nodes[i].y - nodes[j].y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= threshold) {
        consumed.add(nodes[j].id);
        idMap.set(nodes[j].id, survivor.id);
      }
    }
    merged.push(survivor);
  }

  return { merged, idMap };
}

/**
 * Check if a point lies on a line segment.
 */
function pointOnSegment(
  px: number, py: number,
  ax: number, ay: number,
  bx: number, by: number,
  tolerance: number = 5,
): boolean {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) {
    const ddx = px - ax;
    const ddy = py - ay;
    return ddx * ddx + ddy * ddy <= tolerance * tolerance;
  }
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const closestX = ax + t * dx;
  const closestY = ay + t * dy;
  const ddx = px - closestX;
  const ddy = py - closestY;
  return ddx * ddx + ddy * ddy <= tolerance * tolerance;
}

/**
 * Check if a segment is approximately horizontal, vertical, or 45°.
 */
function isValidV1Direction(
  ax: number, ay: number,
  bx: number, by: number,
): boolean {
  const dx = Math.abs(bx - ax);
  const dy = Math.abs(by - ay);
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1) return false;

  const angle = Math.atan2(dy, dx) * (180 / Math.PI);

  // Horizontal (0°), vertical (90°), or 45° diagonal
  const tolerance = 12; // degrees of tolerance
  const isHorizontal = angle <= tolerance || angle >= 180 - tolerance;
  const isVertical = Math.abs(angle - 90) <= tolerance;
  const isDiagonal45 = Math.abs(angle - 45) <= tolerance || Math.abs(angle - 135) <= tolerance;

  return isHorizontal || isVertical || isDiagonal45;
}

/**
 * Check if a point is inside a polygon (ray casting).
 */
function pointInPolygon(
  px: number, py: number,
  polygon: Array<{ x: number; y: number }>,
): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    const intersect = ((yi > py) !== (yj > py))
      && (px < (xj - xi) * (py - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Check if a point is on or near a polygon perimeter.
 */
function pointNearPerimeter(
  px: number, py: number,
  polygon: Array<{ x: number; y: number }>,
  tolerance: number = 5,
): boolean {
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    if (pointOnSegment(px, py, a.x, a.y, b.x, b.y, tolerance)) {
      return true;
    }
  }
  return false;
}

/**
 * Main normalization entry point.
 * Takes raw Scan 1 output and produces a clean, validated skeleton.
 */
export function normalizeV2Skeleton(
  raw: V2Skeleton,
  width: number,
  height: number,
): V2NormalizedSkeleton {
  const { roof_areas, internal_nodes: rawInternalNodes, segments: rawSegments, unresolved_geometry, notes } = raw;
  const rejected: Array<{ segment: V2Segment; reason: string }> = [];

  // 1. Build complete node list (perimeter vertices + internal nodes)
  const perimeterNodes = buildPerimeterNodes(roof_areas);
  let allNodes = [...perimeterNodes, ...rawInternalNodes];

  // 2. Snap internal nodes to nearby perimeter vertices
  const perimeterNodeMap = new Map<string, V2Node>();
  for (const pn of perimeterNodes) {
    perimeterNodeMap.set(pn.id, pn);
  }

  const snapIdMap = new Map<string, string>();
  for (const inode of rawInternalNodes) {
    snapIdMap.set(inode.id, inode.id);
    // Check if this internal node is actually very close to a perimeter vertex
    for (const pn of perimeterNodes) {
      const dx = inode.x - pn.x;
      const dy = inode.y - pn.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= SNAP_THRESHOLD) {
        snapIdMap.set(inode.id, pn.id);
        break;
      }
    }
  }

  // 3. Merge close internal nodes together
  const { merged: mergedNodes, idMap: mergeIdMap } = mergeCloseNodes(allNodes, SNAP_THRESHOLD);

  // Combine ID maps: original → final surviving ID
  const resolveId = (id: string): string => {
    // First check snap map (internal → perimeter)
    const snapped = snapIdMap.get(id);
    if (snapped && snapped !== id) return snapped;
    // Then check merge map
    const merged = mergeIdMap.get(id);
    if (merged) return merged;
    return id;
  };

  // Build surviving node lookup
  const nodeLookup = new Map<string, V2Node>();
  for (const n of mergedNodes) {
    nodeLookup.set(n.id, n);
  }

  // 4. Validate and filter segments
  const validSegments: V2Segment[] = [];
  const seenSegmentKeys = new Set<string>();

  for (const seg of rawSegments) {
    const startId = resolveId(seg.start_node_id);
    const endId = resolveId(seg.end_node_id);

    // Reject if both endpoints are the same (after merging)
    if (startId === endId) {
      rejected.push({ segment: seg, reason: 'zero-length after merge' });
      continue;
    }

    // Reject duplicates (same pair, any direction)
    const key1 = `${startId}|${endId}`;
    const key2 = `${endId}|${startId}`;
    if (seenSegmentKeys.has(key1) || seenSegmentKeys.has(key2)) {
      rejected.push({ segment: seg, reason: 'duplicate segment' });
      continue;
    }
    seenSegmentKeys.add(key1);

    // Look up node coordinates
    const startNode = nodeLookup.get(startId);
    const endNode = nodeLookup.get(endId);
    if (!startNode || !endNode) {
      rejected.push({ segment: seg, reason: 'missing node reference' });
      continue;
    }

    // Check segment length
    const sdx = endNode.x - startNode.x;
    const sdy = endNode.y - startNode.y;
    const segLen = Math.sqrt(sdx * sdx + sdy * sdy);
    if (segLen < MIN_SEGMENT_LENGTH) {
      rejected.push({ segment: seg, reason: 'segment too short' });
      continue;
    }

    // Reject if not valid V1 direction (horizontal/vertical/45°)
    if (!isValidV1Direction(startNode.x, startNode.y, endNode.x, endNode.y)) {
      rejected.push({ segment: seg, reason: 'not horizontal/vertical/45°' });
      continue;
    }

    // Reject if segment is entirely outside its area polygon
    const areaPolygon = roof_areas[seg.area_index]?.points;
    if (areaPolygon && areaPolygon.length >= 3) {
      const midX = (startNode.x + endNode.x) / 2;
      const midY = (startNode.y + endNode.y) / 2;
      const midInside = pointInPolygon(midX, midY, areaPolygon);
      const midOnPerimeter = pointNearPerimeter(midX, midY, areaPolygon, 10);
      if (!midInside && !midOnPerimeter) {
        rejected.push({ segment: seg, reason: 'segment midpoint outside roof area' });
        continue;
      }
    }

    validSegments.push({
      ...seg,
      start_node_id: startId,
      end_node_id: endId,
    });
  }

  // 5. Prune unused nodes (nodes with no connected segments)
  const usedNodeIds = new Set<string>();
  for (const seg of validSegments) {
    usedNodeIds.add(seg.start_node_id);
    usedNodeIds.add(seg.end_node_id);
  }
  const prunedNodes = mergedNodes.filter(n => usedNodeIds.has(n.id));

  // 6. Enforce: internal junctions must have degree >= 2
  const nodeDegree = new Map<string, number>();
  for (const seg of validSegments) {
    nodeDegree.set(seg.start_node_id, (nodeDegree.get(seg.start_node_id) ?? 0) + 1);
    nodeDegree.set(seg.end_node_id, (nodeDegree.get(seg.end_node_id) ?? 0) + 1);
  }
  // Perimeter points can have degree 1 (endpoint of a single internal stroke)
  // Internal junctions must have degree >= 2
  const degreeFailNodes = new Set<string>();
  for (const node of prunedNodes) {
    if (node.kind === 'junction' && (nodeDegree.get(node.id) ?? 0) < 2) {
      degreeFailNodes.add(node.id);
    }
  }

  // Remove segments connected to degree-fail junctions
  const finalSegments = validSegments.filter(seg => {
    if (degreeFailNodes.has(seg.start_node_id) || degreeFailNodes.has(seg.end_node_id)) {
      rejected.push({ segment: seg, reason: 'junction with degree < 2' });
      return false;
    }
    return true;
  });

  // Re-prune nodes after degree filtering
  const finalUsedNodeIds = new Set<string>();
  for (const seg of finalSegments) {
    finalUsedNodeIds.add(seg.start_node_id);
    finalUsedNodeIds.add(seg.end_node_id);
  }
  const finalNodes = prunedNodes.filter(n => finalUsedNodeIds.has(n.id));

  return {
    roof_areas,
    nodes: finalNodes,
    segments: finalSegments,
    unresolved_geometry,
    notes: [
      ...notes,
      rejected.length > 0 ? `Normalized: ${rejected.length} segment(s) rejected.` : '',
    ].filter(Boolean),
    rejected_segments: rejected,
  };
}

// ── Segment table builder for Scan 2 ────────────────────────────────────

export interface SegmentFact {
  segment_id: string;
  start_node: { id: string; kind: string; x: number; y: number };
  end_node: { id: string; kind: string; x: number; y: number };
  direction: 'horizontal' | 'vertical' | 'diagonal_45' | 'diagonal_135';
  angle_degrees: number;
  length_pixels: number;
}

/**
 * Build the structured segment table text for Scan 2 prompt.
 * Also returns the structured facts for server-side use.
 */
export function buildSegmentTable(
  skeleton: V2NormalizedSkeleton,
): { text: string; facts: SegmentFact[] } {
  const nodeLookup = new Map<string, V2Node>();
  for (const n of skeleton.nodes) {
    nodeLookup.set(n.id, n);
  }

  const facts: SegmentFact[] = [];
  for (const seg of skeleton.segments) {
    const start = nodeLookup.get(seg.start_node_id);
    const end = nodeLookup.get(seg.end_node_id);
    if (!start || !end) continue;

    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);
    const length = Math.sqrt(dx * dx + dy * dy);

    let direction: SegmentFact['direction'];
    const absAngle = Math.abs(angle);
    if (absAngle <= 12 || absAngle >= 168) direction = 'horizontal';
    else if (Math.abs(absAngle - 90) <= 12) direction = 'vertical';
    else if (Math.abs(absAngle - 45) <= 12) direction = 'diagonal_45';
    else direction = 'diagonal_135';

    facts.push({
      segment_id: seg.id,
      start_node: { id: start.id, kind: start.kind, x: start.x, y: start.y },
      end_node: { id: end.id, kind: end.kind, x: end.x, y: end.y },
      direction,
      angle_degrees: Math.round(angle * 10) / 10,
      length_pixels: Math.round(length),
    });
  }

  // Build text table
  const lines = facts.map(f => {
    const startKind = f.start_node.kind === 'perimeter_point' ? 'PERIMETER' : 'JUNCTION';
    const endKind = f.end_node.kind === 'perimeter_point' ? 'PERIMETER' : 'JUNCTION';
    return `${f.segment_id}: ${f.start_node.id}(${startKind} @${f.start_node.x},${f.start_node.y}) → ${f.end_node.id}(${endKind} @${f.end_node.x},${f.end_node.y}) | ${f.direction} | ${f.angle_degrees}° | ${f.length_pixels}px`;
  });

  return { text: lines.join('\n'), facts };
}
