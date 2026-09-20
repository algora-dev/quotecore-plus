// Partial-OCR review copy (calibration hardening Phase E, P1-11 audit
// 2026-09-20). Pure and client-safe: adapts the review panel's value hint to
// the candidate's valueState instead of a generic "could not read the
// distance" for every partial read.
import type { CalibrationCandidate } from './calibrationTypes';

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
