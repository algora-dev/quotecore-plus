// Supplier Pricing Portal - shared types
// Phase 2: Standard + Advanced mode. AppliedProduct carries all settings;
// entryId=null means whole-group (Standard), specific entryId = per-entry.

import { GROUP_PITCH_RULES, pitchFactor } from './pitch';

export type MeasurementBasis = 'area' | 'lineal' | 'count';

/** Which measurement group a product can be applied to.
 *  'areas' = parent-model trades (cladding/flooring) - see tradeConfig.ts. */
export type GroupKey =
  | 'areas'
  | 'roofAreas'
  | 'ridges'
  | 'hips'
  | 'valleys'
  | 'barges'
  | 'spouting'
  | 'downpipes';

export interface GroupDef {
  key: GroupKey;
  label: string;
  singular: string;
  basis: MeasurementBasis;
  unit: string; // m2, m, pcs
}

export const GROUP_DEFS: GroupDef[] = [
  { key: 'roofAreas', label: 'Roof Areas', singular: 'Roof Area', basis: 'area', unit: 'm\u00B2' },
  { key: 'ridges', label: 'Ridges', singular: 'Ridge', basis: 'lineal', unit: 'm' },
  { key: 'hips', label: 'Hips', singular: 'Hip', basis: 'lineal', unit: 'm' },
  { key: 'valleys', label: 'Valleys', singular: 'Valley', basis: 'lineal', unit: 'm' },
  { key: 'barges', label: 'Barges', singular: 'Barge', basis: 'lineal', unit: 'm' },
  { key: 'spouting', label: 'Spouting', singular: 'Spouting', basis: 'lineal', unit: 'm' },
  { key: 'downpipes', label: 'Downpipes', singular: 'Downpipe', basis: 'count', unit: 'ea' },
];

export type RoofTypeTag = string; // 'slate' | 'tile' | 'metal' | ... | 'all'

export interface SupplierProduct {
  id: string;
  name: string;
  code: string;
  basis: MeasurementBasis;
  /** groups this product is valid for */
  groups: GroupKey[];
  /** component category - coverings drive roof-type compatibility */
  component?: 'covering' | 'underlay' | 'fixing' | 'ridge' | 'hip' | 'valley' | 'barge' | 'gutter' | 'downpipe';
  /** roof types this product suits - ['all'] when omitted */
  roofTypes?: RoofTypeTag[];
  /** system family - same-family items are Recommended once a covering is picked */
  family?: string;
  unitPrice: number; // baseline/public price per unit
  packSize: number | null; // when set, sold in packs
  defaultWastePct: number; // suggested waste for this product
  defaultLabourRate: number; // suggested labour $/unit (0 = none)
  priceEditable: boolean; // supplier config: can customer override price?
  suggested?: boolean;
}

/** One measured line inside a group (e.g. "Area 1" or "Front ridge"). */
export interface MeasureEntry {
  id: string;
  label: string;
  /** area (m2), length (m) or count - plan value when entryPath === 'plan' */
  value: number;
  /** how many of this measurement (length x qty); areas use 1 */
  quantity: number;
  /** optional per-entry pitch override (plan mode) */
  pitchDegrees?: number;
  /** linear entries: the roof area this component belongs to. Drives
   *  plan-mode pitch conversion (attached area's pitch) and output grouping. */
  roofAreaId?: string | null;
}

export interface MeasurementGroup {
  key: GroupKey;
  entries: MeasureEntry[];
  /** master pitch (plan mode); entries inherit unless they carry their own */
  pitchDegrees: number;
}

// ---------------------------------------------------------------------
// PARENT-AREA MODEL v2 (cladding / flooring - see tradeConfig.ts)
// A PARENT is a pure name-only bucket ("Cedar Cladding", "Plasterboard")
// with no geometry, no measurement and no product of its own. Components
// under the bucket carry the measurements AND receive the products at the
// next step (possibly several layered products on one component).
// ---------------------------------------------------------------------

/** A named bucket organising the job. Never measured, never priced. */
export interface ParentArea {
  id: string;
  name: string;
}

/** How a component is measured (and which catalog products it accepts). */
export type ParentBasis = 'area' | 'lineal' | 'point';

/** A measured component attached to a parent bucket. */
export interface ParentComponent {
  id: string;
  parentId: string;
  name: string;
  basis: ParentBasis;
}

/** One measured entry inside a component. */
export interface ParentEntry {
  id: string;
  componentId: string;
  label: string;
  /** area (m2), length (m) or count - basis of the owning component */
  value: number;
  /** how many of this measurement (identical runs/areas); default 1 */
  quantity: number;
  /** optional raw length + height that produced value (area basis, display only) */
  length?: number | null;
  height?: number | null;
  /** optional slope/angle in degrees (cladding only, display only) */
  angleDegrees?: number | null;
}

/** One product applied to a component. Components take MULTIPLE products
 *  (layered: cedar timber + battens + building wrap on the same m2). */
