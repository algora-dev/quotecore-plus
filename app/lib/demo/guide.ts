import type { DemoGuideChapter, DemoGuideState, DemoEvent } from './model';

export type DemoStep = {
  event: DemoEvent;
  title: string;
  copy: string;
  hint?: string;
  target: 'components' | 'takeoff' | 'customer' | 'job' | 'assistant';
};

/** Later chapters depend on the records these actions create. */
export const SKIP_REQUIRED_EVENTS: DemoEvent[] = ['component.created', 'component.tested', 'takeoff.saved'];

/** Keep the guided path deliberately short. Orientation belongs in the helper
 * copy; the visitor should spend time using QuoteCore+, not operating a tour. */
export const DEMO_GUIDE_CHAPTERS: { id: DemoGuideChapter; title: string; summary: string; steps: DemoStep[] }[] = [
  { id: 'pricing', title: 'Build your pricing', summary: 'Create one reusable pricing rule, test it, then update an existing price.', steps: [
    { event: 'component.created', title: 'Create one pricing component', target: 'components', copy: 'Create an Area component, give it any name and add simple material + labour pricing. Save it when you’re done.', hint: 'We’ll use this exact component on the roof in the next chapter.' },
    { event: 'component.tested', title: 'Test the calculation', target: 'components', copy: 'Open the component you just created and choose Test Component. Run the suggested example to see the real cost breakdown.', hint: 'Testing proves the pricing rule works before you reuse it on a job.' },
    { event: 'component.edited', title: 'Update an existing price', target: 'components', copy: 'Open the seeded Roof covering component, change one material price and save.', hint: 'One library change can be reused on future quotes.' },
  ] },
  { id: 'takeoff', title: 'Measure the job', summary: 'Use the prepared roof plan, then save your real final canvas.', steps: [
    { event: 'takeoff.saved', title: 'Add your component to the roof', target: 'takeoff', copy: 'The prepared roof is already measured. Add the component you created, draw one rectangle on the roof, then save the takeoff.', hint: 'After the rectangle is added you can freely change anything. The quote uses whatever you actually save.' },
  ] },
  { id: 'customer-quote', title: 'Prepare the customer quote', summary: 'Turn the measured job into a clean customer-facing quote.', steps: [
    { event: 'quote.template', title: 'Apply the QCP branding', target: 'customer', copy: 'Apply the QCP header/template from the editor. A real account would use your own logo and company details.' },
    { event: 'quote.presentation', title: 'Make one presentation change', target: 'customer', copy: 'Select a quote line and make one customer-facing change — edit its description, price visibility or wording — then press Save Quote.', hint: 'The quote still comes from the measurements and pricing you saved.' },
    { event: 'email.sent', title: 'Send the demo quote to yourself', target: 'job', copy: 'If you’re still editing, press Save Quote to return to Job Space. Then choose Send Quote and enter your own email address.', hint: 'Optional: the demo email is clearly marked. Sending does not subscribe you to marketing.' },
  ] },
  { id: 'smart-assistant', title: 'Use Smart Assistant', summary: 'Create, change and find work using plain English.', steps: [
    { event: 'assistant.created', title: 'Create work by asking', target: 'assistant', copy: 'Open Smart Assistant and send the example request below. Review its draft, then confirm it.' },
    { event: 'assistant.edited', title: 'Change it in one line', target: 'assistant', copy: 'Send the short change request below, then confirm the update.' },
    { event: 'assistant.found', title: 'Find what needs attention', target: 'assistant', copy: 'Ask the final example below, then open the matching job from the Assistant’s results.' },
  ] },
];

export function currentChapter(state: DemoGuideState): DemoGuideChapter { return state.chapter; }
export function chapterIndex(chapter: DemoGuideChapter): number { return DEMO_GUIDE_CHAPTERS.findIndex(c => c.id === chapter); }
export function nextGuideStep(state: DemoGuideState): DemoStep | undefined {
  return DEMO_GUIDE_CHAPTERS.find(c => c.id === state.chapter)?.steps.find(s => !state.acknowledgements[s.event] && !state.skipped?.[s.event]);
}
export function guideProgress(state: DemoGuideState): { done: number; skipped: number; handled: number; total: number } {
  const steps = DEMO_GUIDE_CHAPTERS.flatMap(c => c.steps);
  const done = steps.filter(s => !!state.acknowledgements[s.event]).length;
  const skipped = steps.filter(s => !state.acknowledgements[s.event] && !!state.skipped?.[s.event]).length;
  return { done, skipped, handled: done + skipped, total: steps.length };
}
export function canEnterChapter(state: DemoGuideState, chapter: DemoGuideChapter): boolean {
  if (chapter === 'pricing') return true;
  if (chapter === 'takeoff') return !!state.guided_created_component_id && !!state.acknowledgements['component.tested'];
  if (chapter === 'customer-quote') return !!state.acknowledgements['takeoff.saved'];
  if (chapter === 'smart-assistant') return !!state.acknowledgements['takeoff.saved'] && !!(state.acknowledgements['quote.presentation'] || state.skipped?.['quote.presentation']);
  return DEMO_GUIDE_CHAPTERS.every(item => item.steps.every(step => !!state.acknowledgements[step.event] || !!state.skipped?.[step.event]));
}
export function guideHref(slug: string, state: DemoGuideState, step = nextGuideStep(state)): string {
  const root = `/${encodeURIComponent(slug)}`;
  const target = step?.target ?? (state.chapter === 'takeoff' ? 'takeoff' : state.chapter === 'customer-quote' ? 'customer' : state.chapter === 'smart-assistant' ? 'assistant' : 'components');
  if (target === 'assistant') return root;
  if (target === 'takeoff' && state.seed.guided_roof_job) return `${root}/quotes/${state.seed.guided_roof_job}/takeoff`;
  if (target === 'job' && state.seed.guided_roof_job) return `${root}/quotes/${state.seed.guided_roof_job}/summary`;
  if (target === 'customer' && state.seed.guided_roof_job) return `${root}/quotes/${state.seed.guided_roof_job}/customer-edit`;
  if (step?.event === 'component.created') return `${root}/components?demoCreate=1`;
  const id = step?.event === 'component.edited' ? state.seed.maintenance_component : state.guided_created_component_id;
  return `${root}/components${id ? `?demoComponent=${encodeURIComponent(id)}${step?.event === 'component.tested' ? '&demoTest=1' : ''}` : ''}`;
}
