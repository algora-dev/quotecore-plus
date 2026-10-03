'use client';
import { useEffect } from 'react';
import { PUSH_WORKER } from '@/app/lib/pwa/push-contracts';
/** Never registers, requests permission, or re-enables a subscription. */
export function PushSessionBridge() {
 useEffect(() => {
  if (!('serviceWorker' in navigator) || !('Notification' in window)) return;
  let cancelled = false, lastAttempt = 0;
  async function refresh() {
   if (cancelled || document.hidden || Date.now() - lastAttempt < 600000) return;
   lastAttempt = Date.now();
   try {
    const registration = await navigator.serviceWorker.getRegistration('/');
    if (!registration?.active || new URL(registration.active.scriptURL).pathname !== PUSH_WORKER) return;
    const subscription = await registration.pushManager.getSubscription();
    if (cancelled) return;
    await fetch('/api/pwa/push', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ operation: Notification.permission === 'granted' && subscription ? 'touch' : 'disable', ...(subscription ? { endpoint: subscription.endpoint } : {}) }) });
   } catch { /* Offline/expired sessions do not cause a sign-out or a new opt-in. */ }
  }
  void refresh(); document.addEventListener('visibilitychange', refresh); window.addEventListener('online', refresh);
  return () => { cancelled = true; document.removeEventListener('visibilitychange', refresh); window.removeEventListener('online', refresh); };
 }, []);
 return null;
}
