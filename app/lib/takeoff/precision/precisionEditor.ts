// Precision edit draft command engine (spec §4.3, §6, §8.3–8.5, §11.2).
//
// Pure reducer/function style: every command takes a session and returns a
// CommandResult. The ONLY boundary is saveEdit(), which is still pure — it
// validates the draft, checks the expected context for staleness, and returns
// a SavePlan that the adapter layer must execute through the EXISTING
// authorised atomic save path (actions.ts save_takeoff_atomic_v2 /
// persistPageCalibration / future update-in-place RPC). This module never
// performs IO and never opens a parallel persistence route.
//
// Local operation history (spec §11.2): bounded to MAX_HISTORY_OPS (100)
// logical operations; one gesture = one op; selection/preview/pan never enter
// history; a new edit after undo clears redo.

import type {
  EditContext,
  EditableGeometry,
  EditTarget,
  PrecisionEditSession,
  PointSelection,
  ScenePoint,
  ValidationIssue,
  CommandResult,
  Vertex,
} from './precisionTypes';
import {
  GEOMETRY_TOLERANCE,
  MIN_CLOSED_OUTLINE_VERTICES,
  newVertexId,
  pointsDistinct,
  polygonArea,
  polygonPerimeter,
  validateOutline,
  hasBlockingIssue,
  verticesFromPoints,
  type ValidationOptions,
} from './precisionGeometry';
import { calibratedArea, calibratedLength } from '../calibration';

/** Bounded local history capacity (spec §11.2 / §17.3: 100 logical ops). */
export const MAX_HISTORY_OPS = 100;

export const EMPTY_SELECTION: PointSelection = { vertexId: null, moveArmed: false };

// ─── beginEdit ───────────────────────────────────────────────────────────

function importGeometry(
  target: EditTarget,
  context: EditContext,
  points: readonly ScenePoint[],
  closed: boolean,
): EditableGeometry {
  return {
    target,
    context,
    vertices: verticesFromPoints(points),
    closed,
    localGeometryRevision: 0,
  };
}

/**
 * Copy saved primitives into a draft and retain an immutable base version
 * (spec §4.3). Generates stable vertex IDs for the imported points once;
 * those IDs persist through undo/redo within this session.
 */
export function beginEdit(
  target: EditTarget,
  context: EditContext,
  savedPoints: readonly ScenePoint[],
  savedClosed: boolean,
): PrecisionEditSession {
  const geometry = importGeometry(target, context, savedPoints, savedClosed);
  return {
    target,
    context,
    base: geometry,
    draft: geometry,
    selection: { ...EMPTY_SELECTION },
    preview: null,
    history: { undo: [], redo: [] },
  };
}

// ─── internal helpers ────────────────────────────────────────────────────

function unchanged(session: PrecisionEditSession, rejected: string): CommandResult {
  return { session, rejected };
}

function nextRevision(draft: EditableGeometry): number {
  return draft.localGeometryRevision + 1;
}

function commit(
  session: PrecisionEditSession,
  kind: 'move' | 'append' | 'insert' | 'delete' | 'close',
  nextDraft: EditableGeometry,
  selection?: PointSelection,
): CommandResult {
  const op = { kind, before: session.draft, after: nextDraft };
  const undo = [...session.history.undo, op].slice(-MAX_HISTORY_OPS);
  return {
    session: {
      ...session,
      draft: nextDraft,
      base: session.base,
      selection: selection ?? session.selection,
      preview: null,
      history: { undo, redo: [] }, // new edit after undo clears redo
    },
  };
}

function vertexIndex(session: PrecisionEditSession, id: string | null): number {
  if (id == null) return -1;
  return session.draft.vertices.findIndex((v) => v.id === id);
}

function withVertex(session: PrecisionEditSession, id: string, point: ScenePoint): EditableGeometry {
  return {
    ...session.draft,
    vertices: session.draft.vertices.map((v) => (v.id === id ? { ...v, point } : v)),
    localGeometryRevision: nextRevision(session.draft),
  };
}

// ─── commands (spec §4.3) ────────────────────────────────────────────────

/** Change selection only; no geometry/history/save (spec §4.3, §5.1). */
export function selectVertex(session: PrecisionEditSession, id: string | null, arm: boolean): CommandResult {
  if (id != null && vertexIndex(session, id) === -1) {
    return unchanged(session, 'unknown-vertex');
  }
  return {
    session: { ...session, selection: { vertexId: id, moveArmed: arm } },
  };
}

