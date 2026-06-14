import type { QuoteRow } from '@/app/lib/types';
import type { TaxLine } from '@/app/lib/taxes/types';
import { formatCurrency } from '@/app/lib/currency/currencies';
import { LineEditForm } from './LineEditForm';
import { displayLineText, splitLineParts } from '@/app/lib/quotes/lineText';

interface QuoteLine {
  id: string;
  text: string;
  /** Toggle-able quantity portion for catalog lines (fix #5). */
  quantityText?: string | null;
  amount: number;
  showPrice: boolean;
  showUnits: boolean;
}

interface Props {
  quote: QuoteRow;
  lines: QuoteLine[];
  subtotal: number;
  /** Per-tax breakdown to render between subtotal and grand total. */
  taxLines: TaxLine[];
  /** Sum of taxLines amounts. Passed in so callers can use the same number elsewhere. */
  taxTotal: number;
  total: number;
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  companyLogoUrl: string;
  footerText: string;
  editingLineId?: string | null;
  onEditLine?: (lineId: string) => void;
  onSaveLine?: (lineId: string, text: string, quantity: string | null, amount: number, showPrice: boolean, qty?: number, unitPrice?: number | null) => void;
  showQuantityColumn?: boolean;
  hideLinePrices?: boolean;
  hideTotals?: boolean;
  onCancelEdit?: () => void;
  onEditHeader?: () => void;
  onEditFooter?: () => void;
  showEditButtons?: boolean;
  currency: string;
}

