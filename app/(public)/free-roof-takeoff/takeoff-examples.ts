/** Illustrative prices only. Never a catalogue or a claim about market rates.
 * Rates below start per metre / square metre; converting units preserves cost. */
import { EMPTY_SPEC, type TakeoffComponentSpec, type TakeoffTradeConfig, type TakeoffUnitSystem } from './tradeConfig';
export const TAKEOFF_CURRENCIES = ['NZD', 'AUD', 'USD', 'GBP', 'EUR', 'CAD'] as const;
export type TakeoffCurrency = typeof TAKEOFF_CURRENCIES[number];
export const FEET_PER_METRE = 1 / 0.3048;
export const SQFT_PER_SQM = FEET_PER_METRE * FEET_PER_METRE;
export function quantityFactor(type: TakeoffComponentSpec['measurementType'], system: TakeoffUnitSystem): number {
  if (type === 'quantity' || system === 'metric') return 1;
  return type === 'lineal' ? FEET_PER_METRE : system === 'squares' ? SQFT_PER_SQM / 100 : SQFT_PER_SQM;
}
export function specUnit(type: TakeoffComponentSpec['measurementType'], system: TakeoffUnitSystem): string {
  return type === 'quantity' ? 'ea' : type === 'lineal' ? system === 'metric' ? 'm' : 'ft' : system === 'metric' ? 'm²' : system === 'squares' ? 'sq' : 'ft²';
}
export function convertSpecs(specs: TakeoffComponentSpec[], from: TakeoffUnitSystem, to: TakeoffUnitSystem): TakeoffComponentSpec[] {
  if (from === to) return specs;
  return specs.map(s => {
    const factor = quantityFactor(s.measurementType, to) / quantityFactor(s.measurementType, from);
    return { ...s, materialRate:s.materialRate / factor, labourRate:s.labourRate / factor,
      packSize:s.packSize == null ? null : s.packSize * factor,
      wasteValue:s.wasteType === 'fixed' || s.wasteType === 'fixed_per_segment' ? s.wasteValue * factor : s.wasteValue };
  });
}
// [material, labour, waste %]. Deliberately non-authoritative teaching values.
const RATES: Record<string, readonly [number,number,number]> = {
  'Hip':[21.8,12.4,5], 'Valley':[26.5,14.2,5], 'Ridge':[19.6,11.8,5], 'Barge':[23.4,13.5,5], 'Spouting':[24.8,16.5,5], 'Roof Area':[38.5,24,7],
  'Building Wrap':[5.8,3.2,7], 'Cavity Battens':[11.4,9.6,5], 'Horizontal Cladding - Cedar':[86,44,8], 'Horizontal Cladding - Corrugate':[36.5,28,7],
  'Window Trim':[14.8,12.5,5], 'Door Trim':[16.2,12.5,5], 'Corner Trims':[22.5,14,5], 'Soffit':[31.5,25,7], 'Openings (windows/doors)':[0,35,0],
  'Timber Plank Flooring':[68,32,8], 'Carpet':[39.5,18.5,8], 'Tile':[46,48,10], 'Underlay':[8.9,4.5,5], 'Skirting':[9.8,10.5,5], 'Scotia':[5.2,7.8,5], 'Transition Strip':[24,14.5,5], 'Adhesive / Sundries':[42,0,0],
};
export function exampleSpecs(config: TakeoffTradeConfig, system: TakeoffUnitSystem): TakeoffComponentSpec[] {
  const base:TakeoffComponentSpec[] = config.placeholderComponents.map(c => {
    const [materialRate,labourRate,waste] = RATES[c.name] ?? [12.5,8.5,5];
    const pitched = config.requiresPitch && (c.measurement_type === 'area' || ['Hip','Valley','Barge'].includes(c.name));
    return { ...EMPTY_SPEC, id:c.id, name:c.name, measurementType:c.measurement_type, materialRate, labourRate,
      wasteType:waste ? 'percent' : 'none', wasteValue:waste, pitchEnabled:pitched,
      pitchType:['Hip','Valley'].includes(c.name) ? 'valley_hip' : 'rafter', pricingOrigin:'example' };
  });
  return convertSpecs(base,'metric',system);
}
/** Keep every supplied default editable even when legacy defaults exceed the 7-item cap. */
export function componentLimit(config:TakeoffTradeConfig):number { return Math.max(config.maxCustomComponents,config.placeholderComponents.length); }
export function validateSpec(s:TakeoffComponentSpec, requiresPitch=true):string[] {
  const issues:string[]=[];
  if (!s.name.trim() || s.name.length>120) issues.push('Use a component name between 1 and 120 characters.');
  for (const [name,value] of [['Material rate',s.materialRate],['Labour rate',s.labourRate],['Waste',s.wasteValue]] as const)
    if (!Number.isFinite(value) || value < 0 || value > 1e9) issues.push(`${name} must be between 0 and 1,000,000,000.`);
  if (s.pricingStrategy !== 'per_unit') {
    if (s.measurementType === 'quantity') issues.push('Counted items use a price per item.');
    if (s.pricingStrategy !== (s.measurementType==='area'?'per_pack_area':'per_pack_length')) issues.push('Pack units must match the measurement type.');
    if (!Number.isFinite(s.packSize) || !s.packSize || s.packSize<=0 || s.packSize>1e9) issues.push('Enter a pack size greater than zero.');
    if (s.packPrice == null || !Number.isFinite(s.packPrice) || s.packPrice<0 || s.packPrice>1e9) issues.push('Enter a valid pack price (zero is allowed).');
  }
  if (s.pitchEnabled && (!requiresPitch || s.measurementType==='quantity')) issues.push('Pitch is only available for roofing lengths and areas.');
  return issues;
}
