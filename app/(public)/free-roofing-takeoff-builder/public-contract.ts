import { areaValueForUnit, BUILT_IN_ORDER, COMPONENT_DEFS, computeEntry } from './calc';
import { calculateTakeoffSections, type UnitSystem } from './engine';
import type { ComponentSection, Entry, PitchType, RoofComponentDef } from './types';

export const ROOF_TAKEOFF_CALCULATION_VERSION = '1.0.0';

export type PublicMode = 'actual' | 'plan';
export type PublicMeasurement = number | { length?: number; area?: number; value?: number };

export interface PublicRoofTakeoffInput {
  mode?: PublicMode;
  units?: UnitSystem;
  pitchDegrees?: number;
  area?: number;
  roofArea?: number;
  hips?: PublicMeasurement[];
  ridges?: PublicMeasurement[];
  ridge?: PublicMeasurement[] | PublicMeasurement;
  valleys?: PublicMeasurement[];
  barges?: PublicMeasurement[];
  spouting?: PublicMeasurement[];
  gutters?: PublicMeasurement[];
  gutter?: PublicMeasurement[] | PublicMeasurement;
  underlay?: number;
  fixings?: number;
  wastePercent?: Partial<Record<string, number>>;
  supplier?: string;
  country?: string; // ISO 2-letter country code for auto-supplier resolution
  supplierLib?: string; // Collection ID for provenance
  supplierVer?: number; // Published version for provenance
  /**
   * G2: Per-component measurement basis. Overrides global `mode` for specific components.
   * Each value can be 'plan', 'actual', or 'unknown'.
   * When 'unknown' and the component has measurements, the API returns needs_clarification.
   */
  measurementBasis?: Partial<Record<string, 'plan' | 'actual' | 'unknown'>>;
}

export interface PublicValidationError {
  field: string;
  message: string;
}

export interface PublicTakeoffResult {
  success: true;
  status: 'complete';
  authoritative: true;
  calculator: 'QuoteCore+ Free Roof Takeoff Builder';
  calculationVersion: string;
  timestamp: string;
  mode: PublicMode;
  units: UnitSystem;
  pitchDegrees: number;
  measurementBasis: Record<string, 'plan' | 'actual'>;
  inputs: PublicRoofTakeoffInput;
  normalizedInputs: Record<string, unknown>;
  results: {
    components: Record<string, {
      label: string;
      rawTotal: number;
      withWaste: number;
      wastePercent: number;
      count: number;
      unit: string;
      materialCost: number;
      labourCost: number;
      totalCost: number;
      componentName?: string;
      componentSku?: string | null;
      unitPrice?: number;
    }>;
    totalEntries: number;
    materialTotal: number;
    labourTotal: number;
    grandTotal: number;
  };
  warnings: string[];
  resultUrl?: string;
  nextAction: null;
  locationMatch?: {
    requestedLocation: string | null;
    matchedLocation: string | null;
    matchType: string;
    warning: string | null;
  };
  pricing?: {
    supplierId: string;
    supplierName: string;
    country: string | null;
    currency: string;
    taxTreatment: string;
    priceType: string;
    pricingUpdatedAt: string | null;
    priceValidUntil: string | null;
    deliveryAssumptions: string | null;
    exclusions: string | null;
    estimateStatus: string;
  };
}

export interface PublicTakeoffClarification {
  success: true;
  status: 'needs_clarification';
  authoritative: false;
  calculator: 'QuoteCore+ Free Roof Takeoff Builder';
  calculationVersion: string;
  question: string;
  requiredField: string;
  nextAction: { type: 'ask_user' };
  partialResults?: Record<string, unknown>;
}

export type PublicTakeoffResponse = PublicTakeoffResult | PublicTakeoffClarification | PublicTakeoffFailure;

export interface PublicTakeoffFailure {
  success: false;
  errors: PublicValidationError[];
}

export interface NormalizedPublicTakeoff {
  mode: PublicMode;
  units: UnitSystem;
  pitchDegrees: number;
  values: Record<string, number[]>;
  sections: Record<string, ComponentSection>;
  warnings: string[];
  basisMap: Record<string, 'plan' | 'actual'>;
  clarificationNeeded: { field: string; question: string }[];
}

const ARRAY_ALIASES: Record<string, keyof PublicRoofTakeoffInput> = {
  hips: 'hips',
  hip: 'hips',
  ridges: 'ridges',
  ridge: 'ridges',
  valleys: 'valleys',
  valley: 'valleys',
  barges: 'barges',
  barge: 'barges',
  spouting: 'spouting',
  gutter: 'spouting',
  gutters: 'spouting',
  eaves: 'spouting',
};

function measurementValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const measurement = value as { length?: unknown; area?: unknown; value?: unknown };
  const candidate = measurement.length ?? measurement.area ?? measurement.value;
  return typeof candidate === 'number' && Number.isFinite(candidate) ? candidate : null;
}

function numberArray(value: unknown): number[] {
  if (!Array.isArray(value)) {
    const measurement = measurementValue(value);
    return measurement == null ? [] : [measurement];
  }
  return value.map(measurementValue).filter((item): item is number => item != null);
}

function clampWaste(value: number | undefined, fallback: number): number {
  if (value == null || !Number.isFinite(value)) return fallback;
  return Math.min(100, Math.max(0, value));
}

function unitFor(kind: string, units: UnitSystem): string {
  const area = kind === 'roof_area' || kind === 'underlay' || kind === 'fixings';
  if (area) return units === 'metric' ? 'm²' : units === 'imperial' ? 'sq ft' : 'squares';
  return units === 'metric' ? 'm' : 'ft';
}

function makeEntry(value: number, mode: PublicMode, pitchDegrees: number, kind: string, pitchType: PitchType): Entry {
  const entry: Entry = {
    id: crypto.randomUUID(),
    label: '',
    inputMode: mode === 'actual' ? 'actual' : 'pitch_calculated',
    pitchDegrees,
    computedValue: 0,
    selectedComponentId: null,
    quantity: 1,
    isTotalInput: true,
    actualValue: value,
  };
  entry.computedValue = computeEntry(entry, kind, pitchType);
  return entry;
}

export function validatePublicInput(input: PublicRoofTakeoffInput): PublicValidationError[] {
  const errors: PublicValidationError[] = [];
  if (input.mode != null && input.mode !== 'actual' && input.mode !== 'plan') {
    errors.push({ field: 'mode', message: 'Mode must be actual or plan.' });
  }
  if (input.units != null && !['metric', 'imperial', 'squares'].includes(input.units)) {
    errors.push({ field: 'units', message: 'Units must be metric, imperial, or squares.' });
  }
  if (input.pitchDegrees != null && (!Number.isFinite(input.pitchDegrees) || input.pitchDegrees < 0 || input.pitchDegrees > 89)) {
    errors.push({ field: 'pitchDegrees', message: 'Pitch must be between 0 and 89 degrees.' });
  }
  // Validate measurementBasis keys
  if (input.measurementBasis) {
    const validKinds = [...BUILT_IN_ORDER, 'area', 'roof_area', 'hips', 'ridges', 'ridge', 'valleys', 'barges', 'spouting', 'underlay', 'fixings'];
    for (const [key, value] of Object.entries(input.measurementBasis)) {
      if (!validKinds.includes(key)) {
        errors.push({ field: `measurementBasis.${key}`, message: `Unknown component: ${key}` });
      }
      if (!value || !['plan', 'actual', 'unknown'].includes(value)) {
        errors.push({ field: `measurementBasis.${key}`, message: 'Basis must be plan, actual, or unknown.' });
      }
    }
  }

  const values: Array<[string, unknown]> = [
    ['area', input.area ?? input.roofArea], ['underlay', input.underlay], ['fixings', input.fixings],
    ['hips', input.hips], ['ridges', input.ridges ?? input.ridge], ['valleys', input.valleys],
    ['barges', input.barges], ['spouting', input.spouting ?? input.gutters ?? input.gutter],
  ];
  for (const [field, value] of values) {
    if (value == null) continue;
    const measurements = Array.isArray(value) ? value : [value];
    const numbers = measurements.map(measurementValue);
    if (numbers.some((item) => item == null || item <= 0)) {
      errors.push({ field, message: `${field} values must be positive finite numbers.` });
    }
    if (measurements.length > 200) errors.push({ field, message: `${field} supports at most 200 entries.` });
  }
  return errors;
}

