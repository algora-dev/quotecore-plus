import type { DemoGuideChapter, DemoGuideState, DemoEvent } from './model';
export type DemoStep = { event: DemoEvent; title: string; copy: string; target: 'components' | 'takeoff' | 'customer' | 'job' | 'assistant' };
/** Steps that cannot be skipped: later chapters depend on the real records
 * they create (the created component, the tested gate, the saved takeoff). */
export const SKIP_REQUIRED_EVENTS: DemoEvent[] = ['component.created', 'component.tested', 'takeoff.saved'];
export const DEMO_GUIDE_CHAPTERS: { id: DemoGuideChapter; title: string; summary: string; steps: DemoStep[] }[] = [
  { id: 'pricing', title: 'Build your pricing', summary: 'One reusable rule. Every future job.', steps: [
    { event: 'component.viewed', title: 'Have a look around', target: 'components', copy: 'Every line in this library is one pricing component - switch libraries from the dropdown to see General Construction and Flooring too. Nothing here saves or changes until you do it. When you are ready, take the next step: create your own component.' },
    { event: 'component.created', title: 'Create your roofing component', target: 'components', copy: 'Create an area component - name it anything (e.g. “Skylight”), give it a price, then press Save. Try £80 material and £25 labour per m², with no pitch or waste. Bare minimum: a name, one price, Save - saving is what moves the demo forward. These are example prices only.' },
    { event: 'component.tested', title: 'Test your component', target: 'components', copy: 'Open the component you created and choose Test Component. Calculate a 2 m² example to see the real material and labour breakdown. Testing does not save edits.' },
    { event: 'component.edited', title: 'Update an existing price', target: 'components', copy: 'Open the seeded Roof covering component, make a small price change and save. The guide waits for the actual saved record.' },
  ] },
  { id: 'takeoff', title: 'Measure the job', summary: 'A prepared plan. Your actual measurements.', steps: [
    { event: 'takeoff.saved', title: 'Add your skylight, then Finish & Save', target: 'takeoff', copy: 'The prepared roof is already measured - area, ridges, hips, valleys, barges and spouting are all drawn and priced. Your one job: add your component (“Skylight”) and draw a rectangle anywhere on the roof. Then explore freely - add, edit or remove anything - and press Finish & Save when you’re done.' },
  ] },
  { id: 'customer-quote', title: 'Prepare the customer quote', summary: 'Your measurements, presented for a customer.', steps: [
    { event: 'quote.template', title: 'Apply the QCP template', target: 'customer', copy: 'Click the header area in the preview, or select “Company & Logo (Header)” in the left Editor. A real account uses your own branding.' },
    { event: 'quote.presentation', title: 'Tidy the presentation', target: 'customer', copy: 'Click a line in the preview (or use the left toolbar) to select it. Edit its description or price, or hide details - show or hide each line’s price with the eye toggle. Change something if you want, then press Save Quote.' },
    { event: 'quote.edited', title: 'Make the description yours', target: 'customer', copy: 'Select a line and rewrite its description so it reads the way you’d say it to this customer. Then press Save Quote - the quote stays based on your saved measurements.' },
    { event: 'email.sent', title: 'Send the quote', target: 'job', copy: 'Still editing? Press Save Quote (top right) - you land in the Job Space. There, press the Send Quote button, enter your own email address and press Send - in this demo it only ever emails you. Then check your inbox: the email and its customer page are exactly what a real customer receives.' },
  ] },
  { id: 'smart-assistant', title: 'Use Smart Assistant', summary: 'Your work, in plain English.', steps: [
    { event: 'assistant.created', title: 'Create a job by asking', target: 'assistant', copy: 'Open Smart Assistant (bottom right) and use voice or text - the example below is ready to paste. Review what it drafts from your words, then press Confirm.' },
    { event: 'assistant.edited', title: 'Change it in one line', target: 'assistant', copy: 'Ask the assistant to change the draft it just created - try the example below - then confirm the update. The saved change is what counts.' },
    { event: 'assistant.found', title: 'Find work needing attention', target: 'assistant', copy: 'Ask the example below. The assistant searches your workspace and opens the matching job - one sentence, zero digging.' },
  ] },
];
export function currentChapter(state: DemoGuideState): DemoGuideChapter { return state.chapter; }
export function chapterIndex(chapter: DemoGuideChapter): number { return DEMO_GUIDE_CHAPTERS.findIndex(c => c.id === chapter); }
export function nextGuideStep(state: DemoGuideState): DemoStep | undefined {
  return DEMO_GUIDE_CHAPTERS.find(c => c.id === state.chapter)?.steps.find(s => !state.acknowledgements[s.event]);
}
export function guideProgress(state: DemoGuideState): { done: number; total: number } {
  const steps = DEMO_GUIDE_CHAPTERS.flatMap(c => c.steps);
  return { done: steps.filter(s => !!state.acknowledgements[s.event]).length, total: steps.length };
}
export function canEnterChapter(state: DemoGuideState, chapter: DemoGuideChapter): boolean {
  if (chapter === 'pricing' || chapter === 'smart-assistant') return true;
  if (chapter === 'takeoff') return !!state.guided_created_component_id && !!state.acknowledgements['component.tested'];
  if (chapter === 'customer-quote') return !!state.acknowledgements['takeoff.saved'];
  return DEMO_GUIDE_CHAPTERS.every(chapter => chapter.steps.every(step => !!state.acknowledgements[step.event]));
}
export function guideHref(slug: string, state: DemoGuideState, step = nextGuideStep(state)): string {
  const root = `/${encodeURIComponent(slug)}`;
  const target = step?.target ?? (state.chapter === 'takeoff' ? 'takeoff' : state.chapter === 'customer-quote' ? 'customer' : state.chapter === 'smart-assistant' ? 'assistant' : 'components');
  // The Smart Assistant popup opens from any workspace page (never the
  // standalone /assistant page), so the chapter's destination is simply home.
  if (target === 'assistant') return root;
  if (target === 'takeoff' && state.seed.guided_roof_job) return `${root}/quotes/${state.seed.guided_roof_job}/takeoff`;
  if (target === 'job' && state.seed.guided_roof_job) return `${root}/quotes/${state.seed.guided_roof_job}/summary`;
  if (target === 'customer' && state.seed.guided_roof_job) return `${root}/quotes/${state.seed.guided_roof_job}/customer-edit`;
  if (step?.event === 'component.created') return `${root}/components?demoCreate=1`;
  const id = step?.event === 'component.edited' ? state.seed.maintenance_component : state.guided_created_component_id;
  return `${root}/components${id ? `?demoComponent=${encodeURIComponent(id)}${step?.event === 'component.tested' ? '&demoTest=1' : ''}` : ''}`;
}
