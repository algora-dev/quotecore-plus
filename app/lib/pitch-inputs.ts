/**
 * Pitch input mode utilities.
 *
 * Pitch is always STORED as degrees in the database. This module provides
 * conversion helpers so the UI can offer three input modes:
 *
 *  - degrees  (°)           — angle from horizontal
 *  - ratio    (1:X)         — rise : run, e.g. 1:12 (roofing), 1:50 (drainage)
 *  - gradient (%)           — rise / run × 100, e.g. 2 % (landscaping, concrete)
 *
 * All three convert to the same underlying `pitch_degrees` for storage and
 * calculation. No DB migration needed.
 */

export type PitchInputMode = 'degrees' | 'ratio' | 'gradient';

export const PITCH_INPUT_MODE_LABELS: Record<PitchInputMode, string> = {
  degrees: 'Angle (°)',
  ratio: 'Ratio (1:X)',
  gradient: 'Gradient (%)',
};

/**
 * Convert a value entered in the given mode to degrees.
 *
 * @param mode  Input mode
 * @param value Numeric value the user entered (rise for ratio, percent for gradient, degrees for degrees)
 * @returns degrees as a number, or null if value is invalid / zero
 */
export function toDegrees(mode: PitchInputMode, value: number): number | null {
  if (!Number.isFinite(value) || value <= 0) return null;
  switch (mode) {
    case 'degrees':
      return Math.min(value, 80); // clamp same as before
    case 'ratio': {
      // value = X in 1:X → degrees = atan(1 / X)
      const deg = Math.atan(1 / value) * (180 / Math.PI);
      return Math.min(deg, 80);
    }
    case 'gradient': {
      // value = percent → degrees = atan(value / 100)
      const deg = Math.atan(value / 100) * (180 / Math.PI);
      return Math.min(deg, 80);
    }
  }
}

/**
 * Convert degrees back to the given mode for display.
 */
export function fromDegrees(mode: PitchInputMode, degrees: number | null | undefined): string {
  if (degrees == null || degrees <= 0) return '';
  switch (mode) {
    case 'degrees':
      return degrees.toFixed(1).replace(/\.0$/, '');
    case 'ratio': {
      // degrees → ratio 1:X → X = 1 / tan(deg)
      const x = 1 / Math.tan(degrees * (Math.PI / 180));
      return x.toFixed(x < 10 ? 1 : 0).replace(/\.0$/, '');
    }
    case 'gradient': {
      // degrees → percent = tan(deg) × 100
      const pct = Math.tan(degrees * (Math.PI / 180)) * 100;
      return pct.toFixed(pct < 10 ? 1 : 0).replace(/\.0$/, '');
    }
  }
}

/**
 * Placeholder text for the input field in each mode.
 */
export function pitchPlaceholder(mode: PitchInputMode): string {
  switch (mode) {
    case 'degrees':
      return 'e.g. 25';
    case 'ratio':
      return 'e.g. 12 (for 1:12)';
    case 'gradient':
      return 'e.g. 2 (for 2%)';
  }
}

/**
 * Suffix label shown next to the input.
 */
export function pitchSuffix(mode: PitchInputMode): string {
  switch (mode) {
    case 'degrees':
      return '°';
    case 'ratio':
      return '1:X';
    case 'gradient':
      return '%';
  }
}
