import 'server-only';
import { createHash } from 'node:crypto';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { debitCounter, CounterLimit, remainingCounter, type CounterStore } from './counter';
import { DemoError } from './errors';
import type { ActiveDemoContext } from './model';
const ANCHOR = '1970-01-01T00:00:00.000Z';
function positiveInt(value: string | undefined, fallback: number): number {
  const result = value === undefined ? fallback : Number(value);
  return Number.isSafeInteger(result) && result > 0 && result < 1_000_000_000 ? result : fallback;
}
export function demoBudgetConfig() {
  const reserve = positiveInt(process.env.DEMO_AI_TURN_RESERVE_MICROUSD, 0);
  const audio = positiveInt(process.env.DEMO_AUDIO_RESERVE_MICROUSD, 0);
  const speech = positiveInt(process.env.DEMO_SPEECH_RESERVE_MICROUSD, 0);
  return { configured: process.env.DEMO_AI_BUDGET_CALIBRATED === 'true' && reserve > 0,
    maximum: positiveInt(process.env.DEMO_AI_BUDGET_MICROUSD, 500_000), reserve, audio, speech,
    turns: Math.min(10, positiveInt(process.env.DEMO_AI_USER_TURNS, 10)), sends: Math.min(3, positiveInt(process.env.DEMO_SELF_SEND_LIMIT, 3)) };
}
function counterStore(scope: 'session' | 'ip', key: string): CounterStore {
  const db = createAdminClient();
  const find = () => db.from('demo_budget_counters').select('settled_credits,reserved_credits,expires_at')
    .eq('scope', scope).eq('scope_key', key).eq('window_start', ANCHOR).maybeSingle();
  return {
    async read() { const { data, error } = await find(); if (error) throw new Error('Could not read allowance');
      return data ? { used: data.settled_credits, held: data.reserved_credits, expiresAt: data.expires_at } : null; },
    async insert(value) {
      const result = await db.from('demo_budget_counters').insert({ scope, scope_key: key, window_start: ANCHOR,
        settled_credits: value.used, reserved_credits: value.held, expires_at: value.expiresAt, updated_at: new Date().toISOString() });
      if (result.error?.code === '23505') return false;
      if (result.error) throw new Error('Could not initialize allowance'); return true;
    },
    async replace(before, after) {
      const result = await db.from('demo_budget_counters').update({ settled_credits: after.used, reserved_credits: after.held,
        expires_at: after.expiresAt, updated_at: new Date().toISOString() }).eq('scope', scope).eq('scope_key', key)
        .eq('window_start', ANCHOR).eq('settled_credits', before.used).eq('reserved_credits', before.held).eq('expires_at', before.expiresAt)
        .select('scope_key').maybeSingle();
      if (result.error) throw new Error('Could not debit allowance'); return !!result.data;
    },
  };
}
function keys(context: ActiveDemoContext, kind: string) {
  if (!context.ipHmac) throw new DemoError('Demo allowance identity is missing. Reset the old demo.', 503);
  return [{ scope: 'session' as const, key: `visitor:${context.anonUserId}:${kind}` }, { scope: 'ip' as const, key: `network:${context.ipHmac}:${kind}` }];
}
/** Uses EXISTING tables. Each bucket debit is atomic CAS; admission across
 * buckets is conservative. On a partial failure prior debits are retained.
 * Never refund on reset/retry or pretend separate HTTP updates are a SQL txn.
 * Calibration must bound the real SA pipeline cost before enabling AI. */
