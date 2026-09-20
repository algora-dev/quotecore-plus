// Calibration hardening Phase B (audit 2026-09-20): pure helpers for the
// commit contract (P0-4), metadata cache rollback (P0-7), draft-vs-committed
// manual recalibration (6.2) and provenance stamping (6.4).
// No React, no Supabase, no Fabric: node-safe and unit-testable.
import type { SourceProvenanceLink } from './calibrationRecompute';
import type { CalibrationMetadataV1 } from './calibrationCodec';

// ---------------------------------------------------------------------------
// P0-4: explicit commit result contract.
// ---------------------------------------------------------------------------

/** Result of the parent-orchestrated persistence after the reducer reaches
 *  'committing'. COMMIT_SUCCEEDED is dispatched ONLY on ok:true. */
export type CalibrationCommitResult =
  | { ok: true }
  | { ok: false; code: string; message: string };

export function commitFailed(code: string, message: string): CalibrationCommitResult {
  return { ok: false, code, message };
}

export function commitSucceeded(): CalibrationCommitResult {
  return { ok: true };
}

/** Normalises anything thrown/handed back by an onFinish implementation. */
export function toCommitResult(value: unknown): CalibrationCommitResult {
  if (value && typeof value === 'object' && 'ok' in value) {
    const v = value as { ok: boolean; code?: unknown; message?: unknown };
    if (v.ok === true) return { ok: true };
    return {
      ok: false,
      code: typeof v.code === 'string' && v.code ? v.code : 'COMMIT_FAILED',
      message:
        typeof v.message === 'string' && v.message
          ? v.message
          : 'The calibration could not be saved. Try again.',
    };
  }
  return {
    ok: false,
    code: 'COMMIT_ERROR',
    message: value instanceof Error ? value.message : 'The calibration could not be saved. Try again.',
  };
}

// ---------------------------------------------------------------------------
// P0-7: metadata cache snapshot/restore.
// ---------------------------------------------------------------------------

export interface MetadataCacheSnapshot {
  pageId: string;
  hadEntry: boolean;
  previous: CalibrationMetadataV1 | undefined;
}

/** Captures the current durable in-memory metadata entry for a page so a
 *  failed commit can restore it. Call BEFORE staging new metadata. */
export function snapshotMetadataEntry(
  cache: Map<string, CalibrationMetadataV1>,
  pageId: string,
): MetadataCacheSnapshot {
  const previous = cache.get(pageId);
  return { pageId, hadEntry: cache.has(pageId), previous };
}

/** Restores the entry captured by snapshotMetadataEntry. After a failed
 *  recalibration a later ordinary save therefore persists the OLD metadata,
 *  never metadata from a calibration the user was told failed. */
export function restoreMetadataEntry(
  cache: Map<string, CalibrationMetadataV1>,
  snapshot: MetadataCacheSnapshot,
): void {
  if (snapshot.hadEntry && snapshot.previous !== undefined) {
    cache.set(snapshot.pageId, snapshot.previous);
  } else {
    cache.delete(snapshot.pageId);
  }
}

// ---------------------------------------------------------------------------
// 6.2: draft-until-commit manual recalibration.
// ---------------------------------------------------------------------------

export interface DraftCalibrationState<T> {
  /** The committed calibration set captured when the draft started. Cancel
   *  restores this untouched. Null while no draft is active. */
  committed: readonly T[] | null;
  /** True once the first draft calibration replaced the committed set on
   *  screen; further drafts append (same as the original manual flow). */
  replaced: boolean;
}

/** Starts a draft recalibration. The committed set stays authoritative for
 *  display and measurements until the user confirms AND the draft replaces
 *  it; Cancel discards the draft only. */
export function startDraftRecalibration<T>(committed: readonly T[]): DraftCalibrationState<T> {
  return { committed, replaced: false };
}

/** Applies one saved manual calibration inside an active draft. The first
 *  save replaces the visible set (the draft), subsequent saves append. */
export function applyDraftCalibration<T>(
  draft: DraftCalibrationState<T>,
  visible: readonly T[],
  added: T,
): { draft: DraftCalibrationState<T>; calibrations: T[] } {
  if (!draft.replaced) {
    return { draft: { ...draft, replaced: true }, calibrations: [added] };
  }
  return { draft, calibrations: [...visible, added] };
}

/** Cancel: discard the draft, committed calibration untouched. */
export function cancelDraftRecalibration<T>(draft: DraftCalibrationState<T>): readonly T[] {
  return draft.committed ?? [];
}

/** Whether a draft is mid-replacement (screen shows draft values, not committed). */
export function isDraftPending(draft: DraftCalibrationState<unknown> | null): boolean {
  return draft !== null;
}

// ---------------------------------------------------------------------------
// 6.4: persist recomputation provenance onto entry inputs.
// ---------------------------------------------------------------------------

export type EntryInputsLike = Record<string, unknown> | null | undefined;

/** Stamps the recompute-resolved source geometry onto a measurement's
 *  entryInputs so it rides the entry_inputs jsonb into the atomic save (and
 *  the RPC copies it to the native column). Only stamps unambiguous
 *  resolutions that produced a source polygon; never mutates the input. */
export function stampSourceProvenance<T extends { entryInputs?: EntryInputsLike }>(
  measurement: T,
  link: SourceProvenanceLink | undefined,
): T {
  if (!link || link.sourceGeometryId == null) return measurement;
  const current = measurement.entryInputs ?? undefined;
  if (current && current.source_geometry_id === link.sourceGeometryId) return measurement;
  return {
    ...measurement,
    entryInputs: { ...(current ?? {}), source_geometry_id: link.sourceGeometryId },
  };
}
