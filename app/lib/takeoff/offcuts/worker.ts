import { optimiseLayouts, optimiseAlternative } from './core/solver';
import type { AlternativePlanOptions, SolveRequest } from './core/types';
/** One computation per worker. The UI terminates it on cancel/page/area changes.
 * Requests carry IDs; stale replies cannot replace a current plan. */
self.addEventListener('message', (event: MessageEvent<{ id: string; request: SolveRequest; alternative?: AlternativePlanOptions }>) => {
  const { id, request, alternative } = event.data;
  const onProgress = (completed: number, total: number) => self.postMessage({ id, kind: 'progress', completed, total });
  try {
    if (alternative) {
      const result = optimiseAlternative(request, alternative, { onProgress });
      self.postMessage({ id, kind: 'alternative-result', result });
    } else {
      const layouts = optimiseLayouts(request, { onProgress });
      if (!layouts.length) throw new Error('No complete plan was produced. Export the reviewed draft for diagnosis.');
      self.postMessage({ id, kind: 'result', solution: layouts[0], layouts });
    }
  } catch (error) { self.postMessage({ id, kind: 'error', message: error instanceof Error ? error.message : String(error) }); }
});
