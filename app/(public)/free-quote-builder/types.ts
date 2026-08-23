// Shared types for the Free Quote Builder (free smart-component showcase tool)

export type MeasurementType = 'lineal' | 'area' | 'quantity';
export type WasteType = 'none' | 'percent' | 'fixed' | 'fixed_per_segment';
export type PitchType = 'rafter' | 'valley_hip' | 'none';
export type PricingStrategy = 'per_unit' | 'per_pack_length' | 'per_pack_area';

/** A user-built component (manual entry or CSV catalog row). Shape mirrors the
 * free-roof-takeoff draft componentSpecs 1:1 so the save-to-app flow
 * (/api/app/import-takeoff-draft) consumes it without translation. */
export interface BuilderComponent {
  id: string;
  name: string;
  measurementType: MeasurementType;
  materialRate: number;
  labourRate: number;
  pricingStrategy: PricingStrategy;
  packPrice: number | null;
  packSize: number | null;
  wasteType: WasteType;
  wasteValue: number;
  pitchEnabled: boolean;
  pitchType: PitchType;
  source: 'manual' | 'csv';
}

export type MeasureMode = 'actual' | 'plan';

/** A measurement entry attached to a parent area. */
export interface BuilderEntry {
  id: string;
  label: string;
  /** raw measurement: length (lineal), plan L x W or total (area), qty (quantity) */
  value: number;
  /** second dimension for area entries entered as L x W */
  value2?: number;
  /** true when value is already a TOTAL area (not L x W) */
  isTotal?: boolean;
  quantity: number;
  /** per-entry pitch override (plan mode); falls back to area pitch */
  pitchDegrees?: number;
}

/** A component placed on a parent area, holding one or more entries. */
export interface AreaComponent {
  id: string;
  componentId: string;
  entries: BuilderEntry[];
}

/** A parent area (roof plane, room, slab - whatever the user defines). */
export interface ParentArea {
  id: string;
  name: string;
  pitchDegrees: number;
  components: AreaComponent[];
}

export type UnitSystem = 'metric' | 'imperial' | 'squares';

export function makeId(prefix = 'id'): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function lenLabel(unit: UnitSystem): string {
  return unit === 'metric' ? 'm' : 'ft';
}

export function areaLabel(unit: UnitSystem): string {
  if (unit === 'metric') return 'm\u00B2';
  if (unit === 'imperial') return 'sq ft';
  return 'squares';
}