export function normalizePublicRoofTakeoff(supplied: PublicRoofTakeoffInput): NormalizedPublicTakeoff {
  const globalMode = supplied.mode ?? 'actual';
  const units = supplied.units ?? 'metric';
  const pitchDegrees = supplied.pitchDegrees ?? 0;
  const warnings: string[] = [];
  if (supplied.mode == null) warnings.push('mode_defaulted_to_actual');

  // Resolve per-component basis from measurementBasis overrides + global mode
  const basisMap: Record<string, 'plan' | 'actual'> = {};
  const clarificationNeeded: { field: string; question: string }[] = [];

  for (const kind of BUILT_IN_ORDER) {
    const aliasMap: Record<string, string> = {
      roof_area: 'area',
      hip: 'hips',
      ridge: 'ridges',
      valley: 'valleys',
      barge: 'barges',
      spouting: 'spouting',
      underlay: 'underlay',
      fixings: 'fixings',
    };
    const alias = aliasMap[kind] ?? kind;
    const explicit = supplied.measurementBasis?.[kind] ?? supplied.measurementBasis?.[alias];
    if (explicit === 'unknown') {
      // Check if this component actually has measurements
      const hasMeasurements = (supplied as Record<string, unknown>)[alias] != null
        || (kind === 'roof_area' && (supplied.area ?? supplied.roofArea) != null);
      if (hasMeasurements) {
        clarificationNeeded.push({
          field: `measurementBasis.${alias}`,
          question: `Are the ${COMPONENT_DEFS[kind]?.label ?? kind} measurements actual sloping lengths/areas or horizontal plan-view lengths/areas?`,
        });
      }
      basisMap[kind] = globalMode as 'plan' | 'actual';
    } else if (explicit === 'plan' || explicit === 'actual') {
      basisMap[kind] = explicit;
    } else {
      basisMap[kind] = globalMode as 'plan' | 'actual';
    }
  }

  // Store clarification info on the normalized result for the calculator to use
  (warnings as string[]).push(...clarificationNeeded.map(c => `clarification_needed:${c.field}`));

  const values: Record<string, number[]> = {
    roof_area: numberArray(supplied.area ?? supplied.roofArea),
    hip: numberArray(supplied.hips),
    ridge: numberArray(supplied.ridges ?? supplied.ridge),
    valley: numberArray(supplied.valleys),
    barge: numberArray(supplied.barges),
    spouting: numberArray(supplied.spouting ?? supplied.gutters ?? supplied.gutter),
    underlay: numberArray(supplied.underlay),
    fixings: numberArray(supplied.fixings),
  };

  const sections: Record<string, ComponentSection> = {};
  for (const kind of BUILT_IN_ORDER) {
    const pitchType = COMPONENT_DEFS[kind]?.pitchType ?? 'none';
    const componentMode = basisMap[kind];
    const entries = values[kind].map((value) => makeEntry(value, componentMode, pitchDegrees, kind, pitchType));
    if (units === 'squares' && (kind === 'roof_area' || kind === 'underlay' || kind === 'fixings')) {
      for (const entry of entries) entry.computedValue = areaValueForUnit(entry.computedValue, units, false);
    }
    sections[kind] = {
      kind,
      entries,
      wastePercent: clampWaste(supplied.wastePercent?.[kind], kind === 'roof_area' ? 10 : 5),
    };
  }

  return { mode: globalMode, units, pitchDegrees, values, sections, warnings, basisMap, clarificationNeeded };
}

export interface SupplierSlotMap {
  [slot: string]: { componentId: string; componentName: string; componentSku: string | null; unitPrice: number } | null;
}

export function calculatePublicRoofTakeoff(
  supplied: PublicRoofTakeoffInput,
  components: RoofComponentDef[] = [],
  slotMap?: SupplierSlotMap,
): PublicTakeoffResponse {
  const errors = validatePublicInput(supplied);
  if (errors.length > 0) return { success: false, errors };

  const { mode, units, pitchDegrees, values, sections, warnings, basisMap, clarificationNeeded } = normalizePublicRoofTakeoff(supplied);

  // If any measurements have unknown basis, return clarification
  if (clarificationNeeded.length > 0) {
    const first = clarificationNeeded[0];
    return {
      success: true,
      status: 'needs_clarification',
      authoritative: false,
      calculator: 'QuoteCore+ Free Roof Takeoff Builder',
      calculationVersion: ROOF_TAKEOFF_CALCULATION_VERSION,
      question: first.question,
      requiredField: first.field,
      nextAction: { type: 'ask_user' },
    };
  }

  if (components.length === 0) warnings.push('pricing_unavailable');
  const componentMap = new Map(components.map((component) => [component.id, component]));
  // Auto-assign components from slot map when entries don't have one
  if (slotMap) {
    for (const kind of BUILT_IN_ORDER) {
      const slot = slotMap[kind];
      if (slot && sections[kind]) {
        for (const entry of sections[kind].entries) {
          if (!entry.selectedComponentId) entry.selectedComponentId = slot.componentId;
        }
      }
    }
  }

  const calculation = calculateTakeoffSections(sections, BUILT_IN_ORDER, (id) => id ? componentMap.get(id) ?? null : null);
  const resultComponents: PublicTakeoffResult['results']['components'] = {};
  for (const kind of BUILT_IN_ORDER) {
    const total = calculation.sections[kind];
    const slot = slotMap?.[kind];
    resultComponents[kind] = {
      label: COMPONENT_DEFS[kind]?.label ?? kind,
      rawTotal: total.rawTotal,
      withWaste: total.withWaste,
      wastePercent: sections[kind].wastePercent,
      count: total.count,
      unit: unitFor(kind, units),
      materialCost: total.materialCost,
      labourCost: total.labourCost,
      totalCost: total.totalCost,
      componentName: slot?.componentName,
      componentSku: slot?.componentSku,
      unitPrice: slot?.unitPrice,
    };
  }

  return {
    success: true,
    status: 'complete',
    authoritative: true,
    calculator: 'QuoteCore+ Free Roof Takeoff Builder',
    calculationVersion: ROOF_TAKEOFF_CALCULATION_VERSION,
    timestamp: new Date().toISOString(),
    mode,
    units,
    pitchDegrees,
    measurementBasis: basisMap,
    inputs: supplied,
    normalizedInputs: { mode, units, pitchDegrees, values, wastePercent: Object.fromEntries(BUILT_IN_ORDER.map((kind) => [kind, sections[kind].wastePercent])), basisMap },
    results: {
      components: resultComponents,
      totalEntries: calculation.totalEntries,
      materialTotal: calculation.materialTotal,
      labourTotal: calculation.labourTotal,
      grandTotal: calculation.grandTotal,
    },
    warnings,
    nextAction: null,
  };
}

