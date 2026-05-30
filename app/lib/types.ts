// QuoteCore+ v2 shared types
//
// As of 2026-05-12, every Row/Insert type below aliases directly to the
// Supabase-generated `Database` interface. The hand-written shapes that
// previously lived here had drifted from the schema (missing columns,
// renamed columns, ghost columns that no longer existed), which is what
// was driving the bulk of our `as any` casts.
//
// To add or change a column: change the migration, run `supabase gen
// types typescript ...` to refresh `database.types.ts`, and the aliases
// here propagate automatically. Do NOT re-introduce hand-rolled Row types
// for DB tables.
import type {
  Tables,
  TablesInsert,
} from '@/app/lib/supabase/server';

export type ComponentType = 'main' | 'extra';
/**
 * `lineal` is canonical (per the 2026-05-05 db01973 backfill that cleaned up
 * polluted rows). `linear` remains in the Postgres enum for backwards
 * compatibility but has **zero** rows pointing at it; new code must never
 * write `'linear'`. The union includes it only because the generated
 * `Database` types do, and we want them to stay in lockstep.
 */
/**
 * `lineal` is canonical (per the 2026-05-05 db01973 backfill that cleaned up
 * polluted rows). `linear` remains in the Postgres enum for backwards
 * compatibility but has zero rows pointing at it; new code must never write
 * `'linear'`. The union includes it only because the generated `Database`
 * types do, and we want them to stay in lockstep.
 *
 * Phase 2 (Generic Trades) added 8 more enum values to the live
 * `measurement_type` Postgres enum on 2026-05-20. They are listed here so
 * the union narrows correctly in client code; database.types.ts will catch
 * up on the next typegen run.
 */
export type MeasurementType =
  | 'area'
  | 'lineal'
  | 'linear'
  | 'quantity'
  | 'fixed'
  // Phase 2 additions:
  | 'length_x_height'
  | 'volume'
  | 'hours_days'
  | 'count'
  | 'curved_line'
  | 'irregular_area'
  | 'multi_lineal'
  | 'multi_lineal_lxh'  // Phase 7+: polyline area tool (length × height per segment)
  | 'volume_3d'          // True 3D volume: user enters L × W × D per measurement
  | 'length_x_height_freestyle'  // freestyle: user enters height at measurement time (canvas prompt / manual builder)
  | 'multi_lineal_lxh_freestyle'; // freestyle polyline: user enters height after finishing polyline

/** Phase 2 (Generic Trades): how a component is priced. Orthogonal to
 *  measurement_type. Default `per_unit` matches today's behaviour. */
export type PricingStrategy =
  | 'per_unit'
  | 'per_pack_length'
  | 'per_pack_area'
  | 'per_pack_coverage'
  | 'per_pack_volume';

/** Phase 2 (Generic Trades): how waste values are interpreted on a
 *  component. `percent` is current behaviour; `flat` adds a fixed amount
 *  per source segment/line. */
export type WasteUnit = 'percent' | 'flat' | 'flat_per_segment';

/** Phase 2 (Generic Trades): trade tag on a quote, drives terminology +
 *  measurement-type allowlist. */
export type Trade = 'roofing' | 'generic';
/**
 * Measurement system used for display in a quote (and as the company default).
 *
 * - `metric`       : meters and square meters (m / m²) - canonical storage units
 * - `imperial_ft`  : feet and square feet (ft / ft²) - typical for US roofers
 * - `imperial_rs`  : feet and Roofing Squares (ft / RS, 1 RS = 100 ft²) - typical for NZ/AU/UK roofers
 * - `imperial`     : DEPRECATED legacy value, treated as `imperial_rs` everywhere.
 *                    Kept in the union (and Postgres enum) so old data still type-checks;
 *                    new code paths must never write this value.
 */
export type MeasurementSystem = 'metric' | 'imperial_ft' | 'imperial_rs' | 'imperial';

/** Narrow a possibly-legacy MeasurementSystem to the canonical 4-value set callers should branch on. */
export function normalizeMeasurementSystem(
  system: MeasurementSystem | null | undefined
): 'metric' | 'imperial_ft' | 'imperial_rs' {
  if (system === 'imperial_ft') return 'imperial_ft';
  // Legacy 'imperial' rows were always Roofing Squares in practice.
  if (system === 'imperial' || system === 'imperial_rs') return 'imperial_rs';
  return 'metric';
}
export type InputMode = 'final' | 'calculated';
export type WasteType = 'percent' | 'fixed' | 'fixed_per_segment' | 'none';
export type PitchType = 'none' | 'rafter' | 'valley_hip';
export type QuoteStatus = 'draft' | 'confirmed' | 'sent' | 'accepted' | 'declined' | 'expired' | 'archived';
export type LineType = 'component' | 'custom' | 'roof_area_header';

// Flashing Library Types
export interface FlashingMeasurement {
  id: string;                                    // e.g., "length-uuid" or "angle-uuid"
  type: 'length' | 'angle';                      // Type of measurement
  sequence: number;                              // Display order (1, 2, 3, ...)
  value: number;                                 // Numeric value (125, 90, 5.5)
  unit: 'mm' | 'ft' | 'in' | 'degrees';         // Unit type
  pointIndices?: number[];                       // Point relationships: [0,1] for length, [0,1,2] for angle
  label?: string;                                // Optional: "Bottom Edge", "Left Angle"
  visible?: boolean;                             // Show/hide in UI
  placement?: 'interior' | 'exterior';           // For angles only
}

/**
 * `flashings.measurements` is a Json column at the DB level but our app
 * always writes `FlashingMeasurement[]` into it. Override the column type
 * so consumers don't have to cast at every read site.
 */
