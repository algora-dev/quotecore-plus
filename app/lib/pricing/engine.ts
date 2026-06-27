// QuoteCore+ v2 Pricing Engine
// Unified calculation: dual input → pitch → waste → costs

// Shared types live in app/lib/types.ts; we re-export them here so the
// pricing engine has a single source of truth for measurement/waste/pitch enums.
import type {
  ComponentType,
  MeasurementType,
  InputMode,
  WasteType,
  PitchType,
} from '@/app/lib/types';
export type { ComponentType, MeasurementType, InputMode, WasteType, PitchType };

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
    // fixed_per_segment: in manual entry (1 segment per entry) this is
    // equivalent to plain fixed. The digital takeoff path converts
    // multi-segment counts before calling this function; this fallback
    // ensures manual entries still get waste applied.
    case 'fixed_per_segment': return value + (wasteFixed || 0);
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

// ─── Pricing Strategies (Generic Trades Phase 6) ─────

export type PricingStrategy =
  | 'per_unit'
  | 'per_pack_length'
  | 'per_pack_area'
  | 'per_pack_coverage'
  | 'per_pack_volume';

/**
 * Computes material cost for a component given its purchasing strategy.
 *
 * - `per_unit`: classic `qty * cost_per_unit` (today's behaviour).
 * - `per_pack_length` / `per_pack_area` / `per_pack_volume`: roll/pack
 *   purchases. Cost = `ceil(qty / pack_size) * pack_price`. Round-up
 *   captures the next purchasable unit. Used when the user buys cable in
 *   20m rolls, underlay in 50m² rolls, or concrete in 5m³ packs.
 * - `per_pack_coverage`: paint-style. `pack_size` is the physical pack
 *   quantity (e.g. 20L) for display only; `pack_coverage_m2` is what the
 *   pack actually covers. Cost = `ceil(area_m2 / pack_coverage_m2) * pack_price`.
 *
 * Returns 0 for nonsense inputs rather than throwing - the DB
 * ck_component_library_pack_values_positive CHECK already rejects bad
 * data on write, so this is a defensive belt at the math layer.
 */
export function computeMaterialCostByStrategy(args: {
  strategy: PricingStrategy;
  totalQuantity: number;
  materialRate: number;
  packPrice: number | null;
  packSize: number | null;
  packCoverageM2: number | null;
}): number {
  const { strategy, totalQuantity, materialRate, packPrice, packSize, packCoverageM2 } = args;

  if (totalQuantity <= 0) return 0;

  switch (strategy) {
    case 'per_unit': {
      return totalQuantity * materialRate;
    }
    case 'per_pack_length':
    case 'per_pack_area':
    case 'per_pack_volume': {
      if (!packPrice || !packSize || packSize <= 0) return 0;
      const packs = Math.ceil(totalQuantity / packSize);
      return packs * packPrice;
    }
    case 'per_pack_coverage': {
      if (!packPrice || !packCoverageM2 || packCoverageM2 <= 0) return 0;
      const packs = Math.ceil(totalQuantity / packCoverageM2);
      return packs * packPrice;
    }
  }
}

/**
 * Convenience: returns the number of packs the user will need to buy
 * (useful for UI worked-example strings like "6 × 50m² rolls"). Returns 0
 * for per_unit (the concept doesn't apply) or for missing pack data.
 */
export function computePackCount(args: {
  strategy: PricingStrategy;
  totalQuantity: number;
  packSize: number | null;
  packCoverageM2: number | null;
}): number {
  const { strategy, totalQuantity, packSize, packCoverageM2 } = args;
  if (totalQuantity <= 0) return 0;
  switch (strategy) {
    case 'per_unit':
      return 0;
    case 'per_pack_length':
    case 'per_pack_area':
    case 'per_pack_volume':
      if (!packSize || packSize <= 0) return 0;
      return Math.ceil(totalQuantity / packSize);
    case 'per_pack_coverage':
      if (!packCoverageM2 || packCoverageM2 <= 0) return 0;
      return Math.ceil(totalQuantity / packCoverageM2);
  }
}

// ─── Quote Totals ────────────────────────────────────
// Uses material_cost and labour_cost already stored on components (entry-based)
// The per-component pricing_strategy switch lives in computeMaterialCostByStrategy
// above; recalc helpers call it before writing material_cost back to the row.

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
