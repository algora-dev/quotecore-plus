import { isRecord, type DemoGuideChapter, type DemoGuideState } from './model';
import { canEnterChapter } from './guide';
export type GuideCommand = { action: 'welcome'; mode: 'guided' | 'explore' } | { action: 'explore' }
  | { action: 'chapter'; chapter: DemoGuideChapter };
export function parseGuideCommand(value: unknown): GuideCommand | null {
  if (!isRecord(value)) return null;
  const keys = Object.keys(value).sort().join(',');
  if (keys === 'action,mode' && value.action === 'welcome' && (value.mode === 'guided' || value.mode === 'explore')) return { action: 'welcome', mode: value.mode };
  if (keys === 'action' && value.action === 'explore') return { action: 'explore' };
  if (keys === 'action,chapter' && value.action === 'chapter' && ['pricing','takeoff','customer-quote','smart-assistant','complete'].includes(String(value.chapter))) {
    return { action: 'chapter', chapter: value.chapter as DemoGuideChapter };
  }
  return null; // IDs, acknowledgements, budgets and arbitrary patches are never accepted.
}
export function applyGuideCommand(state: DemoGuideState, command: GuideCommand): DemoGuideState | null {
  if (command.action === 'welcome') return { ...state, welcomed: true, mode: command.mode };
  if (command.action === 'explore') return { ...state, welcomed: true, mode: 'explore' };
  if (!canEnterChapter(state, command.chapter)) return null;
  return { ...state, welcomed: true, mode: 'guided', chapter: command.chapter };
}
