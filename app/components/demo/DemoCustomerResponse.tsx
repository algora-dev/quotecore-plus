'use client';
import { useEffect, useRef, useState } from 'react';
import { QcButton } from '@/app/components/ui/v2/QcButton';
import { DemoRequestError, demoJsonRequest, demoRequest } from '@/app/lib/demo/client-request';

export function DemoCustomerResponse({ token, initialStatus }: { token: string; initialStatus: string }) {
  const [status, setStatus] = useState(initialStatus); const [error, setError] = useState('');
  const [pending, setPending] = useState<'accepted' | 'declined' | null>(null); const [expired, setExpired] = useState(false);
  const busy = useRef(false); const alive = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  async function respond(choice: 'accepted' | 'declined') {
    if (busy.current || expired) return;
    busy.current = true; setPending(choice); setError('');
    try {
      const result = await demoRequest<{ status: string }>('/api/demo/quote-response', demoJsonRequest({ token, choice }));
      if (!['accepted', 'declined'].includes(result.status)) throw new Error('The response could not be confirmed. Refresh this quote before responding again.');
      if (alive.current) setStatus(result.status);
    } catch (cause) {
      if (!alive.current) return;
      if (cause instanceof DemoRequestError && cause.status === 410) setExpired(true);
      setError(cause instanceof Error ? cause.message : 'Could not record the demo response.');
    } finally { busy.current = false; if (alive.current) setPending(null); }
  }
  return <section className="mt-5 rounded-2xl border border-[var(--qc-border-divider)] bg-[var(--qc-bg-surface)] p-5 shadow-sm">
    <p className="text-xs font-bold uppercase tracking-wider text-[var(--qc-color-orange-ink)]">CUSTOMER VIEW</p><h2 className="mt-1 text-lg font-semibold text-[var(--qc-text-primary)]">Try responding to the quote</h2><p className="mt-2 text-sm leading-6 text-[var(--qc-text-secondary)]">This only changes the fictional demo job. Nothing is ordered, paid or emailed.</p>
    {status === 'accepted' || status === 'declined' ? <p role="status" className="mt-4 rounded-xl bg-[var(--qc-bg-subtle)] p-3 text-sm text-[var(--qc-text-primary)]">Demo response recorded: <strong>{status}</strong>. You can return to your demo tab.</p>
      : !expired && <div className="mt-4 grid gap-2 sm:grid-cols-2"><QcButton variant="primary" disabled={!!pending} onClick={() => void respond('accepted')}>{pending === 'accepted' ? 'Recording acceptance…' : 'Accept demo quote'}</QcButton><QcButton variant="secondary" disabled={!!pending} onClick={() => void respond('declined')}>{pending === 'declined' ? 'Recording decline…' : 'Decline demo quote'}</QcButton></div>}
    {error && <p role="alert" className="mt-3 rounded-xl bg-[var(--qc-color-danger-bg)] p-3 text-sm text-[var(--qc-color-danger)]">{expired ? 'This demo link has expired or the workspace was reset. No response was recorded.' : error}</p>}
  </section>;
}