/**
 * Open-outline creation only (spec §4.3/§8.1): create, select and arm a new
 * point. Rejected on a closed draft — closed review adds points via insert.
 */
export function appendVertex(session: PrecisionEditSession, point: ScenePoint): CommandResult {
  if (session.draft.closed) {
    return unchanged(session, 'append-on-closed-outline');
  }
  const vertex: Vertex = { id: newVertexId(), point };
  const nextDraft: EditableGeometry = {
    ...session.draft,
    vertices: [...session.draft.vertices, vertex],
    localGeometryRevision: nextRevision(session.draft),
  };
  return commit(session, 'append', nextDraft, { vertexId: vertex.id, moveArmed: true });
}

/** Transient frame update: no draft write, no history entry (layer 3). */
export function previewMove(session: PrecisionEditSession, id: string, point: ScenePoint): CommandResult {
  if (vertexIndex(session, id) === -1) return unchanged(session, 'unknown-vertex');
  return {
    session: { ...session, preview: { vertexId: id, point } },
  };
}

/**
 * One logical draft move (spec §4.3/§11.2): updates only this vertex,
 * increments localGeometryRevision, disarms the selection, records exactly one
 * history operation. The resulting polygon may still be invalid (editable,
 * blocked at save) per §8.4.
 */
export function commitMove(session: PrecisionEditSession, id: string, point: ScenePoint): CommandResult {
  const idx = vertexIndex(session, id);
  if (idx === -1) return unchanged(session, 'unknown-vertex');
  const nextDraft = withVertex(session, id, point);
  return commit(session, 'move', nextDraft, { vertexId: id, moveArmed: false });
}

/** Restore pre-gesture preview; no history entry (spec §4.3/§5.3). */
export function cancelGesture(session: PrecisionEditSession): CommandResult {
  if (session.preview == null) return { session };
  return {
    session: { ...session, preview: null, selection: { ...session.selection, moveArmed: false } },
  };
}

/**
 * Insert a vertex at the midpoint of the selected vertex and its successor
 * (spec §6.3). New stable ID; inserted after index i; selected and armed;
 * all other coordinates preserved; area/perimeter unchanged within
 * floating-point tolerance; the collinear midpoint is never simplified away.
 * On an open path, insertion requires a real successor.
 */
export function insertAfter(session: PrecisionEditSession, id: string): CommandResult {
  const idx = vertexIndex(session, id);
  if (idx === -1) return unchanged(session, 'unknown-vertex');
  const { vertices, closed } = session.draft;
  const n = vertices.length;
  const succIdx = idx + 1;
  if (succIdx >= n) {
    if (!closed) return unchanged(session, 'no-successor-open-path');
  }
  const pi = vertices[idx].point;
  const pj = vertices[succIdx % n].point;
  const midpoint: ScenePoint = { x: (pi.x + pj.x) / 2, y: (pi.y + pj.y) / 2 };
  const vertex: Vertex = { id: newVertexId(), point: midpoint };
  const nextVertices = [...vertices.slice(0, succIdx), vertex, ...vertices.slice(succIdx)];
  const nextDraft: EditableGeometry = {
    ...session.draft,
    vertices: nextVertices,
    localGeometryRevision: nextRevision(session.draft),
  };
  return commit(session, 'insert', nextDraft, { vertexId: vertex.id, moveArmed: true });
}

/**
 * Delete the selected vertex (spec §6.4). Reconnect neighbours; select the
 * successor; leave movement disarmed. Rejected when a CLOSED outline would
 * fall below 3 vertices. An open path may shrink to zero. A resulting
 * crossing stays as an editable, blocked-at-save draft.
 */
export function deleteVertex(session: PrecisionEditSession, id: string): CommandResult {
  const idx = vertexIndex(session, id);
  if (idx === -1) return unchanged(session, 'unknown-vertex');
  const { vertices, closed } = session.draft;
  if (closed && vertices.length <= MIN_CLOSED_OUTLINE_VERTICES) {
    return unchanged(session, 'outline-needs-minimum-vertices');
  }
  const nextVertices = vertices.filter((_, i) => i !== idx);
  const nextDraft: EditableGeometry = {
    ...session.draft,
    vertices: nextVertices,
    localGeometryRevision: nextRevision(session.draft),
  };
  // Select the successor in the reduced ordering (wraps on closed outlines).
  const newLen = nextVertices.length;
  let successorId: string | null = null;
  if (newLen > 0) {
    const succIdx = closed ? idx % newLen : Math.min(idx, newLen - 1);
    successorId = nextVertices[succIdx].id;
  }
  return commit(session, 'delete', nextDraft, { vertexId: successorId, moveArmed: false });
}

