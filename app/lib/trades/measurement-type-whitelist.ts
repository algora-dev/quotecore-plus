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
 * roofing now includes `multi_lineal` + `multi_lineal_lxh` for gutters,
 * fascia, barge boards and similar multi-segment roofing components.
 * `rafter`/`valley_hip` are NOT measurement types
 * (they live on the `pitch_type` enum) so they don't appear here.
 */
export type Trade =
  | 'roofing'
  | 'generic'
  | 'cladding'
  | 'electrical'
  | 'plumbing'
  | 'landscaping'
  | 'flooring'
  | 'tiling'
  | 'foundations'
  | 'insulation'
  | 'painting'
  | 'fencing'
  | 'concrete'
  | 'construction';

export type MeasurementType =
  | 'area'
  | 'lineal'
  | 'multi_lineal'
  | 'multi_lineal_lxh'
  | 'length_x_height'
  | 'volume'
  | 'volume_3d'
  | 'irregular_area'
  | 'curved_line'
  | 'hours_days'
  | 'count'
  | 'fixed'
  // Pre-Phase-2 legacy values still live in the live enum and must keep
  // working (patch_006/008 history). New code should not introduce these.
  | 'linear'
  | 'quantity'
  | 'length_x_height_freestyle'
  | 'multi_lineal_lxh_freestyle';

