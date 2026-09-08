// Trade configuration: which trade a supplier pricing tool instance serves.
// Roofing keeps the original group + placeholder-component model; cladding
// and flooring use the PARENT-AREA model (no placeholder components - the
// user measures areas and attaches each to a named parent that represents
// a product / wall-covering type). The flow shell picks the right model
// from the supplier def's trade field (see supplierDefs).

export type Trade = 'roofing' | 'cladding' | 'flooring';
export type TradeModel = 'groups' | 'parents';

/** A pre-seeded measurement row shown under every bucket on the parents
 *  step. name becomes the component name; basis drives the input shape. */
export interface BucketRow {
  name: string;
  basis: 'area' | 'lineal' | 'point';
}

export interface TradeConfig {
  key: Trade;
  label: string;
  /** data model driving the flow */
  model: TradeModel;
  /** what the measured areas represent, lowercase, e.g. "wall" */
  areaNoun: string;
  /** plural label for the measured areas, e.g. "Wall areas" */
  areaLabel: string;
  /** intro copy on the parents step */
  parentsIntro: string;
  /** optional slope/angle per area (cladding yes, flooring no) */
  allowAngle: boolean;
  /** length x height measurement mode (cladding yes, flooring no) */
  allowHeight: boolean;
  /** angle field label */
  angleLabel: string;
  /** default bucket-name examples for the measure step copy - supplier defs
   *  can override with their own real product names (see bucketExamples on
   *  the supplier def). */
  bucketExamples: readonly string[];
  /** default pre-seeded rows per bucket (supplier defs can override) */
  bucketRows: readonly BucketRow[];
}

export const TRADE_CONFIGS: Record<Trade, TradeConfig> = {
  roofing: {
    key: 'roofing',
    label: 'Roofing',
    model: 'groups',
    areaNoun: 'roof',
    areaLabel: 'Roof Areas',
    parentsIntro: '',
    allowAngle: true,
    allowHeight: false,
    angleLabel: 'Pitch',
    bucketExamples: [],
    bucketRows: [],
  },
  cladding: {
    key: 'cladding',
    label: 'Walls & Cladding',
    model: 'parents',
    areaNoun: 'wall',
    areaLabel: 'Wall Areas',
    parentsIntro:
      'Each area group below is one product or wall-covering type (for example one cladding for most walls and render on the rest). Add every wall you measured under the group it belongs to - the total drives the product quantity at the next step.',
    allowAngle: true,
    allowHeight: true,
    angleLabel: 'Angle',
    bucketExamples: ['Weatherboard', 'Render', 'Brick', 'Paint'],
    bucketRows: [
      { name: 'Wall areas', basis: 'area' },
      { name: 'Head Flashing', basis: 'lineal' },
      { name: 'Soffit Flashing', basis: 'lineal' },
      { name: 'Base Flashing', basis: 'lineal' },
      { name: 'Internal Corner Flashing', basis: 'lineal' },
      { name: 'External Corner Flashing', basis: 'lineal' },
      { name: 'Jamb Flashing', basis: 'lineal' },
      { name: 'Sill Flashing', basis: 'lineal' },
      { name: 'Small Penetration', basis: 'point' },
      { name: 'Medium Penetration', basis: 'point' },
      { name: 'Large Penetration', basis: 'point' },
    ],
  },
  flooring: {
    key: 'flooring',
    label: 'Flooring',
    model: 'parents',
    areaNoun: 'floor',
    areaLabel: 'Floor Areas',
    parentsIntro:
      'Each area group below is one product or floor-covering type. Add every floor you measured under the group it belongs to - the total drives the product quantity at the next step.',
    allowAngle: false,
    allowHeight: false,
    angleLabel: 'Angle',
    bucketExamples: ['Carpet', 'Vinyl', 'Timber'],
    bucketRows: [
      { name: 'Floor areas', basis: 'area' },
      { name: 'Skirting', basis: 'lineal' },
      { name: 'Scotia / Trim', basis: 'lineal' },
      { name: 'Transitions / Ramp', basis: 'lineal' },
    ],
  },
};

export function tradeConfigFor(trade: Trade | undefined | null): TradeConfig {
  return TRADE_CONFIGS[trade ?? 'roofing'] ?? TRADE_CONFIGS.roofing;
}
