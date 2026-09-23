// M10 P2: AI component scan (touch) - shared types + helpers.
//
// The touch component scan runs the EXISTING authorised scan2 (line
// detection) + scan3 (classification) stages against the user-corrected
// saved outline. Billing: the server deducts points once on scan1 ("Scans
// 2+3 are continuations of the same scan session - no additional
// deduction", ai-scan-v3 route) so this continuation costs nothing extra.
import type { SemanticKey } from '../aiComponentRegistry';
import { AI_COMPONENT_REGISTRY, ALL_SEMANTIC_KEYS, getSemanticColour } from '../aiComponentRegistry';

/** Client-side stage labels for the two continuation scans. */
export type TouchComponentScanStage = 'lines' | 'classify';

/** One colour swatch in the components rail (a semantic group on canvas). */
export interface TouchComponentGroup {
  key: SemanticKey;
  displayName: string;
  colour: string;
  /** Number of detected line entries in this group. */
  count: number;
}

/** One lineal entry inside a component group (review granularity, P3). */
export interface TouchComponentEntry {
  id: string;
  key: SemanticKey;
  displayName: string;
  colour: string;
  /** Real-world length in calibration units (AiMeasurement.value). */
  value: number;
  hidden: boolean;
}

export type TouchComponentScanResult =
  | { ok: true; data: unknown }
  | { ok: false; error: string; cancelled?: boolean };

/** Simplified terms acknowledgement shown after the component scan (D2). */
export const COMPONENT_SCAN_DISCLAIMER =
  'AI scan results are a starting point, not a guarantee. Always check each detected line against the plan before quoting. You can hide or delete anything before saving. QuoteCore+ cannot be held liable for AI scan accuracy.';

/** Short D1 notice shown after the AI outline scan imports. */
export const OUTLINE_SCAN_DISCLAIMER =
  'This outline came from an AI scan. AI results are a best guess - check the points and adjust anything that looks off before you save.';

/** "3 x Ridges, 2 x Valley" style summary for the D2 disclaimer. */
export function componentGroupSummary(groups: TouchComponentGroup[]): string {
  if (!groups.length) return 'No components were detected.';
  return groups.map(g => `${g.count} x ${g.displayName}`).join(', ');
}

/** Derive rail groups (ordered by the registry) from applied measurements. */
export function groupsFromMeasurements(
  measurements: { semanticKey: SemanticKey }[],
): TouchComponentGroup[] {
  const counts = new Map<SemanticKey, number>();
  for (const m of measurements) {
    counts.set(m.semanticKey, (counts.get(m.semanticKey) ?? 0) + 1);
  }
  return ALL_SEMANTIC_KEYS
    .filter(key => counts.has(key))
    .map(key => ({
      key,
      displayName: AI_COMPONENT_REGISTRY[key].displayName,
      colour: getSemanticColour(key),
      count: counts.get(key) ?? 0,
    }));
}
