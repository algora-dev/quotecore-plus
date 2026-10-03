import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { PUSH_CATEGORIES, PUSH_DEVICE_COOKIE, UUID, pushCategories } from '@/app/lib/pwa/push-contracts';
import { pushEndpoint, validateSubscription } from '@/app/lib/pwa/web-push.server';
import { pushActor, pushConfig, PushHttpError, sameOrigin, boundedPushBody } from '@/app/lib/pwa/push-auth.server';
import { pushDatabase } from '@/app/lib/pwa/push-database';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const json = (value: unknown, status = 200) => NextResponse.json(value, { status, headers: { 'Cache-Control': 'private, no-store' } });
const failure = (error: unknown) => json({ error: error instanceof PushHttpError ? error.message : 'Notifications are unavailable. Retry or ask your administrator to check the push migration/configuration.' }, error instanceof PushHttpError ? error.status : 503);
async function deviceId() { const id = (await cookies()).get(PUSH_DEVICE_COOKIE)?.value; return id && UUID.test(id) ? id : null; }
export async function GET() {
 try {
  const { client, companyId, userId } = await pushActor(), config = pushConfig();
  if (!config) return json({ enabled: false, subscribed: false, categories: PUSH_CATEGORIES, companyId });
  const id = await deviceId(); let subscribed = false, categories: string[] = [...PUSH_CATEGORIES];
  if (id) { const { data, error } = await pushDatabase(client).from('pwa_push_subscriptions').select('enabled,categories,vapid_public').eq('id', id).eq('company_id', companyId).eq('user_id', userId).maybeSingle(); if (error) throw error; if (data) { subscribed = data.enabled && data.vapid_public === config.publicKey; categories = data.categories; } }
  return json({ enabled: true, publicKey: config.publicKey, subscribed, categories, companyId });
 } catch (error) { return failure(error); }
}
export async function POST(request: Request) {
 try {
  sameOrigin(request); const body = await boundedPushBody(request);
  const { client } = await pushActor(), db = pushDatabase(client), operation = body.operation;
  if (!['subscribe','disable','touch','preferences'].includes(String(operation))) throw new PushHttpError(400, 'Unknown notification operation.');
  if (Object.keys(body).some(k => !['operation','subscription','publicKey','categories','endpoint'].includes(k))) throw new PushHttpError(400, 'Unexpected notification fields.');
  const id = await deviceId();
  if (operation === 'subscribe') {
   const config = pushConfig(); if (!config) throw new PushHttpError(404, 'Push notifications are not enabled.');
   if (body.publicKey !== config.publicKey) throw new PushHttpError(409, 'Push configuration changed. Reload before enabling notifications.');
   let subscription; let categories;
   try { subscription = validateSubscription(body.subscription); categories = pushCategories(body.categories); } catch { throw new PushHttpError(400, 'Invalid or unsupported browser subscription/categories.'); }
   const { data, error } = await db.rpc('pwa_push_subscribe', { p_endpoint: subscription.endpoint, p_p256dh: subscription.keys.p256dh, p_auth: subscription.keys.auth, p_vapid_public: config.publicKey, p_categories: categories });
   if (error || !data) throw error ?? new Error('Missing subscription identity.');
   const response = json({ ok: true, subscribed: true });
   response.cookies.set(PUSH_DEVICE_COOKIE, data, { httpOnly: true, secure: new URL(request.url).protocol === 'https:', sameSite: 'lax', path: '/', maxAge: 90 * 86400 });
   return response;
  }
  if (body.endpoint != null) { try { pushEndpoint(body.endpoint as string); } catch { throw new PushHttpError(400, 'Invalid endpoint.'); } }
  const endpoint = typeof body.endpoint === 'string' ? body.endpoint : null;
  if (!id && !endpoint) return json({ ok: true, registered: false });
  let categories: string[] | null = null;
  if (operation === 'preferences') { try { categories = pushCategories(body.categories); } catch { throw new PushHttpError(400, 'Invalid categories.'); } }
  const { data, error } = await db.rpc('pwa_push_manage', { p_operation: String(operation), p_subscription_id: operation === 'disable' && endpoint ? null : id, p_endpoint: endpoint, p_categories: categories });
  if (error) throw error;
  const response = json({ ok: true, registered: data });
  if (operation === 'disable') response.cookies.set(PUSH_DEVICE_COOKIE, '', { httpOnly: true, sameSite: 'lax', secure: new URL(request.url).protocol === 'https:', path: '/', maxAge: 0 });
  return response;
 } catch (error) { return failure(error); }
}
