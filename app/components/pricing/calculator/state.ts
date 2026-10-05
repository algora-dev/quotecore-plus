import type { AssistantChoice, CalculatorAnswers, CalculatorCatalog, Device, MeasurementMethod, TierChoice } from './types';
import { normalizeAnswers } from './routing';
export const EMPTY_ANSWERS: CalculatorAnswers = { device: null, quotesPerMonth: null, methods: [], capacity: 'recommended', digital: 'recommended', scan: false, scanAllowance: 'recommended', offcuts: false, assistant: 'recommended' };
export type AnswerAction =
  | { type: 'device'; value: Device }
  | { type: 'quotes'; value: number | null }
  | { type: 'method'; value: MeasurementMethod }
  | { type: 'digital'; value: boolean }
  | { type: 'scan' | 'offcuts'; value: boolean }
  | { type: 'capacity' | 'scanAllowance'; value: TierChoice }
  | { type: 'assistant'; value: AssistantChoice }
  | { type: 'replace'; value: CalculatorAnswers };
export function answersReducer(a: CalculatorAnswers, action: AnswerAction): CalculatorAnswers {
  switch (action.type) {
    case 'device': return { ...a, device: action.value };
    case 'quotes': return normalizeAnswers({ ...a, quotesPerMonth: action.value });
    case 'method': return normalizeAnswers({ ...a, methods: a.methods.includes(action.value) ? a.methods.filter(m => m !== action.value) : [...a.methods, action.value] });
    case 'digital': return normalizeAnswers({ ...a, digital: action.value ? 'on' : 'off' });
    case 'scan': return normalizeAnswers({ ...a, scan: action.value });
    case 'offcuts': return normalizeAnswers({ ...a, offcuts: action.value });
    case 'capacity': return { ...a, capacity: action.value };
    case 'scanAllowance': return { ...a, scanAllowance: action.value };
    case 'assistant': return { ...a, assistant: action.value };
    case 'replace': return normalizeAnswers(action.value);
  }
}
/** Test fixtures, NOT public pricing shortcuts. */
export function presetAnswers(key: 'simple' | 'assisted', c: CalculatorCatalog): CalculatorAnswers {
  return key === 'simple'
    ? { ...EMPTY_ANSWERS, device: 'mixed', quotesPerMonth: Math.min(3, c.thresholds.lowMax), methods: ['existing'], assistant: 'none' }
    : { ...EMPTY_ANSWERS, device: 'mixed', quotesPerMonth: c.thresholds.mediumMax, methods: ['digital'], scan: true, offcuts: true };
}
