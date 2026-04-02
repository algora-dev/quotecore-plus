// QuoteCore+ v2 Pricing Engine
// Unified calculation: dual input → pitch → waste → costs

export type ComponentType = 'main' | 'extra';
export type MeasurementType = 'area' | 'linear' | 'quantity' | 'fixed';
export type InputMode = 'final' | 'calculated';
export type WasteType = 'percent' | 'fixed' | 'none';
export type PitchType = 'none' | 'rafter' | 'valley_hip';

export interface RoofArea {
  id: string; label: string; inputMode: InputMode;
  finalValueSqm?: number; calcWidthM?: number; calcLengthM?: number;
  calcPlanSqm?: number; calcPitchDegrees?: number; computedSqm?: number;
}

export interface QuoteComponent {
  id: string; quoteRoofAreaId?: string; name: string;
  componentType: ComponentType; measurementType: MeasurementType;
  inputMode: InputMode; finalValue?: number;
  calcRawValue?: number; calcPitchDegrees?: number; calcPitchFactor?: number;
  wasteType: WasteType; wastePercent: number; wasteFixed: number;
  finalQuantity?: number; pricingUnit?: string;
  materialRate: number; labourRate: number;
  materialCost?: number; labourCost?: number;
  isRateOverridden: boolean; isQuantityOverridden: boolean;
  isWasteOverridden: boolean; isPitchOverridden: boolean;
  isCustomerVisible: boolean;
}

export interface QuoteTotals {
  totalMaterials: number; totalLabour: number; subtotal: number;
  materialMargin: number; labourMargin: number;
  subtotalWithMargins: number; tax: number; grandTotal: number;
}

export interface QuoteContext {
  materialMarginPct: number; labourMarginPct: number; taxRate: number;
}

// ─── Pitch Calculations ──────────────────────────────

const RAD = Math.PI / 180;

/** Rafter pitch factor: actual = plan / cos(pitch) */
export function rafterPitchFactor(degrees: number): number {
  if (!degrees || degrees <= 0 || degrees >= 90) return 1;
  return 1 / Math.cos(degrees * RAD);
}

/** Hip/Valley pitch factor: compound angle assuming 45° hip/valley
 *  actual = plan × √(tan²(pitch) + 2) simplified from compound angle formula
 *  More precisely: hip_factor = √(rafter_factor² + 1) for 45° hip */
export function hipValleyPitchFactor(degrees: number): number {
  if (!degrees || degrees <= 0 || degrees >= 90) return 1;
  const rf = rafterPitchFactor(degrees);
  return Math.sqrt(rf * rf + 1);
}

/** Get pitch factor based on pitch type */
export function pitchFactor(degrees: number, pitchType: PitchType = 'rafter'): number {
  if (pitchType === 'valley_hip') return hipValleyPitchFactor(degrees);
  if (pitchType === 'rafter') return rafterPitchFactor(degrees);
  return 1;
}

// ─── Waste ───────────────────────────────────────────

export function applyWaste(value: number, wasteType: WasteType, wastePercent: number, wasteFixed: number): number {
  switch (wasteType) {
    case 'percent': return value * (1 + (wastePercent || 0) / 100);
    case 'fixed': return value + (wasteFixed || 0);
    default: return value;
  }
}

/** Apply pitch then waste to a raw plan value */
export function applyPitchAndWaste(
  rawValue: number,
  isPlan: boolean,
  pitchType: PitchType,
  pitchDegrees: number,
  wasteType: WasteType,
  wastePercent: number,
  wasteFixed: number,
): { afterPitch: number; afterWaste: number; pitchFactorUsed: number } {
  let pitchFactorUsed = 1;
  let afterPitch = rawValue;

  if (isPlan && pitchType !== 'none' && pitchDegrees > 0) {
    pitchFactorUsed = pitchFactor(pitchDegrees, pitchType);
    afterPitch = rawValue * pitchFactorUsed;
  }

  const afterWaste = applyWaste(afterPitch, wasteType, wastePercent, wasteFixed);
  return { afterPitch, afterWaste, pitchFactorUsed };
}

// ─── Roof Area ───────────────────────────────────────

export function computeRoofArea(area: RoofArea): number {
  if (area.inputMode === 'final') return area.finalValueSqm ?? 0;
  let planSqm = area.calcPlanSqm ?? 0;
  if (!planSqm && area.calcWidthM && area.calcLengthM) planSqm = area.calcWidthM * area.calcLengthM;
  return planSqm * rafterPitchFactor(area.calcPitchDegrees ?? 0);
}

export function totalRoofArea(areas: RoofArea[]): number {
  return areas.reduce((sum, a) => sum + (a.computedSqm ?? computeRoofArea(a)), 0);
}

// ─── Quote Totals ────────────────────────────────────
// Uses material_cost and labour_cost already stored on components (entry-based)

export function computeQuoteTotals(components: QuoteComponent[], context: QuoteContext): QuoteTotals {
  const totalMaterials = components.reduce((sum, c) => sum + (c.materialCost ?? 0), 0);
  const totalLabour = components.reduce((sum, c) => sum + (c.labourCost ?? 0), 0);
  const subtotal = totalMaterials + totalLabour;
  const materialMargin = totalMaterials * ((context.materialMarginPct || 0) / 100);
  const labourMargin = totalLabour * ((context.labourMarginPct || 0) / 100);
  const subtotalWithMargins = subtotal + materialMargin + labourMargin;
  const tax = subtotalWithMargins * ((context.taxRate || 0) / 100);
  return { totalMaterials, totalLabour, subtotal, materialMargin, labourMargin, subtotalWithMargins, tax, grandTotal: subtotalWithMargins + tax };
}
