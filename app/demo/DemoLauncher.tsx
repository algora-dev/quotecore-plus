'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createDemoBrowserClient } from '@/app/lib/demo/browser-client';

type StartResult = { slug: string; sessionId: string; resumed?: boolean; expiresAt?: string | null };
type DemoSystem = 'metric' | 'imperial_ft' | 'imperial_rs';

/**
 * Launcher (owner direction 2026-10-05): the measurement system is the single
 * choice at entry - first-time visitors pick Metric / Imperial / Roofing
 * squares and the sandbox is seeded for it. Returning visitors get the
 * continue-or-start-again card. Landing inside the ~15s provisioning window
 * waits and auto-retries with the SAME chosen system instead of dead-ending.
 */
export function DemoLauncher() {
  const router = useRouter();
  const [error, setError] = useState<{ message: string; retryPreparing?: boolean } | null>(null);
  const [existing, setExisting] = useState<StartResult | null>(null);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [resetting, setResetting] = useState(false);
  const started = useRef(false);
  const chosenSystem = useRef<DemoSystem>('metric');

  async function establishIdentity() {
    // Expiry cleanup may have deleted the old anonymous identity while its
    // browser cookie still exists. Clear this namespace only, then remint.
    const demo = createDemoBrowserClient();
    const { data: { user }, error: identityError } = await demo.auth.getUser();
    if (user && user.is_anonymous !== true) throw new Error('The demo requires its own anonymous session. Your normal account has not been changed.');
    if (identityError || !user) {
      await demo.auth.signOut({ scope: 'local' });
      const { error: signInError } = await demo.auth.signInAnonymously();
      if (signInError) throw new Error(signInError.message);
    }
  }

  const startWithSystem = useCallback(async (system: DemoSystem): Promise<void> => {
    chosenSystem.current = system;
    setError(null);
    setPreparing(true);
    try {
      const res = await fetch('/api/demo/start', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ system }),
      });
      const body = (await res.json().catch(() => ({}))) as StartResult & { error?: string; code?: string };
      if (!res.ok || !body.slug) {
        // Seeding is in flight (~15s): wait, then retry automatically.
        if (body.code === 'demo_provisioning') { setError({ message: 'Your demo workspace is still being prepared - one moment.', retryPreparing: true }); return; }
        throw new Error(body.error || 'Could not start the demo. Try again shortly.');
      }
      if (body.resumed) { setExisting(body); return; }
      router.replace('/' + body.slug);
    } finally {
      setPreparing(false);
    }
  }, [router]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void (async () => {
      try {
        await establishIdentity();
        // Read-only probe: resumable session or first-time setup? The units
        // choice must land BEFORE any seed write, so nothing is provisioned
        // until the visitor picks a system.
        const res = await fetch('/api/demo/start', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ probe: true }) });
        const body = (await res.json().catch(() => ({}))) as Partial<StartResult> & { needsSetup?: boolean; error?: string };
        if (!res.ok) throw new Error(body.error || 'Could not start the demo. Try again shortly.');
        if (body.slug && body.sessionId) { setExisting({ slug: body.slug, sessionId: body.sessionId, expiresAt: body.expiresAt ?? null }); return; }
        setNeedsSetup(true);
      } catch (e) {
        setError({ message: e instanceof Error ? e.message : 'Could not start the demo. Try again shortly.' });
      }
    })();
  }, []);

  // Auto-retry while seeding is in flight, preserving the chosen system.
  useEffect(() => {
    if (!error?.retryPreparing) return;
    const timer = setTimeout(() => {
      void startWithSystem(chosenSystem.current).catch(e => setError({ message: e instanceof Error ? e.message : 'Could not start the demo. Try again shortly.' }));
    }, 5000);
    return () => clearTimeout(timer);
  }, [error, startWithSystem]);

  async function startFresh() {
    if (!existing || resetting) return;
    setResetting(true); setError(null);
    try {
      const res = await fetch('/api/demo/reset', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sessionId: existing.sessionId, confirm: 'RESET' }) });
      const body = (await res.json().catch(() => ({}))) as StartResult & { error?: string };
      if (!res.ok || !body.slug) throw new Error(body.error || 'Could not start a fresh demo. Try again shortly.');
      window.location.assign('/' + body.slug);
    } catch (e) {
      setError({ message: e instanceof Error ? e.message : 'Could not start a fresh demo. Try again shortly.' });
      setResetting(false);
    }
  }

  if (resetting) {
    return (
      <div className="w-full max-w-sm rounded-lg border border-amber-200 bg-amber-50 p-6 text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-orange-500" aria-hidden="true" />
        <p className="mt-3 text-sm font-semibold text-slate-800">Preparing your fresh demo</p>
        <p className="mt-1 text-xs text-slate-600">This takes about 15 seconds. Keep this tab open.</p>
      </div>
    );
  }

  if (existing) {
    const until = existing.expiresAt ? new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(existing.expiresAt)) : null;
    return (
      <div className="w-full max-w-sm rounded-lg border border-amber-200 bg-amber-50 p-6 space-y-4 text-center">
        <p className="text-sm font-semibold text-slate-800">You have a demo in progress{until ? ` (available until ${until})` : ''}</p>
        <p className="text-xs text-slate-600">Continue where you left off, or start again with a completely fresh workspace. Your Smart Assistant and send allowances carry over either way.</p>
        <div className="flex flex-col gap-2">
          <button onClick={() => router.replace('/' + existing.slug)} className="qc-flow-control qc-button px-6 py-3 bg-black text-white font-semibold rounded-lg hover:bg-slate-800 transition-colors">Continue my demo</button>
          <button onClick={() => void startFresh()} className="qc-flow-control qc-button px-6 py-3 bg-white text-slate-800 font-semibold rounded-lg border border-slate-300 hover:bg-slate-50 transition-colors">Start again - fresh workspace</button>
        </div>
        {error && <p className="text-sm text-red-700" role="alert">{error.message}</p>}
      </div>
    );
  }

  if (needsSetup) {
    const choices: { system: DemoSystem; title: string; subtitle: string }[] = [
      { system: 'metric', title: 'Metric', subtitle: 'm, m²' },
      { system: 'imperial_ft', title: 'Imperial', subtitle: 'ft, ft²' },
      { system: 'imperial_rs', title: 'Roofing squares', subtitle: 'ft, RS' },
    ];
    return (
      <div className="w-full max-w-sm rounded-lg border border-amber-200 bg-amber-50 p-6 space-y-4 text-center">
        <p className="text-sm font-semibold text-slate-800">How do you measure?</p>
        <p className="text-xs text-slate-600">Pick your measurement system. This is the only choice - everything in the demo works in it. Pricing currency follows your location automatically.</p>
        <div className="flex flex-col gap-2">
          {choices.map(choice => (
            <button
              key={choice.system}
              disabled={preparing}
              onClick={() => void startWithSystem(choice.system).catch(e => setError({ message: e instanceof Error ? e.message : 'Could not start the demo. Try again shortly.' }))}
              className="qc-flow-control qc-button px-6 py-3 bg-black text-white font-semibold rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-60"
            >
              {choice.title} <span className="ml-1 text-xs font-normal text-slate-300">{choice.subtitle}</span>
            </button>
          ))}
        </div>
        {preparing && <p className="text-xs text-slate-600" role="status">Preparing your demo workspace… this takes about 15 seconds.</p>}
        {error && <p className="text-sm text-red-700" role="alert">{error.message}</p>}
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full max-w-sm rounded-lg border border-amber-200 bg-amber-50 p-4 text-center">
        <p className="text-sm text-slate-700">{error.message}</p>
        {error.retryPreparing
          ? <p className="mt-2 text-xs text-slate-500">Retrying automatically every few seconds…</p>
          : <button onClick={() => window.location.reload()} className="qc-flow-control qc-button mt-3 px-6 py-3 bg-black text-white font-semibold rounded-lg hover:bg-slate-800 transition-colors">Try again</button>}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3" role="status" aria-live="polite">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-orange-500" aria-hidden="true" />
      <p className="text-sm text-slate-600">Preparing your demo workspace…</p>
    </div>
  );
}
