import type { CalculatorAnswers, CalculatorCatalog } from './types';
import { hasPlans } from './routing';
import { isComplete } from './validation';
export type Screen = 'device' | 'workload' | 'measurements' | 'tools' | 'assistant' | 'review';
export const STAGES = ['Your day', 'Workload', 'Measurements', 'Your tools', 'Assistant'] as const;
export const stageFor = (screen: Screen): number => ({ device: 0, workload: 1, measurements: 2, tools: 3, assistant: 4, review: 5 })[screen];
/** Five questions for plan users; irrelevant digital tools are skipped for manual-only users.
 * Before methods are answered show the full potential journey. Result is never a question. */
export function questionScreensFor(a: CalculatorAnswers): Exclude<Screen, 'review'>[] {
  return ['device', 'workload', 'measurements', ...(!a.methods.length || hasPlans(a) ? ['tools' as const] : []), 'assistant'];
}
export function screensFor(a: CalculatorAnswers): Screen[] { return [...questionScreensFor(a), 'review']; }
export function progressFor(screen: Screen, a: CalculatorAnswers) {
  const questions = questionScreensFor(a);
  return { questions, total: questions.length, index: screen === 'review' ? questions.length : questions.indexOf(screen) };
}
export function adjacentScreen(screen: Screen, direction: -1 | 1, a: CalculatorAnswers): Screen {
  const screens = screensFor(a); const index = screens.indexOf(screen);
  return screens[Math.max(0, Math.min(screens.length - 1, index + direction))];
}
export function screenReady(screen: Screen, a: CalculatorAnswers, catalog: CalculatorCatalog): boolean {
  if (screen === 'device') return a.device !== null;
  if (screen === 'workload') return a.quotesPerMonth !== null && a.quotesPerMonth >= 1 && a.quotesPerMonth <= catalog.thresholds.maxInput;
  if (screen === 'measurements') return a.methods.length > 0;
  return isComplete(a, catalog);
}
