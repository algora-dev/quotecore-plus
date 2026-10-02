/**
 * Deterministic outline vertex classification and endpoint matching.
 *
 * After Scan 1 returns the roof outline polygon, these utilities calculate
 * whether each vertex is convex or concave - removing the need for Scan 3
 * to make that determination visually.
 *
 * The vertex corner types are then matched to internal line segment
 * endpoints so Scan 3 (and the backend enforcement pass) can apply
 * authoritative hip/valley rules.
 */

import type { V3Point, V3Line } from './ai-prompt-v3';

// ─── Types ───────────────────────────────────────────────────────────────

export type CornerType = 'convex' | 'concave' | 'collinear';

export interface ClassifiedVertex {
  id: string;          // "V0", "V1", etc.
  index: number;
  x: number;
  y: number;
  cornerType: CornerType;
}

export interface AugmentedLine extends V3Line {
  startOutlineVertexId: string | null;
  startOutlineCornerType: CornerType | null;
  endOutlineVertexId: string | null;
  endOutlineCornerType: CornerType | null;
}

// ─── Part 1: Classify outline vertices ───────────────────────────────────

/**
 * Determine whether each outline vertex is convex, concave, or collinear.
 *
 * Works for both CW and CCW polygons by comparing each local turn sign
 * against the polygon's overall winding sign.
 *
 * Image coordinates: y increases downward, but the relative-sign approach
 * is invariant to that - it only cares whether the local turn matches the
 * overall winding.
 */
export function classifyOutlineVertices(vertices: V3Point[]): ClassifiedVertex[] {
  if (!Array.isArray(vertices) || vertices.length < 3) {
    throw new Error('A valid polygon requires at least three vertices.');
  }

  const count = vertices.length;

  // Signed area (twice) - sign tells us the winding direction.
  const signedAreaTwice = vertices.reduce((sum, point, index) => {
    const next = vertices[(index + 1) % count];
    return sum + point.x * next.y - next.x * point.y;
  }, 0);

  const orientationSign = Math.sign(signedAreaTwice);

  if (orientationSign === 0) {
    throw new Error('Cannot classify vertices of a zero-area polygon.');
  }

  const tolerance = 1e-6;

  return vertices.map((current, index) => {
    const previous = vertices[(index - 1 + count) % count];
    const next = vertices[(index + 1) % count];

    // Incoming vector: previous → current
    const incomingX = current.x - previous.x;
    const incomingY = current.y - previous.y;

    // Outgoing vector: current → next
    const outgoingX = next.x - current.x;
    const outgoingY = next.y - current.y;

    // Cross product (z-component)
    const cross = incomingX * outgoingY - incomingY * outgoingX;

    let cornerType: CornerType;

    if (Math.abs(cross) <= tolerance) {
      cornerType = 'collinear';
    } else if (Math.sign(cross) === orientationSign) {
      cornerType = 'convex';
    } else {
      cornerType = 'concave';
    }

    return {
      id: `V${index}`,
      index,
      x: current.x,
      y: current.y,
      cornerType,
    };
  });
}

// ─── Part 2: Match internal segment endpoints to outline vertices ────────

/**
 * For each internal line segment, find which outline vertex (if any) each
 * endpoint is closest to, within a pixel tolerance.
 *
 * Returns the lines augmented with vertex ID and corner type metadata.
 */
export function matchEndpointsToVertices(
  lines: V3Line[],
  vertices: ClassifiedVertex[],
  tolerance: number = 15,
): AugmentedLine[] {
  return lines.map(line => {
    const startMatch = findNearestVertex(line.start, vertices, tolerance);
    const endMatch = findNearestVertex(line.end, vertices, tolerance);

    return {
      ...line,
      startOutlineVertexId: startMatch?.id ?? null,
      startOutlineCornerType: startMatch?.cornerType ?? null,
      endOutlineVertexId: endMatch?.id ?? null,
      endOutlineCornerType: endMatch?.cornerType ?? null,
    };
  });
}

/**
 * Find the nearest vertex to a point within tolerance.
 * Returns null if no vertex is within tolerance, or if the nearest two
 * vertices are equidistant (ambiguous).
 */
