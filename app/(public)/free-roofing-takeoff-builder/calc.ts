// Shared calculation functions for the Roof Takeoff Builder

import type { ComponentKind, Entry, RoofComponentDef, CustomComponentDef, PitchType, ComponentSection } from './types';

// ─── Component definitions (static fallback) ─────────

export const COMPONENT_DEFS: Record<string, { label: string; unit: string; pitchType: PitchType; colour: string; description: string }> = {
  roof_area: { label: 'Roof Area', unit: 'm\u00B2', pitchType: 'rafter', colour: '#3B82F6', description: 'The total surface area of all roof planes. Calculated from your plan dimensions and roof pitch.' },
  ridge: { label: 'Ridges', unit: 'm', pitchType: 'none', colour: '#22C55E', description: 'The horizontal line at the top of a roof where two roof slopes meet - the peak of the roof.' },
  hip: { label: 'Hip', unit: 'm', pitchType: 'hip_valley', colour: '#EF4444', description: 'The angled line where two roof slopes meet on an external corner. Runs from the ridge down to the eaves.' },
  valley: { label: 'Valley', unit: 'm', pitchType: 'hip_valley', colour: '#EAB308', description: 'The angled line where two roof slopes meet on an internal corner. Water flows into valleys. Runs from ridge down to the eaves.' },
  barge: { label: 'Barge', unit: 'm', pitchType: 'rafter', colour: '#A855F7', description: 'The sloped edge of the roof at a gable end. Also called a rafter edge, rake or verge. Runs from the ridge down to the eaves at the side of the roof.' },
  spouting: { label: 'Spouting', unit: 'm', pitchType: 'none', colour: '#64748B', description: 'The gutter system along the bottom edge of the roof. Measured along the eaves where water runs off.' },
  underlay: { label: 'Underlay', unit: 'm\u00B2', pitchType: 'rafter', colour: '#0EA5E9', description: 'A secondary layer that goes under the main roofing material. Measured by area, using the same pitch calculation as roof area.' },
  fixings: { label: 'Fixings', unit: 'm\u00B2', pitchType: 'rafter', colour: '#F59E0B', description: 'Nails, screws, and clips used to secure the roof covering. Measured by roof area, using the same pitch calculation as roof area.' },
};

export const BUILT_IN_ORDER: string[] = ['roof_area', 'ridge', 'hip', 'valley', 'barge', 'spouting', 'underlay', 'fixings'];

// ─── Default example components (fallback when DB is empty) ─────

