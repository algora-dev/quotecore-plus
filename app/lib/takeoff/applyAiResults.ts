/**
 * AI Takeoff — applyAiResults library.
 *
 * Pure functions that transform validated AI scan JSON into canvas-ready
 * data: canvas-pixel geometry, geometric snapping/validation,
 * area membership testing, calibration-based value computation, and typed
 * result objects that TakeoffWorkstation can consume to create Fabric objects.
 *
 * ZERO imports from TakeoffWorkstation — this module is UI-agnostic.
 * ZERO Fabric imports — callers create Fabric objects from the typed results.
 */

import type { Calibration } from './reconstructTypes';
import { AI_COMPONENT_REGISTRY, ALL_SEMANTIC_KEYS, type SemanticKey, SPOUTING_DASH_ARRAY, getSemanticColour, getLineOptions } from './aiComponentRegistry';

// ── Constants (must match TakeoffWorkstation) ───────────────────────────────

export const CANVAS_WIDTH = 800;
export const CANVAS_HEIGHT = 600;

// ── Types ───────────────────────────────────────────────────────────────────

export interface CanvasPoint { x: number; y: number }

export interface AiLineEntry { points: CanvasPoint[] }
export interface AiRoofArea {
  name: string;
  points: CanvasPoint[];
  pitch_degrees: number | null;
}

/** The validated AI result shape (from the API response). */
export interface AiScanData {
  scale: {
    detected: boolean;
    ratio: string | null;
    dimension_line: {
      p1: CanvasPoint; p2: CanvasPoint;
      real_length: number; unit: string;
    } | null;
  };
  pitch: { detected: boolean; global_degrees: number | null };
  roof_areas: AiRoofArea[];
  components: {
    ridges: AiLineEntry[];
    hips: AiLineEntry[];
    valleys: AiLineEntry[];
    barges: AiLineEntry[];
    spouting: AiLineEntry[];
  };
  notes: string[];
  error?: string;
}

/** Component type → system component name mapping. */
export type PlaceholderType = SemanticKey;

/** @deprecated Use AI_COMPONENT_REGISTRY instead. Kept for backward compat. */
export const PLACEHOLDER_NAMES: Record<PlaceholderType, string> = Object.fromEntries(
  ALL_SEMANTIC_KEYS.map(k => [k, AI_COMPONENT_REGISTRY[k].displayName])
) as Record<PlaceholderType, string>;

/** @deprecated Use getSemanticColour() instead. Kept for backward compat. */
export const SYSTEM_COMPONENT_COLOURS: Record<PlaceholderType, string> = Object.fromEntries(
  ALL_SEMANTIC_KEYS.map(k => [k, AI_COMPONENT_REGISTRY[k].colour])
) as Record<PlaceholderType, string>;

/** Re-export for backward compat. */
export { SPOUTING_DASH_ARRAY, getSemanticColour, getLineOptions };

/** A single measurement ready for canvas creation. */
export interface AiMeasurement {
  /** Generated client-side id (crypto.randomUUID). */
  id: string;
  type: 'line' | 'area';
  /** Canvas-space points. */
  canvasPoints: CanvasPoint[];
  /** Real-world value (length in calibration units, or area in sq units). */
  value: number;
  /** The placeholder type this measurement belongs to. */
  placeholderType: PlaceholderType;
  /** Semantic key — mirrors placeholderType but is the authoritative field
   *  for defensive validation (prevents Barge→Spouting ID mix). */
  semanticKey: SemanticKey;
  /** The system component id for this placeholder type. */
  componentId: string;
  /** Parent roof area id (from point-in-polygon test). */
  quoteRoofAreaId: string | null;
  /** Always true for AI-created entries. */
  aiOrigin: boolean;
}

/**
 * Defensive validation: verify that a semantic key and component ID are
 * consistent. Prevents a Barge measurement from being stored under the
 * Spouting component ID (or vice versa).
 *
 * Returns true if the component ID matches the expected system component
 * for the given semantic key.
 */
