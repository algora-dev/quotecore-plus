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

// ── Constants (canvas dimensions are now dynamic — passed as params) ───────

export const MAX_CANVAS_DIM = 2000;

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

export interface SnapResult {
  accepted: AiLineEntry[];
  rejected: number;
}

/**
 * Snap and validate AI-detected lines against locked geometric rules.
 * - Preserve the actual detected stroke angle
 * - Vertex snap: endpoints near roof-area polygon vertices get snapped
 * - Endpoint clustering: nearby endpoints merge to centroid
 * - Reject: out-of-range, zero-length, duplicate lines
 */
export function snapAndValidate(
  entries: AiLineEntry[],
  type: PlaceholderType,
  roofAreaVertices: CanvasPoint[],
  canvasWidth: number = MAX_CANVAS_DIM,
  canvasHeight: number = MAX_CANVAS_DIM,
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
    if (!inRange(p1, canvasWidth, canvasHeight) || !inRange(p2, canvasWidth, canvasHeight)) { rejected++; continue; }

    // 2. Zero-length check
    if (distance(p1, p2) < 2) { rejected++; continue; }

    // 3. Vertex snap — snap endpoints to nearby polygon vertices
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

function inRange(p: CanvasPoint, width: number, height: number): boolean {
  return p.x >= 0 && p.x < width && p.y >= 0 && p.y < height;
}

function distance(a: CanvasPoint, b: CanvasPoint): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
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
 * Barges are accepted only when they branch from a ridge endpoint and follow
 * the outline. Spouting is then rebuilt as the exact perimeter remainder.
 *
 * Rules:
 * 1. Reject any barge that is not on the perimeter, does not start at a ridge
 *    endpoint, or is not perpendicular to that ridge.
 * 2. Project valid barges onto each polygon edge and merge their coverage.
 * 3. Rebuild spouting from every uncovered perimeter interval.
 *
 * Returns the corrected components object.
 */
export function perimeterAccountingPass(
  aiData: AiScanData,
): AiScanData['components'] {
  const corrected = structuredClone(aiData.components);
  const PERIMETER_TOLERANCE = 5;
  const RIDGE_ENDPOINT_TOLERANCE = 12;
  const PERPENDICULAR_DOT_TOLERANCE = Math.sin(8 * Math.PI / 180);
  const MIN_RUN_LENGTH = 2;

  interface EdgeProjection {
    start: number;
    end: number;
  }

  function projectPointToEdge(
    point: CanvasPoint,
    edgeStart: CanvasPoint,
    edgeEnd: CanvasPoint,
  ): { parameter: number; offset: number } | null {
    const edgeX = edgeEnd.x - edgeStart.x;
    const edgeY = edgeEnd.y - edgeStart.y;
    const lengthSquared = edgeX * edgeX + edgeY * edgeY;
    if (lengthSquared === 0) return null;

    const parameter = ((point.x - edgeStart.x) * edgeX + (point.y - edgeStart.y) * edgeY) / lengthSquared;
    const projectedX = edgeStart.x + parameter * edgeX;
    const projectedY = edgeStart.y + parameter * edgeY;
    return {
      parameter,
      offset: Math.hypot(point.x - projectedX, point.y - projectedY),
    };
  }

  function projectRunToEdge(
    runStart: CanvasPoint,
    runEnd: CanvasPoint,
    edgeStart: CanvasPoint,
    edgeEnd: CanvasPoint,
  ): EdgeProjection | null {
    const edgeLength = distance(edgeStart, edgeEnd);
    if (edgeLength === 0) return null;

    const startProjection = projectPointToEdge(runStart, edgeStart, edgeEnd);
    const endProjection = projectPointToEdge(runEnd, edgeStart, edgeEnd);
    if (!startProjection || !endProjection) return null;

    const parameterTolerance = PERIMETER_TOLERANCE / edgeLength;
    if (
      startProjection.offset > PERIMETER_TOLERANCE
      || endProjection.offset > PERIMETER_TOLERANCE
      || startProjection.parameter < -parameterTolerance
      || startProjection.parameter > 1 + parameterTolerance
      || endProjection.parameter < -parameterTolerance
      || endProjection.parameter > 1 + parameterTolerance
    ) {
      return null;
    }

    return {
      start: Math.max(0, Math.min(startProjection.parameter, endProjection.parameter)),
      end: Math.min(1, Math.max(startProjection.parameter, endProjection.parameter)),
    };
  }

  function pointOnEdge(edgeStart: CanvasPoint, edgeEnd: CanvasPoint, parameter: number): CanvasPoint {
    return {
      x: edgeStart.x + (edgeEnd.x - edgeStart.x) * parameter,
      y: edgeStart.y + (edgeEnd.y - edgeStart.y) * parameter,
    };
  }

  function isPerpendicularToRidge(
    bargeStart: CanvasPoint,
    bargeEnd: CanvasPoint,
    ridgeStart: CanvasPoint,
    ridgeEnd: CanvasPoint,
  ): boolean {
    const bargeLength = distance(bargeStart, bargeEnd);
    const ridgeLength = distance(ridgeStart, ridgeEnd);
    if (bargeLength === 0 || ridgeLength === 0) return false;

    const dot = (
      (bargeEnd.x - bargeStart.x) * (ridgeEnd.x - ridgeStart.x)
      + (bargeEnd.y - bargeStart.y) * (ridgeEnd.y - ridgeStart.y)
    ) / (bargeLength * ridgeLength);
    return Math.abs(dot) <= PERPENDICULAR_DOT_TOLERANCE;
  }

  function branchesFromRidgeEndpoint(bargeStart: CanvasPoint, bargeEnd: CanvasPoint): boolean {
    return corrected.ridges.some(ridge => {
      if (ridge.points.length < 2) return false;
      const ridgeStart = ridge.points[0];
      const ridgeEnd = ridge.points[ridge.points.length - 1];
      if (!isPerpendicularToRidge(bargeStart, bargeEnd, ridgeStart, ridgeEnd)) return false;

      return [ridgeStart, ridgeEnd].some(ridgeEndpoint =>
        distance(bargeStart, ridgeEndpoint) <= RIDGE_ENDPOINT_TOLERANCE
        || distance(bargeEnd, ridgeEndpoint) <= RIDGE_ENDPOINT_TOLERANCE,
      );
    });
  }

  const perimeterEdges = aiData.roof_areas.flatMap(area =>
    area.points.map((point, index) => ({
      start: point,
      end: area.points[(index + 1) % area.points.length],
    })),
  );

  corrected.barges = corrected.barges.filter(entry => {
    if (entry.points.length < 2) return false;
    const runStart = entry.points[0];
    const runEnd = entry.points[entry.points.length - 1];
    if (!branchesFromRidgeEndpoint(runStart, runEnd)) return false;

    return perimeterEdges.some(edge =>
      projectRunToEdge(runStart, runEnd, edge.start, edge.end) !== null,
    );
  });

  corrected.spouting = [];

  for (const edge of perimeterEdges) {
    const edgeLength = distance(edge.start, edge.end);
    if (edgeLength < MIN_RUN_LENGTH) continue;

    const coverage = corrected.barges
      .map(entry => projectRunToEdge(
        entry.points[0],
        entry.points[entry.points.length - 1],
        edge.start,
        edge.end,
      ))
      .filter((projection): projection is EdgeProjection => projection !== null)
      .sort((left, right) => left.start - right.start);

    const mergedCoverage: EdgeProjection[] = [];
    for (const interval of coverage) {
      const previous = mergedCoverage[mergedCoverage.length - 1];
      if (previous && interval.start <= previous.end + PERIMETER_TOLERANCE / edgeLength) {
        previous.end = Math.max(previous.end, interval.end);
      } else {
        mergedCoverage.push({ ...interval });
      }
    }

    let remainderStart = 0;
    for (const interval of mergedCoverage) {
      if ((interval.start - remainderStart) * edgeLength >= MIN_RUN_LENGTH) {
        corrected.spouting.push({
          points: [
            pointOnEdge(edge.start, edge.end, remainderStart),
            pointOnEdge(edge.start, edge.end, interval.start),
          ],
        });
      }
      remainderStart = Math.max(remainderStart, interval.end);
    }

    if ((1 - remainderStart) * edgeLength >= MIN_RUN_LENGTH) {
      corrected.spouting.push({
        points: [
          pointOnEdge(edge.start, edge.end, remainderStart),
          { ...edge.end },
        ],
      });
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
  /** Canvas dimensions (dynamic — canvas = processed image dimensions). */
  canvasWidth?: number;
  canvasHeight?: number;
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
  const canvasWidth = params.canvasWidth ?? MAX_CANVAS_DIM;
  const canvasHeight = params.canvasHeight ?? MAX_CANVAS_DIM;

  // ── Step 3: Perimeter-accounting pass ──────────────────────────────
  // Accept only ridge-endpoint barges, then rebuild spouting as the remainder.
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
    const snapResult = snapAndValidate(rawEntries, ptype, allVertices, canvasWidth, canvasHeight);
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
  canvasWidth?: number,
  canvasHeight?: number,
): ApplyAiResult {
  // Identical to applyAiResults — the stored result is the same shape.
  return applyAiResults({
    aiData: storedResult,
    calibrations,
    systemComponentIds,
    canvasWidth,
    canvasHeight,
  });
}
