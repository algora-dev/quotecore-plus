// M10 P2/P3/F4: AI component scan (touch) - shared types + helpers.
//
// The touch component scan runs the EXISTING authorised scan2 (line
// detection) + scan3 (classification) stages against the user-corrected
// saved outline. Billing: the server deducts points once on scan1 ("Scans
// 2+3 are continuations of the same scan session - no additional
// deduction", ai-scan-v3 route) so this continuation costs nothing extra.
//
// F4: groups are keyed by component_library id so ANY library component
// (not just the six system types) can be opened, drawn and persisted
// against its real id - custom components arrive in the quote builder
// priced, with no placeholder mapping.
import type { SemanticKey } from '../aiComponentRegistry';

/** Client-side stage labels for the two continuation scans. */
export type TouchComponentScanStage = 'lines' | 'classify';

/** One lineal entry inside a component group (review granularity, P3/F4). */
export interface TouchComponentEntry {
  id: string;
  /** Group key: the component_library id, or 'uncertain' for review-only detections. */
  key: string;
  /** component_library id (null = uncertain detections - never persisted). */
  componentId: string | null;
  displayName: string;
  colour: string;
  /** Real-world length in calibration units (AiMeasurement.value). */
  value: number;
  hidden: boolean;
  /** Canvas-space endpoints [start, end]. */
  points: { x: number; y: number }[];
}

/** One colour swatch group in the components rail. */
export interface TouchComponentGroup {
  key: string;
  componentId: string | null;
  displayName: string;
  colour: string;
  /** Number of line entries in this group. */
  count: number;
}

/** A component the user can open and draw entries for (F4: ANY library
 * component; system types keep their registry name and colour, customs get
 * a stable palette colour). */
export interface TouchComponentTarget {
  componentId: string;
  /** Semantic key when this is a system type; null for custom components. */
  key: SemanticKey | null;
  displayName: string;
  colour: string;
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

/** Derive rail groups (first-appearance order) from the entry records. */
export function groupsFromEntries(entries: TouchComponentEntry[]): TouchComponentGroup[] {
  const groups: TouchComponentGroup[] = [];
  const byKey = new Map<string, TouchComponentGroup>();
  for (const e of entries) {
    const existing = byKey.get(e.key);
    if (existing) {
      existing.count += 1;
      continue;
    }
    const group: TouchComponentGroup = {
      key: e.key,
      componentId: e.componentId,
      displayName: e.displayName,
      colour: e.colour,
      count: 1,
    };
    byKey.set(e.key, group);
    groups.push(group);
  }
  return groups;
}
