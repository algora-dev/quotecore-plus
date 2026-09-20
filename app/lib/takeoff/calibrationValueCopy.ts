// Partial-OCR review copy (calibration hardening Phase E, P1-11 audit
// 2026-09-20). Pure and client-safe: adapts the review panel's value hint to
// the candidate's valueState instead of a generic "could not read the
// distance" for every partial read.
import type { CalibrationCandidate } from './calibrationTypes';

/**
 * Plain-language calibration status (audit Section 7, UX-2 2026-09-20): the
 * user-facing panel never shows a raw pixels-per-unit number. The exact scale
 * stays available to debug contexts only.
 */
export interface CalibrationStatusInput {
  acceptedCount: number;
  /** True when accepted references disagree beyond the warning threshold. */
  disagreeing: boolean;
}

export interface CalibrationStatusCopy {
  headline: string;
  detail: string;
}

export function calibrationStatusCopy(input: CalibrationStatusInput): CalibrationStatusCopy {
  const n = input.acceptedCount;
  const measurements = `${n} measurement${n === 1 ? '' : 's'} accepted`;
  if (n <= 1) {
    return { headline: measurements, detail: 'Calibration ready.' };
  }
  return input.disagreeing
    ? { headline: measurements, detail: 'They disagree, so the scale may be off.' }
    : { headline: measurements, detail: 'They agree closely.' };
}

/**
 * Disagreement resolution copy (audit Section 7, UX-4): states plainly that the
 * system will average the accepted measurements, with two choices that never
 * block finishing.
 */
export function disagreementResolutionCopy(scaleRangePct: number, thresholdPct: number): string {
  return (
    `Your ${scaleRangePct.toFixed(2)}% difference is above the ${thresholdPct}% tolerance, ` +
    'so we will average the accepted measurements to one scale.'
  );
}

export type PartialValueCandidate = Pick<
  CalibrationCandidate,
  'valueState' | 'suggestedDistance' | 'suggestedUnit' | 'sourceLabelText'
>;

/**
 * Value-entry hint text for the active candidate. Full read keeps the
 * existing "AI read: ..." phrasing; partial reads say exactly WHAT is
 * missing so the user only completes the missing field:
 *   needs_distance: number unread, unit readable (unit is preselected)
 *   needs_unit:     number readable, unit unread (distance is prefilled as
 *                   the placeholder / suggested value)
 *   needs_both:     neither readable
 */
export function valueStateCopy(candidate: PartialValueCandidate): string {
  switch (candidate.valueState) {
    case 'readable':
      return `AI read ${candidate.suggestedDistance} ${candidate.suggestedUnit}. Check the printed distance, or correct it below.`;
    case 'needs_distance':
      return candidate.suggestedUnit
        ? `I found the measurement endpoints and the unit appears to be ${candidate.suggestedUnit}, but could not read the number. Enter the distance shown between these points.`
        : 'I found the measurement endpoints, but could not read the distance. Enter the distance shown between these points and choose its unit.';
    case 'needs_unit':
      return candidate.suggestedDistance != null
        ? `I read the number ${candidate.suggestedDistance}, but could not tell the unit. Check the plan and choose the correct unit.`
        : 'I found the measurement endpoints, but could not read the distance. Enter the distance shown between these points and choose its unit.';
    case 'needs_both':
    default:
      return 'I found the measurement endpoints, but could not read the printed distance or unit. Enter the distance shown between these points and choose its unit.';
  }
}
