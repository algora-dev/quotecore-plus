export type DrawMode = 'none' | 'line' | 'text' | 'edit' | 'adjustPoints' | 'draw';
export type CanvasSize = 'small' | 'medium' | 'large';

export const CANVAS_SIZES = {
  small: { width: 600, height: 450, maxMm: '300mm x 225mm' },
  medium: { width: 800, height: 600, maxMm: '400mm x 300mm' },
  large: { width: 1200, height: 900, maxMm: '600mm x 450mm' },
};

export const SCALE = 0.5; // 2 pixels = 1mm
export const MM_PER_INCH = 25.4;

/**
 * Format a length stored in mm for display in either mm or inches.
 * Metric accounts: `120` -> `"120"`. Imperial accounts: `120` -> `"4.72"`.
 * Lengths are stored canonical in mm; the conversion happens at the
 * display + input boundaries only.
 */
export function formatLength(mm: number, unit: 'mm' | 'in'): string {
  if (unit === 'mm') return String(Math.round(mm));
  return (mm / MM_PER_INCH).toFixed(2);
}

/**
 * Inverse of `formatLength`. Takes whatever the user typed in the active
 * unit and returns the canonical mm value for storage / pixel math.
 */
export function lengthInputToMm(value: number, unit: 'mm' | 'in'): number {
  if (unit === 'mm') return value;
  return value * MM_PER_INCH;
}

/**
 * Loose shape of the JSONB blob fabric.js saves into `flashings.canvas_data`
 * and `flashings.measurements`. The columns are typed `Json` by the
 * generated DB types (correct - Postgres can hold any JSON there); this
 * narrowed view is what our app code actually expects to see when loading
 * a saved drawing. Cast at the boundary, then operate normally.
 */
export type FabricCanvasData = {
  objects?: unknown[];
  width?: number;
  height?: number;
  version?: string;
  [key: string]: unknown;
} | null;

export type StoredMeasurement = MeasurementItem & {
  pointIndices?: number[];
};

export interface MeasurementItem {
  id: string;
  type: 'length' | 'angle';
  value: number;
  originalValue: number;
  visible: boolean;
  textHidden?: boolean;
  arcHidden?: boolean; // Angle arc circle hidden by default
  labelObjectId?: string;
  // For angles
  interiorValue?: number;
  exteriorValue?: number;
  showInterior?: boolean;
  // Whether the applied angle is internal (<180°), external (>180°), or straight (=180°)
  angleType?: 'internal' | 'external' | 'straight';
  // For placement and repositioning
  placementSide?: 'interior' | 'exterior';
  // Store line endpoints for length label repositioning AND point indices
  lineStart?: { x: number; y: number };
  lineEnd?: { x: number; y: number };
  lineStartIndex?: number; // Index in linePoints array
  lineEndIndex?: number;   // Index in linePoints array
  // For angles - store the point index this angle is at
  pointIndex?: number;
  adjacentLineIndices?: number[]; // Indices of connected line measurements
}

export interface _CanvasState {
  canvasJSON: string;
  measurements: MeasurementItem[];
}
