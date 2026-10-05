import type { ResultAction, ResultActions } from './types';
import { safeNavigationHref } from './persistence';
export function actionHref(action: ResultAction, options: ResultActions): string | undefined {
  const href = options.links?.[action];
  return typeof href === 'string' && safeNavigationHref(href) ? href : undefined;
}
export function toolAction(trade: ResultActions['trade']): ResultAction {
  return trade === 'cladding' ? 'takeoff-cladding' : trade === 'flooring' ? 'takeoff-flooring' : 'takeoff-roofing';
}
export function validSetupRange(range: ResultActions['setupRange']): boolean {
  return !!range && ['USD','NZD'].includes(range.currency) && Number.isSafeInteger(range.minCents) && Number.isSafeInteger(range.maxCents) && range.minCents >= 0 && range.maxCents >= range.minCents;
}
