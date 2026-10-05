import 'server-only';
import { randomUUID } from 'node:crypto';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { checkRateLimit } from '@/app/lib/security/rateLimit';
import { getDemoControl } from './control';
import { DemoError } from './errors';
import { fictionalCompany, type DemoMeasurementSystem } from './seed-data';
import { seedDemoCompany } from './seed';
import { DEMO_SEED_VERSION, DEMO_SESSION_MS, initialDemoGuide } from './model';
import { ipHmacFor } from './identity';
import type { Database } from '@/app/lib/supabase/server';
export { ipHmacFor } from './identity';
export { DemoError as DemoProvisionError } from './errors';
type Json = Database['public']['Tables']['demo_sessions']['Insert']['tutorial_state'];
/** No customer data is read here. All seed records are explicitly authored.
 * Auth user remains stable through Reset, so it cannot replenish allowances.
 * The existing rate-limit RPC serializes provisioning admission; a persisted
 * provisioning row prevents a second attempt while the first is in progress. */
/** Read-only entry probe: returns the resumable session, if any, without
 * provisioning. Lets the entry screen ask for the visitor's measurement
 * system BEFORE any seed write happens. */
export async function probeDemo(anonUserId: string): Promise<{ slug: string; sessionId: string; expiresAt: string | null } | null> {
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const previous = await admin.from('demo_sessions').select('id,company_id,status,expires_at,template_version')
    .eq('anon_user_id', anonUserId).order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (previous.error || !previous.data) return null;
  const old = previous.data;
  if (old.template_version !== DEMO_SEED_VERSION || old.status !== 'active' || !old.company_id || !old.expires_at || old.expires_at <= now) return null;
  const company = await admin.from('companies').select('slug,plan_code').eq('id', old.company_id).maybeSingle();
  if (company.error || !company.data?.slug || company.data.plan_code !== 'demo') return null;
  return { slug: company.data.slug, sessionId: old.id, expiresAt: old.expires_at };
}
export async function provisionDemo(anonUserId: string, ip: string | null, reset = false, system?: DemoMeasurementSystem): Promise<{ slug: string; sessionId: string; resumed: boolean; expiresAt: string | null }> {
  if (!(await getDemoControl()).demoEnabled) throw new DemoError('The demo is currently switched off.', 503, 'demo_off');
  const admin = createAdminClient();
  const verified = await admin.auth.admin.getUserById(anonUserId);
  if (verified.error || verified.data.user?.is_anonymous !== true) throw new DemoError('A separate anonymous demo identity is required.', 403);
  const now = new Date().toISOString(); const ipHmac = ipHmacFor(ip);
  const previous = await admin.from('demo_sessions').select('id,company_id,status,expires_at,template_version,reset_count,created_at')
    .eq('anon_user_id', anonUserId).order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (previous.error) throw new DemoError('Could not verify the existing demo.', 503);
  const old = previous.data;
  // Owner 2026-10-04: a crashed provisioning attempt must not jam "Start again"
  // for a quarter hour. Seeding completes well inside 3 minutes, so anything
  // older than that is treated as dead and superseded by the new attempt.
  if (old?.status === 'provisioning' && Date.parse(old.created_at) > Date.now() - 3 * 60_000) {
    throw new DemoError('Your demo is still being prepared. Please retry shortly.', 409, 'demo_provisioning');
  }
  if (!reset && old?.template_version === DEMO_SEED_VERSION && old?.status === 'active' && old.expires_at && old.expires_at > now && old.company_id) {
    const company = await admin.from('companies').select('slug,plan_code').eq('id', old.company_id).maybeSingle();
    if (company.error) throw new DemoError('Could not resume the demo.', 503);
    if (company.data?.slug && company.data.plan_code === 'demo') return { slug: company.data.slug, sessionId: old.id, resumed: true, expiresAt: old.expires_at ?? null };
  }
  if (!await checkRateLimit(`demo:provision:user:${anonUserId}`, 1, 60_000, { failClosed: true }) ||
      !await checkRateLimit(`demo:provision:ip:${ipHmac}`, 5, 3_600_000, { failClosed: true })) {
    throw new DemoError('Please wait before starting another demo. Reset does not restore AI or email allowances.', 429, 'demo_creation_limit');
  }
  // Refuse to repoint any profile attached to a real business, even if a token
  // was unexpectedly marked anonymous. Never use upsert to silently take it over.
  const profile = await admin.from('users').select('company_id').eq('id', anonUserId).maybeSingle();
  if (profile.error) throw new DemoError('Could not verify the demo profile.', 503);
  if (profile.data?.company_id) {
    const company = await admin.from('companies').select('plan_code').eq('id', profile.data.company_id).maybeSingle();
    if (company.error || company.data?.plan_code !== 'demo') throw new DemoError('This identity cannot be used for a disposable demo.', 403);
  }
  if (old?.status === 'active' && old.company_id) {
    const running = await admin.from('smart_assistant_runs').select('id').eq('company_id',old.company_id).in('status',['accepted','running']).gt('started_at',new Date(Date.now()-10*60_000).toISOString()).limit(1).maybeSingle();
    if (running.error || running.data) throw new DemoError('Wait for the current Smart Assistant operation to finish before resetting.',409,'demo_busy');
  }
  if (old?.status === 'active') {
    const stopped = await admin.from('demo_sessions').update({ status: 'terminating' }).eq('id', old.id).eq('status', 'active').select('id').maybeSingle();
    if (stopped.error || !stopped.data) throw new DemoError('Another tab is resetting this demo.', 409);
  }
  const sessionId = randomUUID(), companyId = randomUUID();
  const slug = `demo-${randomUUID().replace(/-/g, '').slice(0, 16)}`;
  // "Start again" re-seeds in the visitor's chosen measurement system: when the
  // caller does not pass one (reset path), carry over the previous demo
  // company's setting so imperial/squares visitors keep their units.
  let chosenSystem: DemoMeasurementSystem = system ?? 'metric';
  if (!system && old?.company_id) {
    const previousCompany = await admin.from('companies').select('default_measurement_system').eq('id', old.company_id).eq('plan_code', 'demo').maybeSingle();
    if (!previousCompany.error && previousCompany.data) {
      const previous = previousCompany.data.default_measurement_system;
      if (previous === 'imperial_ft' || previous === 'imperial_rs' || previous === 'metric') chosenSystem = previous;
    }
  }
  const created = await admin.from('demo_sessions').insert({ id: sessionId, anon_user_id: anonUserId,
    template_version: DEMO_SEED_VERSION, ip_hmac: ipHmac, status: 'provisioning', reset_count: (old?.reset_count ?? 0) + (reset ? 1 : 0) });
  if (created.error) {
    if (old?.status === 'active') await admin.from('demo_sessions').update({ status: 'active' }).eq('id', old.id).eq('status', 'terminating');
    throw new DemoError('Could not start provisioning.', 503);
  }
  let profileMoved = false; let companyCreated = false;
  try {
    const co = await admin.from('companies').insert(fictionalCompany(companyId, slug, now, chosenSystem));
    if (co.error) throw new Error(`company: ${co.error.message}`);
    companyCreated = true;
    const linked = await admin.from('demo_sessions').update({ company_id: companyId }).eq('id', sessionId);
    if (linked.error) throw new Error(`session link: ${linked.error.message}`);
    const userFields = { company_id: companyId, email: `visitor-${anonUserId.slice(0, 8)}@demo.invalid`,
      full_name: 'QCP Demo Visitor', role: 'owner', mfa_required: false, is_admin: false, email_notifications_enabled: false };
    const user = profile.data
      ? await admin.from('users').update(userFields).eq('id', anonUserId)
      : await admin.from('users').insert({ id: anonUserId, ...userFields });
    if (user.error) throw new Error(`profile: ${user.error.message}`);
    profileMoved = true;
    const seed = await seedDemoCompany(companyId, anonUserId, chosenSystem);
    const activeAt = new Date().toISOString();
    const activated = await admin.from('demo_sessions').update({ status: 'active', activated_at: activeAt, last_seen_at: activeAt,
      expires_at: new Date(Date.now() + DEMO_SESSION_MS).toISOString(), tutorial_state: initialDemoGuide(seed) as unknown as Json })
      .eq('id', sessionId).eq('status', 'provisioning').select('id').maybeSingle();
    if (activated.error || !activated.data) throw new Error('activation failed');
    if (old) await admin.from('demo_sessions').update({ status: 'cleanup_pending' }).eq('id', old.id);
    return { slug, sessionId, resumed: false, expiresAt: null };
  } catch (error) {
    console.error('[demo/provision] stage failed', error instanceof Error ? error.message : 'unknown');
    // Restore the old binding before its company is eligible for cleanup.
    if (profileMoved && profile.data?.company_id) await admin.from('users').update({ company_id: profile.data.company_id }).eq('id', anonUserId);
    await admin.from('demo_sessions').update({ status: 'cleanup_failed', company_id: companyCreated ? companyId : null,
      failure_context: { code: 'provision_failed' } }).eq('id', sessionId);
    if (old?.status === 'active' && old.expires_at && old.expires_at > new Date().toISOString()) {
      await admin.from('demo_sessions').update({ status: 'active' }).eq('id', old.id).eq('status', 'terminating');
    }
    throw new DemoError('The fictional workspace could not be prepared. The integration team can check the demo provisioning log.', 503, 'demo_seed_failed');
  }
}
