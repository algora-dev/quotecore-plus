import type { DemoGuideChapter, DemoGuideState, DemoEvent } from './model';
export type DemoStep = { event: DemoEvent; title: string; copy: string; target: 'components' | 'takeoff' | 'customer' | 'assistant' };
/** Steps that cannot be skipped: later chapters depend on the real records
 * they create (the created component, the tested gate, the saved takeoff). */
export const SKIP_REQUIRED_EVENTS: DemoEvent[] = ['component.created', 'component.tested', 'takeoff.saved'];
export const DEMO_GUIDE_CHAPTERS: { id: DemoGuideChapter; title: string; summary: string; steps: DemoStep[] }[] = [
  { id: 'pricing', title: 'Build your pricing', summary: 'One reusable rule. Every future job.', steps: [
    { event: 'component.created', title: 'Create your roofing component', target: 'components', copy: 'Create an area component — name it anything (e.g. “Skylight”), give it a price, then press Save. Try £80 material and £25 labour per m², with no pitch or waste. Bare minimum: a name, one price, Save — saving is what moves the demo forward. These are example prices only.' },
    { event: 'component.tested', title: 'Test your component', target: 'components', copy: 'Open the component you created and choose Test Component. Calculate a 2 m² example to see the real material and labour breakdown. Testing does not save edits.' },
    { event: 'component.edited', title: 'Update an existing price', target: 'components', copy: 'Open the seeded Roof covering component, make a small price change and save. The guide waits for the actual saved record.' },
  ] },
  { id: 'takeoff', title: 'Measure the job', summary: 'A prepared plan. Your actual measurements.', steps: [
    { event: 'scan.loaded', title: 'Load the prepared scan', target: 'takeoff', copy: 'Open the prepared roof and press Scan. This demo replays a real captured AI scan without calling AI. Inspect the outline, then adjust or remove any detection.' },
    { event: 'takeoff.saved', title: 'Add your component, then save', target: 'takeoff', copy: 'Add the component you created and draw a rectangle anywhere on the roof (a skylight, a section — your call). Experiment freely — add or remove anything — then Finish & Save. Your final canvas, not a canned result, will price the quote.' },
  ] },
  { id: 'customer-quote', title: 'Prepare the customer quote', summary: 'Your measurements, presented for a customer.', steps: [
    { event: 'quote.template', title: 'Apply the QCP template', target: 'customer', copy: 'Apply the QCP demo header/footer template in the customer quote editor. A real account uses your own branding.' },
    { event: 'quote.presentation', title: 'Change the presentation', target: 'customer', copy: 'Hide individual line prices. The prices still contribute to the total; you control what the customer sees.' },
    { event: 'quote.edited', title: 'Make the description yours', target: 'customer', copy: 'Edit and save one line description in the customer quote. The underlying quote remains based on your saved measurements.' },
    { event: 'quote.previewed', title: 'See the customer experience', target: 'customer', copy: 'Open the demo customer preview from the guide. Accept or decline safely inside the sandbox. Self-send is available only when your deployment has explicitly enabled it.' },
  ] },
  { id: 'smart-assistant', title: 'Use Smart Assistant', summary: 'Real account control—not Q, the chatbot.', steps: [
    { event: 'assistant.created', title: 'Create work naturally', target: 'assistant', copy: 'Ask Smart Assistant to create a draft roofing job. Use your own wording and confirm its proposed action. The guide advances when the draft exists.' },
    { event: 'assistant.edited', title: 'Change the draft', target: 'assistant', copy: 'Ask Smart Assistant to change the draft it just created, then confirm and save. The saved change—not the reply alone—counts.' },
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
  const id = step?.event === 'component.edited' ? state.seed.maintenance_component : state.guided_created_component_id;
  return `${root}/components${id ? `?demoComponent=${encodeURIComponent(id)}${step?.event === 'component.tested' ? '&demoTest=1' : ''}` : ''}`;
}
