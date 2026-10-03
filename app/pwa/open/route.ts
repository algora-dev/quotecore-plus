import { NextResponse } from 'next/server';
import { pushActor, PushHttpError } from '@/app/lib/pwa/push-auth.server';
import { pushDatabase } from '@/app/lib/pwa/push-database';
import { pushDestination, UUID } from '@/app/lib/pwa/push-contracts';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
 const url = new URL(request.url), deliveryId = url.searchParams.get('delivery');
 const go = (path: string) => { const response = NextResponse.redirect(new URL(path, url.origin)); response.headers.set('Cache-Control', 'private, no-store'); return response; };
 if (!deliveryId || !UUID.test(deliveryId)) return go('/assistant');
 try {
  const { client, userId, companyId } = await pushActor();
  const { data: company, error: companyError } = await client.from('companies').select('slug').eq('id', companyId).maybeSingle();
  if (companyError || !company?.slug) throw new Error('Workspace unavailable.');
  const fallback = `/${encodeURIComponent(company.slug)}/inbox`;
  const { data: delivery, error } = await pushDatabase(client).from('pwa_push_deliveries').select('alert_id').eq('id', deliveryId).eq('company_id', companyId).eq('user_id', userId).maybeSingle();
  if (error) throw error; if (!delivery) return go(fallback);
  const { data: alert, error: alertError } = await client.from('alerts').select('quote_id,invoice_id,order_id,alert_type').eq('id', delivery.alert_id).eq('company_id', companyId).maybeSingle();
  if (alertError) throw alertError; if (!alert) return go(fallback);
  // RLS + a fresh explicit tenant predicate, not a URL stored in the push payload.
  if (alert.quote_id) {
   const result = await client.from('quotes').select('id').eq('id', alert.quote_id).eq('company_id', companyId).maybeSingle();
   if (result.error || !result.data) return go(fallback);
  } else if (alert.invoice_id) {
   const result = await client.from('invoices').select('id').eq('id', alert.invoice_id).eq('company_id', companyId).maybeSingle();
   if (result.error || !result.data) return go(fallback);
  } else if (alert.order_id) {
   const result = await client.from('material_orders').select('id').eq('id', alert.order_id).eq('company_id', companyId).maybeSingle();
   if (result.error || !result.data) return go(fallback);
  }
  return go(pushDestination(company.slug, alert));
 } catch (error) {
  if (error instanceof PushHttpError && error.status === 401) return go(`/login?redirect=${encodeURIComponent(`/pwa/open?delivery=${deliveryId}`)}`);
  return new NextResponse('This notification could not be opened. Sign in to the correct workspace and open the Message Center.', { status: error instanceof PushHttpError ? error.status : 503, headers: { 'Cache-Control': 'private, no-store', 'Content-Type': 'text/plain; charset=utf-8' } });
 }
}
