import type { QuoteRow } from '@/app/lib/types';

interface QuoteLine {
  id: string;
  text: string;
  amount: number;
  showPrice: boolean;
}

interface Props {
  quote: QuoteRow;
  lines: QuoteLine[];
  subtotal: number;
  tax: number;
  total: number;
  onEditLine?: (lineId: string) => void;
  showEditButtons?: boolean;
}

export function QuotePreview({ 
  quote, 
  lines, 
  subtotal, 
  tax, 
  total, 
  onEditLine,
  showEditButtons = true 
}: Props) {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="space-y-1">
        <h3 className="text-xl font-bold text-slate-900">
          QUOTE #{quote.quote_number || 'DRAFT'}
        </h3>
        <p className="text-sm text-slate-600">Client: {quote.customer_name}</p>
        {quote.job_name && (
          <p className="text-sm text-slate-600">Job: {quote.job_name}</p>
        )}
      </div>

      {/* Line items */}
      <div className="space-y-2 border-t pt-4">
        {lines.length === 0 ? (
          <p className="text-sm text-slate-400 italic">No items selected</p>
        ) : (
          lines.map(line => (
            <div key={line.id} className="flex items-start justify-between py-2 border-b border-slate-100">
              <div className="flex-1">
                <p className="text-sm text-slate-900">{line.text}</p>
              </div>
              <div className="flex items-center gap-2">
                {line.showPrice && (
                  <p className="text-sm font-medium text-slate-900">
                    ${line.amount.toFixed(2)}
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
          ))
        )}
      </div>

      {/* Totals */}
      <div className="space-y-2 pt-4 border-t">
        <div className="flex justify-between text-sm">
          <span className="text-slate-600">Subtotal</span>
          <span className="font-medium text-slate-900">${subtotal.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-600">Tax ({quote.tax_rate}%)</span>
          <span className="font-medium text-slate-900">${tax.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-lg font-bold border-t pt-2">
          <span className="text-slate-900">Total</span>
          <span className="text-slate-900">${total.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}
