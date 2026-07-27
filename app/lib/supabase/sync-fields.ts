/**
 * Canonical synchronised fields for supplier component updates.
 * Used by: snapshot construction, diffing, formatting, and apply logic.
 * NEVER sync ownership, local collection, ordering, billing, system, source-tracking, or audit fields.
 */

export const SYNC_FIELDS = [
  // Identity / details
  'name',
  'component_type',
  'measurement_type',
  'sku',
  'takeoff_slot',
  'notes',
  // Rates
  'default_material_rate',
  'default_labour_rate',
  // Waste / pitch
  'default_waste_type',
  'default_waste_percent',
  'default_waste_fixed',
  'default_pitch_type',
  'waste_unit',
  // Packs
  'pack_price',
  'pack_size',
  'pack_coverage_m2',
  // Pricing / display
  'pricing_strategy',
  'show_price_default',
  'show_dimensions_default',
  'eligible_for_orders',
  // Dimensions
  'height_value_mm',
  'depth_value_mm',
] as const;

export type SyncField = (typeof SYNC_FIELDS)[number];

/** Price-related fields - used to classify change_type as 'price_changed' vs 'modified' */
export const PRICE_FIELDS: readonly SyncField[] = [
  'default_material_rate',
  'default_labour_rate',
  'pack_price',
] as const;

/** Build a snapshot object from a component row, keeping only canonical fields */
export function buildSnapshot<T extends Record<string, unknown>>(component: T): Record<string, unknown> {
  const snapshot: Record<string, unknown> = { id: component.id };
  for (const field of SYNC_FIELDS) {
    if (field in component) {
      snapshot[field] = component[field];
    }
  }
  return snapshot;
}

/** Build snapshot array from component list */
export function buildSnapshotArray<T extends Record<string, unknown>>(components: T[]): Record<string, unknown>[] {
  return components.map(buildSnapshot);
}

/** Compare two snapshots and return changed fields */
export function diffSnapshots(
  prev: Record<string, unknown>,
  next: Record<string, unknown>,
): { field: string; oldValue: unknown; newValue: unknown }[] {
  const changes: { field: string; oldValue: unknown; newValue: unknown }[] = [];
  for (const field of SYNC_FIELDS) {
    const oldVal = prev[field];
    const newVal = next[field];
    // Compare with null-safe equality
    if (oldVal !== newVal && (oldVal === undefined || newVal === undefined || String(oldVal) !== String(newVal))) {
      changes.push({ field, oldValue: oldVal ?? null, newValue: newVal ?? null });
    }
  }
  return changes;
}

/** Classify a change: 'price_changed' if only price fields differ, 'modified' otherwise */
export function classifyChange(
  prev: Record<string, unknown>,
  next: Record<string, unknown>,
): 'price_changed' | 'modified' {
  const changed = diffSnapshots(prev, next);
  if (changed.length === 0) return 'modified'; // no change - shouldn't reach here
  const changedFields = new Set(changed.map(c => c.field));
  const nonPriceChanged = [...changedFields].some(f => !PRICE_FIELDS.includes(f as never));
  return nonPriceChanged ? 'modified' : 'price_changed';
}

/** Human-readable label for a sync field */
export const FIELD_LABELS: Record<string, string> = {
  name: 'Name',
  component_type: 'Component Type',
  measurement_type: 'Measurement Type',
  sku: 'SKU',
  takeoff_slot: 'Takeoff Slot',
  notes: 'Notes',
  default_material_rate: 'Material Rate',
  default_labour_rate: 'Labour Rate',
  default_waste_type: 'Waste Type',
  default_waste_percent: 'Waste %',
  default_waste_fixed: 'Waste Fixed',
  default_pitch_type: 'Pitch Type',
  waste_unit: 'Waste Unit',
  pack_price: 'Pack Price',
  pack_size: 'Pack Size',
  pack_coverage_m2: 'Pack Coverage (m2)',
  pricing_strategy: 'Pricing Strategy',
  show_price_default: 'Show Price',
  show_dimensions_default: 'Show Dimensions',
  eligible_for_orders: 'Eligible for Orders',
  height_value_mm: 'Height (mm)',
  depth_value_mm: 'Depth (mm)',
};
