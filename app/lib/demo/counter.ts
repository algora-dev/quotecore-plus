/** Pure compare-and-swap protocol, shared by DB adapter and offline race tests. */
export type Counter = { used: number; held: number; expiresAt: string };
export type CounterStore = {
  read(): Promise<Counter | null>;
  insert(value: Counter): Promise<boolean>;
  replace(before: Counter, after: Counter): Promise<boolean>;
};
export class CounterLimit extends Error {}
export function nextCounter(before: Counter | null, amount: number, maximum: number, now: number, windowMs: number): Counter {
  if (![amount,maximum,now,windowMs].every(Number.isSafeInteger) || amount <= 0 || maximum <= 0 || windowMs <= 0) throw new Error('Invalid counter parameters');
  if (before && (!Number.isSafeInteger(before.used) || !Number.isSafeInteger(before.held) || before.used < 0 || before.held < 0 || !Number.isFinite(Date.parse(before.expiresAt)))) throw new Error('Invalid persisted counter');
  const active = before && Date.parse(before.expiresAt) > now;
  const used = active ? before.used : 0, held = active ? before.held : 0;
  if (used + held + amount > maximum) throw new CounterLimit('Allowance used');
  return { used: used + amount, held, expiresAt: active ? before.expiresAt : new Date(now + windowMs).toISOString() };
}
/** A retry never performs an external side effect. Each successful CAS is one
 * authoritative debit. Separate scopes are pessimistic, not a fake transaction. */
export async function debitCounter(store: CounterStore, amount: number, maximum: number, now = Date.now(), windowMs = 86_400_000): Promise<Counter> {
  for (let attempt = 0; attempt < 24; attempt++) {
    const before = await store.read(); const after = nextCounter(before, amount, maximum, now, windowMs);
    if (before ? await store.replace(before, after) : await store.insert(after)) return after;
  }
  throw new Error('Counter contention; retry later');
}
export function remainingCounter(value: Counter | null, maximum: number, now = Date.now()): number {
  return !value || Date.parse(value.expiresAt) <= now ? maximum : Math.max(0, maximum - value.used - value.held);
}
