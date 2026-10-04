'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createDemoBrowserClient } from '@/app/lib/demo/browser-client';

/**
 * Auto-start launcher (owner direction 2026-09-28: no middle step).
 * Landing on /demo immediately mints/resumes the anonymous demo session and
 * provisions the sandbox, then routes straight into the workspace. The only
 * visible state is a brief "preparing" beat; errors offer a single retry.
 */
export function DemoLauncher() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void (async () => {
      try {
        const demo = createDemoBrowserClient();
        const { data: { user }, error: identityError } = await demo.auth.getUser();
        if (user && user.is_anonymous !== true) throw new Error('The demo requires its own anonymous session. Your normal account has not been changed.');
        if (identityError || !user) {
          // Expiry cleanup may have deleted the old anonymous identity while its
          // browser cookie still exists. Clear this namespace only, then remint.
          await demo.auth.signOut({ scope: 'local' });
          const { error: signInError } = await demo.auth.signInAnonymously();
          if (signInError) throw new Error(signInError.message);
        }
        const res = await fetch('/api/demo/start', { method: 'POST' });
        const body = (await res.json().catch(() => ({}))) as { slug?: string; error?: string };
        if (!res.ok || !body.slug) throw new Error(body.error || 'Could not start the demo. Try again shortly.');
        router.replace('/' + body.slug);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not start the demo. Try again shortly.');
      }
    })();
  }, [router]);

  if (error) {
    return (
      <div className="w-full max-w-sm rounded-lg border border-amber-200 bg-amber-50 p-4 text-center">
        <p className="text-sm text-slate-700">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="qc-flow-control qc-button mt-3 px-6 py-3 bg-black text-white font-semibold rounded-lg hover:bg-slate-800 transition-colors"
        >
          Try again
        </button>
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
