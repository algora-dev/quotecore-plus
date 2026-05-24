/**
 * Trade-aware UI labels - single source of truth for all copy that varies by trade.
 *
 * Each new trade is one entry in TRADE_LABELS plus an enum value in the DB.
 * The rest of the UI picks up the right copy automatically via getTradeLabels().
 *
 * Fields are grouped by usage context: area labels, modal copy, takeoff
 * instructions, quote builder, customer quote, measurement type overrides.
 */

export type Trade = 'roofing' | 'generic' | 'cladding' | 'electrical' | 'plumbing';

export interface TradeLabels {
  // ── Identity ──────────────────────────────────────────────────────────────
  /** Display name in dropdowns / headings. */
  tradeLabel: string;

  // ── Area labels ───────────────────────────────────────────────────────────
  /** Plural noun: "Roof Areas" / "Wall Areas" / "Areas" */
  areaPluralLabel: string;
  /** Singular noun: "Roof Area" / "Wall Area" / "Area" */
  areaSingularLabel: string;
  /** CTA button to add a new area. */
  addAreaCta: string;

  // ── Pitch ─────────────────────────────────────────────────────────────────
  /** Whether pitch is a required field on the add-area modal. */
  pitchRequired: boolean;

  // ── Create-area modal ─────────────────────────────────────────────────────
  /** Modal heading when creating the primary named area. */
  createAreaModalTitle: string;
  /** Placeholder for the area name input. */
  areaNamePlaceholder: string;

  // ── Post-calibration instructions modal ───────────────────────────────────
  /**
   * Optional: shown below the calibration-complete heading.
   * When null the modal skips the optional-area branch and goes straight
   * to the mandatory pitch flow (roofing only).
   */
  firstAreaInstructionsTitle: string;
  firstAreaInstructionsBody: string;
  /** Primary CTA in the instructions modal. */
  firstAreaConfirmCta: string;
  /**
   * Optional guidance note rendered in the modal for trades that support
   * multiple measurement approaches (e.g. cladding elevation vs plan view).
   * null = no note shown.
   */
  toolGuidanceNote: string | null;
  /** Whether the area step is optional (generic/cladding) or mandatory (roofing). */
  areaIsOptional: boolean;

  // ── Optional-area prompt (areaIsOptional trades) ──────────────────────────
  /** Prompt heading when area is optional. */
  needAreaPrompt: string;
  /** Confirm button copy. */
  optionalAreaConfirmCta: string;
  /** Skip button copy. */
  skipAreaCta: string;

  // ── Quote builder ─────────────────────────────────────────────────────────
  /** Step 1 label in the phase nav: "1. Roof Areas" / "1. Wall Areas" */
  builderStepLabel: string;
  /** Empty-quote guard message when no area has been added. */
  emptyAreaGuardMessage: string;

  // ── Customer-facing quote ─────────────────────────────────────────────────
  /** Section header on the customer quote document. */
  customerQuoteSectionLabel: string;

  // ── Measurement type display name overrides ───────────────────────────────
  /**
   * Map of measurement_type → display name for this trade.
   * Keys not present fall back to the global default names.
   */
  measurementTypeLabels: Partial<Record<string, string>>;
}

