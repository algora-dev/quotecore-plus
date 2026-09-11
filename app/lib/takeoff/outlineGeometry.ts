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

// ─── Part 4: Hip/valley 45-degree angle gate ─────────────────────────────

/**
 * Post-Scan 3 angle enforcement: hips and valleys must run diagonally
 * (within tolerance of 45 degrees) relative to the outline edges meeting
 * at the corner they terminate on. A hip/valley whose orientation is
 * parallel or perpendicular to the corner's edges (i.e. horizontal or
 * vertical relative to the roof) is demoted to 'uncertain'.
 *
 * Corner-relative (not image-axis) so it is rotation-invariant.
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

  const fold90 = (deg: number) => {
    let d = Math.abs(deg) % 180;
    if (d > 90) d = 180 - d;
    return d;
  };
  const angleOf = (dx: number, dy: number) => Math.atan2(-dy, dx) * 180 / Math.PI;

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
    const lineAngle = angleOf(line.end.x - line.start.x, line.end.y - line.start.y);
    const edgeAngles = [
      angleOf(vertex.x - prev.x, vertex.y - prev.y),
      angleOf(next.x - vertex.x, next.y - vertex.y),
    ];

    // The line must be within tolerance of 45 degrees from BOTH incident
    // edges (folded to 0-90). This covers both diagonals of an X shape.
    const withinTolerance = edgeAngles.every(ea =>
      Math.abs(fold90(lineAngle - ea) - 45) <= toleranceDeg
    );

    if (withinTolerance) return c;

    corrections.push({
      line_id: c.line_id,
      from: c.type as 'hip' | 'valley',
      to: 'uncertain',
      reason: `Line is not diagonal (~45 deg) to the corner edges (tolerance ${toleranceDeg} deg)`,
    });
    return {
      ...c,
      type: 'uncertain',
      reason: `Backend angle gate: ${c.type} demoted - line runs parallel/perpendicular to the corner edges, not ~45 deg`,
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
