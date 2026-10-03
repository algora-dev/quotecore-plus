/** Push is a delivery surface for existing alerts, never model-authored text. */
export const PUSH_CATEGORIES = ['quotes', 'orders', 'invoices', 'suppliers'] as const;
export type PushCategory = typeof PUSH_CATEGORIES[number];
export const PUSH_DEVICE_COOKIE = 'qcp_push_device';
export const PUSH_WORKER = '/qcp-push-sw.js';
export type BrowserPushSubscription = { endpoint: string; keys: { p256dh: string; auth: string } };
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function pushCategories(value: unknown): PushCategory[] {
  if (!Array.isArray(value) || value.length > 4 || value.some(v => !PUSH_CATEGORIES.includes(v as PushCategory)) || new Set(value).size !== value.length)
    throw new Error('Choose valid notification categories.');
  return value as PushCategory[];
}
/** Only opaque delivery IDs leave the server. No names, amounts, or arbitrary URLs. */
export function notificationPayload(deliveryId: string) {
  if (!UUID.test(deliveryId)) throw new Error('Invalid delivery identity.');
  return { version: 1, kind: 'quotecore_alert', deliveryId } as const;
}
export function pushDestination(slug: string, alert: { quote_id?: string | null; order_id?: string | null; invoice_id?: string | null; alert_type?: string }) {
  if (!slug || slug.length > 200 || /[\u0000-\u001f]/.test(slug)) throw new Error('Invalid workspace.');
  const root = `/${encodeURIComponent(slug)}`;
  if (alert.quote_id && UUID.test(alert.quote_id)) return `${root}/quotes/${alert.quote_id}/summary?from=inbox`;
  if (alert.invoice_id && UUID.test(alert.invoice_id)) return `${root}/invoices/${alert.invoice_id}?from=inbox`;
  if (alert.order_id && UUID.test(alert.order_id)) return `${root}/material-orders/${alert.order_id}/preview?from=inbox`;
  return `${root}/${alert.alert_type === 'supplier_update' ? 'components' : 'inbox'}`;
}
export function retryDisposition(status: number | null, attempt: number, retryAfter: string | undefined, now = Date.now()) {
  if (status != null && status >= 200 && status < 300) return { outcome: 'sent' as const, delaySeconds: 0, revoke: false };
  if (status === 404 || status === 410) return { outcome: 'dead' as const, delaySeconds: 0, revoke: true };
  const retryable = status === null || status === 408 || status === 429 || (status >= 500 && status <= 599);
  if (!retryable || attempt >= 5) return { outcome: 'dead' as const, delaySeconds: 0, revoke: false };
  const supplied = retryAfter ? (/^\d+$/.test(retryAfter) ? Number(retryAfter) : (Date.parse(retryAfter) - now) / 1000) : 0;
  return { outcome: 'retry' as const, delaySeconds: Math.min(3600, Math.max(30 * 2 ** Math.max(0, attempt - 1), Number.isFinite(supplied) ? supplied : 0)), revoke: false };
}