export function validateMeasurementConsistency(
  semanticKey: SemanticKey,
  componentId: string,
  systemComponentIds: Record<SemanticKey, string>,
): boolean {
  const expected = systemComponentIds[semanticKey];
  if (!expected || expected !== componentId) {
    console.error(
      `[AI Takeoff] Consistency violation: semantic key "${semanticKey}" expected component ID "${expected}" but got "${componentId}"`,
    );
    return false;
  }
  return true;
}

/** A detected roof area ready for canvas creation. */
export interface AiRoofAreaResult {
  id: string;
  name: string;
  canvasPoints: CanvasPoint[];
  area: number;
  pitch: number;
}

/** Full result of applyAiResults. */
export interface ApplyAiResult {
  roofAreas: AiRoofAreaResult[];
  measurements: AiMeasurement[];
  /** Count of detections dropped during snapAndValidate. */
  droppedCount: number;
  /** Notes passed through from the AI. */
  notes: string[];
  /** Scale cross-check result (if a dimension line was detected). */
  scaleCheck: {
    hasDimensionLine: boolean;
    aiScale: number | null; // units per pixel from AI dimension line
    userScale: number | null; // units per pixel from calibration
    discrepancyPct: number | null; // percentage difference
    warning: string | null;
  } | null;
}

// ── snapAndValidate ─────────────────────────────────────────────────────────

/** Tolerance for vertex snapping, in canvas pixels. */
const VERTEX_SNAP_TOLERANCE = 12;
/** Tolerance for endpoint clustering (same). */
const CLUSTER_TOLERANCE = 12;
/** Maximum allowed deviation from target angle (degrees). */
const ANGLE_TOLERANCE = 8;

export interface SnapResult {
  accepted: AiLineEntry[];
  rejected: number;
}

/**
 * Snap and validate AI-detected lines against locked geometric rules.
 * - Ridges → exactly 0° or 90°
 * - Hips/valleys → exactly 45° or 135°
 * - Vertex snap: endpoints near roof-area polygon vertices get snapped
 * - Endpoint clustering: nearby endpoints merge to centroid
 * - Reject: out-of-range, zero-length, duplicate lines
 */
export function snapAndValidate(
  entries: AiLineEntry[],
  type: PlaceholderType,
  roofAreaVertices: CanvasPoint[],
): SnapResult {
  const accepted: AiLineEntry[] = [];
  let rejected = 0;

  // Dedup tracking
  const seen = new Set<string>();

  for (const entry of entries) {
    if (entry.points.length < 2) { rejected++; continue; }

    let p1 = { ...entry.points[0] };
    let p2 = { ...entry.points[entry.points.length - 1] };

    // 1. Range check
    if (!inRange(p1) || !inRange(p2)) { rejected++; continue; }

    // 2. Zero-length check
    if (distance(p1, p2) < 2) { rejected++; continue; }

    // 3. Angle snap
    const angle = angleDegrees(p1, p2);
    if (!snapAngle(angle, type)) { rejected++; continue; }

    // Apply angle snap (rotate about midpoint)
    const snapped = snapToAngle(p1, p2, type);
    p1 = snapped.p1;
    p2 = snapped.p2;

    // 4. Vertex snap — snap endpoints to nearby polygon vertices
    p1 = snapToVertex(p1, roofAreaVertices);
    p2 = snapToVertex(p2, roofAreaVertices);

    // 5. Dedup (check both directions)
    const key = `${Math.round(p1.x)},${Math.round(p1.y)}|${Math.round(p2.x)},${Math.round(p2.y)}`;
    const reverseKey = `${Math.round(p2.x)},${Math.round(p2.y)}|${Math.round(p1.x)},${Math.round(p1.y)}`;
    if (seen.has(key) || seen.has(reverseKey)) { rejected++; continue; }
    seen.add(key);

    accepted.push({ points: [p1, p2] });
  }

  return { accepted, rejected };
}

