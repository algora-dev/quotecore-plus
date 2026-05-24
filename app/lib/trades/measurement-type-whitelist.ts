/**
 * Generic Trades Phase 6 - measurement_type compatibility allowlist by trade.
 *
 * Single source of truth used by `assertComponentCompatibleWithQuote()` to
 * decide whether a given component is allowed to attach to a given quote.
 *
 * Mirrors the `ck_component_library_strategy_compat` matrix from the Phase 2
 * migration's perspective on which measurement types matter per trade.
 *
 * Round-3 M-03 correction: `multi_lineal` is in the generic allowlist;
 * roofing intentionally omits it for v1 (gutters / cabling-like roofing
 * cases can widen later). `rafter`/`valley_hip` are NOT measurement types
 * (they live on the `pitch_type` enum) so they don't appear here.
 */
export type Trade = 'roofing' | 'generic' | 'cladding' | 'electrical' | 'plumbing';

export type MeasurementType =
  | 'area'
  | 'lineal'
  | 'multi_lineal'
  | 'multi_lineal_lxh'
  | 'length_x_height'
  | 'volume'
  | 'irregular_area'
  | 'curved_line'
  | 'hours_days'
  | 'count'
  | 'fixed'
  // Pre-Phase-2 legacy values still live in the live enum and must keep
  // working (patch_006/008 history). New code should not introduce these.
  | 'linear'
  | 'quantity';

export const TRADE_ALLOWED_MEASUREMENT_TYPES: Readonly<Record<Trade, ReadonlySet<MeasurementType>>> = {
  // Roofing v1: the four shipped types + the legacy aliases.
  roofing: new Set<MeasurementType>([
    'area',
    'lineal',
    'linear',     // legacy alias of lineal (patch_006 rename history)
    'quantity',   // legacy alias of count
    'fixed',
  ]),
  // Cladding: area-producing types (direct area + lineal×height) plus lineal
  // for trim/flashings and fixed/quantity for fittings.
  cladding: new Set<MeasurementType>([
    'area',
    'multi_lineal_lxh',   // primary: wall length × height from plan view
    'length_x_height',    // single-segment wall height × length
    'irregular_area',     // odd-shaped wall sections
    'lineal',
    'linear',
    'multi_lineal',
    'quantity',
    'count',
    'fixed',
  ]),
  // Generic v1: every type the UI offers, including the Phase 2 extensions.
  generic: new Set<MeasurementType>([
    'area',
    'lineal',
    'linear',
    'multi_lineal',
    'multi_lineal_lxh',
    'length_x_height',
    'volume',
    'irregular_area',
    'curved_line',
    'hours_days',
    'count',
    'quantity',
    'fixed',
  ]),
  // Plumbing: lineal pipe runs are primary; curved paths for bends and
  // concealed routes; count for fixtures, valves, and fittings; volume for
  // tanks, concrete surrounds, and excavation; hours for labor. No pitch -
  // pipe runs are always measured as actual or horizontal plan lengths.
  // No wall-height types (multi_lineal_lxh / length_x_height) - not applicable.
  plumbing: new Set<MeasurementType>([
    'lineal',
    'linear',       // legacy alias
    'multi_lineal', // multiple pipe runs summed
    'curved_line',  // curved pipe paths / bends
    'area',         // waterproofing, floor area
    'volume',       // tanks, concrete, excavation
    'count',
    'quantity',     // legacy alias
    'fixed',
    'hours_days',   // hourly / day-rate labor
  ]),
  // Electrical: lineal cable runs and curved paths are primary; count-based
  // for fittings/outlets/panels; area for lighting or solar coverage; hours
  // for labor. No wall-height types (multi_lineal_lxh / length_x_height) and
  // no volume - neither applies to electrical work.
  // Pitch is allowed at the component level (rafter pitch for roof cable runs);
  // valley_hip pitch types don't apply but are not enforced here - steer via
  // docs and component setup instead.
  electrical: new Set<MeasurementType>([
    'lineal',
    'linear',       // legacy alias
    'multi_lineal', // multiple cable runs summed
    'curved_line',  // curved conduit / cable paths
    'area',         // floor/ceiling area (lighting layout, solar)
    'count',
    'quantity',     // legacy alias
    'fixed',
    'hours_days',   // hourly / day-rate labor
  ]),
};

/**
 * Returns true when `measurementType` is allowed on a quote with the given
 * `trade`. Used for both UI gating (disabled options + tooltip) and the
 * server-side assertion. Never throws - call sites decide the policy.
 */
export function isMeasurementTypeAllowed(
  trade: Trade,
  measurementType: MeasurementType,
): boolean {
  return TRADE_ALLOWED_MEASUREMENT_TYPES[trade]?.has(measurementType) ?? false;
}