/**
 * Switch an open path to closed without duplicating its first point
 * (spec §4.3/§8.1). Requires >= MIN_CLOSED_OUTLINE_VERTICES distinct points;
 * the resulting polygon may still be invalid (blocked at save until repaired).
 */
export function closeOutline(session: PrecisionEditSession): CommandResult {
  const { vertices, closed } = session.draft;
  if (closed) return unchanged(session, 'already-closed');
  if (vertices.length < MIN_CLOSED_OUTLINE_VERTICES) {
    return unchanged(session, 'outline-needs-minimum-vertices');
  }
  for (let i = 0; i < vertices.length; i++) {
    for (let j = i + 1; j < vertices.length; j++) {
      if (!pointsDistinct(vertices[i].point, vertices[j].point)) {
        return unchanged(session, 'duplicate-vertex');
      }
    }
  }
  const nextDraft: EditableGeometry = {
    ...session.draft,
    closed: true,
    localGeometryRevision: nextRevision(session.draft),
  };
  return commit(session, 'close', nextDraft);
}

/** Restore base; clear gesture/selection/draft-only state and local history. */
export function discardEdit(session: PrecisionEditSession): CommandResult {
  return {
    session: {
      ...session,
      draft: session.base,
      selection: { ...EMPTY_SELECTION },
      preview: null,
      history: { undo: [], redo: [] },
    },
  };
}

// ─── undo / redo (spec §11.2) ────────────────────────────────────────────

/**
 * Undo the last logical operation. Restores the exact prior draft snapshot —
 * including vertex IDs, metadata and localGeometryRevision. Never crosses the
 * saved base and never touches another page/target.
 */
export function undo(session: PrecisionEditSession): CommandResult {
  const undoStack = session.history.undo;
  if (undoStack.length === 0) return { session };
  const op = undoStack[undoStack.length - 1];
  return {
    session: {
      ...session,
      draft: op.before,
      preview: null,
      history: {
        undo: undoStack.slice(0, -1),
        redo: [...session.history.redo, op],
      },
    },
  };
}

export function redo(session: PrecisionEditSession): CommandResult {
  const redoStack = session.history.redo;
  if (redoStack.length === 0) return { session };
  const op = redoStack[redoStack.length - 1];
  return {
    session: {
      ...session,
      draft: op.after,
      preview: null,
      history: {
        undo: [...session.history.undo, op],
        redo: redoStack.slice(0, -1),
      },
    },
  };
}

/** True while the draft differs from the saved base. */
export function isDirty(session: PrecisionEditSession): boolean {
  return session.draft !== session.base;
}

// ─── saveEdit boundary (spec §4.3 / §11.3) ──────────────────────────────

/** Where the adapter must route the save — existing paths only. */
export type SaveRoute =
  | { kind: 'atomic-takeoff-save-v2' }                       // actions.ts save_takeoff_atomic_v2
  | { kind: 'page-calibration-persist' }                     // actions.ts persistPageCalibration
  | { kind: 'outline-geometry-update'; geometryId: string; quoteRoofAreaId: string | null };

/**
 * The validated, ready-to-execute save intent produced by saveEdit().
 * Execution is delegated to the EXISTING authorised save services; this module
 * never persists anything itself.
 */
export type SavePlan = Readonly<{
  target: EditTarget;
  context: EditContext;
  vertices: readonly Vertex[];
  closed: boolean;
  /** Primitive recomputations derived from the CURRENT draft at the CURRENT
   *  scale (spec §8.5: polygon edits recompute from new points — never a
   *  scale-ratio multiply of stale areas). Scale itself is NOT recomputed here
   *  (that is the calibration path, spec §7.6). */
  recompute: Readonly<{
    sceneAreaPx2: number;
    scenePerimeterPx: number;
  }>;
  /** Which existing authorised route the adapter must call. */
  route: SaveRoute;
  validation: readonly ValidationIssue[];
}>;