export type FlashingLibraryRow = Omit<Tables<'flashing_library'>, 'measurements'> & {
  measurements: FlashingMeasurement[] | null;
};

/**
 * Client-facing Insert shape. `company_id` is stamped server-side; the
 * client provides everything else. `measurements` is narrowed from Json
 * to the strongly-typed array form our app writes.
 */
export type FlashingLibraryInsert = Omit<
  TablesInsert<'flashing_library'>,
  'measurements' | 'company_id'
> & {
  company_id?: string;
  measurements?: FlashingMeasurement[] | null;
};

// Material Order Template Types
export type MaterialOrderTemplateRow = Tables<'material_order_templates'>;
/**
 * Client-facing Insert shape. `company_id` is stamped server-side.
 */
export type MaterialOrderTemplateInsert = Omit<
  TablesInsert<'material_order_templates'>,
  'company_id'
> & { company_id?: string };

// Material Order Types
export type OrderStatus = 'ready' | 'ordered';

export type MaterialOrderRow = Tables<'material_orders'>;
export type MaterialOrderLineRow = Tables<'material_order_lines'>;

/**
 * Metric-only unit label for a measurement type. Used by system-agnostic
 * contexts like the component library (which spans every quote regardless of
 * unit system).
 *
 * NOTE: For per-quote rendering use `getUnitLabel(measurementType, system)` from
 * `@/app/lib/measurements/displayHelpers` instead, which knows how to render
 * ft, ft², and Roofing Squares for Imperial quotes.
 */
export function unitForMeasurement(mt: MeasurementType): string {
  switch (mt) {
    case 'area': return 'm²';
    case 'lineal': return 'm';
    case 'linear': return 'm';                    // legacy alias
    case 'multi_lineal': return 'm';
    case 'multi_lineal_lxh': return 'm\u00b2';
    case 'quantity': return 'each';
    case 'count': return 'each';                  // Phase 2 alias
    case 'fixed': return 'fixed';
    case 'length_x_height': return 'm²';          // length × component height
    case 'volume': return 'm³';
    case 'volume_3d': return 'm³';            // true 3D: L × W × D
    case 'length_x_height_freestyle': return 'm²';
    case 'multi_lineal_lxh_freestyle': return 'm²';
    case 'hours_days': return 'hr';               // unit refined by component config
    case 'curved_line': return 'm';
    case 'irregular_area': return 'm²';
    default: return '';
  }
}

export function wasteAmountSuffix(wt: WasteType, mt: MeasurementType): string {
  if (wt === 'percent') return '%';
  if (wt === 'fixed' || wt === 'fixed_per_segment') return unitForMeasurement(mt);
  return '';
}

export function entryLabel(mt: MeasurementType): string {
  switch (mt) {
    case 'area': return 'area';
    case 'lineal':
    case 'linear':
    case 'multi_lineal':
    case 'multi_lineal_lxh':
    case 'curved_line': return 'length';
    case 'quantity':
    case 'count': return 'items';
    case 'fixed': return 'value';
    case 'length_x_height': return 'length';
    case 'volume': return 'area';
    case 'volume_3d': return 'L × W × D';
    case 'length_x_height_freestyle': return 'length × height';
    case 'multi_lineal_lxh_freestyle': return 'length × height';
    case 'hours_days': return 'time';
    case 'irregular_area': return 'area';
    default: return '';
  }
}

export function addMoreLabel(mt: MeasurementType): string {
  switch (mt) {
    case 'area': return 'Add more areas';
    case 'lineal':
    case 'linear':
    case 'multi_lineal':
    case 'multi_lineal_lxh':
    case 'curved_line': return 'Add more lengths';
    case 'quantity':
    case 'count': return 'Add more items';
    case 'fixed': return 'Add entry';
    case 'length_x_height': return 'Add more lengths';
    case 'volume': return 'Add more areas';
    case 'volume_3d': return 'Add volume entry';
    case 'length_x_height_freestyle': return 'Add more lengths';
    case 'multi_lineal_lxh_freestyle': return 'Add more lengths';
    case 'hours_days': return 'Add more time';
    case 'irregular_area': return 'Add more areas';
    default: return 'Add entry';
  }
}

export type ComponentLibraryRow = Tables<'component_library'>;
/**
 * Client-facing Insert shape. `company_id` is stamped server-side by the
 * action handlers (from `requireCompanyContext`), so it's optional here.
 * The full DB-required Insert type is `TablesInsert<'component_library'>`.
 */
export type ComponentLibraryInsert = Omit<
  TablesInsert<'component_library'>,
  'company_id'
> & { company_id?: string };

export type TemplateRow = Tables<'templates'>;
export type TemplateRoofAreaRow = Tables<'template_roof_areas'>;

/**
 * Template component rows often arrive with the linked component_library
 * row joined in as `component_library` (PostgREST embed). Express that as
 * a typed intersection rather than `any`.
 */
export type TemplateComponentRow = Tables<'template_components'> & {
  component_library?: ComponentLibraryRow;
};

export type QuoteRow = Tables<'quotes'>;
export type QuoteRoofAreaRow = Tables<'quote_roof_areas'>;
export type QuoteRoofAreaEntryRow = Tables<'quote_roof_area_entries'>;
export type QuoteComponentRow = Tables<'quote_components'>;
export type QuoteComponentEntryRow = Tables<'quote_component_entries'>;
export type CustomerQuoteLineRow = Tables<'customer_quote_lines'>;
export type CustomerQuoteTemplateRow = Tables<'customer_quote_templates'>;

// File Storage Types
export type FileType = 'logo' | 'plan' | 'supporting';
export type QuoteFileRow = Tables<'quote_files'>;
