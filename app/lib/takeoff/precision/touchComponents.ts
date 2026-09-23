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
//
// M11 (2026-09-23 owner pass): entries carry a KIND so the drawing tool
// follows the component's measurement type - lineal = two points, area =
// polygon, count/item = single placement. AI-scan system groups are
// placeholders: the detail page offers "attach real component" (desktop
// parity) and area components can reuse a saved roof area instead of a
// redraw.
import type { SemanticKey } from '../aiComponentRegistry';

/** Client-side stage labels for the two continuation scans. */
export type TouchComponentScanStage = 'lines' | 'classify';

/** How an entry is measured (mirrors the desktop tool choice). */
export type TouchEntryKind = 'line' | 'area' | 'point';

/** Which drawing interaction the touch flow uses for a component. */
export type TouchDrawMode = 'line' | 'polygon' | 'point';

/** One entry inside a component group (review granularity, P3/F4).
 * M11: kind decides value semantics + rendering + persist row type. */
export interface TouchComponentEntry {
  id: string;
  /** Group key: the component_library id, or 'uncertain' for review-only detections. */
  key: string;
  /** component_library id (null = uncertain detections - never persisted). */
  componentId: string | null;
  displayName: string;
  colour: string;
  /** line = length in calibration units; area = unit^2; point = 1 (count). */
  value: number;
  /** Measurement kind (M11). Scan lineal entries default to 'line'. */
  kind: TouchEntryKind;
  hidden: boolean;
  /** Canvas-space points: 2 endpoints (line), polygon vertices (area), or 1 point. */
  points: { x: number; y: number }[];
  /** Area entries attached to a saved roof area: the source outline's
   * geometryId (persisted as entryInputs.source_geometry_id). */
  fromRoofAreaId?: string;
  /** DB quote_roof_areas id for attached entries (persist stamp). */
  quoteRoofAreaId?: string | null;
  /** Plan-space area snapshot for attached entries (entryInputs.plan_value). */
  planValue?: number;
}

/** One colour swatch group in the components rail. */
export interface TouchComponentGroup {
  key: string;
  componentId: string | null;
  displayName: string;
  colour: string;
  /** Number of entries in this group. */
  count: number;
  /** M11 r3 (owner 2026-09-23): false = swatch-only on the grid (attached or
   * custom components - long customer names wreck the layout); scan defaults
   * + uncertain keep their short names. The detail page always names the
   * component. Decorated by useTouchComponents. */
  named?: boolean;
}

/** A component the user can open and draw entries for (F4: ANY library
 * component; system types keep their registry name and colour, customs get
 * a stable palette colour). M11 adds measurement type + system flag so the
 * rail can branch the draw tool and show placeholder attach. */
export interface TouchComponentTarget {
  componentId: string;
  /** Semantic key when this is a system type; null for custom components. */
  key: SemanticKey | null;
  displayName: string;
  colour: string;
  /** component_library.measurement_type (nullable). */
  measurementType?: string | null;
  /** System components (AI placeholders) offer "attach real component". */
  isSystem?: boolean;
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

/** M11: second post-scan education modal (owner 2026-09-23): scan-assist
 * defaults are placeholders - attach a real product before finishing. */
export const PLACEHOLDER_ATTACH_NOTICE =
  'The scan measures with default (placeholder) components - they have no pricing. Open each colour, check its lines, then use "Attach real component" to swap in a product from your library. Anything still attached to a default when you save will reach the quote without a price.';

/** M11: pick the touch drawing interaction from the component's
 * measurement type (mirrors the desktop applyToolForType branching). */
export function drawModeForMeasurementType(measurementType?: string | null): TouchDrawMode {
  const mt = (measurementType ?? '').toLowerCase();
  if (mt === 'area' || mt === 'irregular_area') return 'polygon';
  if (mt === 'count' || mt === 'quantity' || mt === 'fixed' || mt === 'hours_days') return 'point';
  return 'line'; // lineal, linear, curved_line, multi_lineal*, LxH, volume, unknown
}

/** M11: unit suffix for an entry row ("m"/"ft", "m2"/"ft2", each). */
export function unitSuffixForKind(kind: TouchEntryKind, unit: 'meters' | 'feet'): string {
  if (kind === 'area') return unit === 'meters' ? 'm²' : 'ft²';
  if (kind === 'point') return '';
  return unit === 'meters' ? 'm' : 'ft';
}

/** M11: true when the group's component is a seeded AI system placeholder. */
export function componentIsSystemPlaceholder(componentId: string | null,
  components: { id: string; is_system?: boolean }[]): boolean {
  if (!componentId) return false;
  return !!components.find(c => c.id === componentId)?.is_system;
}

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

/** Shoelace polygon area in canvas units (used for drawn area entries). */
export function polygonAreaCanvas(points: { x: number; y: number }[]): number {
  if (points.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}