export const DEFAULT_COMPONENTS: RoofComponentDef[] = [
  // Roof Area
  { id: 'default-roofing-iron', component_kind: 'roof_area' as ComponentKind, name: 'Corrugated Iron Roofing', description: '0.42mm corrugated iron profile', unit: 'm\u00B2', price_per_unit: 18.50, pricing_strategy: 'per_unit', pack_size: null, pack_price: null, labour_rate: 12.00, labour_unit: 'm\u00B2', suggested_waste_percent: 5, pitch_type: 'rafter', is_active: true, sort_order: 1 },
  { id: 'default-metal-tile', component_kind: 'roof_area' as ComponentKind, name: 'Pressed Metal Tile', description: 'Stone-coated metal tile panel', unit: 'm\u00B2', price_per_unit: 32.00, pricing_strategy: 'per_unit', pack_size: null, pack_price: null, labour_rate: 18.00, labour_unit: 'm\u00B2', suggested_waste_percent: 7, pitch_type: 'rafter', is_active: true, sort_order: 2 },
  // Ridge
  { id: 'default-ridge-cap', component_kind: 'ridge' as ComponentKind, name: 'Ridge Cap Flashing', description: 'Pre-formed ridge cap', unit: 'm', price_per_unit: 12.00, pricing_strategy: 'per_unit', pack_size: null, pack_price: null, labour_rate: 8.00, labour_unit: 'm', suggested_waste_percent: 3, pitch_type: 'none', is_active: true, sort_order: 1 },
  { id: 'default-ridge-roll', component_kind: 'ridge' as ComponentKind, name: 'Ridge Roll', description: 'Flexible ridge roll for metal roofs', unit: 'm', price_per_unit: 6.50, pricing_strategy: 'per_unit', pack_size: null, pack_price: null, labour_rate: 5.00, labour_unit: 'm', suggested_waste_percent: 3, pitch_type: 'none', is_active: true, sort_order: 2 },
  // Hip
  { id: 'default-hip-cap', component_kind: 'hip' as ComponentKind, name: 'Hip Cap Flashing', description: 'Pre-formed hip capping', unit: 'm', price_per_unit: 14.00, pricing_strategy: 'per_unit', pack_size: null, pack_price: null, labour_rate: 10.00, labour_unit: 'm', suggested_waste_percent: 5, pitch_type: 'hip_valley', is_active: true, sort_order: 1 },
  // Valley
  { id: 'default-valley-flash', component_kind: 'valley' as ComponentKind, name: 'Valley Flashing', description: 'Pre-formed valley tray', unit: 'm', price_per_unit: 16.00, pricing_strategy: 'per_unit', pack_size: null, pack_price: null, labour_rate: 12.00, labour_unit: 'm', suggested_waste_percent: 5, pitch_type: 'hip_valley', is_active: true, sort_order: 1 },
  // Barge
  { id: 'default-barge-flash', component_kind: 'barge' as ComponentKind, name: 'Barge Flashing', description: 'Barge board flashing', unit: 'm', price_per_unit: 10.00, pricing_strategy: 'per_unit', pack_size: null, pack_price: null, labour_rate: 7.00, labour_unit: 'm', suggested_waste_percent: 3, pitch_type: 'rafter', is_active: true, sort_order: 1 },
  // Spouting
  { id: 'default-spouting', component_kind: 'spouting' as ComponentKind, name: 'Spouting/Gutter', description: 'Continuous gutter system', unit: 'm', price_per_unit: 22.00, pricing_strategy: 'per_unit', pack_size: null, pack_price: null, labour_rate: 10.00, labour_unit: 'm', suggested_waste_percent: 3, pitch_type: 'none', is_active: true, sort_order: 1 },
  { id: 'default-downpipe', component_kind: 'spouting' as ComponentKind, name: 'Downpipe', description: '100mm round downpipe', unit: 'm', price_per_unit: 15.00, pricing_strategy: 'per_unit', pack_size: null, pack_price: null, labour_rate: 8.00, labour_unit: 'm', suggested_waste_percent: 3, pitch_type: 'none', is_active: true, sort_order: 2 },
  // Underlay
  { id: 'default-underlay', component_kind: 'underlay' as ComponentKind, name: 'Roofing Underlay', description: 'Breathable roofing underlay', unit: 'm\u00B2', price_per_unit: 4.50, pricing_strategy: 'per_unit', pack_size: null, pack_price: null, labour_rate: 3.00, labour_unit: 'm\u00B2', suggested_waste_percent: 10, pitch_type: 'rafter', is_active: true, sort_order: 1 },
  // Fixings
  { id: 'default-fixings', component_kind: 'fixings' as ComponentKind, name: 'Roofing Screws', description: '10g x 50mm roofing screws with EPDM washers', unit: 'm\u00B2', price_per_unit: 3.50, pricing_strategy: 'per_unit', pack_size: null, pack_price: null, labour_rate: 2.00, labour_unit: 'm\u00B2', suggested_waste_percent: 5, pitch_type: 'rafter', is_active: true, sort_order: 1 },
];

// ─── Pitch calculation ───────────────────────────────

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

export function pitchFactor(degrees: number, pitchType: PitchType): number {
  if (pitchType === 'none') return 1;
  if (pitchType === 'hip_valley') return hipValleyPitchFactor(degrees);
  return rafterPitchFactor(degrees);
}

export function areaValueForUnit(value: number, unitSystem: 'metric' | 'imperial' | 'squares', fromDimensions: boolean): number {
  return unitSystem === 'squares' && fromDimensions ? value / 100 : value;
}

