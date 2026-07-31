import { BUILT_IN_ORDER, COMPONENT_DEFS } from './calc';
import { ROOF_TAKEOFF_CALCULATION_VERSION } from './public-contract';

export const roofTakeoffSchema = {
  name: 'QuoteCore+ Free Roof Takeoff Builder',
  description: 'Calculates a complete roof takeoff from actual final measurements or plan-view measurements adjusted for roof pitch.',
  calculationVersion: ROOF_TAKEOFF_CALCULATION_VERSION,
  modes: {
    actual: 'Measurements are already final. Pitch is recorded but does not alter them.',
    plan: 'Plan-view measurements are adjusted using the applicable rafter or hip/valley pitch factor.',
  },
  units: {
    metric: 'Metres and square metres.',
    imperial: 'Feet and square feet.',
    squares: 'Feet for lengths and roofing squares for area (1 square = 100 sq ft).',
  },
  inputs: {
    mode: { type: 'string', enum: ['actual', 'plan'], default: 'actual', required: false },
    units: { type: 'string', enum: ['metric', 'imperial', 'squares'], default: 'metric', required: false },
    pitchDegrees: { type: 'number', minimum: 0, maximum: 89, default: 0, required: false },
    area: { type: 'number', exclusiveMinimum: 0, aliases: ['roofArea'], description: 'Total roof area or plan-view roof area, depending on mode.' },
    hips: { type: 'array', items: { oneOf: [{ type: 'number', exclusiveMinimum: 0 }, { type: 'object', properties: { length: { type: 'number', exclusiveMinimum: 0 } }, required: ['length'] }] }, maximumItems: 200 },
    ridges: { type: 'array', aliases: ['ridge'], items: { oneOf: [{ type: 'number', exclusiveMinimum: 0 }, { type: 'object', properties: { length: { type: 'number', exclusiveMinimum: 0 } }, required: ['length'] }] }, maximumItems: 200 },
    valleys: { type: 'array', items: { oneOf: [{ type: 'number', exclusiveMinimum: 0 }, { type: 'object', properties: { length: { type: 'number', exclusiveMinimum: 0 } }, required: ['length'] }] }, maximumItems: 200 },
    barges: { type: 'array', items: { oneOf: [{ type: 'number', exclusiveMinimum: 0 }, { type: 'object', properties: { length: { type: 'number', exclusiveMinimum: 0 } }, required: ['length'] }] }, maximumItems: 200 },
    spouting: { type: 'array', aliases: ['gutter', 'gutters'], items: { oneOf: [{ type: 'number', exclusiveMinimum: 0 }, { type: 'object', properties: { length: { type: 'number', exclusiveMinimum: 0 } }, required: ['length'] }] }, maximumItems: 200 },
    underlay: { type: 'number', exclusiveMinimum: 0 },
    fixings: { type: 'number', exclusiveMinimum: 0 },
    wastePercent: { type: 'object', minimum: 0, maximum: 100, description: 'Optional per-component waste overrides.' },
  },
  components: BUILT_IN_ORDER.map((kind) => ({
    key: kind,
    label: COMPONENT_DEFS[kind].label,
    pitchType: COMPONENT_DEFS[kind].pitchType,
    description: COMPONENT_DEFS[kind].description,
  })),
  outputs: {
    components: 'Per-component raw, waste-adjusted, pricing, count, and unit totals.',
    totalEntries: 'Total number of measurement entries.',
    materialTotal: 'Material total when a published catalogue is available.',
    labourTotal: 'Labour total when a published catalogue is available.',
    grandTotal: 'Combined material and labour total.',
    warnings: 'Non-fatal conditions such as pricing_unavailable or mode_defaulted_to_actual.',
    resultUrl: 'Human-viewable server-rendered URL containing the same normalized inputs and result.',
  },
  endpoints: {
    schema: '/api/public/roof-takeoff/schema',
    calculate: '/api/public/roof-takeoff/calculate',
    humanResult: '/free-roofing-takeoff-builder/calculate',
    mcp: 'https://quote-core.com/mcp',
  },
  example: {
    mode: 'actual',
    units: 'metric',
    pitchDegrees: 25,
    area: 126,
    hips: [5, 5, 5, 5],
    ridges: [8],
    valleys: [4, 4],
    spouting: [18],
  },
} as const;