export async function consumeDemoResource(context: ActiveDemoContext, kind: string, amount: number, maximum: number): Promise<void> {
  try {
    for (const key of keys(context, kind)) await debitCounter(counterStore(key.scope, key.key), amount, maximum);
  } catch (error) {
    if (error instanceof CounterLimit) throw new DemoError('This demo allowance is used. Your other sandbox features still work.', 402, 'demo_allowance_used');
    throw new DemoError('Allowance verification is unavailable. No paid action was started.', 503, 'demo_budget_unavailable');
  }
}
async function remaining(context: ActiveDemoContext, kind: string, maximum: number) {
  const values = await Promise.all(keys(context, kind).map(async key => remainingCounter(await counterStore(key.scope, key.key).read(), maximum)));
  return Math.min(...values);
}
export async function getDemoAllowance(context: ActiveDemoContext) {
  const config = demoBudgetConfig();
  const [turnsRemaining, sendsRemaining, creditsRemaining] = await Promise.all([
    remaining(context, 'assistant-turns', config.turns), remaining(context, 'quote-sends', config.sends), remaining(context, 'ai-microusd', config.maximum),
  ]);
  return { configured: config.configured, voiceConfigured: config.configured && config.audio > 0 && config.speech > 0,
    turnsRemaining, turnsLimit: config.turns, sendsRemaining, sendsLimit: config.sends,
    aiAllowanceAvailable: config.configured && creditsRemaining >= config.reserve };
}
function requestUuid(key: string): string {
  const hex = createHash('sha256').update(key).digest('hex');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-5${hex.slice(13,16)}-a${hex.slice(17,20)}-${hex.slice(20,32)}`;
}
export type DemoReservation = { id: string; duplicate: boolean; runId: string | null };
export async function reserveDemoAi(context: ActiveDemoContext, action: 'assistant-turn' | 'transcribe' | 'speech', requestId: string, payloadDigest: string): Promise<DemoReservation> {
  const config = demoBudgetConfig(); const charge = action === 'assistant-turn' ? config.reserve : action === 'speech' ? config.speech : config.audio;
  if (!config.configured || charge <= 0 || charge > config.maximum) throw new DemoError('Smart Assistant demo cost controls are not configured for this deployment yet.', 503, 'demo_ai_setup');
  const db = createAdminClient(); const id = requestUuid(`${context.anonUserId}:${action}:${requestId}`);
  const inserted = await db.from('demo_usage').insert({ id, demo_session_id: context.sessionId, ip_hmac: context.ipHmac,
    action_type: action, action_variant: payloadDigest, reservation_credits: charge, status: 'reserved', provider: 'openai' });
  if (inserted.error?.code === '23505') {
    const previous = await db.from('demo_usage').select('status,action_variant,demo_session_id,request_ref').eq('id', id).single();
    if (previous.error) throw new DemoError('Could not reconcile the previous request.', 503);
    if (previous.data.demo_session_id !== context.sessionId || previous.data.action_variant !== payloadDigest) throw new DemoError('This request belongs to a different demo action.', 409);
    if (previous.data.status === 'settled' && previous.data.request_ref && action === 'assistant-turn') return { id, duplicate: true, runId: previous.data.request_ref };
    if (previous.data.status === 'denied') throw new DemoError('The allowance for this request was denied.', 402, 'demo_allowance_used');
    throw new DemoError('This request is already in progress or needs reconciliation. Do not repeat the action.', 409, 'demo_request_pending');
  }
  if (inserted.error) throw new DemoError('Could not reserve demo usage. No paid action was started.', 503);
  try {
    await consumeDemoResource(context, 'ai-microusd', charge, config.maximum);
    await consumeDemoResource(context, action === 'assistant-turn' ? 'assistant-turns' : action === 'speech' ? 'speech-requests' : 'voice-requests', 1, config.turns);
    return { id, duplicate: false, runId: null };
  } catch (error) {
    await db.from('demo_usage').update({ status: 'denied', settled_at: new Date().toISOString() }).eq('id', id).eq('status','reserved');
    throw error;
  }
}
/** The calibrated reservation remains charged until the rolling window expires.
 * We record trusted actual usage when configured, but do not perform a fragile
 * multi-HTTP refund. An atomic reserve/true-up RPC is an optional Gavin upgrade. */
export async function settleDemoAi(context: ActiveDemoContext, id: string, runId?: string): Promise<void> {
  const db = createAdminClient(); let actual: number | null = null;
  if (runId) {
    const run = await db.from('smart_assistant_runs').select('tokens_in,tokens_out').eq('id', runId).eq('company_id', context.companyId).maybeSingle();
    const inputRate = Number(process.env.DEMO_AI_INPUT_MICROUSD_PER_TOKEN), outputRate = Number(process.env.DEMO_AI_OUTPUT_MICROUSD_PER_TOKEN);
    if (!run.error && run.data && Number.isFinite(inputRate) && inputRate > 0 && Number.isFinite(outputRate) && outputRate > 0) {
      actual = Math.ceil((run.data.tokens_in ?? 0) * inputRate + (run.data.tokens_out ?? 0) * outputRate);
      if (!Number.isSafeInteger(actual) || actual > 2_000_000_000) actual = null;
    }
  }
  const result = await db.from('demo_usage').update({ status: 'settled', actual_credits: actual,
    request_ref: runId ?? null, settled_at: new Date().toISOString() }).eq('id', id).eq('demo_session_id', context.sessionId).eq('status', 'reserved');
  if (result.error) console.warn('[demo] usage finalization pending; conservative debit retained');
}
