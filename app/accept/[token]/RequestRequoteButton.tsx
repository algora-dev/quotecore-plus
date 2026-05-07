'use client';

/**
 * Customer-facing "Request a Re-Quote" button + modal.
 *
 * Shown on the public acceptance page in three different states:
 *   - active:    quote is live; this is a softer alternative to Accept/Decline
 *   - responded: quote was already accepted/declined; lets the customer reopen
 *   - expired:   the link has aged out; converts a dead link into a lead
 *
 * Submission posts a structured note to the user's dashboard (alert + DB row).
 * The confirmation panel ALSO reveals the user's email as a `mailto:` link
 * pre-filled with the same notes so the customer can email directly if they
 * prefer that channel.
 */

import { useState } from 'react';
import { submitRevisionRequest, getQuoteContactInfo } from './actions';

type Variant = 'active' | 'responded' | 'expired';

interface Props {
  token: string;
  variant: Variant;
  /** Name we already know about the customer (from the quote record). */
  defaultCustomerName?: string | null;
  /** Email we already know (from the quote record). */
  defaultCustomerEmail?: string | null;
}

const VARIANT_COPY: Record<Variant, { trigger: string; heading: string; intro: string }> = {
  active: {
    trigger: 'Request changes to this quote',
    heading: 'Request a revised quote',
    intro: 'Tell the team what you would like changed and they will get back to you with an updated quote.',
  },
  responded: {
    trigger: 'Request a new quote with changes',
    heading: 'Request a new quote',
    intro: "You've already responded to this quote. If your needs have changed, let the team know and they'll prepare a fresh quote for you.",
  },
  expired: {
    trigger: 'Request a fresh quote',
    heading: 'Request a fresh quote',
    intro: "This quote link has expired. Tell the team what you need and they'll send you an up-to-date quote.",
  },
};

export function RequestRequoteButton({ token, variant, defaultCustomerName, defaultCustomerEmail }: Props) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const [name, setName] = useState(defaultCustomerName ?? '');
  const [email, setEmail] = useState(defaultCustomerEmail ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Loaded after a successful submission so we can show the mailto fallback.
  const [contactInfo, setContactInfo] = useState<{
    contactEmail: string | null;
    companyName: string | null;
    quoteNumber: number | null;
    customerName: string | null;
  } | null>(null);

  const copy = VARIANT_COPY[variant];

  // Trigger style: black on the active state (it's a competing CTA so we
  // intentionally keep it secondary), bordered on the dead-end states (where
  // it's the primary action available).
  const triggerClass =
    variant === 'active'
      ? 'inline-flex items-center justify-center w-full rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition'
      : 'inline-flex items-center justify-center w-full rounded-full bg-black px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 hover:shadow-[0_0_12px_rgba(255,107,53,0.4)] transition';

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      const res = await submitRevisionRequest(token, notes, name || null, email || null);
      if (!res.success) {
        setError(res.error);
        return;
      }
      // Fire-and-display the contact info after successful save so the
      // mailto fallback is ready.
      const info = await getQuoteContactInfo(token);
      setContactInfo(info);
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  function buildMailtoHref(): string | null {
    if (!contactInfo?.contactEmail) return null;
    const subjectBits: string[] = ['Re-quote request'];
    if (contactInfo.quoteNumber !== null) subjectBits.push(`#${contactInfo.quoteNumber}`);
    if (name || contactInfo.customerName) subjectBits.push(`\u2014 ${name || contactInfo.customerName}`);
    const subject = encodeURIComponent(subjectBits.join(' '));

    const bodyParts = [
      'Hi,',
      '',
      `I'd like to request a revised quote${contactInfo.quoteNumber !== null ? ` for #${contactInfo.quoteNumber}` : ''}.`,
      '',
      'My notes:',
      notes || '(I will add details when we connect.)',
      '',
      name ? `Thanks, ${name}` : 'Thanks',
    ];
    const body = encodeURIComponent(bodyParts.join('\n'));

    return `mailto:${contactInfo.contactEmail}?subject=${subject}&body=${body}`;
  }

  function reset() {
    setOpen(false);
    setSubmitted(false);
    setError(null);
    setNotes('');
    setContactInfo(null);
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={triggerClass}>
        {copy.trigger}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            {!submitted ? (
              <div className="p-6 space-y-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">{copy.heading}</h2>
                  <p className="text-sm text-slate-600 mt-1">{copy.intro}</p>
                </div>

                <div>
                  <label htmlFor="rr-notes" className="block text-sm font-medium text-slate-700">
                    What would you like changed? <span className="text-red-600">*</span>
                  </label>
                  <textarea
                    id="rr-notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={5}
                    maxLength={4000}
                    placeholder="e.g. Could you re-quote with metal roofing instead of tile? Also need to add a new shed."
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none"
                  />
                  <p className="text-xs text-slate-400 mt-1 text-right">{notes.length} / 4000</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="rr-name" className="block text-sm font-medium text-slate-700">
                      Your name
                    </label>
                    <input
                      id="rr-name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      maxLength={120}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none"
                    />
                  </div>
                  <div>
                    <label htmlFor="rr-email" className="block text-sm font-medium text-slate-700">
                      Your email
                    </label>
                    <input
                      id="rr-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      maxLength={254}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none"
                    />
                  </div>
                </div>

                {error && (
                  <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    {error}
                  </p>
                )}

                <div className="flex gap-3 justify-end pt-2">
                  <button
                    type="button"
                    onClick={reset}
                    disabled={submitting}
                    className="px-4 py-2 text-sm font-medium rounded-full border border-slate-300 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={submitting || notes.trim().length < 5}
                    className="px-4 py-2 text-sm font-semibold rounded-full bg-black text-white hover:bg-slate-800 hover:shadow-[0_0_12px_rgba(255,107,53,0.4)] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? 'Sending...' : 'Send request'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                    <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Request sent</h2>
                    <p className="text-sm text-slate-600">
                      {contactInfo?.companyName ? `${contactInfo.companyName} have` : 'The team have'} been notified and will be in touch.
                    </p>
                  </div>
                </div>

                {contactInfo?.contactEmail && (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-2">
                    <p className="text-xs uppercase tracking-wide text-slate-500 font-medium">
                      Prefer to email directly?
                    </p>
                    <a
                      href={buildMailtoHref() ?? `mailto:${contactInfo.contactEmail}`}
                      className="inline-flex items-center gap-2 text-sm font-medium text-orange-600 hover:text-orange-700 break-all"
                    >
                      <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      {contactInfo.contactEmail}
                    </a>
                    <p className="text-xs text-slate-500">
                      Opens your email app with your notes pre-filled.
                    </p>
                  </div>
                )}

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={reset}
                    className="px-4 py-2 text-sm font-medium rounded-full bg-black text-white hover:bg-slate-800"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
