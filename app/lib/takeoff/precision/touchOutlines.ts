// Mobile takeoff M5: manual outlines + update-in-place editing of saved
// outlines (spec §8.1, §8.3–8.5, §11.3/§11.4, §13-M5; O01/O03/O05/O06/O07/
// O12/O13/O16).
//
// Pure, UI/IO-free orchestration AROUND the M1 command engine
// (precisionEditor) — this module never mutates geometry itself and never
// performs IO. It provides:
//
// - Draft construction for the two outline origins (manual open-path creation
//   §8.1; re-entry editing of a saved outline §8.5). The origin is
//   PROVENANCE ONLY: manual and imported (M6 AI) outlines share the identical
//   draft/validation/save path (spec §8.3), so M6 plugs in by passing
//   origin: 'imported' — nothing else changes.
// - Validation-aware review (blocking vs warning, plan-area preview from the
//   CURRENT draft at the page's constant scale — never a ratio multiply of a
//   stale area, §8.5).
// - Save intents: 'update-in-place' for persisted geometry IDs (NEVER
//   delete+insert — the patch_052 RPC updates the existing measurement row)
//   and 'create-new' for first-time outlines (existing handleSaveArea flow,
//   unchanged).
// - Constant-scale dependent recomputation through the EXISTING
//   computeCalibrationRecompute service (O07): source-linked entries follow
//   the new polygon; independent lines/typed quantities are untouched.
// - Conflict/failure classification (O13) and idempotent-retry semantics
//   (O12): an update intent targets a stable row ID, so re-sending after a
//   lost save response can never create a duplicate row.
// - Dirty-draft exit guard semantics (O16).

import type {
  EditContext,
  PrecisionEditSession,
  ScenePoint,
  ValidationIssue,
} from './precisionTypes';
import { beginEdit, discardEdit, isDirty, saveEdit, type SavePlan } from './precisionEditor';
import {
  polygonArea,
  polygonPerimeter,
  validateOutline,
  verticesFromPoints,
  type ValidationOptions,
} from './precisionGeometry';
import { calibratedArea, calibratedLength } from '../calibration';
import {
  computeCalibrationRecompute,
  type RecomputeMeasurementRecord,
  type RecomputeResult,
} from '../calibrationRecompute';

/** Where a draft's points came from (provenance only, never behaviour). */
export type OutlineDraftOrigin = 'manual' | 'imported';

/** A saved outline as hydration/adapter provides it. `geometryId` is the
 *  durable DB measurement-row id for the area-type row holding this polygon
 *  (hydration sets RoofArea.id to it); `null`-safe helpers below decide
 *  update-vs-create from it. Business metadata (name, pitch, ownership) is
 *  carried on the record and NEVER recreated on save (spec §8.5). */
export interface SavedOutlineRecord {
  geometryId: string | null;
  name: string;
  pitch: number;
  quoteRoofAreaId: string | null;
  fromPageId: string | null;
  points: readonly ScenePoint[];
}

/** Client-local outline ids (never persisted) — created by handleSaveArea
 *  (`area-<ts>`), the M3 harness (`harness-`) and manual drafts (`draft-`). */
const CLIENT_ID_PREFIXES = ['area-', 'harness-', 'draft-'] as const;

/** True when the geometry id is a durable DB row id that the update-in-place
 *  RPC can target (O05). Client-local ids must go through the create path. */
export function isPersistedOutlineGeometryId(id: string | null): boolean {
  if (id == null || id === '') return false;
  return !CLIENT_ID_PREFIXES.some((p) => id.startsWith(p));
}

// ─── Draft construction ──────────────────────────────────────────────────

/** Manual open-path creation (§8.1): empty draft, placement mode, ownership
 *  fields captured for the later create flow. */
