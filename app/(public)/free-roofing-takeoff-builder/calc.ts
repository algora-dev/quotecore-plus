// Shared calculation functions for the Roof Takeoff Builder

import type { ComponentKind, Entry, RoofComponentDef } from './types';

// ─── Component definitions (static fallback) ─────────

export const COMPONENT_DEFS: Record<ComponentKind, { label: string; unit: string; pitchType: 'rafter' | 'hip_valley' | 'none'; colour: string }> = {
  roof_area: { label: 'Roof Area', unit: 'm²', pitchType: 'rafter', colour: '#3B82F6' },
  ridge: { label: 'Ridge', unit: 'm', pitchType: 'none', colour: '#22C55E' },
  hip: { label: 'Hip', unit: 'm', pitchType: 'hip_valley', colour: '#EF4444' },
  valley: { label: 'Valley', unit: 'm', pitchType: 'hip_valley', colour: '#EAB308' },
  barge: { label: 'Barge', unit: 'm', pitchType: 'none', colour: '#A855F7' },
  spouting: { label: 'Spouting', unit: 'm', pitchType: 'none', colour: '#64748B' },
};

export const COMPONENT_ORDER: ComponentKind[] = ['roof_area', 'ridge', 'hip', 'valley', 'barge', 'spouting'];

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

export function pitchFactor(degrees: number, pitchType: 'rafter' | 'hip_valley' | 'none'): number {
  if (pitchType === 'none') return 1;
  if (pitchType === 'hip_valley') return hipValleyPitchFactor(degrees);
  return rafterPitchFactor(degrees);
}

// ─── Entry computation ───────────────────────────────

export function computeEntry(entry: Entry, kind: ComponentKind): number {
  const def = COMPONENT_DEFS[kind];
  const qty = entry.quantity ?? 1;
  if (entry.inputMode === 'actual') {
    return (entry.actualValue ?? 0) * qty;
  }
  if (kind === 'roof_area') {
    const planArea = (entry.planWidth ?? 0) * (entry.planLengthVal ?? 0);
    return planArea * pitchFactor(entry.pitchDegrees, def.pitchType) * qty;
  }
  const planLength = entry.planLength ?? 0;
  return planLength * pitchFactor(entry.pitchDegrees, def.pitchType) * qty;
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

export function makeInitialSections(): Record<ComponentKind, { kind: ComponentKind; entries: Entry[]; wastePercent: number }> {
  const sections = {} as Record<ComponentKind, { kind: ComponentKind; entries: Entry[]; wastePercent: number }>;
  for (const kind of COMPONENT_ORDER) {
    sections[kind] = { kind, entries: [], wastePercent: kind === 'roof_area' ? 10 : 5 };
  }
  return sections;
}