export function QuotePreview({
  quote,
  lines,
  subtotal,
  taxLines,
  taxTotal,
  total,
  companyName,
  companyAddress,
  companyPhone,
  companyEmail,
  companyLogoUrl,
  footerText,
  editingLineId,
  onEditLine,
  onSaveLine,
  onCancelEdit,
  onEditHeader,
  onEditFooter,
  showEditButtons = true,
  currency,
  showQuantityColumn = false,
  hideLinePrices = false,
  hideTotals = false,
}: Props) {
  // Render a line's text honouring the Units toggle. Catalog lines hide the
  // separate quantity_text; legacy/component lines fall back to hyphen-strip.
  // (fix #5 - logic centralised in displayLineText.)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b pb-4 relative">
        {/* Logo (Above everything, right-aligned) */}
        <div className="flex justify-end mb-3">
          {companyLogoUrl ? (
            <img src={companyLogoUrl} alt="Company Logo" className="h-16 object-contain" />
          ) : (
            <div className="w-32 h-16 border-2 border-dashed border-slate-300 rounded flex items-center justify-center bg-slate-50">
              <span className="text-xs text-slate-400">Logo</span>
            </div>
          )}
        </div>

        {/* Quote Info (Left) + Company Details (Right) - Side by Side */}
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <h3 className="text-xl font-bold text-slate-900">
              QUOTE #{quote.quote_number || 'DRAFT'}
            </h3>
            <p className="text-base text-slate-900">
              <span className="font-semibold">Client:</span> {quote.customer_name}
            </p>
            {quote.job_name && (
              <p className="text-base text-slate-900">
                <span className="font-semibold">Job:</span> {quote.job_name}
              </p>
            )}
            <p className="text-base text-slate-900">
              <span className="font-semibold">Date:</span> {new Date(quote.created_at).toLocaleDateString('en-NZ', { day: '2-digit', month: 'long', year: 'numeric' })}
            </p>
          </div>

          <div className="text-right space-y-1">
            {companyName && <p className="font-semibold text-base text-slate-900">{companyName}</p>}
            {companyAddress && <p className="text-sm text-slate-600">{companyAddress}</p>}
            {companyPhone && <p className="text-sm text-slate-600">{companyPhone}</p>}
            {companyEmail && <p className="text-sm text-slate-600">{companyEmail}</p>}
          </div>
        </div>

        {/* Edit Header Button */}
        {showEditButtons && onEditHeader && (
          <button
            onClick={onEditHeader}
            className="absolute -top-2 -right-2 p-1.5 rounded-full bg-white border border-slate-300 hover:bg-slate-50 shadow-sm"
            title="Edit header details"
          >
            <svg className="w-3.5 h-3.5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
          </button>
        )}
      </div>

      {/* Line items */}
      <div className="space-y-2 border-t pt-4">
        {lines.length === 0 ? (
          <p className="text-sm text-slate-400 italic">No items selected</p>
        ) : (
          lines.map(line =>
            editingLineId === line.id && onSaveLine && onCancelEdit ? (
              <div key={line.id} className="py-2">
<LineEditForm
                  initialText={splitLineParts(line.text, line.quantityText).description}
                  initialQuantity={splitLineParts(line.text, line.quantityText).quantity}
                  initialAmount={line.amount}
                  initialShowPrice={line.showPrice}
                  showQuantityColumn={showQuantityColumn}
                  initialQty={(line as { qty?: number }).qty ?? 1}
                  initialUnitPrice={(line as { unitPrice?: number | null }).unitPrice ?? null}
                  onSave={(text, quantity, amount, sp, qty, unitPrice) => onSaveLine(line.id, text, quantity, amount, sp, qty, unitPrice)}
                  onCancel={onCancelEdit}
                />
              </div>
            ) : (
              <div key={line.id} data-pdf-block className="flex items-start justify-between py-2 border-b border-slate-100">
                <div className="flex-1">
                  <p className="text-sm text-slate-900">{displayLineText(line.text, line.quantityText, line.showUnits)}</p>
                </div>
<div className="flex items-center gap-2">
                  {line.showPrice && !hideLinePrices && (
                    <p className="text-sm font-medium text-slate-900">
                      {formatCurrency(line.amount, currency)}
                    </p>
                  )}
                  {showEditButtons && onEditLine && (
                    <button
                      onClick={() => onEditLine(line.id)}
                      className="p-1 text-slate-400 hover:text-slate-600"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            )
          )
        )}
      </div>

      {/* Totals */}
      {!hideTotals && <div data-pdf-block className="space-y-2 pt-4 border-t">
        <div className="flex justify-between text-sm">
          <span className="text-slate-600">Subtotal</span>
          <span className="font-medium text-slate-900">{formatCurrency(subtotal, currency)}</span>
        </div>
        {taxLines.length > 0 && (
          <>
            {taxLines.map((tl) => (
              <div key={tl.id} className="flex justify-between text-sm">
                <span className="text-slate-600">
                  {tl.name} ({tl.rate_percent}%)
                </span>
                <span className="font-medium text-slate-900">{formatCurrency(tl.amount, currency)}</span>
              </div>
            ))}
            {taxLines.length > 1 && (
              <div className="flex justify-between text-sm border-t pt-2">
                <span className="text-slate-600">Tax total</span>
                <span className="font-medium text-slate-900">{formatCurrency(taxTotal, currency)}</span>
              </div>
            )}
          </>
        )}
        <div className="flex justify-between text-lg font-bold border-t pt-2">
          <span className="text-slate-900">Total</span>
          <span className="text-slate-900">{formatCurrency(total, currency)}</span>
        </div>
      </div>}
      {/* end hideTotals guard */}

      {/* Footer */}
      {(footerText || (showEditButtons && onEditFooter)) && (
        <div className="pt-4 border-t relative">
          {footerText && (
            <p className="text-sm text-slate-600 italic whitespace-pre-wrap">{footerText}</p>
          )}
          {!footerText && showEditButtons && (
            <p className="text-sm text-slate-400 italic">No footer text. Click edit to add terms & conditions.</p>
          )}
          {showEditButtons && onEditFooter && (
            <button
              onClick={onEditFooter}
              className="absolute -top-2 -right-2 p-1.5 rounded-full bg-white border border-slate-300 hover:bg-slate-50 shadow-sm"
              title="Edit footer"
            >
              <svg className="w-3.5 h-3.5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
