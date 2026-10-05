// Deterministic distance/value text parsing, unit normalisation, deduplication,
// eligibility and ranking for calibration candidates.
// Spec: sections 6.5, 6.6, 7.3, 9.2. Application code parses model-copied text - never
// parseFloat() on arbitrary OCR text; a valid numeric prefix is not the whole measurement.
import type { CalibrationCandidate, DistanceUnit, Point, WorkingUnit } from './calibrationTypes';
import { distance } from './calibrationCoordinates';

/** Canonical conversion factors to metres (spec 9.2). */
export const UNIT_TO_METERS: Readonly<Record<DistanceUnit, number>> = {
  m: 1,
  cm: 0.01,
  mm: 0.001,
  ft: 0.3048,
  in: 0.0254,
  yd: 0.9144,
};

export const METERS_PER_FOOT = 0.3048;

export function convertDistance(value: number, from: DistanceUnit, to: DistanceUnit): number {
  return (value * UNIT_TO_METERS[from]) / UNIT_TO_METERS[to];
}

export function convertToWorkingUnit(value: number, from: DistanceUnit, working: WorkingUnit): number {
  return working === 'meters' ? value * UNIT_TO_METERS[from] : convertDistance(value, from, 'ft');
}

const UNIT_WORDS: Readonly<Record<string, DistanceUnit>> = {
  m: 'm', meter: 'm', meters: 'm', metre: 'm', metres: 'm',
  cm: 'cm', centimeter: 'cm', centimeters: 'cm', centimetre: 'cm', centimetres: 'cm',
  mm: 'mm', millimeter: 'mm', millimeters: 'mm', millimetre: 'mm', millimetres: 'mm',
  ft: 'ft', foot: 'ft', feet: 'ft',
  in: 'in', inch: 'in', inches: 'in',
  yd: 'yd', yard: 'yd', yards: 'yd',
};

function parseUnitWord(raw: string | null | undefined): DistanceUnit | null {
  if (raw == null) return null;
  const key = raw.trim().toLowerCase();
  if (key === '"' || key === '``' || key === '\u2033') return 'in';
  if (key === "'" || key === '\u2019') return 'ft';
  return UNIT_WORDS[key] ?? null;
}

/** P1-11 (audit 2026-09-20): public unit-word normalisation so partial OCR
 *  states can pre-fill the unit when the number is unreadable. */
export function normaliseUnitWord(raw: string | null | undefined): DistanceUnit | null {
  return parseUnitWord(raw);
}

const DECIMAL = String.raw`\d+(?:\.\d+)?`;
const FRACTION = String.raw`\d+\s+\d+\/\d+|\d+\/\d+`;
const FEET_MARK = String.raw`(?:'|ft|feet|foot|ft\.|feet\.)`;
const INCH_MARK = String.raw`(?:"|''|\u2033|in|inch|inches|in\.|inch\.)`;

// Feet-and-inches, e.g. 10'-6", 10'-6 1/2", 10 ft 6 in. The inch terminator is required
// whenever an inches component is present; a bare trailing number after the feet marker is
// ambiguous and rejected.
const FEET_INCHES_RE = new RegExp(
  String.raw`^(${DECIMAL})\s*${FEET_MARK}\s*-?\s*(?:(${DECIMAL})|(${FRACTION}))\s*${INCH_MARK}$`,
  'i',
);
const FEET_ONLY_RE = new RegExp(String.raw`^(${DECIMAL})\s*${FEET_MARK}$`, 'i');
const INCHES_ONLY_RE = new RegExp(String.raw`^(${DECIMAL})\s*${INCH_MARK}$`, 'i');
const NUMBER_UNIT_RE = new RegExp(String.raw`^(${DECIMAL})\s*([a-zA-Z']+)$`, 'i');
const BARE_NUMBER_RE = new RegExp(String.raw`^(${DECIMAL})$`);
const BARE_FRACTION_RE = new RegExp(String.raw`^(${FRACTION})$`);

/** P1-11: strict bare-number/fraction parse (no unit attached). Returns the
 *  numeric value when the text is ONLY a number, else null. */