// ─── Entry computation ───────────────────────────────

export function computeEntry(entry: Entry, kind: string, pitchType: PitchType): number {
  const qty = entry.quantity ?? 1;
  if (isCustomFixed(kind)) {
    return qty;
  }
  if (entry.inputMode === 'actual') {
    return (entry.actualValue ?? 0) * qty;
  }
  if (entry.isTotalInput) {
    return (entry.actualValue ?? 0) * pitchFactor(entry.pitchDegrees, pitchType) * qty;
  }
  const isArea = kind === 'roof_area' || kind === 'underlay' || kind === 'fixings' || (kind.startsWith('custom-') && isCustomArea(kind));
  if (isArea) {
    const planArea = (entry.planWidth ?? 0) * (entry.planLengthVal ?? 0);
    return planArea * pitchFactor(entry.pitchDegrees, pitchType) * qty;
  }
  const planLength = entry.planLength ?? 0;
  return planLength * pitchFactor(entry.pitchDegrees, pitchType) * qty;
}

// Track which custom components are area-based
const customAreaMap = new Map<string, boolean>();

function isCustomArea(kind: string): boolean {
  return customAreaMap.get(kind) ?? false;
}

// Track which custom components are fixed
const customFixedMap = new Map<string, boolean>();

export function registerCustomKind(id: string, isArea: boolean, isFixed?: boolean) {
  customAreaMap.set(id, isArea);
  if (isFixed !== undefined) customFixedMap.set(id, isFixed);
}

export function isCustomFixed(kind: string): boolean {
  return customFixedMap.get(kind) ?? false;
}

// ─── Pricing calculation ─────────────────────────────

export function computeMaterialCost(qty: number, comp: RoofComponentDef | null): { cost: number; packs: number } {
  if (!comp || qty <= 0) return { cost: 0, packs: 0 };
  if (comp.pricing_strategy === 'per_unit') {
    return { cost: qty * comp.price_per_unit, packs: 0 };
  }
  const packSize = comp.pack_size ?? 1;
  if (packSize <= 0) return { cost: 0, packs: 0 };
  const packs = Math.ceil(qty / packSize);
  const packPrice = comp.pack_price ?? comp.price_per_unit;
  return { cost: packs * packPrice, packs };
}

export function computeKnownPriceCost(qty: number, knownPrice: number): number {
  if (qty <= 0 || knownPrice <= 0) return 0;
  return qty * knownPrice;
}

export function computeLabourCost(qty: number, comp: RoofComponentDef | null): number {
  if (!comp || comp.labour_rate <= 0) return 0;
  if (comp.labour_unit === 'fixed') return comp.labour_rate;
  if (comp.labour_unit === 'per_unit') return qty * comp.labour_rate;
  if (comp.labour_unit === 'hourly') return qty * comp.labour_rate;
  return 0;
}

// ─── Helpers ─────────────────────────────────────────

export function makeId(): string {
  return `e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function makeCustomId(): string {
  return `c-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function makeEntry(pitchDegrees: number = 25): Entry {
  return {
    id: makeId(),
    label: '',
    inputMode: 'pitch_calculated',
    pitchDegrees,
    computedValue: 0,
    selectedComponentId: null,
  };
}

export function makeInitialSections(): Record<string, ComponentSection> {
  const sections: Record<string, ComponentSection> = {};
  for (const kind of BUILT_IN_ORDER) {
    sections[kind] = { kind: kind as ComponentKind, entries: [], wastePercent: kind === 'roof_area' ? 10 : 5 };
  }
  return sections;
}

export function makeCustomSection(def: CustomComponentDef): ComponentSection {
  registerCustomKind(def.id, def.measurementType === 'area', def.measurementType === 'fixed');
  return {
    kind: def.id as ComponentKind,
    entries: [],
    wastePercent: def.measurementType === 'fixed' ? 0 : def.wastePercent,
    customDef: def,
  };
}
