'use client';
import { DocumentHeader } from '@/app/components/documents/DocumentHeader';
import { DocumentEditTarget, DocumentRegion, documentRegion, type DocumentSelection } from '@/app/components/documents/DocumentSelection';
import { formatCurrency } from '@/app/lib/currency/currencies';
import type { ReactNode } from 'react';
import type { InvoiceRow, EditableLine } from './InvoiceEditor';

interface Props {
  selection?: DocumentSelection;
  /** Recipient-only clipboard controls; never included in editor/PDF output. */
  paymentContent?: ReactNode;
  invoice: Pick<InvoiceRow, 'invoice_number' | 'payment_reference' | 'status' | 'customer_name' | 'customer_snapshot'>;
  lines: Pick<EditableLine, 'localId' | 'title' | 'description' | 'quantity' | 'unit' | 'unit_price' | 'line_total' | 'show_price' | 'show_quantity' | 'show_description' | 'is_visible'>[];
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
  paymentDetails?: {
    accountName?: string;
    bankName?: string;
    accountNumber?: string;
    sortCode?: string;
    paymentLink?: string;
  };
  hideLinePrices?: boolean;
  hideTotals?: boolean;
}

function formatDate(dateStr: string) {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

export function InvoicePreview({
  selection,
  paymentContent,
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
  paymentDetails,
  hideLinePrices = false,
  hideTotals = false,
}: Props) {
  const visibleLines = lines.filter((l) => l.is_visible);
  const customer = (invoice.customer_snapshot ?? {}) as Record<string, string>;

  return (
    <div className="qc-output qc-output-invoice">
      <DocumentHeader title="Invoice" number={invoice.invoice_number} companyName={companyName} logo={companyLogoUrl}
        selection={selection} recipientLabel="Bill to" metaTarget="dates"
        companyDetails={<>{companyAddress && <p>{companyAddress}</p>}{companyEmail && <p>{companyEmail}</p>}{companyPhone && <p>{companyPhone}</p>}</>}
        recipient={<><p><strong>{invoice.customer_name}</strong></p>{customer.address && <p className="whitespace-pre-line">{customer.address}</p>}{customer.email && <p>{customer.email}</p>}{customer.phone && <p>{customer.phone}</p>}</>}
        meta={<>
          <div className="qc-output-meta-row"><span>Invoice date</span><span>{formatDate(invoiceDate)}</span></div>
          {dueDate && <div className="qc-output-meta-row"><span>Due date</span><span>{formatDate(dueDate)}</span></div>}
          <div className="qc-output-meta-row"><span>Payment reference</span><span>{invoice.payment_reference}</span></div>
        </>}
      />
      <table className="qc-output-table">
        <thead><tr><th>Description</th><th className="qc-output-numeric">Qty</th>
          {!hideLinePrices && <><th className="qc-output-numeric qc-output-unit-price">Unit price</th><th className="qc-output-numeric">Total</th></>}
        </tr></thead>
        <tbody>{visibleLines.length === 0 ? <tr><td colSpan={hideLinePrices ? 2 : 4}>No line items added yet</td></tr> : visibleLines.map(line => (
          <tr key={line.localId} data-pdf-block {...documentRegion(selection, `line:${line.localId}`)}>
            <td><p className="font-medium">{line.title || 'Untitled'}</p>{line.description && line.show_description !== false && <p className="text-xs text-slate-500">{line.description}</p>}
              <DocumentEditTarget selection={selection} id={`line:${line.localId}`} label={line.title || 'line item'} />
            </td>
            <td className="qc-output-numeric">{line.show_quantity !== false ? `${line.quantity} ${line.unit}` : '-'}</td>
            {!hideLinePrices && <><td className="qc-output-numeric qc-output-unit-price">{line.show_price ? formatCurrency(line.unit_price, currency) : '-'}</td>
              <td className="qc-output-numeric">{line.show_price ? formatCurrency(line.line_total, currency) : '-'}</td></>}
          </tr>
        ))}</tbody>
      </table>
      <></>
      {!hideTotals && <div data-pdf-block className="qc-output-totals" {...documentRegion(selection, 'appearance')}>
        <div className="qc-output-totals-inner"><div><span>Subtotal</span><span>{formatCurrency(subtotal, currency)}</span></div>
          {taxTotal > 0 && <div><span>Tax</span><span>{formatCurrency(taxTotal, currency)}</span></div>}
          <div className="qc-output-grand-total"><span>{invoice.status === 'paid' ? 'Invoice total' : 'Total due'}</span><span>{formatCurrency(total, currency)}</span></div>
        </div><DocumentEditTarget selection={selection} id="appearance" label="price and total display" />
      </div>}
      <div className="qc-output-invoice-bottom" data-columns={notes || terms ? 'double' : 'single'}>
      <div data-pdf-block className="qc-output-payment" {...documentRegion(selection, 'payment')}>
        {paymentContent ?? <>
        <p className="qc-output-label">Payment details</p>
        {paymentDetails?.accountName && <div className="qc-output-meta-row"><span>Account name</span><span>{paymentDetails.accountName}</span></div>}
        {paymentDetails?.bankName && <div className="qc-output-meta-row"><span>Bank</span><span>{paymentDetails.bankName}</span></div>}
        {paymentDetails?.accountNumber && <div className="qc-output-meta-row"><span>Account number</span><span>{paymentDetails.accountNumber}</span></div>}
        {paymentDetails?.sortCode && <div className="qc-output-meta-row"><span>Sort code</span><span>{paymentDetails.sortCode}</span></div>}
        <div className="qc-output-meta-row"><span>Payment reference</span><span>{invoice.payment_reference}</span></div>
        <p className="text-xs text-slate-500">Please include the payment reference when making your payment.</p>
        {dueDate && <p className="text-xs text-slate-500">Payment due by {formatDate(dueDate)}</p>}
        {paymentDetails?.paymentLink && <a href={paymentDetails.paymentLink} target="_blank" rel="noopener noreferrer" className="qc-output-payment-link">Pay online</a>}
        </>}
        <DocumentEditTarget selection={selection} id="payment" label="payment details" />
      </div>
      {(notes || terms) && <div data-pdf-block className="qc-output-invoice-notes">
      {notes ? <DocumentRegion selection={selection} id="notes" label="invoice notes" className="qc-output-notes"><p className="qc-output-label">Notes</p><p>{notes}</p></DocumentRegion> : null}
      {terms ? <DocumentRegion selection={selection} id="terms" label="terms" className="qc-output-notes"><p className="qc-output-label">Terms</p><p>{terms}</p></DocumentRegion> : null}
      </div>}
      </div>
      {footerText ? <DocumentRegion selection={selection} id="footer" label="footer" className="qc-output-footer"><p>{footerText}</p></DocumentRegion> : null}
    </div>
  );
}
