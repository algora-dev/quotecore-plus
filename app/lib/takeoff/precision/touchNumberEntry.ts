// Touch-only number entry. Strings stay strings until explicit confirmation.
// No locale guessing, exponent notation, signs, or parseFloat prefix parsing.
export type NumberKey = `${number}` | '.' | 'backspace' | 'clear';
export const DEFAULT_ROOF_PITCH = 25;
export const DEFAULT_ROOF_NAME = 'Main Roof';
const MAX_DIGITS = 12;

export function editNumberText(value: string, key: NumberKey): string {
  if (key === 'clear') return '';
  if (key === 'backspace') return value.slice(0, -1);
  if (key === '.') return value.includes('.') ? value : `${value || '0'}.`;
  if (!/^\d$/.test(key) || value.replace('.', '').length >= MAX_DIGITS) return value;
  return value === '0' ? key : value + key;
}

export function parseRailNumber(value: string, kind: 'distance' | 'pitch'):
  { ok: true; value: number } | { ok: false; message: string } {
  if (!/^\d+(?:\.\d*)?$/.test(value)) return { ok: false, message: 'Enter a number using the keypad.' };
  const number = Number(value);
  if (!Number.isFinite(number)) return { ok: false, message: 'Enter a finite number.' };
  if (kind === 'distance' && number <= 0) return { ok: false, message: 'The distance must be greater than zero.' };
  if (kind === 'pitch' && (number < 0 || number >= 90)) return { ok: false, message: 'Pitch must be from 0 to less than 90 degrees.' };
  return { ok: true, value: number };
}

export function stepPitch(pitch: number, direction: -1 | 1): number {
  // Whole-degree taps also preserve a fractional value entered on the keypad.
  const next = Math.round((pitch + direction) * 1e9) / 1e9;
  return next >= 90 ? pitch : Math.max(0, next);
}
