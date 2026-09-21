// Mobile takeoff M6: AI outline scan imported as an editable draft
// (spec §8.2/§8.3, §13-M6; O04/O10/O11; gap review "handleAiScan couples
// scan1 outline to runRemainingAiScans").
//
// Pure, UI/IO-free orchestration decisions AROUND the M5 draft/save layer:
//
// - OUTLINE-ONLY STOP (O10): the touch AI scan runs ONLY the existing
//   authorised `scan1` (outline) stage and STOPS there — internal line
//   detection (scan2) and classification (scan3) never auto-run in the touch
//   path, and their data is NEVER converted into committed measurements when
//   accepting only an outline. This is a CLIENT ORCHESTRATION decision only:
//   the request APIs, entitlement checks and ledger are untouched.
// - BILLING (owner decision 2026-09-21): billing is IDENTICAL mobile vs
//   desktop — the full scan1 charge applies to the outline-only action.
//   NO new pricing tiers, NO cheaper outline-only variant. The touch action
//   uses the exact same canonical point cost as the desktop pipeline's
//   scan1 (the server deducts the same points server-side).
// - STALE-RESULT DISCIPLINE (O11): a scan result arriving after manual
//   edits, a page switch, an image-revision change or a cancellation is
//   DISCARDED with an explicit reason — never silently applied. The gate
//   compares the M1 `contextEpoch` + page identity captured at scan start
//   against the values at resolve time.
// - IMPORT-TO-DRAFT (O04): scan1 roof-area polygons enter the SAME M5
//   draft/save path as manual outlines via
//   touchOutlines.beginSavedOutlineEdit(..., origin: 'imported') — origin is
//   provenance only (§8.3), the save intent routes to the existing
//   create-new flow (handleSaveArea) for a new area. Accept-unchanged and
//   edit-then-accept are the same path; no duplicate rows.

import type { ScenePoint } from './precisionTypes';
import type { EditContext } from './precisionTypes';
import type { SavedOutlineRecord } from './touchOutlines';
import { beginSavedOutlineEdit } from './touchOutlines';
import type { PrecisionEditSession } from './precisionTypes';
import { getAiScanPointCost } from '../pointCost';

// ─── O10: outline-only stage stop (pure orchestration decision) ──────────

/** The touch AI outline action stops after this stage. The desktop pipeline
 *  (scan1 → scan2 → scan3) is unchanged. */
export const OUTLINE_ONLY_SCAN_STOP_AFTER_STAGE = 'scan1' as const;

/** Billing is identical to the desktop pipeline's scan1 charge (owner
 *  decision 2026-09-21): the outline-only action is NOT cheaper and never
 *  bypasses authorisation by calling a stage endpoint directly. */
export function outlineOnlyScanCharge(qualityLevel: string): number {
  return getAiScanPointCost(qualityLevel);
}

// ─── O04: scan1 polygon → editable outline candidates ────────────────────

/** One detected roof outline, already in this page's scene frame
 *  (`takeoff-scene-v1`). Points are used as returned by scan1 — the desktop
 *  accept path (applyAiResults) consumes them identically. */
export interface AiOutlineCandidate {
  name: string;
  pitch: number;
  points: readonly ScenePoint[];
  /** Polygon-level sanity at import: at least 3 finite points. Full M1
   *  validation (simple polygon, nonzero area…) still runs in the draft —
   *  an unusable outline imports as an INVALID editable draft with save
   *  blocked (§8.2), never as fabricated/corrected geometry. */
  usable: boolean;
}

interface Scan1RoofAreaShape {
  name?: unknown;
  pitch_degrees?: unknown;
  points?: unknown;
}

function toFinitePoints(raw: unknown): ScenePoint[] | null {
  if (!Array.isArray(raw)) return null;
  const pts: ScenePoint[] = [];
  for (const p of raw) {
    if (
      typeof p === 'object' &&
      p !== null &&
      'x' in p &&
      'y' in p &&
      typeof (p as { x: unknown }).x === 'number' &&
      typeof (p as { y: unknown }).y === 'number' &&
      Number.isFinite((p as { x: number }).x) &&
      Number.isFinite((p as { y: number }).y)
    ) {
      pts.push({ x: (p as { x: number }).x, y: (p as { y: number }).y });
    } else {
      return null;
    }
  }
  return pts;
}

/**
 * Extract outline candidates from a scan1 result payload. ONLY roof-area
 * polygons are read: lines/classification fields (present in the shared
 * AiScanData type) are deliberately ignored — an outline-only import never
 * converts AI internal components into measurements (O10).
 */
export function aiOutlineCandidatesFromScanData(
  data: unknown,
): AiOutlineCandidate[] {
  if (typeof data !== 'object' || data === null) return [];
  const roofAreas = (data as { roof_areas?: unknown }).roof_areas;
  if (!Array.isArray(roofAreas)) return [];
  const globalPitch =
    typeof (data as { pitch?: { global_degrees?: unknown } }).pitch?.global_degrees === 'number'
      ? ((data as { pitch: { global_degrees: number } }).pitch.global_degrees as number)
      : null;
  const out: AiOutlineCandidate[] = [];
  roofAreas.forEach((raw: Scan1RoofAreaShape, idx: number) => {
    const points = toFinitePoints(raw?.points);
    if (points == null) return; // malformed polygon: skipped, not repaired
    out.push({
      name:
        typeof raw?.name === 'string' && raw.name.trim() !== ''
          ? raw.name
          : `Area ${idx + 1}`,
      pitch:
        typeof raw?.pitch_degrees === 'number' && Number.isFinite(raw.pitch_degrees)
          ? raw.pitch_degrees
          : (globalPitch ?? 0),
      points,
      usable: points.length >= 3,
    });
  });
  return out;
}

