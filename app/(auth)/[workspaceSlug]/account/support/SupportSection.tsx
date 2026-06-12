'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useHelpDrawer } from '@/app/components/docs/HelpDrawerContext';
import { createSupportTicket, type TicketCategory, type TicketSummary } from './actions';

/**
 * Support tab content.
 *
 * Top half: ticket submission form.
 * Bottom half: the calling user's previous tickets, newest first.
 *
 * Submitting hits the `createSupportTicket` server action which:
 *   1. Validates + writes a row to `support_tickets`,
 *   2. Best-effort sends a notification email to info@quote-core.com via Resend,
 *   3. Returns success/failure to the form.
 *
 * If the email send fails the ticket still exists \u2014 the user gets a success
 * confirmation and the admin tools (Phase 2) can flag the unforwarded ones.
 */

const CATEGORIES: { value: TicketCategory; label: string; help: string }[] = [
  { value: 'bug', label: 'Bug', help: 'Something is broken or behaving oddly' },
  { value: 'question', label: 'Question', help: 'You need help figuring out how something works' },
  { value: 'billing', label: 'Billing', help: 'Plans, invoices, payments' },
  { value: 'feature_request', label: 'Feature request', help: 'An idea or improvement' },
  { value: 'other', label: 'Other', help: "Doesn't fit the categories above" },
];

const STATUS_BADGES: Record<TicketSummary['status'], { label: string; classes: string }> = {
  open: { label: 'Open', classes: 'bg-orange-50 text-orange-700 border-orange-200' },
  pending: { label: 'Pending', classes: 'bg-blue-50 text-blue-700 border-blue-200' },
  resolved: { label: 'Resolved', classes: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  closed: { label: 'Closed', classes: 'bg-slate-100 text-slate-600 border-slate-200' },
};

interface SupportSectionProps {
  initialTickets: TicketSummary[];
}

export function SupportSection({ initialTickets }: SupportSectionProps) {
  const [category, setCategory] = useState<TicketCategory>('question');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [tickets, setTickets] = useState<TicketSummary[]>(initialTickets);
  const [error, setError] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function reset() {
    setSubject('');
    setBody('');
    setCategory('question');
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccessId(null);

    const pageContext = typeof window !== 'undefined' ? window.location.pathname : null;
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : null;

    startTransition(async () => {
      const result = await createSupportTicket({
        subject,
        body,
        category,
        pageContext,
        userAgent,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setSuccessId(result.id);
      // Optimistic prepend so the user sees their new ticket in the list
      // without waiting for a refetch. Fields below the timestamp are
      // approximate \u2014 the next page refresh will reconcile them.
      const now = new Date().toISOString();
      setTickets((prev) => [
        {
          id: result.id,
          subject: subject.trim(),
          category,
          status: 'open',
          priority: 'normal',
          created_at: now,
          updated_at: now,
          message_count: 0,
        },
        ...prev,
      ]);
      reset();
    });
  }

  const pathname = usePathname();
  const workspaceSlug = pathname.split('/').filter(Boolean)[0] ?? '';
  const { openDrawer } = useHelpDrawer();

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Support</h2>
        <p className="text-sm text-slate-500 mt-1">
          Can&apos;t find what you need in the help docs? Send us a ticket and we&apos;ll get back to you by email.
        </p>
      </div>

      {/* Help & learning - self-serve before a ticket. */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-3">
        <h3 className="text-base font-semibold text-slate-900">Help &amp; learning</h3>
        <p className="text-sm text-slate-500">
          New to QuoteCore+ or stuck on a feature? These are the fastest ways to get going.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/${workspaceSlug}/tutorials`}
            className="inline-flex items-center gap-1.5 rounded-full bg-black px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-slate-800 hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            Tutorials
          </Link>
          <button
            type="button"
            onClick={openDrawer}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 hover:border-slate-400"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
            </svg>
            Open help docs
          </button>
        </div>
      </div>

      {/* New ticket form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
        <h3 className="text-base font-semibold text-slate-900">New ticket</h3>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1.5">Category</label>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {CATEGORIES.map((c) => {
              const isActive = category === c.value;
              return (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setCategory(c.value)}
                  title={c.help}
                  className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
                    isActive
                      ? 'border-orange-300 bg-orange-50 text-orange-700 shadow-[0_0_8px_rgba(255,107,53,0.15)]'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                  }`}
                >
                  {c.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label htmlFor="support-subject" className="block text-xs font-medium text-slate-600 mb-1.5">
            Subject
          </label>
          <input
            id="support-subject"
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            maxLength={200}
            placeholder="Short summary of what you need"
            required
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
          />
        </div>

        <div>
          <label htmlFor="support-body" className="block text-xs font-medium text-slate-600 mb-1.5">
            Describe your issue
          </label>
          <textarea
            id="support-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={8000}
            rows={6}
            placeholder="What happened, what you expected, and any steps to reproduce."
            required
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200 resize-y"
          />
          <p className="mt-1 text-[11px] text-slate-400">{body.length} / 8000 characters</p>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
        {successId && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            Ticket submitted. We&apos;ll reply by email as soon as we can.
          </div>
        )}

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={reset}
            disabled={isPending}
            className="px-3 py-1.5 text-sm rounded-full border border-slate-300 hover:bg-slate-50 disabled:opacity-50"
          >
            Reset
          </button>
          <button
            type="submit"
            disabled={isPending || subject.trim().length < 3 || body.trim().length < 5}
            className="px-4 py-1.5 text-sm font-semibold rounded-full bg-black text-white hover:bg-slate-800 transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? 'Sending...' : 'Send ticket'}
          </button>
        </div>
      </form>

      {/* Previous tickets */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
        <h3 className="text-base font-semibold text-slate-900">Your tickets</h3>
        {tickets.length === 0 ? (
          <p className="text-sm text-slate-500">You haven&apos;t submitted any tickets yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {tickets.map((t) => {
              const badge = STATUS_BADGES[t.status];
              return (
                <li key={t.id} className="py-3 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{t.subject}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {new Date(t.created_at).toLocaleString()} &middot; {t.category.replace('_', ' ')}
                    </p>
                  </div>
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${badge.classes}`}>
                    {badge.label}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