export function parseBareNumber(text: string | null | undefined): number | null {
  const value = text?.trim() ?? '';
  if (value.length === 0) return null;
  if (BARE_NUMBER_RE.test(value)) return Number(value);
  if (BARE_FRACTION_RE.test(value)) return parseFractionValue(value);
  return null;
}

function parseFractionValue(text: string): number | null {
  const mixed = text.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) {
    return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  }
  const simple = text.match(/^(\d+)\/(\d+)$/);
  if (simple) return Number(simple[1]) / Number(simple[2]);
  return null;
}

export interface ParsedDistance {
  distance: number;
  unit: DistanceUnit;
}

/**
 * Strict deterministic parse of model-copied value/unit evidence.
 * Returns null for ambiguous separators, unrecognised syntax, missing units or
 * conflicting units. Anchored patterns only - never a parseFloat prefix.
 */
export function parseDistanceSuggestion(
  valueText: string | null,
  unitText: string | null,
): ParsedDistance | null {
  const value = valueText?.trim() ?? '';
  if (value.length === 0) return null;
  const declaredUnit = parseUnitWord(unitText);

  // Combined feet-and-inches notations.
  const fi = value.match(FEET_INCHES_RE);
  if (fi) {
    if (declaredUnit != null && declaredUnit !== 'ft') return null;
    const inches = fi[3] != null ? parseFractionValue(fi[3]) : Number(fi[2]);
    if (inches == null || inches >= 12) return null;
    return { distance: Number(fi[1]) + inches / 12, unit: 'ft' };
  }

  const inchesOnly = value.match(INCHES_ONLY_RE);
  if (inchesOnly) {
    if (declaredUnit != null && declaredUnit !== 'in') return null;
    return { distance: Number(inchesOnly[1]), unit: 'in' };
  }

  const feetOnly = value.match(FEET_ONLY_RE);
  if (feetOnly) {
    if (declaredUnit != null && declaredUnit !== 'ft') return null;
    return { distance: Number(feetOnly[1]), unit: 'ft' };
  }

  // Number plus attached unit word, e.g. "6.42 m", "12 ft".
  const numUnit = value.match(NUMBER_UNIT_RE);
  if (numUnit) {
    const attached = parseUnitWord(numUnit[2]);
    if (attached == null) return null;
    if (declaredUnit != null && declaredUnit !== attached) return null;
    return { distance: Number(numUnit[1]), unit: attached };
  }

  // Bare number (or fraction) requiring a separate, parseable unit.
  const declared = parseUnitWord(unitText);
  if (declared == null) return null;
  if (BARE_NUMBER_RE.test(value)) return { distance: Number(value), unit: declared };
  if (BARE_FRACTION_RE.test(value)) {
    const parsed = parseFractionValue(value);
    if (parsed != null) return { distance: parsed, unit: declared };
  }
  return null;
}

/** Symmetric endpoint discrepancy ignoring endpoint order (spec 7.3). */
export function pairDistance(
  a: { p1: Point; p2: Point },
  b: { p1: Point; p2: Point },
): number {
  return Math.min(
    Math.max(distance(a.p1, b.p1), distance(a.p2, b.p2)),
    Math.max(distance(a.p1, b.p2), distance(a.p2, b.p1)),
  );
}

export interface DedupeOptions {
  /** Tight coordinate equivalence for numerical duplicates (default 2 px on a 2000 px frame). */
  tightTolerancePx?: number;
  /** Broader physical-reference proximity tolerance (default 5x tight). */
  proximityTolerancePx?: number;
}

export interface DedupeResult<T> {
  /** Representatives in input order; duplicates dropped. */
  kept: T[];
  /** Indices (into the input array) that were dropped as duplicates of an earlier item. */
  duplicateIndices: number[];
}

/**
 * Deduplicate physical references: first tight coordinate equivalence (numerical
 * duplicates/jitter), then broader physical-reference proximity via the symmetric
 * pairDistance. Endpoint order is ignored. Never merges by label text alone.
 */
