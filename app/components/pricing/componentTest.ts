/**
 * Read-only draft adapter for Test component.
 * Uses the SAME pure pitch/waste and pack helpers as quotes/actions.ts
 * addComponentEntry + recalcComponentFromEntries. No API, DB, quote or storage.
 * Canonical rates, packs and fixed allowances remain metric, as stored today.
 */
import type { MeasurementSystem, MeasurementType, PitchType, PricingStrategy, WasteType } from '@/app/lib/types';
import { normalizeMeasurementSystem } from '@/app/lib/types';
import { applyPitchAndWaste, computeMaterialCostByStrategy, computePackCount } from '@/app/lib/pricing/engine';
import { areaInputToMetric, linearInputToMetric, volumeInputToMetric, convertLinear, convertAreaFt2, convertAreaRs, convertVolumeFt3 } from '@/app/lib/measurements/conversions';

export interface ComponentTestDraft {
  name: string;
  measurementType: MeasurementType;
  materialRate: string;
  labourRate: string;
  wasteType: WasteType;
  wasteAmount: string;
  pitchType: PitchType;
  strategy: PricingStrategy;
  packPrice: string;
  packSize: string;
  packCoverage: string;
  heightMm: string;
  depthMm: string;
  timeUnit: 'hr' | 'day';
  /** Sold-as basis for area components (lineal-with-cover, owner 2026-10-09).
   *  Optional display metadata: when soldBy is 'lineal' with a positive
   *  coverWidthMm, the test panel shows the converted lineal figure. */
  soldBy?: 'area' | 'lineal';
  coverWidthMm?: string;
}
export interface ComponentTestInput {
  values: string[];
  system: MeasurementSystem;
  basis: 'surface' | 'plan';
  pitch: string;
}
export type Dimension = 'length' | 'area' | 'volume' | 'quantity' | 'fixed' | 'time';
const LENGTH_TYPES = new Set(['lineal', 'linear', 'multi_lineal', 'curved_line']);
const AREA_TYPES = new Set(['area', 'irregular_area', 'length_x_height', 'multi_lineal_lxh', 'length_x_height_freestyle', 'multi_lineal_lxh_freestyle']);
const PRESET_HEIGHT = new Set(['length_x_height', 'multi_lineal_lxh']);
export function pricedDimension(type: MeasurementType): Dimension {
  if (LENGTH_TYPES.has(type)) return 'length';
  if (AREA_TYPES.has(type)) return 'area';
  if (type === 'volume' || type === 'volume_3d') return 'volume';
  if (type === 'fixed') return 'fixed';
  if (type === 'hours_days') return 'time';
  return 'quantity';
}
export function inputDimension(type: MeasurementType): Dimension {
  if (PRESET_HEIGHT.has(type)) return 'length';
  if (type === 'volume') return 'area';
  return pricedDimension(type);
}
export function unitForDimension(dimension: Dimension, system: MeasurementSystem, timeUnit: 'hr' | 'day' = 'hr'): string {
  const norm = normalizeMeasurementSystem(system);
  if (dimension === 'length') return norm === 'metric' ? 'm' : 'ft';
  if (dimension === 'area') return norm === 'metric' ? 'm²' : norm === 'imperial_ft' ? 'ft²' : 'RS';
  if (dimension === 'volume') return norm === 'metric' ? 'm³' : 'ft³';
  return dimension === 'time' ? timeUnit : dimension === 'fixed' ? 'charge' : 'each';
}
export function canonicalUnit(type: MeasurementType, timeUnit: 'hr' | 'day' = 'hr'): string {
  return unitForDimension(pricedDimension(type), 'metric', timeUnit);
}
export function displayQuantity(value: number, dimension: Dimension, system: MeasurementSystem): number {
  const norm = normalizeMeasurementSystem(system);
  if (norm === 'metric') return value;
  if (dimension === 'length') return convertLinear(value);
  if (dimension === 'area') return norm === 'imperial_ft' ? convertAreaFt2(value) : convertAreaRs(value);
  if (dimension === 'volume') return convertVolumeFt3(value);
  return value;
}
function toMetric(value: number, dimension: Dimension, system: MeasurementSystem): number {
  if (dimension === 'length') return linearInputToMetric(value, system);
  if (dimension === 'area') return areaInputToMetric(value, system);
  if (dimension === 'volume') return volumeInputToMetric(value, system);
  return value;
}
export interface ComponentTestResult {
  entered: number; // summed test input in the chosen display system
  measured: number; // canonical measured quantity after preset height/depth, before pitch
  afterPitch: number;
  required: number;
  wasteAdded: number;
  packs: number;
  purchased: number | null;
  spare: number | null;
  materialCost: number;
  labourCost: number;
  total: number;
  effectiveCost: number | null;
  entryCount: number;
  pitchApplied: boolean;
  entries: { input: number; measured: number; afterPitch: number; afterWaste: number }[];
}
export type ComponentTestOutcome = { ok: true; result: ComponentTestResult } | { ok: false; errors: Record<string, string> };