export function parseQueryInput(params: URLSearchParams): PublicRoofTakeoffInput {
  const input: PublicRoofTakeoffInput = {};
  const mode = params.get('mode');
  if (mode) input.mode = mode as PublicMode;
  const units = params.get('units');
  if (units) input.units = units as UnitSystem;
  const pitch = params.get('pitch') ?? params.get('pitchDegrees');
  if (pitch) input.pitchDegrees = Number(pitch);
  const area = params.get('area') ?? params.get('roofArea');
  if (area) input.area = Number(area);

  for (const [param, target] of Object.entries(ARRAY_ALIASES)) {
    const value = params.get(param);
    if (!value) continue;
    const parsed = value.split(',').map(Number);
    (input as Record<string, unknown>)[target] = parsed;
  }
  for (const kind of ['underlay', 'fixings'] as const) {
    const value = params.get(kind);
    if (value) input[kind] = Number(value);
  }
  const supplier = params.get('supplier');
  if (supplier) input.supplier = supplier;
  const country = params.get('country');
  if (country) input.country = country.toUpperCase();
  const supplierLib = params.get('supplierLib');
  if (supplierLib) input.supplierLib = supplierLib;
  const supplierVer = params.get('supplierVer');
  if (supplierVer) input.supplierVer = Number(supplierVer);
  // Parse per-component measurement basis
  const basis = params.get('measurementBasis');
  if (basis) {
    try {
      const parsed = JSON.parse(decodeURIComponent(basis));
      if (typeof parsed === 'object' && parsed !== null) {
        input.measurementBasis = parsed as Partial<Record<string, 'plan' | 'actual' | 'unknown'>>;
      }
    } catch {
      // Ignore malformed basis
    }
  }
  // Also support individual basis params: basis.area=plan, basis.hips=actual
  for (const key of ['area', 'roof_area', 'hips', 'ridges', 'ridge', 'valleys', 'barges', 'spouting', 'underlay', 'fixings']) {
    const val = params.get(`basis.${key}`);
    if (val && ['plan', 'actual', 'unknown'].includes(val)) {
      if (!input.measurementBasis) input.measurementBasis = {};
      (input.measurementBasis as Record<string, 'plan' | 'actual' | 'unknown'>)[key] = val as 'plan' | 'actual' | 'unknown';
    }
  }
  return input;
}

export function toResultQuery(input: PublicRoofTakeoffInput): string {
  const params = new URLSearchParams();
  params.set('mode', input.mode ?? 'actual');
  params.set('units', input.units ?? 'metric');
  if (input.pitchDegrees != null) params.set('pitch', String(input.pitchDegrees));
  const area = input.area ?? input.roofArea;
  if (area != null) params.set('area', String(area));
  const arrays: Array<[string, number[]]> = [
    ['hips', numberArray(input.hips)], ['ridge', numberArray(input.ridges ?? input.ridge)],
    ['valleys', numberArray(input.valleys)], ['barges', numberArray(input.barges)],
    ['gutter', numberArray(input.spouting ?? input.gutters ?? input.gutter)],
  ];
  for (const [key, values] of arrays) if (values.length > 0) params.set(key, values.join(','));
  if (input.underlay != null) params.set('underlay', String(input.underlay));
  if (input.fixings != null) params.set('fixings', String(input.fixings));
  if (input.supplier) params.set('supplier', input.supplier);
  if (input.country) params.set('country', input.country);
  if (input.supplierLib) params.set('supplierLib', input.supplierLib);
  if (input.supplierVer != null) params.set('supplierVer', String(input.supplierVer));
  if (input.measurementBasis) {
    params.set('measurementBasis', encodeURIComponent(JSON.stringify(input.measurementBasis)));
  }
  return params.toString();
}
