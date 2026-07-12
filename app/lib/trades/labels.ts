/**
 * Trade-aware UI labels - single source of truth for all copy that varies by trade.
 *
 * Each new trade is one entry in TRADE_LABELS plus an enum value in the DB.
 * The rest of the UI picks up the right copy automatically via getTradeLabels().
 *
 * Fields are grouped by usage context: area labels, modal copy, takeoff
 * instructions, quote builder, customer quote, measurement type overrides.
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
  | 'construction'
  | 'solar';

export interface TradeLabels {
  // ── Identity ──────────────────────────────────────────────────────────────
  /** Display name in dropdowns / headings. */
  tradeLabel: string;

  // ── Flashings / Drawings feature ────────────────────────────────────────
  /**
   * Plural label for the drawing-library feature. Roofing calls these
   * "Flashings"; every other trade calls them "Drawings & Images". Used for
   * the entry button, the library page heading, list copy, and the canvas.
   * Internal identifiers (table `flashing_library`, `flashing_ids`, routes,
   * data-copilot keys, file names) are NOT affected - display copy only.
   */
  featureLabel: string;
  /** Singular form: "Flashing" / "Drawing/Image". */
  featureLabelSingular: string;

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
  /**
   * Whether the pitch UI on the component form should be shown for this
   * trade even when pitchRequired is false. Roofing has pitchRequired=true
   * which implicitly shows pitch; landscaping/concrete/insulation set
   * pitchOptional=true to show pitch as an optional checkbox.
   * Defaults to false (hidden) when not specified.
   */
  pitchOptional?: boolean;
  /**
   * When true, the pitch type dropdown only offers Rafter pitch (no
   * valley/hip). Used by trades where slope/angle applies but only as a
   * single multiplier - landscaping, concrete, insulation, electrical.
   */
  pitchHidesValleyHip?: boolean;
  /**
   * Label for the rafter pitch option in the pitch type dropdown.
   * Defaults to "Rafter Pitch" (roofing). Non-roofing pitch trades use
   * "Rise over run" to avoid roofing-specific terminology.
   */
  pitchRafterLabel?: string;
  /**
   * Label for the pitch input field shown on the area in the quote builder.
   * Only shown when pitchRequired or pitchOptional is true.
   * Defaults to "Pitch (°)" when not specified.
   */
  areaPitchLabel?: string;
  /**
   * Label shown next to the "Apply pitch calculation" checkbox in the
   * component form. Defaults to "Apply pitch calculation" when not
   * specified.
   */
  pitchCheckboxLabel?: string;

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
    featureLabel: 'Drawings & Images',
    featureLabelSingular: 'Drawing/Image',

    areaPluralLabel: 'Areas',
    areaSingularLabel: 'Area',
    addAreaCta: 'Add Area',

    pitchRequired: false,
    pitchOptional: true,
    pitchHidesValleyHip: true,
    pitchCheckboxLabel: 'Apply Angle/Slope calculation',
    pitchRafterLabel: 'Rise over run',
    areaPitchLabel: 'Fall / Gradient (°)',

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
    featureLabel: 'Drawings & Images',
    featureLabelSingular: 'Drawing/Image',

    areaPluralLabel: 'Areas',
    areaSingularLabel: 'Area',
    addAreaCta: 'Add Area',

    pitchRequired: false,
    pitchOptional: true,
    pitchHidesValleyHip: true,
    pitchCheckboxLabel: 'Apply Angle/Slope calculation',
    pitchRafterLabel: 'Rise over run',
    areaPitchLabel: 'Pitch (°)',

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
    featureLabel: 'Flashings',
    featureLabelSingular: 'Flashing',

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
    featureLabel: 'Drawings & Images',
    featureLabelSingular: 'Drawing/Image',

    areaPluralLabel: 'Wall Areas',
    areaSingularLabel: 'Wall Area',
    addAreaCta: 'Add Wall Area',

    pitchRequired: false,
    pitchOptional: true,
    pitchHidesValleyHip: true,
    pitchCheckboxLabel: 'Apply Angle/Slope calculation',
    pitchRafterLabel: 'Rise over run',
    areaPitchLabel: 'Pitch (°)',

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
    featureLabel: 'Drawings & Images',
    featureLabelSingular: 'Drawing/Image',

    areaPluralLabel: 'Areas',
    areaSingularLabel: 'Area',
    addAreaCta: 'Add Area',

    pitchRequired: false,
    pitchOptional: true,
    pitchHidesValleyHip: true,
    pitchCheckboxLabel: 'Apply Angle/Slope calculation',
    pitchRafterLabel: 'Rise over run',
    areaPitchLabel: 'Pitch (°)',

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

  landscaping: {
    tradeLabel: 'Landscaping',
    featureLabel: 'Drawings & Images',
    featureLabelSingular: 'Drawing/Image',

    areaPluralLabel: 'Areas',
    areaSingularLabel: 'Area',
    addAreaCta: 'Add Area',

    pitchRequired: false,
    pitchOptional: true,
    pitchHidesValleyHip: true,
    pitchCheckboxLabel: 'Apply Angle/Slope calculation',
    pitchRafterLabel: 'Rise over run',
    areaPitchLabel: 'Gradient (°)',

    createAreaModalTitle: 'Create Area',
    areaNamePlaceholder: 'e.g. Front Garden, Driveway, Patio',

    areaIsOptional: true,
    firstAreaInstructionsTitle: 'Define Your Job Areas',
    firstAreaInstructionsBody:
      'You can draw areas to break the job into zones (garden beds, paving, driveway, lawn). ' +
      'Or skip this and measure paths, edging, and items directly.',
    firstAreaConfirmCta: 'Yes, add an area',
    toolGuidanceNote:
      'Use the Area tool for gardens, lawns, paving, and decking. ' +
      'Use the Line / Multi-Line tools for paths, edging, retaining walls, and fence lines. ' +
      'Use the Curved Line tool for curved garden edges or winding paths. ' +
      'Use Point for trees, planters, fittings, and items priced per unit.',

    needAreaPrompt: 'Do you want to define a job area first?',
    optionalAreaConfirmCta: 'Yes, add an area',
    skipAreaCta: 'No, skip',

    builderStepLabel: 'Areas',
    emptyAreaGuardMessage:
      'A quote needs at least one component before it can be saved. ' +
      "We'll take you back so you can add one.",

    customerQuoteSectionLabel: 'Landscaping Works',

    measurementTypeLabels: {
      multi_lineal:    'Multiple Lines',
      curved_line:     'Curved Line',
      hours_days:      'Hours / Days',
      count:           'Count',
      volume:          'Volume',
      irregular_area:  'Irregular Area',
    },
  },

  flooring: {
    tradeLabel: 'Flooring',
    featureLabel: 'Drawings & Images',
    featureLabelSingular: 'Drawing/Image',

    areaPluralLabel: 'Areas',
    areaSingularLabel: 'Area',
    addAreaCta: 'Add Area',

    pitchRequired: false,
    pitchOptional: true,
    pitchHidesValleyHip: true,
    pitchCheckboxLabel: 'Apply Angle/Slope calculation',
    pitchRafterLabel: 'Rise over run',
    areaPitchLabel: 'Fall / Gradient (°)',

    createAreaModalTitle: 'Create Area',
    areaNamePlaceholder: 'e.g. Living Room, Hallway, Kitchen',

    areaIsOptional: true,
    firstAreaInstructionsTitle: 'Define Your Floor Areas',
    firstAreaInstructionsBody:
      'Draw each floor area you are quoting (room by room, or as a single open zone). ' +
      'Or skip this and measure components directly.',
    firstAreaConfirmCta: 'Yes, add an area',
    toolGuidanceNote:
      'Use the Area tool for room floor areas. ' +
      'Use the Line / Multi-Line tools for skirting, edge trims, and transition strips. ' +
      'Use Point for fittings and items priced per unit.',

    needAreaPrompt: 'Do you want to measure a floor area first?',
    optionalAreaConfirmCta: 'Yes, add an area',
    skipAreaCta: 'No, skip',

    builderStepLabel: 'Areas',
    emptyAreaGuardMessage:
      'A quote needs at least one component before it can be saved. ' +
      "We'll take you back so you can add one.",

    customerQuoteSectionLabel: 'Flooring Works',

    measurementTypeLabels: {
      multi_lineal:    'Multiple Trim Runs',
      curved_line:     'Curved Trim Run',
      hours_days:      'Hours / Days',
      count:           'Count',
      volume:          'Volume (screed / levelling)',
      irregular_area:  'Irregular Floor Area',
    },
  },

  tiling: {
    tradeLabel: 'Tiling',
    featureLabel: 'Drawings & Images',
    featureLabelSingular: 'Drawing/Image',

    areaPluralLabel: 'Areas',
    areaSingularLabel: 'Area',
    addAreaCta: 'Add Area',

    pitchRequired: false,
    pitchOptional: true,
    pitchHidesValleyHip: true,
    pitchCheckboxLabel: 'Apply Angle/Slope calculation',
    pitchRafterLabel: 'Rise over run',
    areaPitchLabel: 'Fall / Gradient (°)',

    createAreaModalTitle: 'Create Area',
    areaNamePlaceholder: 'e.g. Bathroom, Kitchen Splashback',

    areaIsOptional: true,
    firstAreaInstructionsTitle: 'Define Your Tiling Areas',
    firstAreaInstructionsBody:
      'Draw your tiling areas - floor zones from a plan, or walls measured directly. ' +
      'For wall tiling from a floor plan, use the Line / Multi-Line tools with components ' +
      'set up as Wall Length × Height.',
    firstAreaConfirmCta: 'Yes, add an area',
    toolGuidanceNote:
      'Use the Area tool for floor tiling and direct elevation plans. ' +
      'Use the Line / Multi-Line tools for wall runs in plan view ' +
      '(set components to Wall Length × Height). ' +
      'Use Point for fittings and items priced per unit.',

    needAreaPrompt: 'Do you want to measure a tiling area first?',
    optionalAreaConfirmCta: 'Yes, add an area',
    skipAreaCta: 'No, skip',

    builderStepLabel: 'Areas',
    emptyAreaGuardMessage:
      'A quote needs at least one component before it can be saved. ' +
      "We'll take you back so you can add one.",

    customerQuoteSectionLabel: 'Tiling Works',

    measurementTypeLabels: {
      multi_lineal_lxh: 'Wall Length × Height',
      length_x_height:  'Wall Height × Length',
      multi_lineal:     'Multiple Trim Runs',
      curved_line:      'Curved Trim Run',
      hours_days:       'Hours / Days',
      count:            'Count',
      irregular_area:   'Irregular Area',
    },
  },

  foundations: {
    tradeLabel: 'Foundations',
    featureLabel: 'Drawings & Images',
    featureLabelSingular: 'Drawing/Image',

    areaPluralLabel: 'Areas',
    areaSingularLabel: 'Area',
    addAreaCta: 'Add Area',

    pitchRequired: false,
    pitchOptional: true,
    pitchHidesValleyHip: true,
    pitchCheckboxLabel: 'Apply Angle/Slope calculation',
    pitchRafterLabel: 'Rise over run',
    areaPitchLabel: 'Gradient (°)',

    createAreaModalTitle: 'Create Area',
    areaNamePlaceholder: 'e.g. Main Slab, Garage Footing',

    areaIsOptional: true,
    firstAreaInstructionsTitle: 'Define Your Foundation Areas',
    firstAreaInstructionsBody:
      'Draw the slab outline or excavation footprint. ' +
      'Use the Line tools to trace footings, beams, and the perimeter directly.',
    firstAreaConfirmCta: 'Yes, add an area',
    toolGuidanceNote:
      'Use the Area tool for slab footprints and excavation zones. ' +
      'Use the Line / Multi-Line tools for footings, ring beams, and perimeter runs. ' +
      'Use Point for piers, pads, and items priced per unit.',

    needAreaPrompt: 'Do you want to measure a slab or excavation area first?',
    optionalAreaConfirmCta: 'Yes, add an area',
    skipAreaCta: 'No, skip',

    builderStepLabel: 'Areas',
    emptyAreaGuardMessage:
      'A quote needs at least one component before it can be saved. ' +
      "We'll take you back so you can add one.",

    customerQuoteSectionLabel: 'Foundation Works',

    measurementTypeLabels: {
      multi_lineal:    'Multiple Footings',
      curved_line:     'Curved Footing',
      hours_days:      'Hours / Days',
      count:           'Count',
      volume:          'Volume (concrete / excavation)',
      irregular_area:  'Irregular Slab Area',
    },
  },

  insulation: {
    tradeLabel: 'Insulation',
    featureLabel: 'Drawings & Images',
    featureLabelSingular: 'Drawing/Image',

    areaPluralLabel: 'Areas',
    areaSingularLabel: 'Area',
    addAreaCta: 'Add Area',

    pitchRequired: false,
    pitchOptional: true,
    pitchHidesValleyHip: true,
    pitchCheckboxLabel: 'Apply Angle/Slope calculation',
    pitchRafterLabel: 'Rise over run',
    areaPitchLabel: 'Pitch (°)',

    createAreaModalTitle: 'Create Area',
    areaNamePlaceholder: 'e.g. Ceiling, Loft, Wall North',

    areaIsOptional: true,
    firstAreaInstructionsTitle: 'Define Your Insulation Areas',
    firstAreaInstructionsBody:
      'Draw each area you are insulating - ceiling, floor, or walls. ' +
      'For wall insulation from a floor plan use the Line / Multi-Line tools with ' +
      'components set up as Wall Length × Height.',
    firstAreaConfirmCta: 'Yes, add an area',
    toolGuidanceNote:
      'Use the Area tool for ceiling, floor, and elevation areas. ' +
      'Use the Line / Multi-Line tools for wall insulation in plan view ' +
      '(set components to Wall Length × Height). ' +
      'Enable rafter pitch on roof / loft components that follow the slope.',

    needAreaPrompt: 'Do you want to measure an insulation area first?',
    optionalAreaConfirmCta: 'Yes, add an area',
    skipAreaCta: 'No, skip',

    builderStepLabel: 'Areas',
    emptyAreaGuardMessage:
      'A quote needs at least one component before it can be saved. ' +
      "We'll take you back so you can add one.",

    customerQuoteSectionLabel: 'Insulation Works',

    measurementTypeLabels: {
      multi_lineal_lxh: 'Wall Length × Height',
      length_x_height:  'Wall Height × Length',
      multi_lineal:     'Multiple Edge Runs',
      hours_days:       'Hours / Days',
      count:            'Count (bags / rolls / batts)',
      irregular_area:   'Irregular Area',
    },
  },

  painting: {
    tradeLabel: 'Painting',
    featureLabel: 'Drawings & Images',
    featureLabelSingular: 'Drawing/Image',

    areaPluralLabel: 'Areas',
    areaSingularLabel: 'Area',
    addAreaCta: 'Add Area',

    pitchRequired: false,
    pitchOptional: true,
    pitchHidesValleyHip: true,
    pitchCheckboxLabel: 'Apply Angle/Slope calculation',
    pitchRafterLabel: 'Rise over run',
    areaPitchLabel: 'Pitch (°)',

    createAreaModalTitle: 'Create Area',
    areaNamePlaceholder: 'e.g. Living Room, External North Wall',

    areaIsOptional: true,
    firstAreaInstructionsTitle: 'Define Your Painting Areas',
    firstAreaInstructionsBody:
      'Draw each area you are painting - ceiling, walls, or external elevations. ' +
      'For wall painting from a floor plan use the Line / Multi-Line tools with ' +
      'components set up as Wall Length × Height.',
    firstAreaConfirmCta: 'Yes, add an area',
    toolGuidanceNote:
      'Use the Area tool for ceilings and direct elevation plans. ' +
      'Use the Line / Multi-Line tools for walls in plan view ' +
      '(set components to Wall Length × Height). ' +
      'Use the Line tools for skirtings, architraves, and trim.',

    needAreaPrompt: 'Do you want to measure a painting area first?',
    optionalAreaConfirmCta: 'Yes, add an area',
    skipAreaCta: 'No, skip',

    builderStepLabel: 'Areas',
    emptyAreaGuardMessage:
      'A quote needs at least one component before it can be saved. ' +
      "We'll take you back so you can add one.",

    customerQuoteSectionLabel: 'Painting Works',

    measurementTypeLabels: {
      multi_lineal_lxh: 'Wall Length × Height',
      length_x_height:  'Wall Height × Length',
      multi_lineal:     'Multiple Trim Runs',
      curved_line:      'Curved Trim Run',
      hours_days:       'Hours / Days',
      count:            'Count',
      irregular_area:   'Irregular Area',
    },
  },

  fencing: {
    tradeLabel: 'Fencing',
    featureLabel: 'Drawings & Images',
    featureLabelSingular: 'Drawing/Image',

    areaPluralLabel: 'Areas',
    areaSingularLabel: 'Area',
    addAreaCta: 'Add Area',

    pitchRequired: false,
    pitchOptional: true,
    pitchHidesValleyHip: true,
    pitchCheckboxLabel: 'Apply Angle/Slope calculation',
    pitchRafterLabel: 'Rise over run',
    areaPitchLabel: 'Gradient (°)',

    createAreaModalTitle: 'Create Area',
    areaNamePlaceholder: 'e.g. Boundary, Paddock',

    areaIsOptional: true,
    firstAreaInstructionsTitle: 'Define Your Fencing Job',
    firstAreaInstructionsBody:
      'For most fencing jobs you can skip the area step and measure fence runs directly. ' +
      'Or draw an area first if you want to record the enclosed zone.',
    firstAreaConfirmCta: 'Yes, add an area',
    toolGuidanceNote:
      'Use the Line / Multi-Line tools for fence runs. ' +
      'Use the Curved Line tool for curved boundaries. ' +
      'Use Point for posts, gates, and fittings priced per unit.',

    needAreaPrompt: 'Do you want to define an area first?',
    optionalAreaConfirmCta: 'Yes, add an area',
    skipAreaCta: 'No, skip',

    builderStepLabel: 'Areas',
    emptyAreaGuardMessage:
      'A quote needs at least one component before it can be saved. ' +
      "We'll take you back so you can add one.",

    customerQuoteSectionLabel: 'Fencing Works',

    measurementTypeLabels: {
      multi_lineal:     'Multiple Fence Runs',
      multi_lineal_lxh: 'Panel Length × Height',
      length_x_height:  'Panel Height × Length',
      curved_line:      'Curved Fence Run',
      hours_days:       'Hours / Days',
      count:            'Count (posts / gates)',
      irregular_area:   'Irregular Area',
    },
  },

  concrete: {
    tradeLabel: 'Concrete',
    featureLabel: 'Drawings & Images',
    featureLabelSingular: 'Drawing/Image',

    areaPluralLabel: 'Areas',
    areaSingularLabel: 'Area',
    addAreaCta: 'Add Area',

    pitchRequired: false,
    pitchOptional: true,
    pitchHidesValleyHip: true,
    pitchCheckboxLabel: 'Apply Angle/Slope calculation',
    pitchRafterLabel: 'Rise over run',
    areaPitchLabel: 'Fall / Gradient (°)',

    createAreaModalTitle: 'Create Area',
    areaNamePlaceholder: 'e.g. Driveway, Garage Slab, Patio',

    areaIsOptional: true,
    firstAreaInstructionsTitle: 'Define Your Concrete Areas',
    firstAreaInstructionsBody:
      'Draw the slab or pour outline. ' +
      'Use the Line tools to trace kerbs, edges, expansion joints, and sawn cuts directly.',
    firstAreaConfirmCta: 'Yes, add an area',
    toolGuidanceNote:
      'Use the Area tool for slab footprints. ' +
      'Use the Line / Multi-Line tools for kerbs, edge restraints, joints, and sawn cuts. ' +
      'Use the Curved Line tool for curved kerbs and edges. ' +
      'Use Point for items priced per unit.',

    needAreaPrompt: 'Do you want to measure a slab area first?',
    optionalAreaConfirmCta: 'Yes, add an area',
    skipAreaCta: 'No, skip',

    builderStepLabel: 'Areas',
    emptyAreaGuardMessage:
      'A quote needs at least one component before it can be saved. ' +
      "We'll take you back so you can add one.",

    customerQuoteSectionLabel: 'Concrete Works',

    measurementTypeLabels: {
      multi_lineal:    'Multiple Kerb / Edge Runs',
      curved_line:     'Curved Kerb / Edge',
      hours_days:      'Hours / Days',
      count:           'Count',
      volume:          'Volume (concrete pour)',
      irregular_area:  'Irregular Slab Area',
    },
  },

  solar: {
    tradeLabel: 'Solar',
    featureLabel: 'Drawings & Images',
    featureLabelSingular: 'Drawing/Image',

    areaPluralLabel: 'Areas',
    areaSingularLabel: 'Area',
    addAreaCta: 'Add Area',

    pitchRequired: false,
    pitchOptional: true,
    pitchHidesValleyHip: true,
    pitchCheckboxLabel: 'Apply Angle/Slope calculation',
    pitchRafterLabel: 'Rise over run',
    areaPitchLabel: 'Tilt (°)',

    createAreaModalTitle: 'Create Area',
    areaNamePlaceholder: 'e.g. Main Roof, North Array, Carport',

    areaIsOptional: true,
    firstAreaInstructionsTitle: 'Define Your Installation Areas',
    firstAreaInstructionsBody:
      'Draw each area where panels or equipment will be installed. ' +
      'Or skip this and measure runs and items directly.',
    firstAreaConfirmCta: 'Yes, add an area',
    toolGuidanceNote:
      'Use the Area tool for roof or ground-mount panel arrays. ' +
      'Use the Line / Multi-Line tools for cable and conduit runs. ' +
      'Use Point for inverters, isolators, meters, and items priced per unit.',

    needAreaPrompt: 'Do you want to define an installation area first?',
    optionalAreaConfirmCta: 'Yes, add an area',
    skipAreaCta: 'No, skip',

    builderStepLabel: 'Areas',
    emptyAreaGuardMessage:
      'A quote needs at least one component before it can be saved. ' +
      "We'll take you back so you can add one.",

    customerQuoteSectionLabel: 'Solar Installation',

    measurementTypeLabels: {
      multi_lineal:  'Multiple Cable / Conduit Runs',
      curved_line:   'Curved Cable Run',
      hours_days:    'Hours / Days',
      count:         'Count (panels / inverters / fittings)',
      volume:        'Volume',
    },
  },

  construction: {
    tradeLabel: 'Construction',
    featureLabel: 'Drawings & Images',
    featureLabelSingular: 'Drawing/Image',

    areaPluralLabel: 'Areas',
    areaSingularLabel: 'Area',
    addAreaCta: 'Add Area',

    pitchRequired: false,
    pitchOptional: true,
    pitchHidesValleyHip: true,
    pitchCheckboxLabel: 'Apply Angle/Slope calculation',
    pitchRafterLabel: 'Rise over run',
    areaPitchLabel: 'Pitch (°)',

    createAreaModalTitle: 'Create Area',
    areaNamePlaceholder: 'e.g. Zone A, Ground Floor, Extension',

    areaIsOptional: true,
    firstAreaInstructionsTitle: 'Define Your Areas',
    firstAreaInstructionsBody:
      'For area-based components you can draw an area now. ' +
      'For lineal or count-based work you can skip this and measure directly.',
    firstAreaConfirmCta: 'Yes, add an area',
    toolGuidanceNote:
      'Use the Area tool for room or zone outlines. ' +
      'Use the Line / Multi-Line tools for lineal runs (footings, framing, trim, fence lines). ' +
      'Use the Curved Line tool for curved paths or edges. ' +
      'Use Point for items priced per unit. ' +
      'Enable pitch on individual components when measuring roof work from plan view.',

    needAreaPrompt: 'Do you want to measure an area first?',
    optionalAreaConfirmCta: 'Yes, add an area',
    skipAreaCta: 'No, skip',

    builderStepLabel: 'Areas',
    emptyAreaGuardMessage:
      'A quote needs at least one area and one main component before it can be saved. ' +
      "We'll take you back to Areas so you can add one.",

    customerQuoteSectionLabel: 'Construction Works',

    measurementTypeLabels: {},
  },
};

/**
 * Safe accessor: falls back to roofing labels for unknown / legacy trade
 * values so a stale database row never breaks the UI.
 */
export function getTradeLabels(trade?: string | null): TradeLabels {
  if (trade === 'cladding')     return TRADE_LABELS.cladding;
  if (trade === 'generic')      return TRADE_LABELS.generic;
  if (trade === 'electrical')   return TRADE_LABELS.electrical;
  if (trade === 'plumbing')     return TRADE_LABELS.plumbing;
  if (trade === 'landscaping')  return TRADE_LABELS.landscaping;
  if (trade === 'flooring')     return TRADE_LABELS.flooring;
  if (trade === 'tiling')       return TRADE_LABELS.tiling;
  if (trade === 'foundations')  return TRADE_LABELS.foundations;
  if (trade === 'insulation')   return TRADE_LABELS.insulation;
  if (trade === 'painting')     return TRADE_LABELS.painting;
  if (trade === 'fencing')      return TRADE_LABELS.fencing;
  if (trade === 'concrete')     return TRADE_LABELS.concrete;
  if (trade === 'construction') return TRADE_LABELS.construction;
  if (trade === 'solar')        return TRADE_LABELS.solar;
  return TRADE_LABELS.roofing;
}
