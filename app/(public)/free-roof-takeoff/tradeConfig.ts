/**
 * Free takeoff tool trade configuration (TEMPLATE).
 *
 * This file is the template seam for forking the free takeoff tool into
 * other trades (cladding, etc.). A new trade fork = new config object +
 * a thin landing page. Everything downstream (workstation, report) reads
 * from here + the passed component list, so no fork edits are needed in
 * DemoWorkstation or TakeoffOutputView.
 *
 * Roofing is currently the only trade that uses pitch.
 */

export type TakeoffUnitSystem = 'metric' | 'imperial' | 'squares';

export interface TakeoffUnitOption {
  value: TakeoffUnitSystem;
  label: string;
  description: string;
  /** Length unit used for calibration + lineal measurements. */
  lengthUnit: 'meters' | 'feet';
  /** Area display unit in the report. */
  areaUnit: 'm2' | 'ft2' | 'squares';
}

export interface TakeoffPlaceholderComponent {
  id: string;
  name: string;
  measurement_type: 'lineal' | 'area' | 'quantity';
}

export interface TakeoffTradeConfig {
  /** URL slug of the tool page (used for back links + refs). */
  slug: string;
  /** Human trade name shown in copy. */
  tradeName: string;
  /** Whether areas need a pitch/slope entry. Roofing only, for now. */
  requiresPitch: boolean;
  /** Unit choices offered in step 1. */
  unitOptions: TakeoffUnitOption[];
  /** Default placeholder components offered in step 2. */
  placeholderComponents: TakeoffPlaceholderComponent[];
  /** Max custom components a guest can build before signup. */
  maxCustomComponents: number;
  /** Extra note line appended to the report footer. */
  reportNote: string | null;
}

/** Metric: lengths in m, areas in m2. */
const METRIC: TakeoffUnitOption = {
  value: 'metric', label: 'Metric', description: 'Lengths in metres, areas in m²',
  lengthUnit: 'meters', areaUnit: 'm2',
};

/** Imperial: lengths in ft, areas in ft². */
const IMPERIAL: TakeoffUnitOption = {
  value: 'imperial', label: 'Imperial', description: 'Lengths in feet, areas in ft²',
  lengthUnit: 'feet', areaUnit: 'ft2',
};

/** Roofing squares: lengths in ft (lineal feet), areas in roofing squares (1 sq = 100 ft²). */
const SQUARES: TakeoffUnitOption = {
  value: 'squares', label: 'Roofing Squares', description: 'Areas in squares (1 sq = 100 ft²), lengths in feet',
  lengthUnit: 'feet', areaUnit: 'squares',
};

export const ROOFING_TAKEOFF_CONFIG: TakeoffTradeConfig = {
  slug: 'free-roof-takeoff',
  tradeName: 'roofing',
  requiresPitch: true,
  unitOptions: [METRIC, IMPERIAL, SQUARES],
  placeholderComponents: [
    { id: 'd711bd93-2225-467e-8278-80f26c838b38', name: 'Hip', measurement_type: 'lineal' },
    { id: '538eac7a-d359-4c42-bff1-8c4957c7f4cc', name: 'Valley', measurement_type: 'lineal' },
    { id: 'de45e5d8-70b9-4827-95be-40a881dd5fcd', name: 'Ridge', measurement_type: 'lineal' },
    { id: '8f3a3e15-4497-480e-afaf-60c316a37de5', name: 'Barge', measurement_type: 'lineal' },
    { id: '99882053-bebc-427c-9450-b652a85ef665', name: 'Spouting', measurement_type: 'lineal' },
    { id: 'b2d33024-e32b-4809-b0ed-3b5e90babcba', name: 'Roof Area', measurement_type: 'area' },
    { id: '2e8bf4c9-553c-4aa2-b9a4-25248124df8a', name: 'Broken Hip', measurement_type: 'lineal' },
  ],
  maxCustomComponents: 7,
  reportNote:
    'Hip and valley entries are calculated as true lengths: the system derives the hip/valley pitch from the roof pitch you entered for each area.',
};

/** Resolve the unit option object for a chosen system (falls back to metric). */
export function resolveUnitOption(system: TakeoffUnitSystem, config: TakeoffTradeConfig): TakeoffUnitOption {
  return config.unitOptions.find(o => o.value === system) ?? config.unitOptions[0];
}
