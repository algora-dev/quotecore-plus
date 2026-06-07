'use client';
import { formatCurrency } from '@/app/lib/currency/currencies';
import type { InvoiceRow, EditableLine } from './InvoiceEditor';

interface Props {
  invoice: InvoiceRow;
  lines: EditableLine[];
  currency: string;
  companyName: string;
  companyAddress: string;
  companyEmail: string;
  companyPhone: string;
  companyLogoUrl: string;
  footerText: string;
  notes: string;
  terms: string;
  invoiceDate: string;
  dueDate: string;
  subtotal: number;
  taxTotal: number;
  total: number;
}

function formatDate(dateStr: string) {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

export function InvoicePreview({
  invoice,
  lines,
  currency,
  companyName,
  companyAddress,
  companyEmail,
  companyPhone,
  companyLogoUrl,
  footerText,
  notes,
  terms,
  invoiceDate,
  dueDate,
  subtotal,
  taxTotal,
  total,
}: Props) {
  const visibleLines = lines.filter((l) => l.is_visible);
  const customer = invoice.customer_snapshot as Record<string, string>;

  return (
    <div className="mx-auto max-w-3xl bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="bg-slate-900 px-8 py-6 flex items-start justify-between">
        <div>
          {companyLogoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={companyLogoUrl} alt="Company logo" className="h-12 w-auto object-contain mb-3" />
          )}
          <h1 className="text-2xl font-bold text-white tracking-tight">INVOICE</h1>
          <p className="text-slate-400 text-sm mt-1 font-mono">{invoice.invoice_number}</p>
        </div>
        <div className="text-right">
          <p className="text-white font-semibold text-sm">{companyName}</p>
          {companyAddress && <p className="text-slate-400 text-xs mt-1 whitespace-pre-line">{companyAddress}</p>}
          {companyEmail && <p className="text-slate-400 text-xs">{companyEmail}</p>}
          {companyPhone && <p className="text-slate-400 text-xs">{companyPhone}</p>}
        </div>
      </div>

      {/* Meta bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-0 border-b border-slate-200">
        {[
          { label: 'Invoice Date', value: formatDate(invoiceDate) },
          { label: 'Due Date', value: dueDate ? formatDate(dueDate) : '—' },
          { label: 'Invoice No.', value: invoice.invoice_number },
          { label: 'Payment Ref.', value: invoice.payment_reference },
        ].map((item, i) => (
          <div key={item.label} className={`px-5 py-3 ${i < 3 ? 'border-r border-slate-200' : ''}`}>
            <p className="text-xs text-slate-500 uppercase tracking-wide">{item.label}</p>
            <p className="text-sm font-medium text-slate-900 mt-0.5 font-mono">{item.value}</p>
          </div>
        ))}
      </div>

      {/* Bill to */}
      <div className="px-8 py-5 border-b border-slate-100">
        <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Bill To</p>
        <p className="font-semibold text-slate-900">{invoice.customer_name}</p>
        {customer.email && <p className="text-sm text-slate-600">{customer.email}</p>}
        {customer.phone && <p className="text-sm text-slate-600">{customer.phone}</p>}
        {customer.address && <p className="text-sm text-slate-600 whitespace-pre-line">{customer.address}</p>}
      </div>

      {/* Line items */}
      <div className="px-8 py-5">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="text-left py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">Description</th>
              <th className="text-right py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide w-16">Qty</th>
              <th className="text-right py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide w-24">Unit Price</th>
              <th className="text-right py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide w-24">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visibleLines.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-8 text-center text-slate-400 italic text-xs">No line items added yet</td>
              </tr>
            ) : (
              visibleLines.map((line) => (
                <tr key={line.localId}>
                  <td className="py-3">
                    <p className="font-medium text-slate-900">{line.title || 'Untitled'}</p>
                    {line.description && <p className="text-xs text-slate-500 mt-0.5">{line.description}</p>}
                  </td>
                  <td className="py-3 text-right text-slate-700">{line.quantity} {line.unit}</td>
                  <td className="py-3 text-right text-slate-700">
                    {line.show_price ? formatCurrency(line.unit_price, currency) : '—'}
                  </td>
                  <td className="py-3 text-right font-medium text-slate-900">
                    {line.show_price ? formatCurrency(line.line_total, currency) : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Totals */}
        <div className="mt-4 flex justify-end">
          <div className="w-64 space-y-1">
            <div className="flex justify-between text-sm text-slate-600">
              <span>Subtotal</span>
              <span>{formatCurrency(subtotal, currency)}</span>
            </div>
            {taxTotal > 0 && (
              <div className="flex justify-between text-sm text-slate-600">
                <span>Tax</span>
                <span>{formatCurrency(taxTotal, currency)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-bold text-slate-900 border-t border-slate-200 pt-2 mt-2">
              <span>Total Due</span>
              <span>{formatCurrency(total, currency)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Payment instructions */}
      <div className="mx-8 mb-5 rounded-xl bg-orange-50 border border-orange-200 p-5">
        <p className="text-xs font-semibold text-orange-700 uppercase tracking-wide mb-3">Payment Instructions</p>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-600">Amount Due</span>
            <span className="font-bold text-slate-900">{formatCurrency(total, currency)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Payment Reference</span>
            <span className="font-mono font-semibold text-orange-700">{invoice.payment_reference}</span>
          </div>
        </div>
        <p className="text-xs text-slate-500 mt-3">
          Please include the payment reference when making your payment so we can identify it quickly.
        </p>
        {dueDate && (
          <p className="text-xs font-medium text-orange-700 mt-2">
            Payment due by {formatDate(dueDate)}
          </p>
        )}
      </div>

      {/* Notes */}
      {notes && (
        <div className="px-8 pb-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Notes</p>
          <p className="text-sm text-slate-700 whitespace-pre-line">{notes}</p>
        </div>
      )}

      {/* Terms */}
      {terms && (
        <div className="px-8 pb-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Terms & Conditions</p>
          <p className="text-sm text-slate-600 whitespace-pre-line">{terms}</p>
        </div>
      )}

      {/* Footer */}
      {footerText && (
        <div className="bg-slate-50 border-t border-slate-200 px-8 py-4">
          <p className="text-xs text-slate-500 text-center">{footerText}</p>
        </div>
      )}
    </div>
  );
}
