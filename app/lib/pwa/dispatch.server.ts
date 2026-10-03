import 'server-only';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { notificationPayload, retryDisposition } from './push-contracts';
import { pushDatabase } from './push-database';
import { sendWebPush, validateSubscription, type VapidConfig } from './web-push.server';
type Claim = { id: string; lease_token: string; attempts: number };
/** Bounded request-scoped worker. Provider acceptance is not device delivery.
 * At-least-once transport + unique outbox + stable Topic/notification tag. */
export async function dispatchPush(config: VapidConfig) {
 const db = pushDatabase(createAdminClient()), started = Date.now();
 const counts = { claimed: 0, accepted: 0, retry: 0, dead: 0, superseded: 0 };
 const { error: cleanupError } = await db.rpc('pwa_push_cleanup', {}).abortSignal(AbortSignal.timeout(5000));
 if (cleanupError) throw new Error('Push queue cleanup failed.');
 while (counts.claimed < 20 && Date.now() - started < 38000) {
  const { data, error } = await db.rpc('pwa_push_claim', { p_limit: 4 }).abortSignal(AbortSignal.timeout(5000));
  if (error || !Array.isArray(data)) throw new Error('Push claim failed.');
  const claims = data as unknown as Claim[]; if (!claims.length) break;
  counts.claimed += claims.length;
  await Promise.all(claims.map(async claim => {
   const { data: current, error: currentError } = await db.rpc('pwa_push_current', { p_delivery_id: claim.id, p_lease_token: claim.lease_token }).abortSignal(AbortSignal.timeout(5000));
   if (currentError) throw new Error('Push eligibility revalidation failed.');
   let status: number | null = null, retryAfter: string | undefined, revoked = false, suppressed = false;
   if (!current || Array.isArray(current) || typeof current !== 'object') suppressed = true;
   else {
    let subscription;
    try {
     if (current.vapid_public !== config.publicKey) throw new Error('Key rotated.');
     subscription = validateSubscription({ endpoint: current.endpoint, keys: { p256dh: current.p256dh, auth: current.auth } });
    } catch { revoked = true; }
    if (subscription) {
     try { const response = await sendWebPush(subscription, JSON.stringify(notificationPayload(claim.id)), claim.id.replace(/-/g, ''), config); status = response.status; retryAfter = response.retryAfter; }
     catch { /* Network outcome is unknown. Retry this SAME delivery identity. */ }
    }
   }
   const result = suppressed || revoked ? { outcome: 'dead' as const, delaySeconds: 0, revoke: revoked } : retryDisposition(status, claim.attempts, retryAfter);
   const { data: acknowledged, error: finishError } = await db.rpc('pwa_push_finish', {
    p_delivery_id: claim.id, p_lease_token: claim.lease_token, p_outcome: result.outcome, p_http_status: status,
    p_delay_seconds: Math.ceil(result.delaySeconds), p_revoke: result.revoke,
   }).abortSignal(AbortSignal.timeout(5000));
   if (finishError) throw new Error('Push acknowledgement failed; lease recovery must reconcile this delivery.');
   if (!acknowledged) counts.superseded++; else if (result.outcome === 'sent') counts.accepted++; else counts[result.outcome]++;
  }));
 }
 return counts;
}
