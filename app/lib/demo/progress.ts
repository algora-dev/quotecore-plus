import 'server-only';
import { createAdminClient } from '@/app/lib/supabase/admin';
import type { Database } from '@/app/lib/supabase/server';
import { readGuide, acknowledge, type DemoGuideState, type DemoEvent } from './model';
import { readActiveDemoContext } from './context';
import { DemoError } from './errors';
type Json = Database['public']['Tables']['demo_sessions']['Update']['tutorial_state'];
/** Optimistic compare-and-swap on the EXISTING JSONB. No schema/RPC change.
 * Concurrent tabs cannot overwrite each other's acknowledgements. Callbacks
 * must be pure: retries must never resend email or repeat a mutation. */
export async function mutateDemoGuide(sessionId: string, mutate: (previous: DemoGuideState) => DemoGuideState): Promise<DemoGuideState> {
  const admin = createAdminClient();
  for (let attempt = 0; attempt < 6; attempt++) {
    const { data, error } = await admin.from('demo_sessions').select('tutorial_state, status, expires_at')
      .eq('id', sessionId).eq('status', 'active').gt('expires_at', new Date().toISOString()).maybeSingle();
    if (error) throw new DemoError('Could not read guide progress.', 503);
    if (!data) throw new DemoError('Demo expired or reset.', 410, 'demo_expired');
    const previous = readGuide(data.tutorial_state);
    const next = { ...mutate(previous), version: 2 as const, revision: previous.revision + 1 };
    const result = await admin.from('demo_sessions').update({ tutorial_state: next as unknown as Json, last_seen_at: new Date().toISOString() })
      .eq('id', sessionId).eq('status', 'active').gt('expires_at', new Date().toISOString())
      .eq('tutorial_state', JSON.stringify(data.tutorial_state)).select('id').maybeSingle();
    if (result.error) throw new DemoError('Could not save guide progress.', 503);
    if (result.data) return next;
  }
  throw new DemoError('Another tab is updating your demo. Please retry.', 409, 'demo_conflict');
}
/** Hook only AFTER a real product action succeeded. Never client-authorized. */
export async function recordDemoEvent(companyId: string, event: DemoEvent, recordId?: string): Promise<void> {
  const context = await readActiveDemoContext(companyId);
  if (!context) return;
  await mutateDemoGuide(context.sessionId, previous => acknowledge(previous, event, recordId));
}
/** Product writes must not be falsely reported as failures if only guide bookkeeping fails. */
export async function recordDemoEventBestEffort(companyId: string, event: DemoEvent, recordId?: string): Promise<void> {
  try { await recordDemoEvent(companyId, event, recordId); } catch { console.warn('[demo] progress acknowledgement pending', event); }
}
