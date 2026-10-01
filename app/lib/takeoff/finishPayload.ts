/**
 * Shared finish-payload contract for takeoff surfaces that emit a completed
 * takeoff as data instead of navigating into the app's quote-build step.
 *
 * Structural clone of the free-tool output contract (DemoFinishPayload) so
 * TakeoffOutputView and future MCP surfaces can consume either. unitSystem
 * and componentSpecs are added by the emitting surface when known (the
 * workstation itself only owns canvas state).
 */

export interface TakeoffFinishPayload {
  roofAreas: { id: string; name: string; area: number; pitch: number }[];
  componentGroups: Array<{
    componentId: string;
    name: string;
    isSystem: boolean;
    semantic: string | null;
    count: number;
    total: number;
    measurementType?: string;
    measurements: { value: number; quoteRoofAreaId?: string | null }[];
  }>;
  calibrationUnit: string;
  /** Unit system chosen at entry (metric / imperial / squares). */
  unitSystem?: 'metric' | 'imperial' | 'squares';
  /** User-built component specs from the entry wizard (free tool). */
  componentSpecs?: Array<{
    id: string;
    name: string;
    measurementType: 'lineal' | 'area' | 'quantity';
    materialRate: number;
    labourRate: number;
    wasteType: string;
    wasteValue: number;
    pitchEnabled: boolean;
  }>;
}
