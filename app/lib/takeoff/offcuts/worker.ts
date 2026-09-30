import { optimiseLayouts } from './core/solver';
import type { SolveRequest } from './core/types';
/** Terminate the worker to cancel synchronous geometry/search. Replies carry an
 * ID so an old page/request can never overwrite the current review session. */
self.addEventListener('message', (event: MessageEvent<{ id: string; request: SolveRequest }>) => {
  const { id, request } = event.data;
  try {
    const layouts = optimiseLayouts(request, { onProgress: (completed, total) => self.postMessage({ id, kind: 'progress', completed, total }) });
    self.postMessage({ id, kind: 'result', solution: layouts[0], layouts });
  } catch (error) { self.postMessage({ id, kind: 'error', message: error instanceof Error ? error.message : String(error) }); }
});
