/** Bounded concurrency for declared safe reads only. Default is an ordering barrier. */
export async function executeToolBatch<T>(
  calls: readonly T[], parallelSafe: (call: T) => boolean,
  execute: (call: T) => Promise<unknown>, concurrency = 3,
): Promise<unknown[]> {
  const limit = Math.max(1, Math.min(3, Math.floor(concurrency) || 1));
  const results: unknown[] = [];
  for (let i = 0; i < calls.length;) {
    if (!parallelSafe(calls[i])) { results.push(await execute(calls[i++])); continue; }
    const batch: T[] = [];
    while (i < calls.length && batch.length < limit && parallelSafe(calls[i])) batch.push(calls[i++]);
    // allSettled drains admitted reads even if one rejects. Never finish while sibling work is live.
    const settled = await Promise.allSettled(batch.map(execute));
    const failed = settled.find(result => result.status === 'rejected');
    if (failed?.status === 'rejected') throw failed.reason;
    results.push(...settled.map(result => result.status === 'fulfilled' ? result.value : null));
  }
  return results;
}
export function stableArguments(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableArguments).join(',')}]`;
  if (value !== null && typeof value === 'object') return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${stableArguments(v)}`).join(',')}}`;
  return JSON.stringify(value) ?? 'null';
}
