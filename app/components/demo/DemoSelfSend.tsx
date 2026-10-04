'use client';
import { useState, type FormEvent } from 'react';
import { QcButton } from '@/app/components/ui/v2/QcButton';
/** Demo send: enter an email, press send. No verification code (owner 2026-10-04).
 * The server caps sends at 3 per 24h and only ever emails the entered address. */
export function DemoSelfSend() {
  const [email, setEmail] = useState(''); const [pending, setPending] = useState(false); const [error, setError] = useState(''); const [sent, setSent] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); setPending(true); setError('');
    try {
      const response = await fetch('/api/demo/self-send', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setSent(true); setEmail(''); window.dispatchEvent(new Event('qc-demo-refresh'));
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not send the demo quote.'); }
    finally { setPending(false); }
  }
  if (sent) return <p role="status" className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm">Sent. Check your inbox or spam folder. The email only ever goes to the address you entered, up to 3 times per day. This is not a marketing subscription.</p>;
  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block text-sm font-semibold">Your email address
        <input className="mt-2 block min-h-11 w-full rounded-lg border border-slate-300 px-3 focus:outline-orange-500" type="email" value={email} onChange={event => setEmail(event.target.value)} maxLength={254} inputMode="email" autoComplete="email" required />
      </label>
      <p className="text-xs leading-5 text-slate-600">In this demo, sending only ever emails your own address. Attachments, follow-ups and editable email content are main-app features.</p>
      <QcButton variant="primary" disabled={pending} type="submit">{pending ? 'Sending…' : 'Send my demo quote'}</QcButton>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </form>
  );
}