export interface ComponentApplied {
  id: string;
  componentId: string;
  productId: string;
  wastePct: number;
  labourRate: number;         // per unit (0 = none)
  qtyOverride: number | null; // replaces measured qty when set
  priceOverride: number | null; // only honoured if product.priceEditable
}

/** The whole in-progress job for parent-model trades. */
export interface ParentJob {
  parents: ParentArea[];
  components: ParentComponent[];
  entries: ParentEntry[];
  applied: ComponentApplied[];
  customComponents: CustomComponent[];
}

export function emptyParentJob(): ParentJob {
  return { parents: [], components: [], entries: [], applied: [], customComponents: [] };
}

export const PARENT_BASIS_UNIT: Record<ParentBasis, string> = {
  area: 'm\u00B2',
  lineal: 'm',
  point: 'ea',
};

/** Total measured value of one component (entries x qty). */
export function componentTotal(job: ParentJob, componentId: string): number {
  return job.entries
    .filter(e => e.componentId === componentId)
    .reduce((s, e) => s + (e.value || 0) * (e.quantity || 1), 0);
}

/** One product application. entryId=null applies to the whole group
 *  (Standard); a specific entryId is an Advanced per-entry assignment. */
export interface AppliedProduct {
  id: string;
  groupKey: GroupKey;
  productId: string;
  entryId: string | null;
  wastePct: number;
  /** length-based waste: flat amount added to calc qty (same unit as the group) */
  wasteFlat: number;
  /** which waste mode is active - only one applies at a time */
  wasteMode: 'percent' | 'flat';
  labourRate: number;          // $ per unit (0 = none)
  qtyOverride: number | null;  // replaces measured qty when set
  priceOverride: number | null; // only honoured if product.priceEditable
}

/** Purchase qty after waste (percent OR flat length per wasteMode - never
 *  both) - single source of truth shared by the pricing engine and the live
 *  UI previews. */
export function applyWaste(ap: { wastePct?: number; wasteFlat?: number; wasteMode?: 'percent' | 'flat' }, calcQty: number): number {
  if (ap.wasteMode === 'flat') {
    return calcQty + (ap.wasteFlat || 0);
  }
  return calcQty * (1 + (ap.wastePct || 0) / 100);
}

/** User-defined custom component (final step before output). Fully
 *  self-priced: the user enters measurement basis, quantity, material cost
 *  and labour cost. Session-only - never persisted to any library. */
export interface CustomComponent {
  id: string;
  name: string;
  basis: MeasurementBasis;
  /** measured amount: m2, m or count */
  quantity: number;
  /** material cost per unit */
  unitPrice: number;
  /** labour cost per unit (0 = none) */
  labourRate: number;
}

export const CUSTOM_BASIS_UNIT: Record<MeasurementBasis, string> = {
  area: 'm\u00B2',
  lineal: 'm',
  count: 'ea',
};

export interface MeasurementSet {
  entryPath: 'measure' | 'plan' | 'actual'; // Phase 1: 'actual' only
  /** keyed by GroupKey; parent-model trades do not use this */
  groups: Record<string, MeasurementGroup>;
  appliedProducts: AppliedProduct[];
  /** user-created custom components (final step before output) */
  customComponents: CustomComponent[];
}

export type Mode = 'standard' | 'advanced';

export type EntryMode = 'measure' | 'have'; // Step 1 choice
export type HaveSubMode = 'plan' | 'actual'; // Step 1B choice

export function emptyMeasurementSet(): MeasurementSet {
  const groups = {} as MeasurementSet['groups'];
  for (const g of GROUP_DEFS) {
    groups[g.key] = { key: g.key, entries: [], pitchDegrees: 25 };
  }
  return { entryPath: 'actual', groups, appliedProducts: [], customComponents: [] };
}

export function groupTotal(set: MeasurementSet, key: GroupKey): number {
  return set.groups[key].entries.reduce((s, e) => s + (e.value || 0), 0);
}

/** Pitched (converted) value of an entry - plan mode applies the pitch
 *  rule; actual mode returns the value unchanged. Attached linear entries
 *  convert at their ROOF AREA's pitch (per-area correctness), falling back
 *  to the group pitch when unattached. */
export function entryPitched(set: MeasurementSet, key: GroupKey, entryId: string): number {
  const g = set.groups[key];
  const e = g.entries.find(x => x.id === entryId);
  if (!e) return 0;
  const raw = e.value * (e.quantity || 1);
  if (set.entryPath !== 'plan') return raw;
  const areaPitch = e.roofAreaId
    ? set.groups.roofAreas.entries.find(a => a.id === e.roofAreaId)?.pitchDegrees
    : undefined;
  const deg = e.pitchDegrees ?? areaPitch ?? g.pitchDegrees ?? 0;
  return raw * pitchFactor(GROUP_PITCH_RULES[key] ?? 'none', deg);
}

/** Pitched total for a whole group. */
export function groupPitchedTotal(set: MeasurementSet, key: GroupKey): number {
  return set.groups[key].entries.reduce((s, e) => s + entryPitched(set, key, e.id), 0);
}

export function makeId(prefix = 'id'): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}
