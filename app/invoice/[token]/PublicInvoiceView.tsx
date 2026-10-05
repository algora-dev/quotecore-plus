'use client';
import { useState } from 'react';
import { InvoicePreview } from '@/app/(auth)/[workspaceSlug]/invoices/[id]/InvoicePreview';

export type InvoiceLine = {
  id: string;
  sort_order: number;
  title: string;
  description: string | null;
  quantity: number;
  unit: string;
  unit_price: number;
  line_total: number;
  show_price: boolean;
  show_quantity: boolean;
  show_description: boolean;
  is_visible: boolean;
};

export type PaymentDetails = {
  accountName?: string;
  bankName?: string;
  accountNumber?: string;
  sortCode?: string;
  paymentLink?: string;
};

export type Invoice = {
  hide_line_prices?: boolean;
  hide_totals?: boolean;
  id: string;
  invoice_number: string;
  payment_reference: string;
  status: string;
  customer_name: string;
  customer_email: string | null;
  customer_snapshot: Record<string, string>;
  cq_company_name: string | null;
  cq_company_address: string | null;
  cq_company_email: string | null;
  cq_company_phone: string | null;
  cq_company_logo_url: string | null;
  cq_footer_text: string | null;
  business_snapshot: Record<string, string>;
  currency: string;
  subtotal: number;
  tax_total: number;
  total: number;
  invoice_date: string;
  due_date: string | null;
  notes: string | null;
  terms: string | null;
  payment_details: PaymentDetails | null;
  payment_reported_at: string | null;
  paid_at: string | null;
};

interface Props {
  invoice: Invoice;
  lines: InvoiceLine[];
  token: string;
}

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: currency || 'GBP' }).format(amount);
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
}

// ── Payment row with copy button ────────────────────────────────────────────

function PayRow({
  label, value, copyKey, copied, onCopy, mono = false, highlight = false,
}: {
  label: string;
  value: string;
  copyKey: string;
  copied: string | null;
  onCopy: (text: string, key: string) => void;
  mono?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className="flex justify-between items-center gap-3">
      <span className="text-sm text-slate-600 flex-shrink-0">{label}</span>
      <div className="flex items-center gap-2 min-w-0">
        <span className={`text-sm font-semibold truncate ${
          highlight ? 'text-orange-700 font-mono' : mono ? 'font-mono text-slate-900' : 'text-slate-900'
        }`}>
          {value}
        </span>
        <button
          type="button"
          aria-label={`Copy ${label}`}
          onClick={() => onCopy(value, copyKey)}
          className="flex-shrink-0 text-xs text-orange-600 border border-orange-300 rounded-full px-2 py-0.5 hover:bg-orange-100 transition-colors whitespace-nowrap"
        >
          {copied === copyKey ? (<svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>) : (<svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>)}
        </button>
      </div>
    </div>
  );
}

// ── Payment Sent form ──────────────────────────────────────────────────────

function PaymentSentForm({ invoiceId, token }: { invoiceId: string; token: string }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/invoices/public/${token}/payment-sent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });
      if (res.ok) setDone(true);
    } catch {
      alert('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-5 text-center">
        <p className="text-emerald-700 font-semibold">✓ Payment reported</p>
        <p className="text-sm text-emerald-600 mt-1">Thank you - the sender will confirm receipt.</p>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-full bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-700 transition-all"
      >
        Payment Sent
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 p-5 space-y-3">
      <p className="font-semibold text-slate-900 text-sm">Confirm Payment Sent</p>
      <p className="text-xs text-slate-500">This notifies the sender that you have made your payment. You can add a note (e.g. paid by bank transfer).</p>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Optional message, e.g. Paid via bank transfer today."
        rows={3}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm resize-none focus:border-emerald-500 focus:outline-none"
      />
      <div className="flex gap-3">
        <button type="button" onClick={() => setOpen(false)} className="flex-1 rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
          Back
        </button>
        <button type="button" onClick={handleSubmit} disabled={submitting}
          className="flex-1 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition-all">
          {submitting ? 'Sending…' : 'Confirm Payment Sent'}
        </button>
      </div>
    </div>
  );
}

