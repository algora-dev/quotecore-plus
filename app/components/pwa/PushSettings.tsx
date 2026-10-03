'use client';
import { useEffect, useState } from 'react';
import { PUSH_CATEGORIES, PUSH_WORKER, type PushCategory } from '@/app/lib/pwa/push-contracts';
type Configuration = { enabled: boolean; publicKey?: string; subscribed: boolean; categories: PushCategory[]; companyId?: string };
async function post(body: Record<string, unknown>) {
 const response = await fetch('/api/pwa/push', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
 const result = await response.json(); if (!response.ok) throw new Error(result.error ?? 'Notification settings could not be saved.'); return result;
}
function keyBytes(value: string): ArrayBuffer {
 const text = atob(value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4));
 const bytes = new Uint8Array(text.length); for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i); return bytes.buffer;
}
export function PushSettings({ companyId }: { companyId: string }) {
 const [config, setConfig] = useState<Configuration | null>(null), [categories, setCategories] = useState<PushCategory[]>([...PUSH_CATEGORIES]);
 const [busy, setBusy] = useState(false), [message, setMessage] = useState('Loading notification settings…');
 const supported = typeof window !== 'undefined' && window.isSecureContext && 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
 useEffect(() => {
  let cancelled = false;
  fetch('/api/pwa/push', { cache: 'no-store', credentials: 'same-origin' }).then(async response => {
   const result = await response.json(); if (!response.ok) throw new Error(result.error ?? 'Settings unavailable.');
   if (result.companyId && result.companyId !== companyId) throw new Error('Switch to your own signed-in workspace to manage device notifications.');
   if (!cancelled) { setConfig(result); setCategories(result.categories ?? [...PUSH_CATEGORIES]); setMessage(''); }
  }).catch(error => { if (!cancelled) setMessage(error instanceof Error ? error.message : 'Settings unavailable.'); });
  return () => { cancelled = true; };
 }, [companyId]);
 async function enable() {
  if (!supported || !config?.publicKey) return;
  setBusy(true); setMessage('');
  let newlySubscribed: PushSubscription | null = null;
  try {
   // This call stays in the explicit click handler, before any network await.
   const permission = await Notification.requestPermission();
   if (permission !== 'granted') { setMessage('Notifications were not enabled. You can change permission in your browser or device settings.'); return; }
   const previous = await navigator.serviceWorker.getRegistration('/');
   if (previous?.active && new URL(previous.active.scriptURL).pathname !== PUSH_WORKER) throw new Error('Another service worker controls this app. Ask your integration agent to merge the push handlers rather than replace it.');
   const registration = await navigator.serviceWorker.register(PUSH_WORKER, { scope: '/', updateViaCache: 'none' });
   await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('The notification worker did not activate. Reload and retry.')), 10000);
    navigator.serviceWorker.ready.then(() => { clearTimeout(timer); resolve(); }, error => { clearTimeout(timer); reject(error); });
   });
   const existing = await registration.pushManager.getSubscription();
   if (existing) { await post({ operation: 'disable', endpoint: existing.endpoint }); await existing.unsubscribe(); }
   newlySubscribed = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(config.publicKey) });
   await post({ operation: 'subscribe', subscription: newlySubscribed.toJSON(), publicKey: config.publicKey, categories });
   setConfig({ ...config, subscribed: true }); setMessage('Notifications enabled for this device. Alert details stay inside the authenticated app.');
  } catch (error) {
   // If server registration fails, do not retain an orphaned browser subscription.
   if (newlySubscribed) await newlySubscribed.unsubscribe().catch(() => false);
   setConfig(previous => previous ? { ...previous, subscribed: false } : previous);
   setMessage(error instanceof Error ? error.message : 'Notifications could not be enabled.');
  } finally { setBusy(false); }
 }
 async function disable() {
  setBusy(true); setMessage('');
  try {
   const registration = supported ? await navigator.serviceWorker.getRegistration('/') : undefined;
   const subscription = await registration?.pushManager.getSubscription();
   await post({ operation: 'disable', ...(subscription ? { endpoint: subscription.endpoint } : {}) });
   setConfig(previous => previous ? { ...previous, subscribed: false } : previous);
   if (subscription) await subscription.unsubscribe();
   setMessage('Notifications disabled for this device.');
  } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not confirm that notifications were disabled.'); }
  finally { setBusy(false); }
 }
 return <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
  <h2 className="font-semibold">Device notifications</h2>
  <p className="text-sm text-slate-600">Opt in to existing QuoteCore alerts. Lock-screen messages do not include customer names, prices or quote details. Tapping an alert checks your current account and opens its source in QuoteCore.</p>
  {message && <p role="status" className="text-sm">{message}</p>}
  {config && !config.enabled && <p className="text-sm">Push delivery has not been enabled by your administrator.</p>}
  {config?.enabled && !supported && <p className="text-sm">This browser does not expose Web Push here. On iPhone, use the installed home-screen app over HTTPS.</p>}
  {config?.enabled && supported && <fieldset disabled={busy} className="space-y-3"><legend className="sr-only">Notification preferences</legend>
   <div className="flex flex-wrap gap-4">{PUSH_CATEGORIES.map(category => <label key={category} className="flex items-center gap-2 text-sm capitalize"><input type="checkbox" checked={categories.includes(category)} onChange={e => setCategories(current => e.target.checked ? [...current, category] : current.filter(c => c !== category))}/>{category}</label>)}</div>
   {!categories.length && <p className="text-sm">No categories are selected; no pushes will be sent.</p>}
   <div className="flex flex-wrap gap-2">{config.subscribed ? <><button type="button" onClick={disable} className="rounded-full border px-4 py-2 text-sm">Disable on this device</button><button type="button" onClick={async () => { setBusy(true); try { await post({ operation: 'preferences', categories }); setMessage('Notification categories saved for this device.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Save failed.'); } finally { setBusy(false); } }} className="rounded-full border px-4 py-2 text-sm">Save categories</button></> : <button type="button" onClick={enable} className="rounded-full bg-orange-500 px-4 py-2 text-sm font-semibold text-white">Enable on this device</button>}</div>
   {busy && <p role="status" className="text-sm">Updating device notifications…</p>}
  </fieldset>}
 </section>;
}