// ─── O11: stale-result gate ──────────────────────────────────────────────

/** Page identity + epoch captured at scan start (from the M1 EditContext). */
export interface AiOutlineScanStart {
  pageId: string;
  imageRevision: string | null;
  contextEpoch: number;
}

export type AiOutlineApplicationDecision =
  | { action: 'apply' }
  | {
      action: 'discard';
      reason: 'page-changed' | 'image-revision-changed' | 'context-epoch-changed' | 'manual-edits';
      message: string;
    };

const DISCARD_MESSAGES: Record<Exclude<AiOutlineApplicationDecision, { action: 'apply' }>['reason'], string> = {
  'page-changed': 'AI outline discarded — you switched pages while scanning.',
  'image-revision-changed': 'AI outline discarded — the plan image changed while scanning.',
  'context-epoch-changed': 'AI outline discarded — the scan was cancelled or is no longer current.',
  'manual-edits': 'AI outline discarded — you made edits while scanning. Search again to replace them.',
};

/**
 * Decide whether a resolved scan result may still be applied (O11): a result
 * arriving after manual edits, a page switch, an image-revision change or a
 * cancellation is DISCARDED with an explicit user-facing reason — never
 * silently applied over human work.
 */
export function resolveAiOutlineApplication(
  started: AiOutlineScanStart,
  current: AiOutlineScanStart,
  manualEditsSinceScan: boolean,
): AiOutlineApplicationDecision {
  if (manualEditsSinceScan) {
    return { action: 'discard', reason: 'manual-edits', message: DISCARD_MESSAGES['manual-edits'] };
  }
  if (started.pageId !== current.pageId) {
    return { action: 'discard', reason: 'page-changed', message: DISCARD_MESSAGES['page-changed'] };
  }
  if (started.imageRevision !== current.imageRevision) {
    return { action: 'discard', reason: 'image-revision-changed', message: DISCARD_MESSAGES['image-revision-changed'] };
  }
  if (started.contextEpoch !== current.contextEpoch) {
    return { action: 'discard', reason: 'context-epoch-changed', message: DISCARD_MESSAGES['context-epoch-changed'] };
  }
  return { action: 'apply' };
}

// ─── M8: calibration-complete HARD GATE (owner prescription 2026-09-21) ───

/** Decision for the AI outline scan action before it may be offered/run. */
export type OutlineScanGate =
  | { allowed: true }
  | { allowed: false; reason: 'uncalibrated'; message: string };

/**
 * M8 hard gate: the AI outline scan is UNAVAILABLE until the current page
 * has a completed calibration (effective scale). The owner managed to scan
 * before finishing calibration on a live iPhone — that must be impossible.
 * `scale` is the adapter's effective page scale (null = uncalibrated).
 */
export function outlineScanCalibrationGate(scale: { scale: number } | null): OutlineScanGate {
  if (scale == null || !Number.isFinite(scale.scale) || scale.scale <= 0) {
    return {
      allowed: false,
      reason: 'uncalibrated',
      message: 'Set the scale first — calibrate this page before scanning an outline.',
    };
  }
  return { allowed: true };
}

// ─── Adapter contracts (workstation ⇄ touch editor; IO stays adapter-side) ─

/** Entitlement/availability snapshot for the touch outline scan. `null`/
 *  unavailable = the manual journey stays fully functional (R01/O17). */
export interface AiOutlineScanInfo {
  available: true;
  /** Points exhausted — offer a clean message, never a block on manual work. */
  blocked: boolean;
  /** The charge the UI must display = the backend scan1 charge (O10). */
  cost: number;
  qualityLevel: 'low' | 'medium' | 'high';
}

export type AiOutlineScanResult =
  | { ok: true; data: unknown }
  | { ok: false; error: string; cancelled?: boolean; pointsExhausted?: boolean };

// ─── O04: candidate → M5 draft (origin 'imported') ────────────────────────

/** Import a detected outline INTO the M5 edit draft with origin 'imported'.
 *  The candidate is NOT saved geometry yet: geometryId is null so the M5
 *  save intent routes to create-new (the existing handleSaveArea flow) —
 *  accept-unchanged and edit-then-accept share this exact path, and an
 *  existing area edited later goes update-in-place through the same M5
 *  editor (no duplicate rows, no AI-internal components committed). */
export function beginImportedOutlineDraft(
  candidate: AiOutlineCandidate,
  context: EditContext,
): PrecisionEditSession {
  const record: SavedOutlineRecord = {
    geometryId: null,
    name: candidate.name,
    pitch: candidate.pitch,
    quoteRoofAreaId: null,
    fromPageId: context.pageId,
    points: candidate.points,
  };
  // An imported outline is a CLOSED polygon from the detector.
  return beginSavedOutlineEdit(record, context, 'imported');
}