export type SaveResult =
  | Readonly<{ ok: true; plan: SavePlan }>
  | Readonly<{ ok: false; reason: 'stale-context' | 'blocking-validation' | 'clean'; issues?: readonly ValidationIssue[] }>;

/**
 * Validation is target-aware (spec §8.4 applies to outlines; calibration and
 * component-line targets are 2-point segments with their own minimal rules).
 */
function validationIssuesForTarget(
  session: PrecisionEditSession,
  options: ValidationOptions,
): readonly ValidationIssue[] {
  const { target, draft } = session;
  if (target.kind === 'outline') return validateOutline(draft, options);
  const issues: ValidationIssue[] = [];
  const nonFinite = draft.vertices.filter((v) => !Number.isFinite(v.point.x) || !Number.isFinite(v.point.y));
  if (nonFinite.length > 0) {
    issues.push({ code: 'non-finite-coordinate', severity: 'blocking', message: 'A point has invalid coordinates.', vertexIds: nonFinite.map((v) => v.id) });
    return issues;
  }
  if (draft.vertices.length < 2) {
    issues.push({ code: 'insufficient-vertices', severity: 'blocking', message: 'A segment needs two points.' });
  } else if (!pointsDistinct(draft.vertices[0].point, draft.vertices[1].point)) {
    issues.push({ code: 'duplicate-vertex', severity: 'blocking', message: 'The two points occupy the same position.' });
  }
  return issues;
}

/**
 * The save boundary (spec §4.3 saveEdit): validate primitives, recompute
 * dependencies, and hand a plan to the existing atomic save path. Returns
 * `clean` (nothing to save) when the draft equals the base, `stale-context`
 * when the expected context no longer matches the session (page/image/epoch
 * changed underneath us), and `blocking-validation` when validation fails —
 * an invalid draft stays editable for repair, it is never silently saved.
 */
export function saveEdit(
  session: PrecisionEditSession,
  expectedContext: EditContext,
  options: ValidationOptions = {},
): SaveResult {
  if (!isDirty(session)) return { ok: false, reason: 'clean' };

  if (
    expectedContext.quoteId !== session.context.quoteId ||
    expectedContext.pageId !== session.context.pageId ||
    expectedContext.imageRevision !== session.context.imageRevision ||
    expectedContext.contextEpoch !== session.context.contextEpoch
  ) {
    return { ok: false, reason: 'stale-context' };
  }

  const issues = validationIssuesForTarget(session, options);
  if (hasBlockingIssue(issues)) {
    return { ok: false, reason: 'blocking-validation', issues };
  }

  const route: SaveRoute = (() => {
    if (session.target.kind === 'calibration') return { kind: 'page-calibration-persist' };
    if (session.target.kind === 'outline') {
      // Update-in-place: keep geometryId/quoteRoofAreaId ownership — never a
      // new roof-area row (spec §8.5). The underlying RPC gap is tracked for M5.
      return {
        kind: 'outline-geometry-update',
        geometryId: session.target.geometryId,
        quoteRoofAreaId: session.target.quoteRoofAreaId,
      };
    }
    return { kind: 'atomic-takeoff-save-v2' };
  })();

  const plan: SavePlan = {
    target: session.target,
    context: session.context,
    vertices: session.draft.vertices,
    closed: session.draft.closed,
    recompute: {
      sceneAreaPx2: session.draft.closed ? polygonArea(session.draft.vertices) : 0,
      scenePerimeterPx: polygonPerimeter(session.draft.vertices, session.draft.closed),
    },
    route,
    validation: issues,
  };
  return { ok: true, plan };
}

/**
 * Convenience for adapters/tests: apply the page's effective scale (existing
 * calibration.ts services) to a SavePlan's primitives. Spec §17.4 F: a polygon
 * edit at constant scale must derive plan area from the NEW points.
 */
export function calibratedPlanFromSave(plan: SavePlan, scale: number): Readonly<{
  planArea: number;
  perimeter: number;
}> {
  return {
    planArea: calibratedArea(plan.recompute.sceneAreaPx2, scale),
    perimeter: calibratedLength(plan.recompute.scenePerimeterPx, scale),
  };
}

/** Exposed for tests and adapters: re-exported reuse point for existing domain. */
export { validateOutline, GEOMETRY_TOLERANCE };
