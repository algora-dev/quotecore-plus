// Calculation engine for the Free Quote Builder - mirrors the free-roof-takeoff
// calc semantics (pitch factors, waste, pack pricing) but keyed on user-defined
// components instead of fixed roofing kinds.

import type {
  AreaComponent, BuilderComponent, BuilderEntry, MeasureMode, ParentArea, UnitSystem,
} from './types';

const RAD = Math.PI / 180;

export function rafterPitchFactor(degrees: number): number {
  if (!degrees || degrees <= 0 || degrees >= 90) return 1;
  return 1 / Math.cos(degrees * RAD);
}

export function hipValleyPitchFactor(degrees: number): number {
  if (!degrees || degrees <= 0 || degrees >= 90) return 1;
  const tangent = Math.tan(degrees * RAD);
  return Math.sqrt(1 + (tangent * tangent) / 2);
}

export function pitchFactor(degrees: number, pitchType: 'rafter' | 'valley_hip' | 'none'): number {
  if (pitchType === 'none') return 1;
  if (pitchType === 'valley_hip') return hipValleyPitchFactor(degrees);
  return rafterPitchFactor(degrees);
}

/** Raw measurement value for an entry (before pitch/waste). */
export function entryRawValue(entry: BuilderEntry, comp: BuilderComponent): number {
  const qty = entry.quantity || 1;
  if (comp.measurementType === 'quantity') return qty;
  if (comp.measurementType === 'area') {
    const base = entry.isTotal ? entry.value : (entry.value || 0) * (entry.value2 || 0);
    return base * qty;
  }
  return (entry.value || 0) * qty;
}

/** Final measurement for an entry: raw -> pitch (plan mode). Waste is applied
 * at the component level in areaComponentTotals. */
export function entryFinalValue(
  entry: BuilderEntry,
  comp: BuilderComponent,
  area: ParentArea,
  measureMode: MeasureMode,
): number {
  const raw = entryRawValue(entry, comp);
  if (measureMode !== 'plan' || !comp.pitchEnabled || comp.pitchType === 'none') return raw;
  // Undefined pitch means "follow the area pitch" - only an explicit per-entry
  // override (user typed a value) pins the entry to a different pitch.
  const degrees = entry.pitchDegrees ?? area.pitchDegrees ?? 0;
  return raw * pitchFactor(degrees, comp.pitchType);
}

export function applyWaste(total: number, comp: BuilderComponent): number {
  if (comp.wasteType === 'percent') return total * (1 + (comp.wasteValue || 0) / 100);
  return total; // fixed waste handled per-entry in wasteFixedTotal
}

export function wasteFixedTotal(comp: BuilderComponent, entryCount: number): number {
  if (comp.wasteType === 'fixed' || comp.wasteType === 'fixed_per_segment') {
    return (comp.wasteValue || 0) * entryCount;
  }
  return 0;
}

export interface MaterialCost { cost: number; packs: number }

export function materialCost(finalQty: number, comp: BuilderComponent): MaterialCost {
  if (comp.pricingStrategy === 'per_unit' || !comp.packPrice || !comp.packSize) {
    return { cost: finalQty * (comp.materialRate || 0), packs: 0 };
  }
  const packs = Math.ceil(finalQty / comp.packSize);
  return { cost: packs * comp.packPrice, packs };
}

export function labourCost(finalQty: number, comp: BuilderComponent): number {
  return finalQty * (comp.labourRate || 0);
}

export interface AreaComponentTotals {
  rawTotal: number;
  finalTotal: number;
  withWasteTotal: number;
  entryCount: number;
  materialCost: number;
  labourCost: number;
  packs: number;
}

export function areaComponentTotals(
  ac: AreaComponent,
  comp: BuilderComponent,
  area: ParentArea,
  measureMode: MeasureMode,
): AreaComponentTotals {
  let rawTotal = 0;
  let finalTotal = 0;
  for (const e of ac.entries) {
    rawTotal += entryRawValue(e, comp);
    finalTotal += entryFinalValue(e, comp, area, measureMode);
  }
  const withWaste = applyWaste(finalTotal, comp) + wasteFixedTotal(comp, ac.entries.length);
  // Cost uses the full waste-inclusive quantity (percent AND fixed waste)
  // so the price covers what is actually billed/needed.
  const mat = materialCost(withWaste, comp);
  const lab = labourCost(withWaste, comp);
  return {
    rawTotal,
    finalTotal,
    withWasteTotal: withWaste,
    entryCount: ac.entries.length,
    materialCost: mat.cost,
    labourCost: lab,
    packs: mat.packs,
  };
}

export interface GrandTotals {
  material: number;
  labour: number;
  total: number;
  hasPricing: boolean;
}

export function grandTotals(
  areas: ParentArea[],
  components: BuilderComponent[],
  measureMode: MeasureMode,
): GrandTotals {
  let material = 0;
  let labour = 0;
  const byId = new Map(components.map(c => [c.id, c]));
  for (const area of areas) {
    for (const ac of area.components) {
      const comp = byId.get(ac.componentId);
      if (!comp || ac.entries.length === 0) continue;
      const t = areaComponentTotals(ac, comp, area, measureMode);
      material += t.materialCost;
      labour += t.labourCost;
    }
  }
  return { material, labour, total: material + labour, hasPricing: material > 0 || labour > 0 };
}

export function fmt(n: number, dp = 2): string {
  return n.toLocaleString('en-NZ', { minimumFractionDigits: dp, maximumFractionDigits: dp });
}
