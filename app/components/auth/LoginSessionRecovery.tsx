'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { attachLoginRecoveryEvents, createLoginRecovery, type RecoveryState } from '@/app/lib/auth/login-recovery';
import { RESUME_BUILD, suppressAutomaticResume } from '@/app/lib/auth/resume-contract';

/** Restored login documents need a fresh server check, not another password.
 * The response proves identity and MFA; the destination still enforces all of
 * its original permissions. Text/normal login remains the failure fallback. */
export function LoginSessionRecovery({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const [state, setState] = useState<RecoveryState>(enabled ? 'checking' : 'form');
  const [mayCheck, setMayCheck] = useState(false);
  const recovery = useRef<ReturnType<typeof createLoginRecovery> | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const search = new URLSearchParams(window.location.search);
    // The loop marker only suppresses AUTOMATIC navigation, not an explicit retry.
    search.delete('__qcp_resume');
    search.delete('redirect'); search.delete('next');
    setMayCheck(!suppressAutomaticResume(search, window.location.hash));
    const control = createLoginRecovery({
      search: () => new URLSearchParams(window.location.search), hash: () => window.location.hash,
      visible: () => !document.hidden, online: () => navigator.onLine !== false, now: Date.now,
      readStorage: key => sessionStorage.getItem(key), writeStorage: (key, value) => sessionStorage.setItem(key, value),
      probe: async (destination, signal, trigger) => {
        // No browser Supabase client: avoid competing token rotation. This GET
        // is read-only apart from the existing SDK's ordinary cookie refresh.
        const response = await fetch(`/api/auth/resume?redirect=${encodeURIComponent(destination)}`, {
          credentials: 'same-origin', cache: 'no-store', redirect: 'error', signal,
          headers: { 'X-QCP-Resume-Trigger': trigger,
            'X-QCP-Display-Mode': window.matchMedia?.('(display-mode: standalone)').matches ||
              (navigator as Navigator & { standalone?: boolean }).standalone ? 'standalone' : 'browser' },
        });
        return response.json();
      },
      navigate: destination => window.location.replace(destination), state: setState,
    });
    recovery.current = control;
    const detach = attachLoginRecoveryEvents(control, window, document);
    void control.start();
    return () => { detach(); recovery.current = null; };
  }, [enabled]);

  if (!enabled) return children;
  const checking = state === 'checking' || state === 'navigating';
  return <div data-qcp-session-recovery={RESUME_BUILD} data-recovery-state={state}>
    {checking && <main className="min-h-screen flex items-center justify-center px-6" aria-busy="true">
      <div role="status" className="max-w-md text-center">
        <h1 className="text-xl font-semibold">{state === 'navigating' ? 'Opening your workspace…' : 'Checking your saved sign-in…'}</h1>
        <p className="mt-3 text-sm text-slate-600">No password is needed if your existing session is still valid.</p>
      </div>
    </main>}
    {(state === 'unavailable' || state === 'loop') && <section className="mx-auto mt-5 max-w-md rounded-xl border border-amber-200 bg-amber-50 p-4" role="status">
      <p className="text-sm text-amber-950">{state === 'loop'
        ? 'Your saved sign-in did not complete the return to the app. You can check it again, or sign in below.'
        : 'Your saved sign-in could not be checked. This does not mean you have been signed out. Reconnect and try again, or sign in below.'}</p>
      {mayCheck && <button type="button" className="mt-3 min-h-11 underline font-semibold" onClick={() => void recovery.current?.start('manual')}>Check saved sign-in</button>}
    </section>}
    <div hidden={checking} onFocusCapture={() => recovery.current?.enteringCredentials()}
      onPointerDownCapture={() => recovery.current?.enteringCredentials()} onSubmitCapture={() => recovery.current?.enteringCredentials()}>
      {children}
    </div>
  </div>;
}
