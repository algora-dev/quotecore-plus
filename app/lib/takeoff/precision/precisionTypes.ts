// Mobile takeoff & precision geometry editor — shared edit-draft contracts.
// Spec: docs/MOBILE_TAKEOFF_PRECISION_EDITOR_IMPLEMENTATION_PLAN_2026-09-21.md §4.2.
// M0 gap review §4 mapping: plain serialisable data only; no React, Fabric, Supabase
// or provider SDK imports. Scene-coordinate convention reuses the existing
// calibrationTypes Point + calibrationCoordinates affine machinery — nothing here
// redefines a coordinate frame.

import type { Point } from '../calibrationTypes';

/**
 * Scene point in the existing `takeoff-scene-v1` frame (see
 * CalibrationImageDescriptor.coordinateFrame / buildSourceToScene).
 * Alias of the existing domain Point — do not define a second point type.
 */
export type ScenePoint = Point;

/** Vertex with a stable session identity. IDs are random (crypto.randomUUID),
 *  NEVER coordinate-derived: coordinates change during drags; identity must not. */
export type Vertex = Readonly<{
  id: string;
  point: ScenePoint;
}>;

/** Identity + expected server state captured when the edit began. */
export type EditContext = Readonly<{
  quoteId: string;
  pageId: string;
  /** Authoritative server content-digest revision of the immutable source image
   *  (calibrationImageRevision.ts semantics; null only before first hydration). */
  imageRevision: string | null;
  coordinateFrame: 'takeoff-scene-v1';
  /** Expected server session version at edit start (actions.ts sessionVersion guard). */
  sessionVersion: number;
  /** Monotonic client epoch; invalidates stale client/AI work (spec §11.4). */
  contextEpoch: number;
}>;

/** What the edit draft edits. Ownership fields map onto existing domain records
 *  (RoofArea quoteRoofAreaId/fromPageId, calibration reference drafts, measurement
 *  entries) per the M0 gap review integration map. */
export type EditTarget =
  | { kind: 'calibration'; referenceDraftId: string }
  | {
      kind: 'outline';
      geometryId: string;
      quoteRoofAreaId: string | null;
      /** M5 (spec §8.2/§8.3): where the draft's points came from. Manual and
       *  imported (M6 AI) outlines share the IDENTICAL draft/save path — the
       *  origin is provenance only, never a behaviour switch. */
      origin?: 'manual' | 'imported';
    }
  | { kind: 'component-line'; measurementId: string; componentId: string;
      quoteRoofAreaId: string | null };

/** The editable geometry: an immutable snapshot of the draft at a point in time. */
export type EditableGeometry = Readonly<{
  target: EditTarget;
  context: EditContext;
  vertices: readonly Vertex[];
  closed: boolean;
  /** Increments on every committed geometry change; undo restores the previous value. */
  localGeometryRevision: number;
}>;

/** Selection is separate from placement (spec invariant R06 / §5.1). */
export type PointSelection = Readonly<{
  vertexId: string | null;
  /** When true, the next off-point drag may move the selected vertex. */
  moveArmed: boolean;
}>;

export type ValidationSeverity = 'warning' | 'blocking';

export type ValidationIssue = Readonly<{
  code: string;
  severity: ValidationSeverity;
  message: string;
  vertexIds?: readonly string[];
}>;

/** Transient per-gesture preview (spec §11.1 layer 3). Disposable; never history. */
export type GesturePreview = Readonly<{
  vertexId: string;
  point: ScenePoint;
}>;

/** One logical, undoable operation in the bounded local history (spec §11.2). */
export type EditOperation = Readonly<{
  /** Human-oriented label, e.g. 'move' | 'append' | 'insert' | 'delete' | 'close'. */
  kind: 'move' | 'append' | 'insert' | 'delete' | 'close';
  /** Full plain-data draft snapshot BEFORE the operation (immutable). */
  before: EditableGeometry;
  /** Full plain-data draft snapshot AFTER the operation (immutable). */
  after: EditableGeometry;
}>;

export type PrecisionEditSession = Readonly<{
  /** Target + context captured at beginEdit. */
  target: EditTarget;
  context: EditContext;
  /** Immutable base (last saved state copied at beginEdit). */
  base: EditableGeometry;
  /** Current draft (layer 2). */
  draft: EditableGeometry;
  selection: PointSelection;
  /** Active gesture preview (layer 3) or null. */
  preview: GesturePreview | null;
  history: Readonly<{
    undo: readonly EditOperation[];
    redo: readonly EditOperation[];
  }>;
}>;

/** Outcome of a command: either an unchanged-session rejection with a machine
 *  readable reason, or the next session state. Pure — no side effects. */
export type CommandResult = Readonly<{
  session: PrecisionEditSession;
  /** Set when the command was rejected without any state change (spec §6.4
   *  delete-minimum rule etc.). */
  rejected?: string;
}>;
