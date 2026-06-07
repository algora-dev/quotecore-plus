'use client';
import { useState } from 'react';

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
  if (!dateStr) return '—';
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
          onClick={() => onCopy(value, copyKey)}
          className="flex-shrink-0 text-xs text-orange-600 border border-orange-300 rounded-full px-2 py-0.5 hover:bg-orange-100 transition-colors whitespace-nowrap"
        >
          {copied === copyKey ? '✓' : 'Copy'}
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
        <p className="text-sm text-emerald-600 mt-1">Thank you — the sender will confirm receipt.</p>
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
  const visibleLines = lines.filter((l) => l.is_visible);
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
            <p className="text-amber-700 font-semibold">Payment reported — awaiting confirmation by sender</p>
          </div>
        )}
        {isDisputed && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-5 py-3 text-center">
            <p className="text-red-700 font-semibold">This invoice has a dispute in progress</p>
          </div>
        )}

        {/* Invoice document */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
          {/* Header */}
          <div className="bg-slate-900 px-8 py-6 flex items-start justify-between">
            <div>
              {invoice.cq_company_logo_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={invoice.cq_company_logo_url} alt="Logo" className="h-12 w-auto object-contain mb-3" />
              )}
              <h1 className="text-2xl font-bold text-white">INVOICE</h1>
              <p className="text-slate-400 text-sm mt-1 font-mono">{invoice.invoice_number}</p>
            </div>
            <div className="text-right">
              {invoice.cq_company_name && <p className="text-white font-semibold text-sm">{invoice.cq_company_name}</p>}
              {invoice.cq_company_address && <p className="text-slate-400 text-xs mt-1 whitespace-pre-line">{invoice.cq_company_address}</p>}
              {invoice.cq_company_email && <p className="text-slate-400 text-xs">{invoice.cq_company_email}</p>}
              {invoice.cq_company_phone && <p className="text-slate-400 text-xs">{invoice.cq_company_phone}</p>}
            </div>
          </div>

          {/* Meta */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-0 border-b border-slate-200">
            {[
              { label: 'Invoice Date', value: formatDate(invoice.invoice_date) },
              { label: 'Due Date', value: formatDate(invoice.due_date) },
              { label: 'Invoice No.', value: invoice.invoice_number },
              { label: 'Payment Ref.', value: invoice.payment_reference },
            ].map((item, i) => (
              <div key={item.label} className={`px-5 py-3 ${i < 3 ? 'border-r border-slate-200' : ''}`}>
                <p className="text-xs text-slate-500 uppercase tracking-wide">{item.label}</p>
                <p className="text-sm font-medium text-slate-900 mt-0.5 font-mono break-all">{item.value}</p>
              </div>
            ))}
          </div>

          {/* Bill to */}
          <div className="px-8 py-5 border-b border-slate-100">
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Bill To</p>
            <p className="font-semibold text-slate-900">{invoice.customer_name}</p>
            {invoice.customer_snapshot?.email && <p className="text-sm text-slate-600">{invoice.customer_snapshot.email}</p>}
            {invoice.customer_snapshot?.address && <p className="text-sm text-slate-600 whitespace-pre-line">{invoice.customer_snapshot.address}</p>}
          </div>

          {/* Lines */}
          <div className="px-8 py-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">Description</th>
                  <th className="text-right py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide w-20">Qty</th>
                  <th className="text-right py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide w-24 hidden sm:table-cell">Unit Price</th>
                  <th className="text-right py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide w-24">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleLines.map((line) => (
                  <tr key={line.id}>
                    <td className="py-3">
                      <p className="font-medium text-slate-900">{line.title}</p>
                      {line.description && <p className="text-xs text-slate-500 mt-0.5">{line.description}</p>}
                    </td>
                    <td className="py-3 text-right text-slate-700">{line.quantity} {line.unit}</td>
                    <td className="py-3 text-right text-slate-700 hidden sm:table-cell">
                      {line.show_price ? formatCurrency(line.unit_price, invoice.currency) : '—'}
                    </td>
                    <td className="py-3 text-right font-medium text-slate-900">
                      {line.show_price ? formatCurrency(line.line_total, invoice.currency) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div className="mt-4 flex justify-end">
              <div className="w-64 space-y-1">
                <div className="flex justify-between text-sm text-slate-600">
                  <span>Subtotal</span><span>{formatCurrency(invoice.subtotal, invoice.currency)}</span>
                </div>
                {invoice.tax_total > 0 && (
                  <div className="flex justify-between text-sm text-slate-600">
                    <span>Tax</span><span>{formatCurrency(invoice.tax_total, invoice.currency)}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-bold text-slate-900 border-t border-slate-200 pt-2 mt-2">
                  <span>Total Due</span><span>{formatCurrency(invoice.total, invoice.currency)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Payment instructions */}
          <div className="mx-8 mb-6 rounded-xl bg-orange-50 border border-orange-200 p-5">
            <p className="text-xs font-semibold text-orange-700 uppercase tracking-wide mb-4">Payment Instructions</p>

            {/* Amount due */}
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm text-slate-600">Amount Due</span>
              <span className="text-lg font-bold text-slate-900">{formatCurrency(invoice.total, invoice.currency)}</span>
            </div>

            {/* Bank details — individual copy rows */}
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
                    `Amount: ${formatCurrency(invoice.total, invoice.currency)}`,
                    pd.accountName ? `Account Name: ${pd.accountName}` : '',
                    pd.bankName ? `Bank: ${pd.bankName}` : '',
                    pd.accountNumber ? `Account Number: ${pd.accountNumber}` : '',
                    pd.sortCode ? `Sort Code: ${pd.sortCode}` : '',
                    `Payment Reference: ${invoice.payment_reference}`,
                  ].filter(Boolean).join('\n');
                  copyToClipboard(parts, 'all');
                }}
                className="w-full text-center text-sm text-orange-700 font-semibold hover:underline"
              >
                {copied === 'all' ? '✓ All Details Copied' : 'Copy All Payment Details'}
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
          </div>

          {/* Notes / Terms */}
          {invoice.notes && (
            <div className="px-8 pb-5">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Notes</p>
              <p className="text-sm text-slate-700 whitespace-pre-line">{invoice.notes}</p>
            </div>
          )}
          {invoice.terms && (
            <div className="px-8 pb-5">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Terms & Conditions</p>
              <p className="text-sm text-slate-600 whitespace-pre-line">{invoice.terms}</p>
            </div>
          )}

          {invoice.cq_footer_text && (
            <div className="bg-slate-50 border-t border-slate-200 px-8 py-4">
              <p className="text-xs text-slate-500 text-center">{invoice.cq_footer_text}</p>
            </div>
          )}
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
