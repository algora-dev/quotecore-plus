import {
  computeKnownPriceCost,
  computeLabourCost,
  computeMaterialCost,
} from './calc';
import type { ComponentSection, RoofComponentDef } from './types';

export type UnitSystem = 'metric' | 'imperial' | 'squares';

export interface SectionTotal {
  rawTotal: number;
  withWaste: number;
  count: number;
  materialCost: number;
  labourCost: number;
  totalCost: number;
}

export interface TakeoffCalculation {
  sections: Record<string, SectionTotal>;
  totalEntries: number;
  grandTotal: number;
  materialTotal: number;
  labourTotal: number;
}

function isFixedSection(section: ComponentSection): boolean {
  return section.customDef?.measurementType === 'fixed';
}

export function calculateTakeoffSections(
  sections: Record<string, ComponentSection>,
  keys: string[],
  getComponentById: (id: string | null) => RoofComponentDef | null,
): TakeoffCalculation {
  const totals: Record<string, SectionTotal> = {};

  for (const key of keys) {
    const section = sections[key];
    if (!section) {
      totals[key] = { rawTotal: 0, withWaste: 0, count: 0, materialCost: 0, labourCost: 0, totalCost: 0 };
      continue;
    }

    const fixed = isFixedSection(section);
    const rawTotal = fixed
      ? section.entries.reduce((sum, entry) => sum + (entry.quantity ?? 1), 0)
      : section.entries.reduce((sum, entry) => sum + entry.computedValue, 0);
    const withWaste = fixed ? rawTotal : rawTotal * (1 + section.wastePercent / 100);
    let materialCost = 0;
    let labourCost = 0;

    for (const entry of section.entries) {
      const costQuantity = fixed ? (entry.quantity ?? 1) : entry.computedValue;
      if (entry.knownPrice != null && entry.knownPrice > 0) {
        materialCost += computeKnownPriceCost(costQuantity, entry.knownPrice);
        continue;
      }

      const component = getComponentById(entry.selectedComponentId);
      materialCost += computeMaterialCost(costQuantity, component).cost;
      labourCost += computeLabourCost(costQuantity, component);
    }

    totals[key] = {
      rawTotal,
      withWaste,
      count: section.entries.length,
      materialCost,
      labourCost,
      totalCost: materialCost + labourCost,
    };
  }

  const totalEntries = keys.reduce((sum, key) => sum + (totals[key]?.count ?? 0), 0);
  const materialTotal = keys.reduce((sum, key) => sum + (totals[key]?.materialCost ?? 0), 0);
  const labourTotal = keys.reduce((sum, key) => sum + (totals[key]?.labourCost ?? 0), 0);

  return {
    sections: totals,
    totalEntries,
    materialTotal,
    labourTotal,
    grandTotal: materialTotal + labourTotal,
  };
}
