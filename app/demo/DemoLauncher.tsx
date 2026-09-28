'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createDemoBrowserClient } from '@/app/lib/demo/browser-client';

/**
 * Start button for the public demo entry. Flow: anonymous sign-in into the
 * DEMO cookie namespace (isolated from any normal session in this browser)
 * → provision/resume sandbox via /api/demo/start → straight into the app.
 */
export function DemoLauncher() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const demo = createDemoBrowserClient();
      const { data: { session } } = await demo.auth.getSession();
      if (!session) {
        const { error: signInError } = await demo.auth.signInAnonymously();
        if (signInError) throw new Error(signInError.message);
      }
      const res = await fetch('/api/demo/start', { method: 'POST' });
      const body = (await res.json().catch(() => ({}))) as { slug?: string; error?: string };
      if (!res.ok || !body.slug) throw new Error(body.error || 'Could not start the demo. Try again shortly.');
      router.push('/' + body.slug);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start the demo. Try again shortly.');
      setBusy(false);
    }
  }

  return (
    <div className="mt-6">
      <button
        onClick={start}
        disabled={busy}
        className="w-full rounded-full bg-[#FF6B35] px-5 py-3 text-sm font-semibold text-white hover:brightness-105 disabled:opacity-60"
      >
        {busy ? 'Preparing your workspace…' : 'Start the demo'}
      </button>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </div>
  );
}