function inRange(p: CanvasPoint): boolean {
  return p.x >= 0 && p.x < CANVAS_WIDTH && p.y >= 0 && p.y < CANVAS_HEIGHT;
}

function distance(a: CanvasPoint, b: CanvasPoint): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function angleDegrees(a: CanvasPoint, b: CanvasPoint): number {
  return Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
}

function snapAngle(angle: number, type: PlaceholderType): boolean {
  // Normalize to 0–180
  let a = angle % 180;
  if (a < 0) a += 180;

  if (type === 'ridges' || type === 'barges' || type === 'spouting') {
    // Ridges, barges, and spouting are ALL horizontal (0°) or vertical (90°).
    // Barges and spouting follow the building outline, which is orthogonal.
    return a <= ANGLE_TOLERANCE || Math.abs(a - 90) <= ANGLE_TOLERANCE || Math.abs(a - 180) <= ANGLE_TOLERANCE;
  }
  // hips + valleys: 45° or 135°
  return Math.abs(a - 45) <= ANGLE_TOLERANCE || Math.abs(a - 135) <= ANGLE_TOLERANCE;
}

function snapToAngle(
  p1: CanvasPoint,
  p2: CanvasPoint,
  type: PlaceholderType,
): { p1: CanvasPoint; p2: CanvasPoint } {
  const midX = (p1.x + p2.x) / 2;
  const midY = (p1.y + p2.y) / 2;
  const len = distance(p1, p2);

  const angle = angleDegrees(p1, p2);
  let a = angle % 180;
  if (a < 0) a += 180;

  let targetAngle: number;
  if (type === 'ridges' || type === 'barges' || type === 'spouting') {
    // Horizontal or vertical — snap to nearest
    targetAngle = (a <= 45 || a >= 135) ? 0 : 90;
  } else {
    // hips/valleys — snap to 45° or 135°
    targetAngle = (Math.abs(a - 45) <= Math.abs(a - 135)) ? 45 : 135;
  }

  // Convert to radians and rotate about midpoint
  const rad = targetAngle * Math.PI / 180;
  const halfLen = len / 2;
  return {
    p1: { x: Math.round(midX - halfLen * Math.cos(rad)), y: Math.round(midY - halfLen * Math.sin(rad)) },
    p2: { x: Math.round(midX + halfLen * Math.cos(rad)), y: Math.round(midY + halfLen * Math.sin(rad)) },
  };
}

function snapToVertex(
  p: CanvasPoint,
  vertices: CanvasPoint[],
  tolerance = VERTEX_SNAP_TOLERANCE,
): CanvasPoint {
  let best = p;
  let bestDist = tolerance;
  for (const v of vertices) {
    const d = distance(p, v);
    if (d < bestDist) {
      bestDist = d;
      best = { ...v };
    }
  }
  return best;
}

/**
 * Cluster nearby endpoints across all lines of the same type.
 * Endpoints within CLUSTER_TOLERANCE merge to their centroid.
 */
export function clusterEndpoints(entries: AiLineEntry[]): AiLineEntry[] {
  if (entries.length === 0) return entries;

  // Collect all endpoints
  const endpoints: CanvasPoint[] = [];
  for (const e of entries) {
    endpoints.push(e.points[0]);
    endpoints.push(e.points[e.points.length - 1]);
  }

  // Build clusters
  const clusters: CanvasPoint[][] = [];
  const assigned: boolean[] = new Array(endpoints.length).fill(false);

  for (let i = 0; i < endpoints.length; i++) {
    if (assigned[i]) continue;
    const cluster = [endpoints[i]];
    assigned[i] = true;
    for (let j = i + 1; j < endpoints.length; j++) {
      if (assigned[j]) continue;
      if (distance(endpoints[i], endpoints[j]) < CLUSTER_TOLERANCE) {
        cluster.push(endpoints[j]);
        assigned[j] = true;
      }
    }
    clusters.push(cluster);
  }

  // Compute centroids
  const centroidMap = new Map<string, CanvasPoint>();
  for (const cluster of clusters) {
    const cx = Math.round(cluster.reduce((s, p) => s + p.x, 0) / cluster.length);
    const cy = Math.round(cluster.reduce((s, p) => s + p.y, 0) / cluster.length);
    const centroid = { x: cx, y: cy };
    for (const p of cluster) {
      centroidMap.set(`${p.x},${p.y}`, centroid);
    }
  }

  // Apply
  return entries.map(e => {
    const p1 = e.points[0];
    const p2 = e.points[e.points.length - 1];
    return {
      points: [
        centroidMap.get(`${p1.x},${p1.y}`) ?? p1,
        centroidMap.get(`${p2.x},${p2.y}`) ?? p2,
      ],
    };
  });
}