export function beginManualOutlineDraft(context: EditContext): PrecisionEditSession {
  const geometryId =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? `draft-${crypto.randomUUID()}`
      : `draft-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return beginEdit(
    { kind: 'outline', geometryId, quoteRoofAreaId: null, origin: 'manual' },
    context,
    [],
    false,
  );
}

/** Re-entry editing of a saved outline (§8.5): clone the target polygon into
 *  a draft; the record's measurement ID, name, pitch, page and area ownership
 *  are retained on the target and NEVER recreated on save. */
export function beginSavedOutlineEdit(
  saved: SavedOutlineRecord,
  context: EditContext,
  origin: OutlineDraftOrigin = 'manual',
): PrecisionEditSession {
  return beginEdit(
    {
      kind: 'outline',
      geometryId: saved.geometryId ?? '',
      quoteRoofAreaId: saved.quoteRoofAreaId,
      origin,
    },
    context,
    saved.points,
    true,
  );
}

// ─── Review / validation ─────────────────────────────────────────────────

/** Effective page scale (real working units per scene px). */
export interface OutlineScale {
  scale: number;
  unit: 'feet' | 'meters';
}

export interface OutlineReview {
  issues: readonly ValidationIssue[];
  blocking: readonly ValidationIssue[];
  closed: boolean;
  vertexCount: number;
  /** Plan-area preview derived from the CURRENT draft at the CURRENT scale
   *  (§8.5) — null while the outline is open or invalid. */
  planArea: number | null;
  perimeter: number;
}

/** Target-aware review of an outline draft (validation per M1/§8.4). */
export function outlineReview(
  session: PrecisionEditSession,
  scale: OutlineScale,
  options: ValidationOptions = {},
): OutlineReview {
  const issues = validateOutline(session.draft, options);
  const blocking = issues.filter((i) => i.severity === 'blocking');
  const pxArea = session.draft.closed ? polygonArea(session.draft.vertices) : 0;
  const valid = blocking.length === 0;
  return {
    issues,
    blocking,
    closed: session.draft.closed,
    vertexCount: session.draft.vertices.length,
    planArea:
      session.draft.closed && valid && pxArea > 0
        ? calibratedArea(pxArea, scale.scale)
        : null,
    perimeter: calibratedLength(
      polygonPerimeter(session.draft.vertices, session.draft.closed),
      scale.scale,
    ),
  };
}

// ─── Save intents ────────────────────────────────────────────────────────

export type OutlineSaveIntent =
  | {
      kind: 'update-in-place';
      /** Durable measurement-row id — the SAME row is updated, never
       *  duplicated (O05/O12). */
      geometryId: string;
      quoteRoofAreaId: string | null;
      points: readonly ScenePoint[];
      planArea: number;
      perimeter: number;
      /** Captured at edit start; the RPC re-checks it server-side (O13). */
      sessionVersion: number;
      /** UPDATE-by-id is naturally idempotent: a retry after a lost save
       *  response cannot create a second row (O12). */
      retrySafe: true;
      origin: OutlineDraftOrigin;
    }
  | {
      kind: 'create-new';
      points: readonly ScenePoint[];
      planArea: number;
      perimeter: number;
      origin: OutlineDraftOrigin;
    };

export type OutlineSaveIntentResult =
  | { ok: true; intent: OutlineSaveIntent; plan: SavePlan }
  | { ok: false; reason: 'clean' | 'stale-context' | 'blocking-validation'; issues?: readonly ValidationIssue[] };

/**
 * The M1 `saveEdit` boundary specialised for outlines (§4.3/§11.3): the
 * returned intent tells the adapter WHICH existing authorised route to use —
 * `update-in-place` → the patch_052 RPC through actions.ts; `create-new` →
 * the existing handleSaveArea flow (owner fields/name/pitch handled there).
 */
export function outlineSaveIntent(
  session: PrecisionEditSession,
  expectedContext: EditContext,
  scale: OutlineScale,
  options: ValidationOptions = {},
): OutlineSaveIntentResult {
  const result = saveEdit(session, expectedContext, options);
  if (!result.ok) {
    return { ok: false, reason: result.reason, issues: result.issues };
  }
  const plan = result.plan;
  const points = plan.vertices.map((v) => v.point);
  const origin: OutlineDraftOrigin =
    session.target.kind === 'outline' && session.target.origin === 'imported'
      ? 'imported'
      : 'manual';
  const calibrated = {
    planArea: calibratedArea(plan.recompute.sceneAreaPx2, scale.scale),
    perimeter: calibratedLength(plan.recompute.scenePerimeterPx, scale.scale),
  };
  if (
    session.target.kind === 'outline' &&
    isPersistedOutlineGeometryId(session.target.geometryId)
  ) {
    return {
      ok: true,
      plan,
      intent: {
        kind: 'update-in-place',
        geometryId: session.target.geometryId,
        quoteRoofAreaId: session.target.quoteRoofAreaId,
        points,
        sessionVersion: session.context.sessionVersion,
        retrySafe: true,
        origin,
        ...calibrated,
      },
    };
  }
  return {
    ok: true,
    plan,
    intent: { kind: 'create-new', points, origin, ...calibrated },
  };
}

// ─── Source-linked recomputation at constant scale (O07) ─────────────────

/** Page-scoped dependent records available to the adapter (geometry-free
 *  attached entries + geometry-bearing entries). Independent typed
 *  quantities (point counts) never enter recompute — the existing service
 *  skips them. */
export interface OutlineDependents {
  measurements: readonly RecomputeMeasurementRecord[];
}

export interface OutlineRecomputeInput {
  /** The EDITED polygon (new points) + its durable geometry id, pitch and
   *  area ownership. */
  edited: {
    geometryId: string;
    points: readonly ScenePoint[];
    pitch: number;
    quoteRoofAreaId?: string | null;
  };
  /** Page scale BEFORE and AFTER the edit — identical: a geometry edit at
   *  constant calibration scale (§8.5). */
  scale: OutlineScale;
  dependents: OutlineDependents;
}

/**
 * Recompute dependent quantities from the NEW polygon through the EXISTING
 * calibrationRecompute service at constant scale. Source-linked entries
 * (entry_inputs.source_geometry_id → this polygon, or unique area match)
 * follow the new points; independent lines and typed quantities are
 * untouched (skipped by the service). NOT a scale-ratio multiply.
 */
export function outlineDependentRecompute(input: OutlineRecomputeInput): RecomputeResult {
  const { scale } = input;
  return computeCalibrationRecompute({
    measurements: [...input.dependents.measurements],
    roofAreas: [
      {
        id: input.edited.geometryId,
        points: input.edited.points,
        area: polygonArea(verticesFromPoints(input.edited.points)),
        pitch: input.edited.pitch,
        quoteRoofAreaId: input.edited.quoteRoofAreaId ?? null,
      },
    ],
    oldScale: scale.scale,
    newCalibration: {
      scale: scale.scale,
      unit: scale.unit,
      aggregationPolicy: 'mean-distance-per-scene-pixel-v1',
      contributingCalibrationIds: [],
      validCalibrationCount: 1,
      scaleRangePct: 0,
      disagreementWarning: null,
    },
  });
}

// ─── Failure classification (O13) / retry semantics (O12) ────────────────

export type AreaSaveErrorKind =
  | 'stale-version'
  | 'not-found'
  | 'validation'
  | 'unauthorized'
  | 'unknown';

/** Map a save error (RPC message or action error string) to a stable kind so
 *  presentations can offer reload/review on conflict while KEEPING the
 *  user's unsaved draft (O13 — never a force-overwrite invitation). */
export function classifyAreaSaveError(message: string): AreaSaveErrorKind {
  const m = message ?? '';
  if (/STALE_TAKEOFF_VERSION/i.test(m)) return 'stale-version';
  if (/AREA_ROW_NOT_FOUND|AREA_PAGE_MISMATCH|Page .* does not belong/i.test(m)) return 'not-found';
  if (/AREA_GEOMETRY_INVALID|AREA_SCALE_UNAVAILABLE|blocked|validation/i.test(m)) return 'validation';
  if (/Unauthorized|not found/i.test(m)) return 'unauthorized';
  return 'unknown';
}

// ─── Dirty-draft exit guard (O16) ────────────────────────────────────────

export interface OutlineExitGuard {
  dirty: boolean;
}

/** True when the outline draft differs from its saved base (layer 2 only —
 *  transient gesture previews are not "unsaved edits"). */
export function outlineExitGuard(session: PrecisionEditSession | null): OutlineExitGuard {
  return { dirty: session != null && isDirty(session) };
}

export type OutlineExitDecision = 'save' | 'discard' | 'stay';

/**
 * Resolve an exit decision against a session (pure). 'stay' changes nothing;
 * 'discard' restores the saved base (the adapter then drops the draft) and
 * can NEVER roll back an already-acknowledged checkpoint save — the saved
 * base only ever advances through the authorised save path (O16). The
 * 'save' decision is executed by the adapter via outlineSaveIntent; this
 * helper deliberately performs no IO.
 */
export function resolveOutlineExit(
  session: PrecisionEditSession,
  decision: OutlineExitDecision,
): { session: PrecisionEditSession; proceed: boolean } {
  if (decision === 'stay') return { session, proceed: false };
  if (decision === 'discard') {
    return { session: discardEdit(session).session, proceed: true };
  }
  return { session, proceed: false }; // 'save' is adapter-side IO; proceed after ack
}
