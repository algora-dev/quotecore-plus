/** P7-INBOX-01: interpret confirmed IDs, never the number requested.
 * Local contract adapter only; no business transition or API call lives here.
 */
export function resolveInboxOutcome(payload: unknown, requestedIds: readonly string[]): {
  updatedIds: string[]; failedIds: string[];
} {
  if (!payload || typeof payload !== 'object') throw new Error('Missing update result');
  const result = payload as { ok?: unknown; updatedIds?: unknown };
  if (result.ok !== true || !Array.isArray(result.updatedIds) || result.updatedIds.some(id => typeof id !== 'string')) {
    throw new Error('Unconfirmed update result');
  }
  const requested = new Set(requestedIds);
  const updatedIds = Array.from(new Set(result.updatedIds as string[])).filter(id => requested.has(id));
  const updated = new Set(updatedIds);
  return { updatedIds, failedIds: Array.from(requested).filter(id => !updated.has(id)) };
}
