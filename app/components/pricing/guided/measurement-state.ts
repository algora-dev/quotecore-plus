import type { MeasurementSystem, MeasurementType } from '@/app/lib/types';
import { normalizeMeasurementSystem } from '@/app/lib/types';
import { buildMeasurementLabels, ROOFING_DEFAULT_TYPES } from '@/app/(auth)/[workspaceSlug]/components/parts/helpers';
import type { ComponentEditorSettings } from '../SmartComponentEditor';

// This is a view of the existing editor contract, not a new component schema.
export type MeasurementFields = Pick<ComponentEditorSettings, 'measurementType' | 'heightMm' | 'depthMm' | 'hoursUnit'>;
export type NewMeasurementType = Exclude<MeasurementType, 'linear' | 'count' | 'curved_line' | 'irregular_area'>;
export type MeasurementErrors = Partial<Record<keyof MeasurementFields, string>>;
export type MeasurementPicture = 'length' | 'area' | 'quantity' | 'fixed' | 'height' | 'volume' | 'time' | 'multi';
export const COMMON_MEASUREMENT_TYPES: readonly NewMeasurementType[] = ['lineal', 'area', 'quantity', 'fixed'];

// Same new-create exclusions as SmartComponentEditor. Legacy rows remain editable
// in the quick editor. Do not offer obsolete or gated types to a new guided draft.
const HIDDEN_NEW_TYPES = new Set<MeasurementType>(['linear', 'count', 'curved_line', 'irregular_area']);

const COPY: Record<NewMeasurementType, { title: string; short: string; explanation: string; example: string; picture: MeasurementPicture }> = {
  lineal: {
    title: 'By length', short: 'Flashing, pipe or guttering.', picture: 'length',
    explanation: 'Enter how long it is. Smart Components™ use that length with your rates and rules.',
    example: 'Valley flashing',
  },
  area: {
    title: 'By area', short: 'Underlay, flooring or paint.', picture: 'area',
    explanation: 'Enter how much surface you need to cover. Smart Components™ use that area with your rates and rules.',
    example: 'Roofing underlay',
  },
  quantity: {
    title: 'By item', short: 'Vents, brackets or fittings.', picture: 'quantity',
    explanation: 'Enter how many items you need. Smart Components™ use that quantity with your rates and rules.',
    example: 'Roof vents',
  },
  fixed: {
    title: 'One fixed amount', short: 'Delivery or a call-out charge.', picture: 'fixed',
    explanation: 'Use a set amount without entering a length, area or item count.',
    example: 'Delivery',
  },
  multi_lineal: {
    title: 'Several connected lengths', short: 'A run with more than one straight section.', picture: 'multi',
    explanation: 'Measure the connected sections. Their combined length is used for pricing.',
    example: 'Guttering around corners',
  },
  length_x_height: {
    title: 'Length with a set height', short: 'Measure any length using one fixed height.', picture: 'height',
    explanation: 'Save the height here. On a job, measure the length to work out the area.',
    example: 'Cladding at a standard height',
  },
  multi_lineal_lxh: {
    title: 'Connected lengths with a set height', short: 'Several lengths using one fixed height.', picture: 'height',
    explanation: 'Save one height here. The connected lengths use that height to work out the area.',
    example: 'Cladding around several walls',
  },
  length_x_height_freestyle: {
    title: 'Length with a custom height', short: 'Choose the height each time you measure.', picture: 'height',
    explanation: 'Enter the height with each measurement on the job, rather than saving one height in this component.',
    example: 'A wall with a job-specific height',
  },
  multi_lineal_lxh_freestyle: {
    title: 'Connected lengths with a custom height', short: 'Enter a different height when needed.', picture: 'height',
    explanation: 'Measure the connected run, then enter its height on the job to work out the area.',
    example: 'A run of walls measured together',
  },
  volume: {
    title: 'Volume with a set depth', short: 'Measure an area using one fixed depth.', picture: 'volume',
    explanation: 'Save the depth here. The measured area and that depth give the volume you need.',
    example: 'Concrete at a standard thickness',
  },
  volume_3d: {
    title: 'Volume with a custom depth', short: 'Choose the depth each time you measure.', picture: 'volume',
    explanation: 'Enter dimensions on the job to work out volume. No fixed depth is saved here.',
    example: 'Concrete with varying depths',
  },
  hours_days: {
    title: 'By time', short: 'Work priced by the hour or day.', picture: 'time',
    explanation: 'Enter the amount of time. Keep the time and your rate on the same basis, hours or days.',
    example: 'Installation labour',
  },
};

export function availableMeasurementTypes(genericTradesEnabled: boolean): NewMeasurementType[] {
  return (Object.keys(buildMeasurementLabels('metric')) as MeasurementType[])
    .filter((type): type is NewMeasurementType => !HIDDEN_NEW_TYPES.has(type) && (genericTradesEnabled || ROOFING_DEFAULT_TYPES.has(type)));
}
export function measurementUnits(system: MeasurementSystem) {
  const normalised = normalizeMeasurementSystem(system);
  return { length: normalised === 'metric' ? 'm' : 'ft', area: normalised === 'metric' ? 'm²' : normalised === 'imperial_ft' ? 'ft²' : 'RS', volume: normalised === 'metric' ? 'm³' : 'ft³' };
}
export function measurementOption(type: NewMeasurementType, system: MeasurementSystem, hoursUnit: 'hr' | 'day' = 'hr') {
  const units = measurementUnits(system);
  const info = COPY[type];
  const unit = info.picture === 'length' || info.picture === 'multi' ? units.length
    : info.picture === 'area' || info.picture === 'height' ? units.area
    : info.picture === 'volume' ? units.volume
    : info.picture === 'time' ? hoursUnit : info.picture === 'quantity' ? 'each' : 'charge';
  const amount = info.picture === 'area' ? `20 ${unit}` : info.picture === 'quantity' ? '6 items'
    : info.picture === 'fixed' ? '1 charge' : info.picture === 'time' ? `8 ${unit}`
    : info.picture === 'volume' ? `3 ${unit}` : info.picture === 'height' ? `12 ${unit}` : `10 ${unit}`;
  return { ...info, type, unit, amount, editorLabel: buildMeasurementLabels(system)[type] };
}
export function requiresHeight(type: MeasurementType) { return type === 'length_x_height' || type === 'multi_lineal_lxh'; }
export function requiresDepth(type: MeasurementType) { return type === 'volume'; }
export function validateMeasurement(value: MeasurementFields, chosen: boolean, genericTradesEnabled: boolean): MeasurementErrors {
  if (!chosen) return { measurementType: 'Choose how you measure this item.' };
  if (!availableMeasurementTypes(genericTradesEnabled).includes(value.measurementType as NewMeasurementType)) {
    return { measurementType: 'Choose a measurement type available in your workspace.' };
  }
  const errors: MeasurementErrors = {};
  const positive = (raw: string) => raw.trim() !== '' && Number.isFinite(Number(raw)) && Number(raw) > 0;
  if (requiresHeight(value.measurementType) && !positive(value.heightMm)) errors.heightMm = 'Enter a height greater than zero, in millimetres.';
  if (requiresDepth(value.measurementType) && !positive(value.depthMm)) errors.depthMm = 'Enter a depth greater than zero, in millimetres.';
  if (value.measurementType === 'hours_days' && !['hr', 'day'].includes(value.hoursUnit)) errors.hoursUnit = 'Choose hours or days for your test.';
  return errors;
}
