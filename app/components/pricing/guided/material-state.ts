import type { ComponentEditorSettings } from '../SmartComponentEditor';
import type { MeasurementType, PricingStrategy } from '@/app/lib/types';
import { allowedStrategiesFor } from '@/app/(auth)/[workspaceSlug]/components/parts/helpers';

export type MaterialDraft = {
  materialRate: string;
  pricingStrategy: ComponentEditorSettings['pricingStrategy'];
  packPrice: string;
  packSize: string;
};
export type MaterialErrors = Partial<Record<keyof MaterialDraft, string>>;
export function materialModes(type: MeasurementType, enabled: boolean): PricingStrategy[] {
  return enabled ? allowedStrategiesFor(type).filter(s => s !== 'per_pack_coverage') : ['per_unit'];
}
export function validateMaterial(draft: MaterialDraft, type: MeasurementType, enabled: boolean): MaterialErrors {
  const errors: MaterialErrors = {};
  const modes = materialModes(type, enabled);
  if (!modes.includes(draft.pricingStrategy)) {
    errors.pricingStrategy = 'Choose a purchasing method available for this measurement type.';
    return errors;
  }
  const nonnegative = (value: string) => value.trim() !== '' && Number.isFinite(Number(value)) && Number(value) >= 0;
  const positive = (value: string) => value.trim() !== '' && Number.isFinite(Number(value)) && Number(value) > 0;
  if (draft.pricingStrategy === 'per_unit') {
    if (!nonnegative(draft.materialRate)) errors.materialRate = 'Enter a material cost of zero or more.';
  } else {
    if (!nonnegative(draft.packPrice)) errors.packPrice = 'Enter a pack price of zero or more.';
    if (!positive(draft.packSize)) errors.packSize = 'Enter an amount per pack greater than zero.';
  }
  return errors;
}
