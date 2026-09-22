import type { Point } from '../calibrationTypes';

// Presentation steps only. Accepted references/scales remain exclusively in
// calibrationSession; releasing a drag must NEVER advance these steps.
export type TouchCalibrationStep = 'find' | 'start' | 'end' | 'distance' | 'references' | 'ai';
export function canPlaceCalibrationPoint(step: TouchCalibrationStep, count: number): boolean {
  return (step === 'start' && count === 0) || (step === 'end' && count === 1);
}
export function canEditCalibrationPoints(step: TouchCalibrationStep): boolean {
  return step === 'start' || step === 'end';
}
export function pointIsOnPlan(point: Point, scene: { width: number; height: number }): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y) && point.x >= 0 && point.y >= 0 && point.x <= scene.width && point.y <= scene.height;
}