function findNearestVertex(
  point: V3Point,
  vertices: ClassifiedVertex[],
  tolerance: number,
): ClassifiedVertex | null {
  let nearest: ClassifiedVertex | null = null;
  let nearestDist = Infinity;
  let secondNearestDist = Infinity;

  for (const v of vertices) {
    const dist = Math.hypot(point.x - v.x, point.y - v.y);
    if (dist <= tolerance) {
      if (dist < nearestDist) {
        secondNearestDist = nearestDist;
        nearest = v;
        nearestDist = dist;
      } else if (dist < secondNearestDist) {
        secondNearestDist = dist;
      }
    }
  }

  // If nearest is null, nothing was within tolerance.
  if (!nearest) return null;

  // If two vertices are equidistant (within a tiny epsilon), it's ambiguous.
  if (Math.abs(nearestDist - secondNearestDist) < 0.5) {
    return null;
  }

  return nearest;
}

// ─── Part 4: Hip/valley angle gate ─────────────────────────────────────

/** Ray-cast point-in-polygon over the ordered outline vertices. Used to pick
 *  the inward direction of a corner's angle bisector (parity test is
 *  winding-invariant, so it works for CW and CCW outlines). */
function pointInsidePolygon(vertices: Array<{ x: number; y: number }>, x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    const xi = vertices[i].x, yi = vertices[i].y;
    const xj = vertices[j].x, yj = vertices[j].y;
    const intersects = (yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

/**
 * Post-Scan 3 angle enforcement: hips and valleys must travel roughly along
 * the INWARD ANGLE BISECTOR of the outline corner they terminate on
 * (rotation- and corner-angle-invariant). A hip/valley running parallel or
 * perpendicular to the corner's bisector direction is demoted to 'uncertain'.
 *
 * Corner-relative bisector, not a fixed 45-degrees-from-both-edges test: on
 * stepped roofs with non-90-degree corners the old rule was mathematically
 * impossible to satisfy and vetoed legitimate hips/valleys. The bisector is
 * 45 degrees from both edges on square corners (identical to the old rule)
 * and generalises correctly to any corner angle.
 * Conservative: only demotes, never promotes or renames to another type.
 */
export function enforceHipValleyAngleRule(
  classifications: Array<{ line_id: string; type: string; confidence: number; reason: string }>,
  augmentedLines: AugmentedLine[],
  vertices: ClassifiedVertex[],
  toleranceDeg: number = 12,
): { corrections: EnforcementCorrection[]; classifications: Array<{ line_id: string; type: string; confidence: number; reason: string }> } {
  const vertexById = new Map<string, ClassifiedVertex>();
  for (const v of vertices) vertexById.set(v.id, v);
  const lineMap = new Map<string, AugmentedLine>();
  for (const l of augmentedLines) lineMap.set(l.id, l);

  const corrections: EnforcementCorrection[] = [];

  const corrected = classifications.map(c => {
    if (c.type !== 'hip' && c.type !== 'valley') return c;
    const line = lineMap.get(c.line_id);
    if (!line) return c;

    // Find the outline vertex this line terminates on (if any)
    const vertexId = line.startOutlineVertexId ?? line.endOutlineVertexId;
    if (!vertexId) return c; // already handled by vertex rule
    const vertex = vertexById.get(vertexId);
    if (!vertex) return c;

    // Incident outline edge directions at this vertex
    const n = vertices.length;
    const prev = vertices[(vertex.index - 1 + n) % n];
    const next = vertices[(vertex.index + 1) % n];

    // Inward angle bisector: unit vectors from the vertex along both edges;
    // their sum bisects the smaller angle between them. If that direction
    // points outside the roof (concave corners), negate it.
    const u1x = prev.x - vertex.x, u1y = prev.y - vertex.y;
    const u2x = next.x - vertex.x, u2y = next.y - vertex.y;
    const l1 = Math.hypot(u1x, u1y) || 1, l2 = Math.hypot(u2x, u2y) || 1;
    let bisX = (u1x / l1 + u2x / l2), bisY = (u1y / l1 + u2y / l2);
    const bisLen = Math.hypot(bisX, bisY);
    if (bisLen < 1e-6) return c; // collinear edges: no bisector, skip gate
    bisX /= bisLen; bisY /= bisLen;
    if (!pointInsidePolygon(vertices, vertex.x + bisX * 2, vertex.y + bisY * 2)) {
      bisX = -bisX; bisY = -bisY;
    }

    // Direction from the matched vertex endpoint along the line (undirected
    // check: the acute angle between the line and the bisector must be within
    // tolerance, covering both diagonals of an X at the corner).
    const startIsVertex = line.startOutlineVertexId === vertexId;
    const px = startIsVertex ? line.start.x : line.end.x;
    const py = startIsVertex ? line.start.y : line.end.y;
    const qx = startIsVertex ? line.end.x : line.start.x;
    const qy = startIsVertex ? line.end.y : line.start.y;
    const lineLen = Math.hypot(qx - px, qy - py) || 1;
    const dot = ((qx - px) * bisX + (qy - py) * bisY) / lineLen;
    const directed = Math.acos(Math.max(-1, Math.min(1, dot))) * 180 / Math.PI;
    const acute = Math.min(directed, 180 - directed);

    const withinTolerance = acute <= toleranceDeg;

    if (withinTolerance) return c;

    corrections.push({
      line_id: c.line_id,
      from: c.type as 'hip' | 'valley',
      to: 'uncertain',
      reason: `Line does not follow the corner's inward bisector within ${toleranceDeg} degrees`,
    });
    return {
      ...c,
      type: 'uncertain',
      reason: `Backend angle gate: ${c.type} demoted - line runs parallel/perpendicular to the corner's inward bisector, not along it`,
    };
  });

  return { corrections, classifications: corrected };
}

/**
 * Post-Scan 3 enforcement: correct hip ↔ valley misclassifications using
 * the authoritative vertex data.
 *
 * Rules (conservative - only touches hip/valley):
 * - convex vertex + type === 'hip'     → keep (correct)
 * - concave vertex + type === 'valley' → keep (correct)
 * - convex vertex + type === 'valley'  → correct to 'hip'
 * - concave vertex + type === 'hip'    → correct to 'valley'
 * - no vertex match + type === 'hip'/'valley' → change to 'uncertain'
 * - collinear vertex + type === 'hip'/'valley' → change to 'uncertain'
 *
 * All other classification types are left untouched.
 */
export interface EnforcementCorrection {
  line_id: string;
  from: 'hip' | 'valley';
  to: 'hip' | 'valley' | 'uncertain';
  reason: string;
}

export function enforceHipValleyVertexRule(
  classifications: Array<{
    line_id: string;
    type: string;
    confidence: number;
    reason: string;
  }>,
  augmentedLines: AugmentedLine[],
): { corrections: EnforcementCorrection[]; classifications: Array<{ line_id: string; type: string; confidence: number; reason: string }> } {
  const lineMap = new Map<string, AugmentedLine>();
  for (const l of augmentedLines) lineMap.set(l.id, l);

  const corrections: EnforcementCorrection[] = [];

  const corrected = classifications.map(c => {
    if (c.type !== 'hip' && c.type !== 'valley') return c;

    const line = lineMap.get(c.line_id);
    if (!line) return c;

    // Gather vertex info from both endpoints
    const vertexCorners: CornerType[] = [];
    if (line.startOutlineCornerType) vertexCorners.push(line.startOutlineCornerType);
    if (line.endOutlineCornerType) vertexCorners.push(line.endOutlineCornerType);

    // No vertex match at all - can't be hip or valley
    if (vertexCorners.length === 0) {
      corrections.push({
        line_id: c.line_id,
        from: c.type as 'hip' | 'valley',
        to: 'uncertain',
        reason: `No outline vertex match for either endpoint`,
      });
      return { ...c, type: 'uncertain', reason: `Backend: no outline vertex endpoint - cannot be ${c.type}` };
    }

    // Find the first non-collinear vertex (collinear doesn't determine hip/valley)
    const meaningfulCorner = vertexCorners.find(vc => vc !== 'collinear');

    if (!meaningfulCorner) {
      // All matched vertices are collinear
      corrections.push({
        line_id: c.line_id,
        from: c.type as 'hip' | 'valley',
        to: 'uncertain',
        reason: `Matched vertex is collinear - cannot determine hip/valley`,
      });
      return { ...c, type: 'uncertain', reason: 'Backend: matched vertex is collinear - cannot determine hip/valley' };
    }

    // Apply the authoritative rule
    const expectedType: 'hip' | 'valley' = meaningfulCorner === 'convex' ? 'hip' : 'valley';

    if (c.type === expectedType) {
      return c; // Correct as-is
    }

    // Misclassification - correct it
    corrections.push({
      line_id: c.line_id,
      from: c.type as 'hip' | 'valley',
      to: expectedType,
      reason: `Endpoint at ${meaningfulCorner} vertex → must be ${expectedType}`,
    });
    return {
      ...c,
      type: expectedType,
      reason: `Backend corrected: endpoint at ${meaningfulCorner} vertex → ${expectedType} (was ${c.type})`,
    };
  });

  return { corrections, classifications: corrected };
}
