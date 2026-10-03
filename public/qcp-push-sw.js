/* QuoteCore push-only service worker. Intentionally NO fetch handler, auth cache,
 * precache, background AI, or offline business data. */
'use strict';
const DELIVERY_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('push', event => {
 let deliveryId = null;
 try { const data = event.data?.json(); if (data?.version === 1 && data.kind === 'quotecore_alert' && typeof data.deliveryId === 'string' && DELIVERY_ID.test(data.deliveryId)) deliveryId = data.deliveryId; } catch { /* Always display a safe fallback; no data-authored text. */ }
 event.waitUntil(self.registration.showNotification('QuoteCore+', {
  body: 'You have a new workspace alert. Open QuoteCore to view it.',
  icon: '/icons/icon-192.png', badge: '/icons/icon-192.png',
  tag: deliveryId ? `qcp-${deliveryId}` : 'qcp-alert', renotify: false,
  data: { deliveryId },
 }));
});
self.addEventListener('notificationclick', event => {
 event.notification.close();
 const id = event.notification.data?.deliveryId;
 const path = typeof id === 'string' && DELIVERY_ID.test(id) ? `/pwa/open?delivery=${encodeURIComponent(id)}` : '/assistant';
 const target = new URL(path, self.location.origin).href;
 event.waitUntil((async () => {
  const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  // Reuse only this resolver tab. Never navigate an in-progress quote builder
  // away from unsaved work just because a notification was tapped.
  const existing = windows.find(client => client.url === target);
  if (existing && 'focus' in existing) return existing.focus();
  return self.clients.openWindow(target);
 })());
});