// ── Dispute form ───────────────────────────────────────────────────────────

function DisputeForm({ token }: { token: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit() {
    if (!name.trim() || !reason.trim() || !message.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/invoices/public/${token}/dispute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, reason, message }),
      });
      if (res.ok) setDone(true);
    } catch {
      alert('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-xl bg-amber-50 border border-amber-200 p-5 text-center">
        <p className="text-amber-700 font-semibold">Dispute submitted</p>
        <p className="text-sm text-amber-600 mt-1">The sender has been notified and will be in touch.</p>
      </div>
    );
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)}
        className="w-full rounded-full border border-red-200 bg-red-50 px-6 py-3 text-sm font-medium text-red-700 hover:bg-red-100 transition-all">
        Dispute Invoice
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-red-200 p-5 space-y-3">
      <p className="font-semibold text-red-700 text-sm">Dispute this Invoice</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Your Name <span className="text-red-500">*</span></label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name"
            className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-red-500 focus:outline-none" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Your Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com"
            className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-red-500 focus:outline-none" />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">Reason <span className="text-red-500">*</span></label>
        <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Incorrect amount, work not completed…"
          className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-red-500 focus:outline-none" />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">Message <span className="text-red-500">*</span></label>
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} placeholder="Describe your dispute…"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm resize-none focus:border-red-500 focus:outline-none" />
      </div>
      <div className="flex gap-3">
        <button type="button" onClick={() => setOpen(false)} className="flex-1 rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
          Back
        </button>
        <button type="button" onClick={handleSubmit} disabled={submitting || !name.trim() || !reason.trim() || !message.trim()}
          className="flex-1 rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition-all">
          {submitting ? 'Submitting…' : 'Submit Dispute'}
        </button>
      </div>
    </div>
  );
}

// ── Main public view ───────────────────────────────────────────────────────

