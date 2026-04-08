import type { QuoteRow } from '@/app/lib/types';
import { formatCurrency } from '@/app/lib/currency/currencies';
import { LineEditForm } from './LineEditForm';

interface QuoteLine {
  id: string;
  text: string;
  amount: number;
  showPrice: boolean;
  showUnits: boolean;
}

interface Props {
  quote: QuoteRow;
  lines: QuoteLine[];
  subtotal: number;
  tax: number;
  total: number;
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  companyLogoUrl: string;
  footerText: string;
  editingLineId?: string | null;
  onEditLine?: (lineId: string) => void;
  onSaveLine?: (lineId: string, text: string, amount: number, showPrice: boolean) => void;
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
  tax, 
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
}: Props) {
  // Helper to remove units from text (everything after "—")
  function removeUnits(text: string): string {
    const dashIndex = text.indexOf('—');
    if (dashIndex === -1) return text;
    return text.substring(0, dashIndex).trim();
  }

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
            className="absolute -top-2 -right-2 px-2 py-1 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700 shadow-sm"
            title="Edit header details"
          >
            ✏️ Edit Header
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
                  initialText={line.text}
                  initialAmount={line.amount}
                  initialShowPrice={line.showPrice}
                  onSave={(text, amount, showPrice) => onSaveLine(line.id, text, amount, showPrice)}
                  onCancel={onCancelEdit}
                />
              </div>
            ) : (
              <div key={line.id} className="flex items-start justify-between py-2 border-b border-slate-100">
                <div className="flex-1">
                  <p className="text-sm text-slate-900">{line.showUnits ? line.text : removeUnits(line.text)}</p>
                </div>
                <div className="flex items-center gap-2">
                  {line.showPrice && (
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
      <div className="space-y-2 pt-4 border-t">
        <div className="flex justify-between text-sm">
          <span className="text-slate-600">Subtotal</span>
          <span className="font-medium text-slate-900">{formatCurrency(subtotal, currency)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-600">Tax ({quote.tax_rate}%)</span>
          <span className="font-medium text-slate-900">{formatCurrency(tax, currency)}</span>
        </div>
        <div className="flex justify-between text-lg font-bold border-t pt-2">
          <span className="text-slate-900">Total</span>
          <span className="text-slate-900">{formatCurrency(total, currency)}</span>
        </div>
      </div>

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
              className="absolute -top-2 -right-2 px-2 py-1 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700 shadow-sm"
              title="Edit footer"
            >
              ✏️ Edit Footer
            </button>
          )}
        </div>
      )}
    </div>
  );
}
