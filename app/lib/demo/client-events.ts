'use client';
import { isDemoLocation } from './routing';
export function refreshDemoGuide(): void {
  if (typeof window !== 'undefined' && isDemoLocation(window.location.hostname, window.location.pathname)) window.dispatchEvent(new Event('qc-demo-refresh'));
}
/** Invoked by the real Test Component success callback, never by a Next button.
 * The endpoint re-reads ownership and runs the same pricing test server-side. */
export async function demoComponentCalculated(componentId: string | null): Promise<void> {
  if (!componentId || typeof window === 'undefined' || !isDemoLocation(window.location.hostname, window.location.pathname)) return;
  try {
    const response = await fetch('/api/demo/checkpoint', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'test-component', componentId }) });
    if (response.ok) refreshDemoGuide();
    else console.warn('[demo] component test guide acknowledgement pending');
  } catch { /* Product calculation remains visible; guide offers a retry. */ }
}