// ── Point-in-polygon area membership ────────────────────────────────────────

/**
 * Ray-casting point-in-polygon test.
 * Returns the index of the first area whose polygon contains the point,
 * or -1 if outside all areas.
 */
export function findContainingArea(
  point: CanvasPoint,
  areas: CanvasPoint[][],
): number {
  for (let i = 0; i < areas.length; i++) {
    if (pointInPolygon(point, areas[i])) return i;
  }
  return -1;
}

function pointInPolygon(point: CanvasPoint, polygon: CanvasPoint[]): boolean {
  if (polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    const intersect = ((yi > point.y) !== (yj > point.y))
      && (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// ── Value computation ───────────────────────────────────────────────────────

/**
 * Compute the real-world length of a line given canvas points + calibration.
 * Mirrors the manual draw handler: pixelDistance * avgScale.
 */
export function computeLineValue(
  p1: CanvasPoint,
  p2: CanvasPoint,
  calibrations: Calibration[],
): number {
  if (calibrations.length === 0) return 0;
  const pixelDistance = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
  const avgScale = calibrations.reduce((s, cal) => s + cal.scale, 0) / calibrations.length;
  return pixelDistance * avgScale;
}

/**
 * Compute the real-world area of a polygon given canvas points + calibration.
 * Mirrors the manual draw handler: pixelArea * avgScale².
 */
export function computeAreaValue(
  points: CanvasPoint[],
  calibrations: Calibration[],
): number {
  if (calibrations.length === 0 || points.length < 3) return 0;
  const pixelArea = shoelaceArea(points);
  const avgScale = calibrations.reduce((s, cal) => s + cal.scale, 0) / calibrations.length;
  return pixelArea * avgScale * avgScale;
}

function shoelaceArea(points: CanvasPoint[]): number {
  let area = 0;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    area += (points[j].x + points[i].x) * (points[j].y - points[i].y);
  }
  return Math.abs(area) / 2;
}

// ── Scale cross-check ───────────────────────────────────────────────────────

/**
 * If the AI detected a labelled dimension line, compute the percentage
 * discrepancy against the user's calibration. Only dimension lines are
 * directly comparable (not printed ratios like "1:100").
 */
export function computeScaleCheck(
  aiData: AiScanData,
  calibrations: Calibration[],
): ApplyAiResult['scaleCheck'] {
  const dl = aiData.scale.dimension_line;
  if (!dl) {
    return {
      hasDimensionLine: false,
      aiScale: null,
      userScale: null,
      discrepancyPct: null,
      warning: null,
    };
  }

  if (calibrations.length === 0) {
    return {
      hasDimensionLine: true,
      aiScale: null,
      userScale: null,
      discrepancyPct: null,
      warning: null,
    };
  }

  const pixelLength = distance(dl.p1, dl.p2);
  // AI says this pixel length = real_length (in unit)
  const aiScale = dl.real_length / pixelLength; // units per pixel

  // User calibration (average)
  const userScale = calibrations.reduce((s, cal) => s + cal.scale, 0) / calibrations.length;

  const discrepancyPct = Math.abs(aiScale - userScale) / userScale * 100;

  const warning = discrepancyPct > 15
    ? `The plan's dimension markings suggest your calibration may be off by ${discrepancyPct.toFixed(0)}% — double-check before saving.`
    : null;

  return { hasDimensionLine: true, aiScale, userScale, discrepancyPct, warning };
}

// ── Perimeter accounting pass ───────────────────────────────────────────────

/**
 * Defensive perimeter-accounting pass.
 *
 * Every outline segment must be classified exactly once — either Barge or
 * Spouting — never both, never silently omitted.
 *
 * Rules:
 * 1. For each roof area polygon, iterate each edge (segment).
 * 2. Check if the segment already appears in the AI's barges or spouting arrays.
 * 3. If it appears in BOTH — remove from spouting (barge wins).
 * 4. If it appears in NEITHER — default to Spouting (unless clear gable evidence).
 * 5. Mono-pitch rectangle rule: 3 barges + 1 spouting.
 *
 * Returns the corrected components object.
 */
export function perimeterAccountingPass(
  aiData: AiScanData,
): AiScanData['components'] {
  const corrected = structuredClone(aiData.components);

  // Build edge sets for barges and spouting (both directions)
  const edgeKey = (p1: CanvasPoint, p2: CanvasPoint) =>
    `${Math.round(p1.x)},${Math.round(p1.y)}|${Math.round(p2.x)},${Math.round(p2.y)}`;

  const bargeEdges = new Set<string>();
  const spoutingEdges = new Set<string>();

  for (const entry of corrected.barges) {
    if (entry.points.length < 2) continue;
    const p1 = entry.points[0], p2 = entry.points[entry.points.length - 1];
    bargeEdges.add(edgeKey(p1, p2));
    bargeEdges.add(edgeKey(p2, p1)); // reverse
  }
  for (const entry of corrected.spouting) {
    if (entry.points.length < 2) continue;
    const p1 = entry.points[0], p2 = entry.points[entry.points.length - 1];
    spoutingEdges.add(edgeKey(p1, p2));
    spoutingEdges.add(edgeKey(p2, p1)); // reverse
  }

  // 1. Remove spouting entries that duplicate barge entries (barge wins)
  corrected.spouting = corrected.spouting.filter(entry => {
    if (entry.points.length < 2) return false;
    const p1 = entry.points[0], p2 = entry.points[entry.points.length - 1];
    return !bargeEdges.has(edgeKey(p1, p2));
  });

  // 2. For each roof area polygon edge, check if it's classified.
  //    If unclassified, add it as Spouting (default).
  const TOLERANCE = 5; // pixels

  function edgesMatch(a1: CanvasPoint, a2: CanvasPoint, b1: CanvasPoint, b2: CanvasPoint): boolean {
    const d1 = Math.hypot(a1.x - b1.x, a1.y - b1.y);
    const d2 = Math.hypot(a2.x - b2.x, a2.y - b2.y);
    const d3 = Math.hypot(a1.x - b2.x, a1.y - b2.y);
    const d4 = Math.hypot(a2.x - b1.x, a2.y - b1.y);
    return (d1 < TOLERANCE && d2 < TOLERANCE) || (d3 < TOLERANCE && d4 < TOLERANCE);
  }

  for (const area of aiData.roof_areas) {
    const pts = area.points;
    for (let i = 0; i < pts.length; i++) {
      const p1 = pts[i];
      const p2 = pts[(i + 1) % pts.length];

      // Check if this edge is already in barges or spouting
      let foundInBarge = false;
      let foundInSpouting = false;

      for (const entry of corrected.barges) {
        if (entry.points.length < 2) continue;
        const e1 = entry.points[0], e2 = entry.points[entry.points.length - 1];
        if (edgesMatch(p1, p2, e1, e2)) { foundInBarge = true; break; }
      }
      if (foundInBarge) continue; // already classified as barge

      for (const entry of corrected.spouting) {
        if (entry.points.length < 2) continue;
        const e1 = entry.points[0], e2 = entry.points[entry.points.length - 1];
        if (edgesMatch(p1, p2, e1, e2)) { foundInSpouting = true; break; }
      }
      if (foundInSpouting) continue; // already classified as spouting

      // Unclassified perimeter segment — default to Spouting
      corrected.spouting.push({ points: [{ ...p1 }, { ...p2 }] });
    }
  }

  // 3. Mono-pitch rectangle rule: if a roof area has exactly 4 edges
  //    and no ridge was detected, validate 3 barges + 1 spouting.
  //    If the counts are wrong, log a note but don't force-correct
  //    (the AI may have valid reasons for a non-standard classification).
  for (const area of aiData.roof_areas) {
    if (area.points.length === 4) {
      const hasRidge = corrected.ridges.length > 0;
      if (!hasRidge) {
        // Mono-pitch: expect 3 barges + 1 spouting for this area
        // Count edges that belong to this area
        let bargeCount = 0;
        let spoutingCount = 0;
        const pts = area.points;
        for (let i = 0; i < 4; i++) {
          const p1 = pts[i];
          const p2 = pts[(i + 1) % 4];
          for (const entry of corrected.barges) {
            if (entry.points.length < 2) continue;
            const e1 = entry.points[0], e2 = entry.points[entry.points.length - 1];
            if (edgesMatch(p1, p2, e1, e2)) { bargeCount++; break; }
          }
          for (const entry of corrected.spouting) {
            if (entry.points.length < 2) continue;
            const e1 = entry.points[0], e2 = entry.points[entry.points.length - 1];
            if (edgesMatch(p1, p2, e1, e2)) { spoutingCount++; break; }
          }
        }
        // If we have 0 barges and 4 spouting on a mono-pitch, flip 3 to barge
        if (bargeCount === 0 && spoutingCount === 4) {
          // Find the longest edge — that's likely the spouting (eaves/gutter)
          // The other 3 are barges
          let longestIdx = 0;
          let longestLen = 0;
          for (let i = 0; i < 4; i++) {
            const p1 = pts[i];
            const p2 = pts[(i + 1) % 4];
            const len = Math.hypot(p2.x - p1.x, p2.y - p1.y);
            if (len > longestLen) { longestLen = len; longestIdx = i; }
          }
          // Remove all 4 spouting entries for this area, re-add 1 spouting (longest) + 3 barges
          const areaEdges = pts.map((p, i) => ({ p1: p, p2: pts[(i + 1) % 4] }));
          corrected.spouting = corrected.spouting.filter(entry => {
            if (entry.points.length < 2) return true;
            const e1 = entry.points[0], e2 = entry.points[entry.points.length - 1];
            return !areaEdges.some(ae => edgesMatch(ae.p1, ae.p2, e1, e2));
          });
          // Add the longest as spouting
          corrected.spouting.push({ points: [{ ...areaEdges[longestIdx].p1 }, { ...areaEdges[longestIdx].p2 }] });
          // Add the other 3 as barges
          for (let i = 0; i < 4; i++) {
            if (i === longestIdx) continue;
            corrected.barges.push({ points: [{ ...areaEdges[i].p1 }, { ...areaEdges[i].p2 }] });
          }
        }
      }
    }
  }

  return corrected;
}

// ── Main: applyAiResults ────────────────────────────────────────────────────

export interface ApplyAiParams {
  aiData: AiScanData;
  calibrations: Calibration[];
  /** Map of placeholder type → system component id (from the component fetch). */
  systemComponentIds: Record<PlaceholderType, string>;
}

/**
 * Transform validated AI scan data into canvas-ready results.
 *
 * Steps:
 * 1. Compute background layout (scale + offsets)
 * 2. Collect roof area polygon vertices for vertex snapping
 * 3. For each placeholder type: snapAndValidate then clusterEndpoints
 * 4. Point-in-polygon test: stamp each line with its parent roof area
 * 5. Compute real-world values using calibration
 * 6. Build roof area results with area + pitch
 * 7. Scale cross-check
 */
export function applyAiResults(params: ApplyAiParams): ApplyAiResult {
  const { aiData, calibrations, systemComponentIds } = params;

  // ── Step 3: Perimeter-accounting pass ──────────────────────────────
  // Every outline segment classified exactly once. Unclassified → Spouting.
  // Mono-pitch rectangle rule: 3 barges + 1 spouting.
  const correctedComponents = perimeterAccountingPass(aiData);
  const correctedAiData = { ...aiData, components: correctedComponents };

  // Collect roof area vertices for vertex snapping
  const areaPolygons = correctedAiData.roof_areas.map(a => a.points);
  const allVertices = areaPolygons.flat();

  // Process roof areas first (need their ids for line membership)
  const roofAreaResults: AiRoofAreaResult[] = correctedAiData.roof_areas.map((area, idx) => {
    const canvasPoints = area.points.map(point => ({ ...point }));
    const areaValue = computeAreaValue(canvasPoints, calibrations);
    const pitch = area.pitch_degrees ?? aiData.pitch.global_degrees ?? 0;
    return {
      id: crypto.randomUUID(),
      name: area.name || `Area ${idx + 1}`,
      canvasPoints,
      area: areaValue,
      pitch,
    };
  });

  const areaPolygonsForHitTest = correctedAiData.roof_areas.map(a => a.points);

  // Process each placeholder type
  const measurements: AiMeasurement[] = [];
  let totalDropped = 0;

  const placeholderTypes: PlaceholderType[] = ALL_SEMANTIC_KEYS;

  for (const ptype of placeholderTypes) {
    const rawEntries = correctedAiData.components[ptype];

    // snapAndValidate
    const snapResult = snapAndValidate(rawEntries, ptype, allVertices);
    totalDropped += snapResult.rejected;

    // clusterEndpoints
    const clustered = clusterEndpoints(snapResult.accepted);

    // Convert to measurements
    for (const entry of clustered) {
      const canvasPoints = entry.points.map(point => ({ ...point }));
      const value = computeLineValue(canvasPoints[0], canvasPoints[1], calibrations);

      // Defensive validation: prevent Barge→Spouting ID mix
      const componentId = systemComponentIds[ptype];
      if (!validateMeasurementConsistency(ptype, componentId, systemComponentIds)) {
        continue; // skip inconsistent measurement
      }

      // Point-in-polygon: use midpoint of the line
      const midpoint: CanvasPoint = {
        x: (entry.points[0].x + entry.points[1].x) / 2,
        y: (entry.points[0].y + entry.points[1].y) / 2,
      };
      const areaIdx = findContainingArea(midpoint, areaPolygonsForHitTest);
      const quoteRoofAreaId = areaIdx >= 0 ? roofAreaResults[areaIdx].id : (roofAreaResults[0]?.id ?? null);

      measurements.push({
        id: crypto.randomUUID(),
        type: 'line',
        canvasPoints,
        value,
        placeholderType: ptype,
        semanticKey: ptype,
        componentId,
        quoteRoofAreaId,
        aiOrigin: true,
      });
    }
  }

  // Scale cross-check
  const scaleCheck = computeScaleCheck(correctedAiData, calibrations);

  return {
    roofAreas: roofAreaResults,
    measurements,
    droppedCount: totalDropped,
    notes: correctedAiData.notes,
    scaleCheck,
  };
}

// ── Reset restore helper ────────────────────────────────────────────────────

/**
 * Given a stored ai_scan_result (the validated JSON from the DB),
 * re-derive the full measurement set. Used by "Reset AI Entries".
 *
 * This is the same transformation as applyAiResults, but reads from the
 * stored snapshot instead of a fresh API response. The results are
 * deterministic given the same input, so the restored measurements
 * match the original apply (any user edits since then are discarded
 * for ai_origin entries only — manual entries are untouched).
 */
export function resetFromStoredScan(
  storedResult: AiScanData,
  calibrations: Calibration[],
  systemComponentIds: Record<PlaceholderType, string>,
): ApplyAiResult {
  // Identical to applyAiResults — the stored result is the same shape.
  return applyAiResults({
    aiData: storedResult,
    calibrations,
    systemComponentIds,
  });
}