export const TRADE_ALLOWED_MEASUREMENT_TYPES: Readonly<Record<Trade, ReadonlySet<MeasurementType>>> = {
  // Roofing: original v1 types + multi-segment lineals + wall-area types +
  // volume/count/hours for ancillary work (concrete pads, fittings, labor).
  // Roofers commonly do foundation, cladding, and general construction work
  // alongside the roof, so the whitelist is intentionally broad.
  roofing: new Set<MeasurementType>([
    'area',
    'lineal',
    'linear',                    // legacy alias of lineal
    'multi_lineal',              // gutters, fascia, barge boards
    'multi_lineal_lxh',          // multi-segment × height (wall sections)
    'multi_lineal_lxh_freestyle',
    'length_x_height',           // single wall: length × height
    'length_x_height_freestyle',
    'irregular_area',            // odd-shaped roof sections
    'volume',                    // concrete pads, excavation
    'volume_3d',                 // true 3D volume (L × W × D)
    'curved_line',               // curved gutters, valleys
    'count',
    'quantity',                  // legacy alias of count
    'fixed',
    'hours_days',                // labor
  ]),
  // Cladding: area-producing types (direct area + lineal×height) plus lineal
  // for trim/flashings and fixed/quantity for fittings.
  cladding: new Set<MeasurementType>([
    'area',
    'multi_lineal_lxh',   // primary: wall length × height from plan view
    'length_x_height',    // single-segment wall height × length
    'multi_lineal_lxh_freestyle',
    'length_x_height_freestyle',
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
    'multi_lineal_lxh_freestyle',
    'length_x_height',
    'length_x_height_freestyle',
    'volume',
    'volume_3d',
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
    'volume_3d',    // true 3D: user enters L × W × D per measurement
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
  // Landscaping: full measurement palette - paths, retaining walls, gardens,
  // driveways, decks, planting, fencing. Pitch is shown as "Angle / Slope"
  // for batters, driveway gradient, and tier steps (rafter only, no valley/hip).
  landscaping: new Set<MeasurementType>([
    'area',
    'irregular_area',
    'lineal',
    'linear',
    'multi_lineal',
    'multi_lineal_lxh',
    'multi_lineal_lxh_freestyle',
    'length_x_height',
    'length_x_height_freestyle',
    'volume',          // bulk materials: soil, mulch, aggregate, concrete
    'volume_3d',       // true 3D volume for excavation, soil, etc.
    'curved_line',     // garden edging, curved paths
    'count',
    'quantity',
    'fixed',
    'hours_days',
  ]),
  // Flooring: area-dominant (floor coverings) with lineal trims/edges and
  // volume for screed/levelling. No wall-height types, no pitch.
  flooring: new Set<MeasurementType>([
    'area',
    'irregular_area',
    'lineal',          // skirtings, edge trims, transition strips
    'linear',
    'multi_lineal',
    'curved_line',
    'volume',          // screed, self-levelling compound
    'volume_3d',       // true 3D: L × W × D
    'count',
    'quantity',
    'fixed',
    'hours_days',
  ]),
  // Tiling: full area palette including wall tiling (multi_lineal_lxh + lxh
  // for splashbacks/showers). No volume, no pitch.
  tiling: new Set<MeasurementType>([
    'area',
    'irregular_area',
    'multi_lineal_lxh',   // wall tiling from plan view
    'multi_lineal_lxh_freestyle',
    'length_x_height',    // single wall: shower, splashback
    'length_x_height_freestyle',
    'lineal',             // trims, edges
    'linear',
    'multi_lineal',
    'curved_line',
    'count',
    'quantity',
    'fixed',
    'hours_days',
  ]),
  // Foundations: area for slab, lineal for footings/beams, volume for
  // concrete/excavation, count for piers/pads. No wall-height, no pitch.
  foundations: new Set<MeasurementType>([
    'area',
    'irregular_area',
    'lineal',          // strip footings, beams, perimeter
    'linear',
    'multi_lineal',
    'curved_line',
    'volume',          // concrete pour, excavation
    'volume_3d',       // true 3D volume
    'count',
    'quantity',
    'fixed',
    'hours_days',
  ]),
  // Insulation: area-dominant (ceiling/floor batts, sheets) plus wall area
  // types for wall insulation. Pitch supported (rafter only) for loft and
  // roof-space insulation measured from plan view.
  insulation: new Set<MeasurementType>([
    'area',
    'irregular_area',
    'multi_lineal_lxh',
    'multi_lineal_lxh_freestyle',
    'length_x_height',
    'length_x_height_freestyle',
    'lineal',          // edge seal, tape, perimeter trim
    'linear',
    'multi_lineal',
    'count',           // bags, rolls, batts
    'quantity',
    'fixed',
    'hours_days',
  ]),
  // Painting: area-dominant with wall-area types for plan-view takeoff.
  // Lineal for trims/skirtings/architraves. No volume, no pitch.
  painting: new Set<MeasurementType>([
    'area',
    'irregular_area',
    'multi_lineal_lxh',
    'multi_lineal_lxh_freestyle',
    'length_x_height',
    'length_x_height_freestyle',
    'lineal',          // skirtings, architraves, trim
    'linear',
    'multi_lineal',
    'curved_line',
    'count',
    'quantity',
    'fixed',
    'hours_days',
  ]),
  // Fencing: lineal-dominant with area for paved zones and wall-area types
  // for panel area when needed. No volume, no pitch.
  fencing: new Set<MeasurementType>([
    'lineal',
    'linear',
    'multi_lineal',
    'multi_lineal_lxh',   // panel area when measured from plan
    'multi_lineal_lxh_freestyle',
    'length_x_height',
    'length_x_height_freestyle',
    'area',               // paved areas, gates
    'irregular_area',
    'curved_line',        // curved fence lines
    'count',              // posts, gates, fittings
    'quantity',
    'fixed',
    'hours_days',
  ]),
  // Concrete: area + volume primary (slabs, pours), lineal for kerbs/edges/
  // joints/sawn cuts. Pitch shown as "Slope / Pitch" for slab fall to drainage
  // (rafter only, no valley/hip). No wall-height types.
  concrete: new Set<MeasurementType>([
    'area',
    'irregular_area',
    'lineal',          // kerbs, edges, expansion joints, sawn cuts
    'linear',
    'multi_lineal',
    'curved_line',
    'volume',          // slabs, pours
    'volume_3d',       // true 3D volume
    'count',
    'quantity',
    'fixed',
    'hours_days',
  ]),
  // Construction (umbrella): full measurement palette like generic - covers
  // any general construction job mixing multiple disciplines. Pitch off at
  // trade level; per-component pitch can still be enabled for roof work.
  construction: new Set<MeasurementType>([
    'area',
    'lineal',
    'linear',
    'multi_lineal',
    'multi_lineal_lxh',
    'multi_lineal_lxh_freestyle',
    'length_x_height',
    'length_x_height_freestyle',
    'volume',
    'volume_3d',
    'irregular_area',
    'curved_line',
    'hours_days',
    'count',
    'quantity',
    'fixed',
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
