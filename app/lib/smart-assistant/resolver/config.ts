import type { RetrievalCapabilities } from '../retrieval/service.server';
import { intelligenceAvailable } from '../retrieval/intelligence';
/** Additive rollout. A model name, existing Edit grant or P1.7 flag cannot enable this. */
export function resolverEnabled(): boolean {
  return process.env.SMART_ASSISTANT_RESOLVER_ENABLED === 'true';
}
export function resolverAvailable(capabilities: RetrievalCapabilities): boolean {
  return resolverEnabled() && intelligenceAvailable(capabilities) && capabilities.resolverVersion === 1;
}
export const RESOLVER_LIMITS = Object.freeze({
  candidates: 5, rowsPerSource: 10, concurrency: 4, reads: 28,
  clarificationTurns: 2, rejected: 20, stateMinutes: 15,
  deadlineMs: 12_000, queryMs: 4_000, payloadBytes: 30_000,
});
