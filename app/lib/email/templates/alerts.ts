/**
 * App-alert email templates (in-app alert mirrors).
 *
 * Recipients: the company users who should see the alert.
 * Gating: caller must check `users.email_notifications_enabled` before sending.
 * Subject + content kept tight to mirror what the in-app alert shows.
 */

import { renderEmailLayout, ctaBlock, para, paraHtml, note } from '../baseLayout';

export type QuoteResponseEmailInput = {
  recipientName?: string | null;
  customerName: string | null;
  quoteNumber: string | null;
  quoteUrl: string;
};

export type RevisionRequestEmailInput = {
  recipientName?: string | null;
  customerName: string | null;
  quoteNumber: string | null;
  notes: string;
  sourceState: 'active' | 'responded' | 'expired' | 'withdrawn';
  quoteUrl: string;
};

const greet = (name?: string | null) => (name ? `Hi ${name},` : 'Hi,');
const labelQuote = (n: string | null) => (n ? `#${n}` : 'a quote');

/* ---- Quote accepted ---- */

export function quoteAcceptedEmail(input: QuoteResponseEmailInput) {
  const { recipientName, customerName, quoteNumber, quoteUrl } = input;
  const subject = `Quote ${labelQuote(quoteNumber)} accepted${customerName ? ` by ${customerName}` : ''}`;
  const heading = 'Quote accepted 🎉';
  const inner =
    para(greet(recipientName)) +
    paraHtml(
      `<strong>${customerName ?? 'Your customer'}</strong> has accepted Quote ${labelQuote(quoteNumber)}.`
    ) +
    para('Open the quote to convert it to a job, send confirmations, or order materials.') +
    ctaBlock('View quote', quoteUrl) +
    note("You're receiving this because in-app email alerts are enabled. You can turn them off in Settings.");
  return {
    subject,
    html: renderEmailLayout({
      heading,
      innerHtml: inner,
      preheader: `${customerName ?? 'A customer'} accepted Quote ${labelQuote(quoteNumber)}.`,
    }),
    text: `${customerName ?? 'A customer'} accepted Quote ${labelQuote(quoteNumber)}. Open it: ${quoteUrl}`,
  };
}

/* ---- Quote declined ---- */

export function quoteDeclinedEmail(input: QuoteResponseEmailInput) {
  const { recipientName, customerName, quoteNumber, quoteUrl } = input;
  const subject = `Quote ${labelQuote(quoteNumber)} declined${customerName ? ` by ${customerName}` : ''}`;
  const heading = 'Quote declined';
  const inner =
    para(greet(recipientName)) +
    paraHtml(
      `<strong>${customerName ?? 'Your customer'}</strong> has declined Quote ${labelQuote(quoteNumber)}.`
    ) +
    para("If you'd like to follow up, you can reach out directly or send a fresh quote.") +
    ctaBlock('View quote', quoteUrl) +
    note("You're receiving this because in-app email alerts are enabled. You can turn them off in Settings.");
  return {
    subject,
    html: renderEmailLayout({
      heading,
      innerHtml: inner,
      preheader: `${customerName ?? 'A customer'} declined Quote ${labelQuote(quoteNumber)}.`,
    }),
    text: `${customerName ?? 'A customer'} declined Quote ${labelQuote(quoteNumber)}. Open it: ${quoteUrl}`,
  };
}

/* ---- Revision requested ---- */

export function revisionRequestedEmail(input: RevisionRequestEmailInput) {
  const { recipientName, customerName, quoteNumber, notes, sourceState, quoteUrl } = input;
  const subject = `Re-quote requested for ${labelQuote(quoteNumber)}`;
  const heading = 'Re-quote requested';

  // Cap notes length in email body - full notes still visible in-app.
  const trimmedNotes = notes.length > 500 ? `${notes.slice(0, 500)}…` : notes;
  const stateLabel =
    sourceState === 'active'
      ? 'before responding'
      : sourceState === 'responded'
        ? 'after their response'
        : sourceState === 'withdrawn'
          ? 'after the quote was withdrawn'
          : 'after the link expired';

  const inner =
    para(greet(recipientName)) +
    paraHtml(
      `<strong>${customerName ?? 'A customer'}</strong> has requested a revision on Quote ${labelQuote(quoteNumber)} (${stateLabel}).`
    ) +
    paraHtml(
      `<strong>Their notes:</strong><br/><span style="color:#374151;">${trimmedNotes
        .split(/\r?\n/)
        .map((l) =>
          l
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
        )
        .join('<br/>')}</span>`
    ) +
    ctaBlock('Open quote', quoteUrl) +
    note("You're receiving this because in-app email alerts are enabled. You can turn them off in Settings.");

  return {
    subject,
    html: renderEmailLayout({
      heading,
      innerHtml: inner,
      preheader: `${customerName ?? 'A customer'} wants changes to Quote ${labelQuote(quoteNumber)}.`,
    }),
    text: `${customerName ?? 'A customer'} requested a revision on Quote ${labelQuote(quoteNumber)}.\nNotes: ${trimmedNotes}\nOpen: ${quoteUrl}`,
  };
}
