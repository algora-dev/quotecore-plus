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
  /** Per-line margin override (null = use global). */
  lineMarginPercent?: number | null;
  /** Per-line labor margin override (null = use global). */
  lineLaborMarginPercent?: number | null;
  /** Raw material cost (component lines only). */
  baseMaterialCost?: number;
  /** Raw labour cost (component lines only). */
  baseLabourCost?: number;
  /** Whether this line came from a quote component (vs custom/catalog). */
  type?: 'component' | 'custom';
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
  onSaveLine?: (lineId: string, text: string, quantity: string | null, amount: number, showPrice: boolean, qty?: number, unitPrice?: number | null, lineMarginPercent?: number | null, lineLaborMarginPercent?: number | null) => void;
  showQuantityColumn?: boolean;
  hideLinePrices?: boolean;
  hideTotals?: boolean;
  onCancelEdit?: () => void;
  onEditHeader?: () => void;
  onEditFooter?: () => void;
  showEditButtons?: boolean;
  currency: string;
  /** Global margin % for this quote (blank quotes). Null = no global margin. */
  globalMarginPercent?: number | null;
  /** Live labor margin % from the editor slider — pre-populates the pencil
   *  editor's labor margin field so it reflects the current editor value. */
  globalLaborMarginPercent?: number | null;
  /** Whether to show the margin breakdown row in the preview. */
  showMarginInPreview?: boolean;
  /** Material margin total to display (null = hidden). Passed from editor. */
  materialMarginDisplay?: number | null;
  /** Labour margin total to display (null = hidden). Passed from editor. */
  labourMarginDisplay?: number | null;
  /** Quote entry_mode, used to conditionally show margin fields in the line editor. */
  quoteEntryMode?: string | null;
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
  globalMarginPercent = null,
  globalLaborMarginPercent = null,
  showMarginInPreview = true,
  materialMarginDisplay = null,
  labourMarginDisplay = null,
  quoteEntryMode = null,
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

      {/* Line items — table layout for clean column alignment (matches order editor) */}
      <div className="border-t pt-4">
        {lines.length === 0 ? (
          <p className="text-sm text-slate-400 italic">No items selected</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-slate-300 text-left">
                <th className="py-2 pr-3 font-semibold text-slate-600">Item</th>
                {showQuantityColumn && (
                  <th className="py-2 px-2 text-right font-semibold text-slate-600 whitespace-nowrap w-12">Qty</th>
                )}
                <th className="py-2 pl-3 text-right font-semibold text-slate-600 whitespace-nowrap">
                  {hideLinePrices ? '' : 'Total'}
                </th>
                {showEditButtons && onEditLine && <th className="w-8" />}
              </tr>
            </thead>
            <tbody>
              {lines.map(line =>
                editingLineId === line.id && onSaveLine && onCancelEdit ? (
                  <tr key={line.id}>
                    <td
                      colSpan={
                        (showQuantityColumn ? 1 : 0) +
                        (showEditButtons && onEditLine ? 3 : 2)
                      }
                      className="py-2"
                    >
                      <LineEditForm
                        initialText={splitLineParts(line.text, line.quantityText).description}
                        initialQuantity={splitLineParts(line.text, line.quantityText).quantity}
                        initialAmount={line.amount}
                        initialShowPrice={line.showPrice}
                        showQuantityColumn={showQuantityColumn}
                        initialQty={(line as { qty?: number }).qty ?? 1}
                        initialUnitPrice={(line as { unitPrice?: number | null }).unitPrice ?? null}
                        // Margin fields
                        isComponentLine={line.type === 'component'}
                        baseMaterialCost={line.baseMaterialCost}
                        baseLabourCost={line.baseLabourCost}
                        initialLineMarginPercent={line.lineMarginPercent ?? null}
                        initialLineLaborMarginPercent={line.lineLaborMarginPercent ?? null}
                        globalMarginPercent={globalMarginPercent}
                        defaultMaterialMarginPercent={
                          quote.material_margin_enabled && quote.material_margin_percent != null
                            ? Number(quote.material_margin_percent)
                            : null
                        }
                        defaultLaborMarginPercent={
                          // Prefer the live editor value (globalLaborMarginPercent prop)
                          // when passed — it updates in real-time as the user tweaks the
                          // slider. Fall back to the quote DB field.
                          typeof globalLaborMarginPercent === 'number'
                            ? globalLaborMarginPercent
                            : (quote.labor_margin_enabled && quote.labor_margin_percent != null
                                ? Number(quote.labor_margin_percent)
                                : null)
                        }
                        quoteEntryMode={quoteEntryMode}
                        onSave={(text, quantity, amount, sp, qty, unitPrice, lineMarginPercent, lineLaborMarginPercent) =>
                          onSaveLine(line.id, text, quantity, amount, sp, qty, unitPrice, lineMarginPercent, lineLaborMarginPercent)
                        }
                        onCancel={onCancelEdit}
                      />
                    </td>
                  </tr>
                ) : (
                  <tr key={line.id} data-pdf-block className="border-b border-slate-100 align-top">
                    <td className="py-2 pr-3 text-slate-900">
                      {displayLineText(line.text, line.quantityText, line.showUnits)}
                    </td>
                    {showQuantityColumn && (
                      <td className="py-2 px-2 text-right text-slate-600 w-12 tabular-nums">
                        {(line as { qty?: number }).qty ?? 1}
                      </td>
                    )}
                    <td className="py-2 pl-3 text-right font-medium text-slate-900 whitespace-nowrap tabular-nums">
                      {line.showPrice && !hideLinePrices
                        ? formatCurrency(line.amount, currency)
                        : ''}
                    </td>
                    {showEditButtons && onEditLine && (
                      <td className="py-2 pl-2 text-right">
                        <button
                          onClick={() => onEditLine(line.id)}
                          className="p-1 text-slate-400 hover:text-slate-600"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                            />
                          </svg>
                        </button>
                      </td>
                    )}
                  </tr>
                )
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Totals */}
      {!hideTotals && <div data-pdf-block className="space-y-2 pt-4 border-t">
        <div className="flex justify-between text-sm">
          <span className="text-slate-600">Subtotal</span>
          <span className="font-medium text-slate-900">{formatCurrency(subtotal, currency)}</span>
        </div>
        {/* Material margin row */}
        {materialMarginDisplay != null && globalMarginPercent != null && globalMarginPercent > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-slate-400 italic">Material margin ({globalMarginPercent}%)</span>
            <span className="text-slate-400 italic">{formatCurrency(materialMarginDisplay, currency)} incl.</span>
          </div>
        )}
        {/* Labour margin row */}
        {labourMarginDisplay != null && globalLaborMarginPercent != null && globalLaborMarginPercent > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-slate-400 italic">Labour margin ({globalLaborMarginPercent}%)</span>
            <span className="text-slate-400 italic">{formatCurrency(labourMarginDisplay, currency)} incl.</span>
          </div>
        )}
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
