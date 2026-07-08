/**
 * Shared types for canvas reconstruction.
 * These are the minimal shapes needed by reconstructCanvas.ts.
 * They match the interfaces in TakeoffWorkstation.tsx but are kept separate
 * to avoid importing the full component.
 */

export interface CalibrationPoint {
  x: number;
  y: number;
}

export interface Calibration {
  id: string;
  point1: CalibrationPoint;
  point2: CalibrationPoint;
  pixelDistance: number;
  actualDistance: number;
  unit: 'feet' | 'meters';
  scale: number;
}

export interface RoofArea {
  id: string;
  name: string;
  points: { x: number; y: number }[];
  area: number;
  pitch: number;
  visible: boolean;
  polygon?: unknown;
  markers?: unknown[];
  /** Parent/child plans (2026-07-05): which takeoff page this polygon was drawn on. */
  fromPageId?: string | null;
}

export interface ComponentMeasurement {
  id: string;
  type: 'line' | 'area' | 'point' | 'multi_lineal' | 'multi_lineal_lxh' | 'volume_3d' | 'length_x_height_freestyle' | 'multi_lineal_lxh_freestyle';
  value: number;
  points?: { x: number; y: number }[];
  visible: boolean;
  canvasObjects?: unknown[];
  fromPageId?: string | null;
  /** Draw-time area stamp — must survive reconstruct/redraw round-trips. */
  quoteRoofAreaId?: string | null;
  /** v8 (2026-07-08): user-entered H/D reference — reconstructCanvas output
   *  REPLACES React state, so this must survive the round-trip or redraws
   *  strip it before save (the "H/D missing after area switch" bug). */
  entryInputs?: { height_m?: number | null; depth_m?: number | null } | null;
}
