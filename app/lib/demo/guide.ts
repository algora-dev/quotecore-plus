import type { DemoGuideChapter, DemoGuideState, DemoEvent } from './model';
export type DemoStep = { event: DemoEvent; title: string; copy: string; target: 'components' | 'takeoff' | 'customer' | 'assistant' };
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
    { event: 'quote.template', title: 'Apply the QCP template', target: 'customer', copy: 'Apply the QCP demo header/footer template in the customer quote editor. A real account uses your own branding.' },
    { event: 'quote.presentation', title: 'Tidy the presentation', target: 'customer', copy: 'Click a line in the preview (or use the left toolbar) to select it. Edit its description or price, drag to reorder, or hide details - show or hide each line’s price with the eye toggle. Change something if you want, then press Save & Return.' },
    { event: 'quote.edited', title: 'Make the description yours', target: 'customer', copy: 'Select a line and rewrite its description so it reads the way you’d say it to this customer. Then press Save & Return - the quote stays based on your saved measurements.' },
    { event: 'quote.previewed', title: 'Send to customer', target: 'customer', copy: 'Press Save & Return (top right) to save your customer quote. Then send it to your own email, or open it in a browser. In this demo the Send button only ever emails you. Attachments and automatic follow-ups come with the main app.' },
  ] },
  { id: 'smart-assistant', title: 'Use Smart Assistant', summary: 'Real account control-not Q, the chatbot.', steps: [
    { event: 'assistant.created', title: 'Create work naturally', target: 'assistant', copy: 'Ask Smart Assistant to create a draft roofing job. Use your own wording and confirm its proposed action. The guide advances when the draft exists.' },
    { event: 'assistant.edited', title: 'Change the draft', target: 'assistant', copy: 'Ask Smart Assistant to change the draft it just created, then confirm and save. The saved change-not the reply alone-counts.' },
    { event: 'assistant.found', title: 'Find work needing attention', target: 'assistant', copy: 'Ask: “Do I have any accepted quotes without a material order?” Open the matching result to inspect the prepared job.' },
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
  if (target === 'takeoff' && state.seed.guided_roof_job) return `${root}/quotes/${state.seed.guided_roof_job}/takeoff`;
  if (target === 'customer' && state.seed.guided_roof_job) return `${root}/quotes/${state.seed.guided_roof_job}/customer-edit`;
  if (target === 'assistant') return `${root}/assistant`;
  if (step?.event === 'component.created') return `${root}/components?demoCreate=1`;
  const id = step?.event === 'component.edited' ? state.seed.maintenance_component : state.guided_created_component_id;
  return `${root}/components${id ? `?demoComponent=${encodeURIComponent(id)}${step?.event === 'component.tested' ? '&demoTest=1' : ''}` : ''}`;
}
