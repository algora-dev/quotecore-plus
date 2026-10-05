/** Presentation-only handoff. The destination API has already re-authorised the
 * stored card's parent/child. This event cannot read records or perform edits.
 */
import { isUuid } from './contracts';
export const COMPONENT_FOCUS_EVENT = 'quotecore:assistant-component-focus';
export function componentFocusId(search: string): string | null {
  const values = new URLSearchParams(search).getAll('sa_component');
  return values.length === 1 && isUuid(values[0]) ? values[0] : null;
}
export function notifyComponentFocus(): void {
  if (typeof window !== 'undefined' && componentFocusId(window.location.search)) window.dispatchEvent(new Event(COMPONENT_FOCUS_EVENT));
}
