// Shared calculation functions for the Roof Takeoff Builder

import type { ComponentKind, Entry, RoofComponentDef, CustomComponentDef, PitchType, ComponentSection } from './types';

// ─── Component definitions (static fallback) ─────────

export const COMPONENT_DEFS: Record<string, { label: string; unit: string; pitchType: PitchType; colour: string; description: string }> = {
  roof_area: { label: 'Roof Area', unit: 'm\u00B2', pitchType: 'rafter', colour: '#3B82F6', description: 'The total surface area of all roof planes. Calculated from your plan dimensions and roof pitch.' },
  ridge: { label: 'Ridges', unit: 'm', pitchType: 'none', colour: '#22C55E', description: 'The horizontal line at the top of a roof where two roof slopes meet - the peak of the roof.' },
  hip: { label: 'Hip', unit: 'm', pitchType: 'hip_valley', colour: '#EF4444', description: 'The angled line where two roof slopes meet on an external corner. Runs from the ridge down to the eaves.' },
  valley: { label: 'Valley', unit: 'm', pitchType: 'hip_valley', colour: '#EAB308', description: 'The angled line where two roof slopes meet on an internal corner. Water flows into valleys. Runs from ridge down to the eaves.' },
  barge: { label: 'Barge', unit: 'm', pitchType: 'rafter', colour: '#A855F7', description: 'The sloped edge of the roof at a gable end. Also called a rafter edge or verge. Runs from the ridge down to the eaves at the side of the roof.' },
  spouting: { label: 'Spouting', unit: 'm', pitchType: 'none', colour: '#64748B', description: 'The gutter system along the bottom edge of the roof. Measured along the eaves where water runs off.' },
};

export const BUILT_IN_ORDER: string[] = ['roof_area', 'ridge', 'hip', 'valley', 'barge', 'spouting'];

// ─── Pitch calculation ───────────────────────────────

const RAD = Math.PI / 180;

export function rafterPitchFactor(degrees: number): number {
  if (!degrees || degrees <= 0 || degrees >= 90) return 1;
  return 1 / Math.cos(degrees * RAD);
}

export function hipValleyPitchFactor(degrees: number): number {
  if (!degrees || degrees <= 0 || degrees >= 90) return 1;
  const rf = rafterPitchFactor(degrees);
  return Math.sqrt(rf * rf + 1);
}

export function pitchFactor(degrees: number, pitchType: PitchType): number {
  if (pitchType === 'none') return 1;
  if (pitchType === 'hip_valley') return hipValleyPitchFactor(degrees);
  return rafterPitchFactor(degrees);
}

// ─── Entry computation ───────────────────────────────

export function computeEntry(entry: Entry, kind: string, pitchType: PitchType): number {
  const qty = entry.quantity ?? 1;
  if (entry.inputMode === 'actual') {
    return (entry.actualValue ?? 0) * qty;
  }
  if (entry.isTotalInput) {
    return (entry.actualValue ?? 0) * pitchFactor(entry.pitchDegrees, pitchType) * qty;
  }
  const isArea = kind === 'roof_area' || (kind === 'custom' && isCustomArea(kind));
  if (isArea) {
    const planArea = (entry.planWidth ?? 0) * (entry.planLengthVal ?? 0);
    return planArea * pitchFactor(entry.pitchDegrees, pitchType) * qty;
  }
  const planLength = entry.planLength ?? 0;
  return planLength * pitchFactor(entry.pitchDegrees, pitchType) * qty;
}

// Track which custom components are area-based
const customAreaMap = new Map<string, boolean>();

export function registerCustomKind(id: string, isArea: boolean) {
  customAreaMap.set(id, isArea);
}

function isCustomArea(kind: string): boolean {
  return customAreaMap.get(kind) ?? false;
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
  registerCustomKind(def.id, def.measurementType === 'area');
  return {
    kind: 'custom',
    entries: [],
    wastePercent: def.wastePercent,
    customDef: def,
  };
}
