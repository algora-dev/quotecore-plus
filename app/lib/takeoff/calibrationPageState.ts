// P0-1 / P0-5 (calibration hardening audit 2026-09-20): pure per-page
// calibration resolution shared by page switching, area switching and
// hydration. A page's calibration restore comes ONLY from that page's own
// stored array - the outgoing page's current scale is never copied onto a
// destination page that has no saved calibration. Pure data in/out; no React,
// no Fabric, no Supabase. The caller owns the store, so no function here can
// ever write another page's calibration into it.
//
// Structural supertype of the workstation's local Calibration interface -
// assignment works in both directions without casts.

/** Minimal shape every stored page calibration satisfies (legacy array form). */
export interface PageCalibrationLike {
  id: string;
  point1: { x: number; y: number };
  point2: { x: number; y: number };
  pixelDistance: number;
  actualDistance: number;
  unit: 'feet' | 'meters';
  scale: number;
}

/** Read-only view of a per-page calibration store (e.g. a Map<string, Calibration[]>). */
export type PageCalibrationStore<T extends PageCalibrationLike = PageCalibrationLike> = ReadonlyMap<
  string,
  readonly T[]
>;

export interface PageCalibrationResolution<T extends PageCalibrationLike = PageCalibrationLike> {
  /** Defensive copies of the page's OWN stored calibration; empty when none. */
  calibrations: T[];
  calibrationConfirmed: boolean;
  showCalibrationHelp: boolean;
  /** 'page' = restored from this page's own stored array; 'none' = uncalibrated. */
  source: 'page' | 'none';
}

/**
 * P0-6 (calibration hardening audit 2026-09-20): should a decoded AI metadata
 * envelope be trusted for this page? The envelope's imageRevision must match
 * the page's authoritative server-established revision when that revision is
 * known. A mismatch means the envelope was computed against a different
 * source image (for example after a re-upload) - it must NOT be silently
 * trusted. A null page revision (pre-migration row) cannot contradict the
 * envelope, so the envelope stays trusted in that case.
 */
export function shouldTrustCalibrationMetadata(
  metadataImageRevision: string,
  pageImageRevision: string | null,
): boolean {
  if (pageImageRevision == null) return true;
  return metadataImageRevision === pageImageRevision;
}

/**
 * Resolve the calibration state a destination page should show.
 * - Page has its own stored calibration -> restore it (confirmed).
 * - Page has none (or pageId is null) -> uncalibrated entry state.
 */
export function resolvePageCalibration<T extends PageCalibrationLike>(
  store: PageCalibrationStore<T>,
  pageId: string | null | undefined,
): PageCalibrationResolution<T> {
  const own = pageId != null ? store.get(pageId) : undefined;
  if (own != null && own.length > 0) {
    return {
      calibrations: own.map((c) => ({ ...c })),
      calibrationConfirmed: true,
      showCalibrationHelp: false,
      source: 'page',
    };
  }
  return {
    calibrations: [],
    calibrationConfirmed: false,
    showCalibrationHelp: true,
    source: 'none',
  };
}