export function deduplicateByGeometry<T extends { sceneP1: Point; sceneP2: Point }>(
  items: readonly T[],
  options: DedupeOptions = {},
): DedupeResult<T> {
  const tight = options.tightTolerancePx ?? 2;
  const proximity = options.proximityTolerancePx ?? tight * 5;
  const kept: T[] = [];
  const duplicateIndices: number[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const dup = kept.some((k) => {
      const d = pairDistance(
        { p1: k.sceneP1, p2: k.sceneP2 },
        { p1: item.sceneP1, p2: item.sceneP2 },
      );
      return d <= tight || d <= proximity;
    });
    if (dup) duplicateIndices.push(i);
    else kept.push(item);
  }
  return { kept, duplicateIndices };
}

export interface EligibilityFlags {
  sourceType: CalibrationCandidate['sourceType'];
  explicitDistanceReference: boolean;
  straightSpan: boolean;
  bothEndpointsVisible: boolean;
  endpointAssociationClear: boolean;
  sameMeasurementView: boolean;
}

export interface EligibilityResult {
  eligible: boolean;
  reasons: string[];
}

/** Geometric/evidence screening (spec 6.6 steps 2-3). An unparseable value is NOT ineligible. */
export function checkEligibility(flags: EligibilityFlags): EligibilityResult {
  const reasons: string[] = [];
  if (!flags.explicitDistanceReference) reasons.push('no_explicit_distance_reference');
  if (!flags.straightSpan) reasons.push('not_a_straight_two_point_span');
  if (!flags.bothEndpointsVisible) reasons.push('endpoints_not_both_visible');
  if (!flags.endpointAssociationClear) reasons.push('endpoint_association_ambiguous');
  if (!flags.sameMeasurementView) reasons.push('different_measurement_view');
  return { eligible: reasons.length === 0, reasons };
}

/** Structurally invalid geometry: non-finite points or zero endpoint separation. */
export function hasValidGeometry(c: Pick<CalibrationCandidate, 'sceneP1' | 'sceneP2'>): boolean {
  const { sceneP1, sceneP2 } = c;
  if (![sceneP1.x, sceneP1.y, sceneP2.x, sceneP2.y].every(Number.isFinite)) return false;
  return distance(sceneP1, sceneP2) > 0;
}

export interface RankingOptions {
  /** Warning-only short-span threshold in scene pixels; no hard minimum span is enforced. */
  shortSpanWarningPx?: number;
}

/** A candidate plus the screening flags captured from its hypothesis at construction. */
export interface RankableCandidate extends CalibrationCandidate, EligibilityFlags {}

/**
 * Eligibility BEFORE ranking, then descending final pixel span with endpoint confidence
 * and value readability as tie-breakers. Never ranks by the printed real-world number and
 * never weights the scale by ranking. Invalid geometry is excluded.
 */
export function rankCandidates<T extends RankableCandidate>(
  candidates: readonly T[],
  options: RankingOptions = {},
): T[] {
  const eligible = candidates.filter((c) =>
    hasValidGeometry(c) &&
    Number.isFinite(c.endpointConfidence) &&
    checkEligibility({
      sourceType: c.sourceType,
      explicitDistanceReference: c.explicitDistanceReference,
      straightSpan: c.straightSpan,
      bothEndpointsVisible: c.bothEndpointsVisible,
      endpointAssociationClear: c.endpointAssociationClear,
      sameMeasurementView: c.sameMeasurementView,
    }).eligible,
  );
  const shortSpan = options.shortSpanWarningPx ?? 30;
  return eligible
    .slice()
    .sort((a, b) => {
      if (b.scenePixelLength !== a.scenePixelLength) return b.scenePixelLength - a.scenePixelLength;
      if (b.endpointConfidence !== a.endpointConfidence) return b.endpointConfidence - a.endpointConfidence;
      const rank = (c: CalibrationCandidate) => (c.valueState === 'readable' ? 0 : 1);
      return rank(a) - rank(b);
    })
    .map((c) => {
      const warnings = c.warnings.slice();
      if (c.scenePixelLength < shortSpan && !warnings.includes('short_pixel_span')) {
        warnings.push('short_pixel_span');
      }
      return { ...c, warnings };
    });
}