export const TRADE_LABELS: Readonly<Record<Trade, TradeLabels>> = {
  plumbing: {
    tradeLabel: 'Plumbing',

    areaPluralLabel: 'Areas',
    areaSingularLabel: 'Area',
    addAreaCta: 'Add Area',

    pitchRequired: false,

    createAreaModalTitle: 'Create Area',
    areaNamePlaceholder: 'e.g. Bathroom, Kitchen, Ground Floor',

    areaIsOptional: true,
    firstAreaInstructionsTitle: 'Define Job Areas',
    firstAreaInstructionsBody:
      'You can optionally draw areas to break the job into zones (floors, rooms, sections). ' +
      'Or skip this and measure pipe runs and fittings directly.',
    firstAreaConfirmCta: 'Yes, add an area',
    toolGuidanceNote:
      'Use the Line / Multi-Line tools for pipe runs. ' +
      'Use the Curved Line tool for curved or concealed pipe routes. ' +
      'Use Point for fixtures, valves, and fittings.',

    needAreaPrompt: 'Do you want to define a job area first?',
    optionalAreaConfirmCta: 'Yes, add an area',
    skipAreaCta: 'No, skip',

    builderStepLabel: 'Areas',
    emptyAreaGuardMessage:
      'A quote needs at least one component before it can be saved. ' +
      "We'll take you back so you can add one.",

    customerQuoteSectionLabel: 'Plumbing Works',

    measurementTypeLabels: {
      multi_lineal: 'Multiple Pipe Runs',
      curved_line:  'Curved Pipe Run',
      hours_days:   'Hours / Days',
      count:        'Count',
      volume:       'Volume',
    },
  },

  electrical: {
    tradeLabel: 'Electrical',

    areaPluralLabel: 'Areas',
    areaSingularLabel: 'Area',
    addAreaCta: 'Add Area',

    pitchRequired: false,

    createAreaModalTitle: 'Create Area',
    areaNamePlaceholder: 'e.g. Ground Floor, Roof Space',

    areaIsOptional: true,
    firstAreaInstructionsTitle: 'Define Job Areas',
    firstAreaInstructionsBody:
      'You can optionally draw areas to break the job into zones (floors, circuits, sections). ' +
      'Or skip this and measure cable runs and fittings directly.',
    firstAreaConfirmCta: "Yes, add an area",
    toolGuidanceNote:
      'Use the Line / Multi-Line tools for cable runs and conduit. ' +
      'Use the Curved Line tool for curved cable paths. ' +
      'Use Point for outlets, fittings, and panels.',

    needAreaPrompt: 'Do you want to define a job area first?',
    optionalAreaConfirmCta: 'Yes, add an area',
    skipAreaCta: 'No, skip',

    builderStepLabel: 'Areas',
    emptyAreaGuardMessage:
      'A quote needs at least one component before it can be saved. ' +
      "We'll take you back so you can add one.",

    customerQuoteSectionLabel: 'Electrical Works',

    measurementTypeLabels: {
      multi_lineal:  'Multiple Cable Runs',
      curved_line:   'Curved Cable Run',
      hours_days:    'Hours / Days',
      count:         'Count',
    },
  },

  roofing: {
    tradeLabel: 'Roofing',

    areaPluralLabel: 'Roof Areas',
    areaSingularLabel: 'Roof Area',
    addAreaCta: 'Add Roof Area',

    pitchRequired: true,

    createAreaModalTitle: 'Create Roof Area',
    areaNamePlaceholder: 'e.g. Main Roof',

    areaIsOptional: false,
    firstAreaInstructionsTitle: 'Next: Create Your First Roof Area',
    firstAreaInstructionsBody:
      'Before measuring components, you must define at least one roof area with a pitch angle. ' +
      'Click the Area button, draw around the roof outline, then enter a name and pitch angle.',
    firstAreaConfirmCta: "Got it, let's create a roof area!",
    toolGuidanceNote: null,

    needAreaPrompt: 'Do you want to measure a roof area first?',
    optionalAreaConfirmCta: 'Yes, add a roof area',
    skipAreaCta: 'No, skip',

    builderStepLabel: 'Roof Areas',
    emptyAreaGuardMessage:
      'A quote needs at least one roof area and one main component before it can be saved. ' +
      "We'll take you back to Roof Areas so you can add one.",

    customerQuoteSectionLabel: 'Roof Areas',

    measurementTypeLabels: {},
  },

  cladding: {
    tradeLabel: 'Cladding',

    areaPluralLabel: 'Wall Areas',
    areaSingularLabel: 'Wall Area',
    addAreaCta: 'Add Wall Area',

    pitchRequired: false,

    createAreaModalTitle: 'Create Wall Area',
    areaNamePlaceholder: 'e.g. North Elevation',

    areaIsOptional: true,
    firstAreaInstructionsTitle: 'Next: Define Your Wall Areas',
    firstAreaInstructionsBody:
      'Define your wall areas before measuring components. ' +
      'Use the Area tool to trace elevations directly, or use the Line / Multi-Line tools ' +
      'for plan views - make sure your components are set up with Wall Length × Height.',
    firstAreaConfirmCta: "Got it, let's add a wall area!",
    toolGuidanceNote:
      'Use the Area tool for elevation plans, or the Line / Multi-Line tools for plan view ' +
      '(make sure your components are set up with Wall Length × Height).',

    needAreaPrompt: 'Do you want to measure a wall area first?',
    optionalAreaConfirmCta: 'Yes, add a wall area',
    skipAreaCta: 'No, skip',

    builderStepLabel: 'Wall Areas',
    emptyAreaGuardMessage:
      'A quote needs at least one wall area and one main component before it can be saved. ' +
      "We'll take you back to Wall Areas so you can add one.",

    customerQuoteSectionLabel: 'Wall Areas',

    measurementTypeLabels: {
      multi_lineal_lxh: 'Wall Length × Height',
      length_x_height: 'Wall Height × Length',
    },
  },

  generic: {
    tradeLabel: 'Generic',

    areaPluralLabel: 'Areas',
    areaSingularLabel: 'Area',
    addAreaCta: 'Add Area',

    pitchRequired: false,

    createAreaModalTitle: 'Create Area',
    areaNamePlaceholder: 'e.g. Zone A',

    areaIsOptional: true,
    firstAreaInstructionsTitle: 'Define Your Areas',
    firstAreaInstructionsBody:
      'For area-based components you can draw an area now. ' +
      'For lineal or count-based work you can skip this and measure directly.',
    firstAreaConfirmCta: 'Yes, add an area',
    toolGuidanceNote: null,

    needAreaPrompt: 'Do you want to measure an area first?',
    optionalAreaConfirmCta: 'Yes, add an area',
    skipAreaCta: 'No, skip',

    builderStepLabel: 'Areas',
    emptyAreaGuardMessage:
      'A quote needs at least one area and one main component before it can be saved. ' +
      "We'll take you back to Areas so you can add one.",

    customerQuoteSectionLabel: 'Areas',

    measurementTypeLabels: {},
  },
};

/**
 * Safe accessor: falls back to roofing labels for unknown / legacy trade
 * values so a stale database row never breaks the UI.
 */
export function getTradeLabels(trade?: string | null): TradeLabels {
  if (trade === 'cladding')   return TRADE_LABELS.cladding;
  if (trade === 'generic')    return TRADE_LABELS.generic;
  if (trade === 'electrical') return TRADE_LABELS.electrical;
  if (trade === 'plumbing')   return TRADE_LABELS.plumbing;
  return TRADE_LABELS.roofing;
}
