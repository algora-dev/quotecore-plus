import { acknowledge, isRecord, type DemoGuideChapter, type DemoGuideState } from './model';
import { canEnterChapter, DEMO_GUIDE_CHAPTERS, nextGuideStep, reviewStepForChapter, SKIP_REQUIRED_EVENTS } from './guide';
export type GuideCommand = { action: 'welcome'; mode: 'guided' | 'explore' } | { action: 'explore' }
  | { action: 'chapter'; chapter: DemoGuideChapter } | { action: 'skip' } | { action: 'finish-assistant' };
export function parseGuideCommand(value: unknown): GuideCommand | null {
  if (!isRecord(value)) return null;
  const keys = Object.keys(value).sort().join(',');
  if (keys === 'action,mode' && value.action === 'welcome' && (value.mode === 'guided' || value.mode === 'explore')) return { action: 'welcome', mode: value.mode };
  if (keys === 'action' && value.action === 'explore') return { action: 'explore' };
  if (keys === 'action' && value.action === 'skip') return { action: 'skip' };
  if (keys === 'action' && value.action === 'finish-assistant') return { action: 'finish-assistant' };
  if (keys === 'action,chapter' && value.action === 'chapter' && ['pricing','takeoff','customer-quote','smart-assistant','complete'].includes(String(value.chapter))) {
    return { action: 'chapter', chapter: value.chapter as DemoGuideChapter };
  }
  return null; // IDs, acknowledgements, budgets and arbitrary patches are never accepted.
}
export function applyGuideCommand(state: DemoGuideState, command: GuideCommand): DemoGuideState | null {
  const clearReview = (value: DemoGuideState): DemoGuideState => {
    const { review_event: _reviewEvent, ...rest } = value;
    return rest;
  };
  if (command.action === 'welcome') return { ...clearReview(state), welcomed: true, mode: command.mode };
  if (command.action === 'explore') return { ...clearReview(state), welcomed: true, mode: 'explore' };
  if (command.action === 'finish-assistant') {
    // Finishing is only available after the server has verified that the final
    // Assistant run actually surfaced the seeded accepted quote. This is not a
    // generic client-side completion escape hatch.
    const step = nextGuideStep(state);
    if (state.review_event || step?.event !== 'assistant.found' || !state.assistant_found_ready_at || !(state.assistant_found_record_ids?.length)) return null;
    return acknowledge(state, 'assistant.found');
  }
  if (command.action === 'skip') {
    // Review mode represents an already handled lesson. Never rewrite it as
    // skipped just because the visitor is looking back through a chapter.
    if (state.review_event) return null;
    // A skip only records a deferred lesson, never a successful business event.
    // Record-producing prerequisite steps must still be completed for real.
    const step = nextGuideStep(state);
    if (!step || SKIP_REQUIRED_EVENTS.includes(step.event)) return null;
    return { ...state, skipped: { ...state.skipped, [step.event]: { at: new Date().toISOString() } } };
  }
  if (!canEnterChapter(state, command.chapter)) return null;
  const chapter = DEMO_GUIDE_CHAPTERS.find(item => item.id === command.chapter);
  const incomplete = chapter?.steps.find(step => !state.acknowledgements[step.event] && !state.skipped?.[step.event]);
  const review = !incomplete ? reviewStepForChapter(state, command.chapter) : undefined;
  return { ...clearReview(state), welcomed: true, mode: 'guided', chapter: command.chapter, ...(review ? { review_event: review.event } : {}) };
}
