import 'server-only';
import { cache } from 'react';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { readGuide, isSessionActive, type ActiveDemoContext } from './model';
export type { DemoGuideState, DemoGuideChapter, ActiveDemoContext } from './model';
const FIELDS = 'id, anon_user_id, company_id, ip_hmac, activated_at, created_at, expires_at, tutorial_state, reset_count, status';
export async function readActiveDemoContext(companyId: string, anonUserId?: string): Promise<ActiveDemoContext | null> {
  const admin = createAdminClient();
  let query = admin.from('demo_sessions').select(FIELDS).eq('company_id', companyId).eq('status', 'active');
  if (anonUserId) query = query.eq('anon_user_id', anonUserId);
  const { data, error } = await query.order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (error) throw new Error('Demo session verification unavailable.');
  if (!data?.company_id || !data.expires_at || !isSessionActive(data.status, data.expires_at)) return null;
  return { sessionId: data.id, anonUserId: data.anon_user_id, companyId: data.company_id,
    expiresAt: data.expires_at, activatedAt: data.activated_at ?? data.created_at, ipHmac: data.ip_hmac ?? '',
    tutorialState: readGuide(data.tutorial_state), resetCount: data.reset_count ?? 0 };
}
export const getActiveDemoContext = cache(readActiveDemoContext);
/** Includes expired/reset demos: egress must stay blocked after logical expiry. */
export async function isDemoCompany(companyId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data, error } = await admin.from('demo_sessions').select('id').eq('company_id', companyId).limit(1).maybeSingle();
  if (error) throw new Error('Could not verify company safety.');
  if (data) return true;
  const co = await admin.from('companies').select('plan_code').eq('id', companyId).maybeSingle();
  if (co.error) throw new Error('Could not verify company safety.');
  return co.data?.plan_code === 'demo';
}