export function PublicInvoiceView({ invoice, lines, token }: Props) {
  const isPaid = invoice.status === 'paid';
  const isPaymentReported = invoice.status === 'payment_reported';
  const isDisputed = invoice.status === 'disputed';

  const [copied, setCopied] = useState<string | null>(null);

  function copyToClipboard(text: string, key: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="mx-auto max-w-3xl space-y-4">
        {/* Status banner */}
        {isPaid && (
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-5 py-3 text-center">
            <p className="text-emerald-700 font-semibold">✓ This invoice has been paid</p>
          </div>
        )}
        {isPaymentReported && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 px-5 py-3 text-center">
            <p className="text-amber-700 font-semibold">Payment reported - awaiting confirmation by sender</p>
          </div>
        )}
        {isDisputed && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-5 py-3 text-center">
            <p className="text-red-700 font-semibold">This invoice has a dispute in progress</p>
          </div>
        )}

        {/* Same document body as owner preview and PDF. Recipient actions stay below. */}
        <div className="qc-recipient-paper bg-white border border-slate-200 shadow-sm">
          <InvoicePreview invoice={invoice} lines={lines.map(line => ({ ...line, localId: line.id }))}
            currency={invoice.currency} companyName={invoice.cq_company_name || ''}
            companyAddress={invoice.cq_company_address || ''} companyEmail={invoice.cq_company_email || ''}
            companyPhone={invoice.cq_company_phone || ''} companyLogoUrl={invoice.cq_company_logo_url || ''}
            footerText={invoice.cq_footer_text || ''} notes={invoice.notes || ''} terms={invoice.terms || ''}
            invoiceDate={invoice.invoice_date} dueDate={invoice.due_date || ''}
            subtotal={invoice.subtotal} taxTotal={invoice.tax_total} total={invoice.total}
            hideLinePrices={invoice.hide_line_prices === true} hideTotals={invoice.hide_totals === true}
            paymentDetails={invoice.payment_details || undefined} paymentContent={<>
            <p className="text-xs font-semibold text-orange-700 uppercase tracking-wide mb-4">Payment Instructions</p>

            {invoice.hide_totals !== true && <>
            {/* Amount due with copy button */}
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm text-slate-600">Amount Due</span>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-slate-900">{formatCurrency(invoice.total, invoice.currency)}</span>
                <button
                  type="button" aria-label="Copy amount due"
                  onClick={() => copyToClipboard(formatCurrency(invoice.total, invoice.currency), 'amount')}
                  className="flex-shrink-0 text-xs text-orange-600 border border-orange-300 rounded-full px-2 py-0.5 hover:bg-orange-100 transition-colors whitespace-nowrap"
                >
                  {copied === 'amount' ? (<svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>) : (<svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>)}
                </button>
              </div>
            </div>

            </>}
            {/* Bank details - individual copy rows */}
            {(invoice.payment_details?.accountName || invoice.payment_details?.accountNumber) && (
              <div className="space-y-2 mb-3 pb-3 border-b border-orange-200">
                {invoice.payment_details?.accountName && (
                  <PayRow label="Account Name" value={invoice.payment_details.accountName} copyKey="payee" copied={copied} onCopy={copyToClipboard} mono={false} />
                )}
                {invoice.payment_details?.bankName && (
                  <PayRow label="Bank" value={invoice.payment_details.bankName} copyKey="bank" copied={copied} onCopy={copyToClipboard} mono={false} />
                )}
                {invoice.payment_details?.accountNumber && (
                  <PayRow label="Account Number" value={invoice.payment_details.accountNumber} copyKey="accnum" copied={copied} onCopy={copyToClipboard} mono={true} />
                )}
                {invoice.payment_details?.sortCode && (
                  <PayRow label="Sort Code" value={invoice.payment_details.sortCode} copyKey="sort" copied={copied} onCopy={copyToClipboard} mono={true} />
                )}
              </div>
            )}

            {/* Payment reference */}
            <PayRow label="Payment Reference" value={invoice.payment_reference} copyKey="ref" copied={copied} onCopy={copyToClipboard} mono={true} highlight />

            {/* Copy everything button */}
            <div className="mt-3 pt-3 border-t border-orange-200">
              <button
                type="button"
                onClick={() => {
                  const pd = invoice.payment_details ?? {};
                  const parts = [
                    invoice.hide_totals !== true ? `Amount Due: ${formatCurrency(invoice.total, invoice.currency)}` : '',
                    pd.accountName ? `Account Name: ${pd.accountName}` : '',
                    pd.bankName ? `Bank: ${pd.bankName}` : '',
                    pd.accountNumber ? `Account Number: ${pd.accountNumber}` : '',
                    pd.sortCode ? `Sort Code: ${pd.sortCode}` : '',
                    `Payment Reference: ${invoice.payment_reference}`,
                    pd.paymentLink ? `Pay Online: ${pd.paymentLink}` : '',
                  ].filter(Boolean).join('\n');
                  copyToClipboard(parts, 'all');
                }}
                className="w-full inline-flex items-center justify-center gap-2 text-sm text-orange-700 font-semibold hover:underline"
              >
                {copied === 'all' ? (
                  <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> All Details Copied</>
                ) : (
                  <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg> Copy All Payment Details</>
                )}
              </button>
            </div>

            {/* Pay online button */}
            {invoice.payment_details?.paymentLink && (
              <a href={invoice.payment_details.paymentLink} target="_blank" rel="noopener noreferrer"
                className="mt-3 flex items-center justify-center gap-1.5 w-full rounded-full bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 transition-all">
                Pay Online
              </a>
            )}

            {invoice.due_date && (
              <p className="text-xs font-medium text-orange-700 mt-3 text-center">
                Payment due by {formatDate(invoice.due_date)}
              </p>
            )}

            </>}
          />
        </div>

        {/* Customer actions */}
        {!isPaid && !isPaymentReported && !isDisputed && (
          <div className="space-y-3">
            <PaymentSentForm invoiceId={invoice.id} token={token} />
            <DisputeForm token={token} />
          </div>
        )}
      </div>
    </div>
  );
}