export function calculateComponentTest(draft: ComponentTestDraft, input: ComponentTestInput): ComponentTestOutcome {
  const errors: Record<string, string> = {};
  function number(raw: string, key: string, label: string, positive = false): number {
    const n = Number(raw);
    if (raw.trim() === '' || !Number.isFinite(n) || (positive ? n <= 0 : n < 0)) {
      errors[key] = `${label}: enter ${positive ? 'a number above zero' : 'zero or a positive number'}.`;
      return 0;
    }
    return n;
  }
  const dimension = pricedDimension(draft.measurementType);
  const inDimension = inputDimension(draft.measurementType);
  const packStrategy = draft.strategy !== 'per_unit';
  const materialRate = packStrategy ? 0 : number(draft.materialRate, 'materialRate', 'Material cost');
  const labourRate = number(draft.labourRate, 'labourRate', 'Labour cost');
  const wasteAmount = draft.wasteType === 'none' ? 0 : number(draft.wasteAmount, 'wasteAmount', 'Waste allowance');
  const packPrice = packStrategy ? number(draft.packPrice, 'packPrice', 'Pack price', true) : null;
  const packSize = packStrategy ? number(draft.packSize, 'packSize', 'Pack size', true) : null;
  const packCoverage = draft.strategy === 'per_pack_coverage' ? number(draft.packCoverage, 'packCoverage', 'Coverage per pack', true) : null;
  const height = PRESET_HEIGHT.has(draft.measurementType) ? number(draft.heightMm, 'heightMm', 'Component height in mm', true) / 1000 : 1;
  const depth = draft.measurementType === 'volume' ? number(draft.depthMm, 'depthMm', 'Component depth in mm', true) / 1000 : 1;
  // Do not silently ignore a persisted unusual pitch rule. Match the selected
  // component's rule, but make plan/surface basis explicit in the UI.
  const pitchApplied = draft.pitchType !== 'none' && input.basis === 'plan';
  const pitch = pitchApplied ? number(input.pitch, 'pitch', 'Pitch in degrees') : 0;
  if (pitchApplied && pitch >= 90) errors.pitch = 'Pitch must be below 90 degrees.';
  const values = dimension === 'fixed' ? [1] : input.values.map((raw, i) => number(raw, `value-${i}`, `Measurement ${i + 1}`, true));
  if (values.length === 0) errors.values = 'Add a measurement to test.';
  const compatible = draft.strategy === 'per_unit'
    || (draft.strategy === 'per_pack_length' && dimension === 'length')
    || ((draft.strategy === 'per_pack_area' || draft.strategy === 'per_pack_coverage') && dimension === 'area')
    || (draft.strategy === 'per_pack_volume' && dimension === 'volume');
  if (!compatible) errors.strategy = 'Choose a purchasing method that matches this measurement type.';
  if (Object.keys(errors).length) return { ok: false, errors };

  const entries = values.map(value => {
    const measured = toMetric(value, inDimension, input.system) * height * depth;
    const adjusted = applyPitchAndWaste(measured, pitchApplied, draft.pitchType, pitch,
      draft.wasteType, draft.wasteType === 'percent' ? wasteAmount : 0,
      draft.wasteType === 'fixed' || draft.wasteType === 'fixed_per_segment' ? wasteAmount : 0);
    return { input: value, measured, afterPitch: adjusted.afterPitch, afterWaste: adjusted.afterWaste };
  });
  const entered = values.reduce((a, b) => a + b, 0);
  const measured = entries.reduce((sum, e) => sum + e.measured, 0);
  const afterPitch = entries.reduce((sum, e) => sum + e.afterPitch, 0);
  const required = entries.reduce((sum, e) => sum + e.afterWaste, 0);
  const material = computeMaterialCostByStrategy({ strategy: draft.strategy, totalQuantity: required,
    materialRate, packPrice, packSize, packCoverageM2: packCoverage });
  if (material.packDataMissing) return { ok: false, errors: { packSize: 'Complete the pack price and size before testing.' } };
  const packs = computePackCount({ strategy: draft.strategy, totalQuantity: required, packSize, packCoverageM2: packCoverage });
  // EXACT caller convention in recalcComponentFromEntries. Do not use purchased
  // coverage or a second waste calculation for labour.
  const labourCost = required * labourRate;
  const total = material.cost + labourCost;
  const purchased = packStrategy ? packs * (draft.strategy === 'per_pack_coverage' ? packCoverage! : packSize!) : null;
  if (![measured, afterPitch, required, material.cost, labourCost, total, purchased ?? 0].every(Number.isFinite)) {
    return { ok: false, errors: { values: 'These values are too large to calculate safely. Reduce the measurement or rates.' } };
  }
  return { ok: true, result: { entered, measured, afterPitch, required, wasteAdded: required - afterPitch,
    packs, purchased, spare: purchased === null ? null : Math.max(0, purchased - required),
    materialCost: material.cost, labourCost, total, effectiveCost: entered > 0 ? total / entered : null,
    entryCount: values.length, pitchApplied, entries } };
}
