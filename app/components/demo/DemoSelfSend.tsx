'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { QcButton } from '@/app/components/ui/v2/QcButton';
import { DemoRequestError, demoJsonRequest, demoRequest } from '@/app/lib/demo/client-request';
import './demo-send.css';

/** Single explicit delivery, no automatic retry. Provider acceptance is not
 * delivery confirmation. Email ownership is not verified in this demo flow. */
export function DemoSelfSend({ quoteId, onPendingChange, onClose }: { quoteId?: string; onPendingChange?: (pending: boolean) => void; onClose?: () => void }) {
  const [email, setEmail] = useState(''); const [pending, setPending] = useState(false);
  const [error, setError] = useState(''); const [sentTo, setSentTo] = useState('');
  const busy = useRef(false); const alive = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy.current) return;
    const to = email.trim(); if (!to) return;
    busy.current = true; setPending(true); setError(''); onPendingChange?.(true);
    try {
      const result = await demoRequest<{ acceptedByProvider: boolean }>('/api/demo/self-send', demoJsonRequest({ email: to, ...(quoteId ? { quoteId } : {}) }), 30_000);
      if (result.acceptedByProvider !== true) throw new DemoRequestError('We could not confirm that the email was accepted. Check your inbox before trying again.', 502);
      if (!alive.current) return;
      setSentTo(to); setEmail(''); window.dispatchEvent(new Event('qc-demo-refresh'));
    } catch (cause) {
      if (!alive.current) return;
      const message = cause instanceof Error ? cause.message : 'Could not send the demo email.';
      setError(cause instanceof DemoRequestError && (cause.status === 0 || cause.status === 502)
        ? `${message} It may still arrive: check your inbox before sending again. No automatic retry has been made.` : message);
    } finally {
      busy.current = false;
      if (alive.current) { setPending(false); onPendingChange?.(false); }
    }
  }
  if (sentTo) return <div className="qc-demo-send-result">
    <div role="status"><strong>Your demo email is on its way</strong><p>The delivery provider accepted it for <span>{sentTo}</span>. Check your inbox or spam folder, then open the demo quote to try Accept or Decline.</p></div>
    <p>This is a fictional quote, not a contract. Sending did not add you to a marketing list.</p>
    {onClose && <QcButton variant="primary" onClick={onClose}>Back to the guided demo</QcButton>}
  </div>;
  return <form onSubmit={submit} className="qc-demo-send-form" aria-busy={pending}>
    <label>Your email address<input type="email" value={email} onChange={event => setEmail(event.target.value)} maxLength={254} inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} required disabled={pending} aria-describedby="qc-demo-send-note" /></label>
    <p id="qc-demo-send-note">We’ll send the guided demo quote to the address you enter. No attachments, follow-ups or marketing subscription. Demo send limits still apply after a reset.</p>
    {error && <p role="alert" className="qc-demo-send-error">{error}</p>}
    <QcButton variant="primary" pending={pending} type="submit">{pending ? 'Sending your demo quote…' : 'Email me the demo quote'}</QcButton>
  </form>;
}
