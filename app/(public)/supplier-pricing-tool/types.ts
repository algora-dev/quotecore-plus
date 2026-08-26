// Supplier Pricing Portal - shared types
// Phase 2: Standard + Advanced mode. AppliedProduct carries all settings;
// entryId=null means whole-group (Standard), specific entryId = per-entry.

export type MeasurementBasis = 'area' | 'lineal' | 'count';

/** Which measurement group a product can be applied to. */
export type GroupKey =
  | 'roofAreas'
  | 'ridges'
  | 'hips'
  | 'valleys'
  | 'barges'
  | 'spouting';

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
];

export interface SupplierProduct {
  id: string;
  name: string;
  code: string;
  basis: MeasurementBasis;
  /** groups this product is valid for */
  groups: GroupKey[];
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
  /** area (m2), length (m) or count */
  value: number;
}

export interface MeasurementGroup {
  key: GroupKey;
  entries: MeasureEntry[];
}

/** One product application. entryId=null applies to the whole group
 *  (Standard); a specific entryId is an Advanced per-entry assignment. */
export interface AppliedProduct {
  id: string;
  groupKey: GroupKey;
  productId: string;
  entryId: string | null;
  wastePct: number;
  labourRate: number;          // $ per unit (0 = none)
  qtyOverride: number | null;  // replaces measured qty when set
  priceOverride: number | null; // only honoured if product.priceEditable
}

export interface MeasurementSet {
  entryPath: 'measure' | 'plan' | 'actual'; // Phase 1: 'actual' only
  groups: Record<GroupKey, MeasurementGroup>;
  appliedProducts: AppliedProduct[];
}

export type Mode = 'standard' | 'advanced';

export type EntryMode = 'measure' | 'have'; // Step 1 choice
export type HaveSubMode = 'plan' | 'actual'; // Step 1B choice

export function emptyMeasurementSet(): MeasurementSet {
  const groups = {} as MeasurementSet['groups'];
  for (const g of GROUP_DEFS) {
    groups[g.key] = { key: g.key, entries: [] };
  }
  return { entryPath: 'actual', groups, appliedProducts: [] };
}

export function groupTotal(set: MeasurementSet, key: GroupKey): number {
  return set.groups[key].entries.reduce((s, e) => s + (e.value || 0), 0);
}

export function makeId(prefix = 'id'): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}
