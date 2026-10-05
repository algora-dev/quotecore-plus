/** Pure demo presentation contracts. No auth, permissions or pricing changes. */
import { DEMO_GUIDE_CHAPTERS, guideHref, nextGuideStep } from './guide';
import type { DemoGuideState } from './model';
export type DemoSystem = 'metric' | 'imperial_ft' | 'imperial_rs';
export const DEMO_SYSTEMS: { id: DemoSystem; title: string; symbol: string; detail: string }[] = [
  { id: 'metric', title: 'Metric', symbol: 'm · m²', detail: 'Metres and square metres' },
  { id: 'imperial_ft', title: 'Imperial', symbol: 'ft · ft²', detail: 'Feet and square feet' },
  { id: 'imperial_rs', title: 'Roofing squares', symbol: 'ft · RS', detail: 'Feet and roofing squares (100 ft² each)' },
];
export function isDemoSystem(value: unknown): value is DemoSystem {
  return DEMO_SYSTEMS.some(system => system.id === value);
}
export function demoSystemLabel(value?: DemoSystem) { return DEMO_SYSTEMS.find(item => item.id === value)?.title ?? 'Your chosen units'; }
export type DemoComponentSurface = { kind: 'create' | 'edit' | 'test' | 'closed'; componentId?: string };
export function readComponentSurface(value: unknown): DemoComponentSurface | null {
  if (!value || typeof value !== 'object') return null;
  const data = value as Record<string, unknown>;
  if (!['create', 'edit', 'test', 'closed'].includes(String(data.kind))) return null;
  return { kind: data.kind as DemoComponentSurface['kind'], ...(typeof data.componentId === 'string' ? { componentId: data.componentId } : {}) };
}
export function guideLocation(slug: string, state: DemoGuideState, pathname: string, surface: DemoComponentSurface | null) {
  const step = nextGuideStep(state);
  const href = guideHref(slug, state);
  const path = href.split('?')[0];
  const root = `/${encodeURIComponent(slug)}`;
  const editor = state.seed.guided_roof_job ? `${root}/quotes/${state.seed.guided_roof_job}/customer-edit` : '';
  let onPage = pathname === path;
  if (step?.target === 'assistant') onPage = (pathname === root || pathname.startsWith(`${root}/`)) && pathname !== `${root}/assistant` && pathname !== `${root}/account/smart-assistant`;
  if (step?.event === 'email.sent') onPage = pathname === path || (!!editor && pathname === editor);
  let ready = onPage;
  if (onPage && step?.target === 'components') {
    ready = step.event === 'component.created' ? surface?.kind === 'create'
      : step.event === 'component.tested' ? (surface?.kind === 'test' || surface?.kind === 'edit') && surface.componentId === state.guided_created_component_id
      : surface?.kind === 'edit' && surface.componentId === state.seed.maintenance_component;
  }
  return { href, path, onPage, ready, inCustomerEditor: !!editor && pathname === editor };
}
/** Complete Takeoff naturally lands in the editor. Resume that transition even
 * after a refresh; it must not depend on a transient celebration-card flag. */
export function shouldAdvanceToCustomer(slug: string, state: DemoGuideState, pathname: string): boolean {
  return state.mode === 'guided' && state.chapter === 'takeoff' && !!state.acknowledgements['takeoff.saved']
    && pathname === `/${encodeURIComponent(slug)}/quotes/${state.seed.guided_roof_job}/customer-edit`;
}
export function acceptGuideRevision(current: DemoGuideState, incoming: DemoGuideState): DemoGuideState {
  return incoming.revision >= current.revision ? incoming : current;
}
export function chapterOutcome(state: DemoGuideState, chapter: typeof DEMO_GUIDE_CHAPTERS[number]) {
  const done = chapter.steps.filter(step => !!state.acknowledgements[step.event]).length;
  const skipped = chapter.steps.filter(step => !state.acknowledgements[step.event] && !!state.skipped?.[step.event]).length;
  return { done, skipped, total: chapter.steps.length, finished: done + skipped === chapter.steps.length };
}
export function clampGuidePosition(position: { x: number; y: number }, width: number, height: number, viewportWidth: number, viewportHeight: number) {
  const margin = 12;
  return { x: Math.max(margin, Math.min(position.x, viewportWidth - width - margin)), y: Math.max(margin, Math.min(position.y, viewportHeight - height - margin)) };
}
export function assistantExample(event: string | undefined, units: DemoSystem) {
  if (event === 'assistant.edited') return units === 'metric' ? 'Change the ridge to 6 m and add 12 m of gutter.' : 'Change the ridge to 20 ft and add 40 ft of gutter.';
  if (event === 'assistant.found') return 'Do I have any accepted quotes without a material order?';
  if (units === 'metric') return 'Create a roof quote for Jim Smith — 180 m² roof on the plan, 25° pitch, 5 hips at 4 m and 1 ridge at 2 m, using the roofing library.';
  if (units === 'imperial_rs') return 'Create a roof quote for Jim Smith — 19.4 roofing squares on the plan, 25° pitch, 5 hips at 13 ft and 1 ridge at 6.5 ft, using the roofing library.';
  return 'Create a roof quote for Jim Smith — 1,940 ft² roof on the plan, 25° pitch, 5 hips at 13 ft and 1 ridge at 6.5 ft, using the roofing library.';
}
