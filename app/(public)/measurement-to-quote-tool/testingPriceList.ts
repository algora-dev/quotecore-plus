import type { BuilderComponent } from './types';
import { makeId } from './types';

/**
 * QuoteCore+ testing price list (owner 2026-10-03): six ready-made roofing
 * pricing components with TESTING rates (placeholder $ values - not real
 * pricing). The point is teaching-by-example: each item explains in plain
 * English how its price is built (rates, waste, pitch, packs). Users run
 * them as-is, edit them, or copy the pattern into their own components.
 */
export interface TestingPriceItem extends BuilderComponent {
  /** Plain-English explanation of how this component prices a measurement. */
  howItWorks: string;
}

export const TESTING_PRICE_LIST: TestingPriceItem[] = [
  {
    id: 'tpl-area',
    name: 'Roof area (longrun)',
    measurementType: 'area',
    materialRate: 42,
    labourRate: 28,
    pricingStrategy: 'per_unit',
    packPrice: null,
    packSize: null,
    wasteType: 'percent',
    wasteValue: 10,
    pitchEnabled: true,
    pitchType: 'rafter',
    source: 'manual',
    howItWorks:
      'Roof area × ($42 material + $28 labour per m²), plus 10% waste. In plan mode the flat plan area is multiplied by the rafter pitch factor to get the true roof area.',
  },
  {
    id: 'tpl-ridge',
    name: 'Ridge cap',
    measurementType: 'lineal',
    materialRate: 18,
    labourRate: 12,
    pricingStrategy: 'per_unit',
    packPrice: null,
    packSize: null,
    wasteType: 'percent',
    wasteValue: 5,
    pitchEnabled: false,
    pitchType: 'none',
    source: 'manual',
    howItWorks:
      'Ridge length × ($18 + $12 per m) + 5% waste. Ridges run level, so there is no pitch factor.',
  },
  {
    id: 'tpl-hip',
    name: 'Hip cap',
    measurementType: 'lineal',
    materialRate: 20,
    labourRate: 14,
    pricingStrategy: 'per_unit',
    packPrice: null,
    packSize: null,
    wasteType: 'percent',
    wasteValue: 5,
    pitchEnabled: true,
    pitchType: 'valley_hip',
    source: 'manual',
    howItWorks:
      'Hip length × ($20 + $14 per m) + 5% waste. In plan mode the hip/valley pitch factor converts the plan length to the true sloped length.',
  },
  {
    id: 'tpl-valley',
    name: 'Valley tray',
    measurementType: 'lineal',
    materialRate: 35,
    labourRate: 22,
    pricingStrategy: 'per_unit',
    packPrice: null,
    packSize: null,
    wasteType: 'percent',
    wasteValue: 8,
    pitchEnabled: true,
    pitchType: 'valley_hip',
    source: 'manual',
    howItWorks:
      'Valley length × ($35 + $22 per m) + 8% waste, with the hip/valley pitch factor in plan mode.',
  },
  {
    id: 'tpl-barge',
    name: 'Barge / verge flashing',
    measurementType: 'lineal',
    materialRate: 16,
    labourRate: 12,
    pricingStrategy: 'per_unit',
    packPrice: null,
    packSize: null,
    wasteType: 'percent',
    wasteValue: 5,
    pitchEnabled: true,
    pitchType: 'rafter',
    source: 'manual',
    howItWorks:
      'Barge length × ($16 + $12 per m) + 5% waste. The rafter pitch factor applies in plan mode.',
  },
  {
    id: 'tpl-spouting',
    name: 'Spouting (gutter)',
    measurementType: 'lineal',
    materialRate: 0,
    labourRate: 15,
    pricingStrategy: 'per_pack_length',
    packPrice: 95,
    packSize: 4,
    wasteType: 'none',
    wasteValue: 0,
    pitchEnabled: false,
    pitchType: 'none',
    source: 'manual',
    howItWorks:
      'Material priced per 4 m pack at $95 per pack (rounded up to whole packs), plus $15/m labour. This one shows how pack pricing works.',
  },
];

/** Session copy of one item (fresh id so loading twice never collides). */
export function toComponent(item: TestingPriceItem): BuilderComponent {
  return {
    id: makeId('comp'),
    name: item.name,
    measurementType: item.measurementType,
    materialRate: item.materialRate,
    labourRate: item.labourRate,
    pricingStrategy: item.pricingStrategy,
    packPrice: item.packPrice,
    packSize: item.packSize,
    wasteType: item.wasteType,
    wasteValue: item.wasteValue,
    pitchEnabled: item.pitchEnabled,
    pitchType: item.pitchType,
    source: item.source,
  };
}
