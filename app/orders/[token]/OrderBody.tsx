'use client';

import type { MaterialOrderRow, MaterialOrderLineRow, FlashingLibraryRow } from '@/app/lib/types';
import { useRef } from 'react';
import { DocumentHeader } from '@/app/components/documents/DocumentHeader';
import { DocumentEditTarget, DocumentRegion, documentRegion, type DocumentSelection } from '@/app/components/documents/DocumentSelection';
import { formatCurrency } from '@/app/lib/currency/currencies';
import {
  parseLineByLineData,
  parseLineByLineFooter,
  parseLineByLineTaxes,
  parseLineByLineHideLinePrices,
  parseLineByLineHideTotals,
  parseLineByLineShowQuantityColumn,
  lineByLineTotal,
  lineDisplayText,
  computeLineByLineTaxes,
  type LineByLineItem,
} from '@/app/(auth)/[workspaceSlug]/material-orders/lineByLine';

export type OrderDocumentData = Pick<MaterialOrderRow,
  'order_number' | 'to_supplier' | 'from_company' | 'contact_person' | 'contact_details' |
  'reference' | 'order_type' | 'colours' | 'delivery_date' | 'delivery_address' | 'header_notes' |
  'logo_url' | 'order_date' | 'layout_mode'> & { line_by_line_data?: unknown };
export type OrderDocumentLine = Pick<MaterialOrderLineRow,
  'id' | 'item_name' | 'flashing_id' | 'flashing_image_url' | 'entry_mode' | 'quantity' | 'length_unit' | 'item_notes' |
  'show_component_name' | 'show_flashing_image' | 'show_measurements' | 'priced_quantity' | 'measurement_display'> & { lengths?: unknown };
interface Props {
  selection?: DocumentSelection;
  order: OrderDocumentData;
  lines: OrderDocumentLine[];
  flashings: Pick<FlashingLibraryRow, 'id' | 'name' | 'image_url'>[];
  /** Currency code for line-by-line price rendering (defaults to GBP). */
  currency?: string;
}

interface LengthEntry {
  length: number | string;
  multiplier: number | string;
  variables?: { name: string; value: number | string; unit: string }[];
  calcLength?: number;
  calcWidth?: number;
  calcDepth?: number;
}

/**
 * Read-only mobile-friendly rendering of a material order for the
 * supplier-facing public page. Mirrors the data shown in the internal
 * `OrderPreview` but flowed naturally (no fixed A4 page sizes) so it
 * works on phones and prints sensibly.
 *
 * The Download button at the bottom uses the browser's print-to-PDF
 * dialog with a print-only stylesheet that hides everything outside
 * `[data-print-root]`. This is the same approach the in-app preview
 * uses and avoids server-side PDF generation in this batch.
 */
export function OrderBody({ order, lines, flashings, currency = 'GBP', selection }: Props) {
  const printRootRef = useRef<HTMLDivElement | null>(null);

  // Line-by-line orders store their priced item list in a single JSON column
  // (`material_orders.line_by_line_data`) rather than in `material_order_lines`.
  const isLineByLine = order.layout_mode === 'line_by_line';
  const lblLines: LineByLineItem[] = isLineByLine
    ? parseLineByLineData(order.line_by_line_data).filter((l) => l.isVisible)
    : [];
  const lblSubtotal = isLineByLine ? lineByLineTotal(parseLineByLineData(order.line_by_line_data)) : 0;
  const lblFooter = isLineByLine ? parseLineByLineFooter(order.line_by_line_data) : '';
  const lblTaxes = isLineByLine ? parseLineByLineTaxes(order.line_by_line_data) : [];
  const lblHideLinePrices = isLineByLine ? parseLineByLineHideLinePrices(order.line_by_line_data) : false;
  const lblHideTotals = isLineByLine ? parseLineByLineHideTotals(order.line_by_line_data) : false;
  const { taxLines: lblTaxLines, taxTotal: lblTaxTotal } = computeLineByLineTaxes(lblSubtotal, lblTaxes);
  const lblTotal = lblSubtotal + lblTaxTotal;
  const lblShowQuantityColumn = parseLineByLineShowQuantityColumn(order.line_by_line_data);
  const lblHasPrices = !lblHideTotals && (lblLines.some((l) => l.showPrice) || lblTaxLines.length > 0);

  return (
    <>
      <style jsx global>{`
        @media print {
          @page { margin: 12mm; }
          html, body { background: #fff !important; }
          body * { visibility: hidden !important; }
          [data-print-root], [data-print-root] * { visibility: visible !important; }
          [data-print-root] {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 0 !important;
            margin: 0 !important;
            border: 0 !important;
            box-shadow: none !important;
            background: #fff !important;
          }
          [data-print-hide], [data-exclude-pdf] { display: none !important; }

          /* Print-only two-column rule. Tailwind's sm: breakpoint is
             based on viewport width, which is irrelevant for print, so
             we force the grid columns explicitly when the user chose
             'double' layout. */
          [data-layout-mode='double'] {
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            gap: 6mm !important;
          }

          /* Keep each line card together - a tall flashing card (e.g.
             barge) is pushed to the next page instead of being clipped. */
          [data-print-card] {
            page-break-inside: avoid;
            break-inside: avoid;
          }
          [data-print-card] img {
            max-height: 60mm;
            width: auto;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>

      <div
        ref={printRootRef}
        data-print-root
        className="qc-output qc-output-order"
      >
        <DocumentHeader title="Purchase order" number={order.order_number || 'Draft'} companyName={order.from_company || ''} logo={order.logo_url}
          selection={selection} headerTarget="details" recipientTarget="details" metaTarget="details" recipientLabel="Supplier"
          companyDetails={<>{order.contact_person && <p>{order.contact_person}</p>}{order.contact_details && <p>{order.contact_details}</p>}</>}
          recipient={<>
            {order.to_supplier && <p><strong>{order.to_supplier}</strong></p>}
            {order.delivery_address && <><p className="qc-output-label" style={{marginTop:12}}>Deliver to</p><p className="whitespace-pre-line">{order.delivery_address}</p></>}
          </>}
          meta={<>
            {order.reference && <div className="qc-output-meta-row"><span>Reference</span><span>{order.reference}</span></div>}
            {order.order_date && <div className="qc-output-meta-row"><span>Order date</span><span>{new Date(order.order_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span></div>}
            {order.delivery_date && <div className="qc-output-meta-row"><span>Delivery date</span><span>{new Date(order.delivery_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span></div>}
            {order.order_type && <div className="qc-output-meta-row"><span>Order type</span><span>{order.order_type}</span></div>}
            {order.colours && <div className="qc-output-meta-row"><span>Colours</span><span>{order.colours}</span></div>}
          </>}
        />
        {order.header_notes && <DocumentRegion selection={selection} id="details" label="order notes" className="qc-output-notes"><p className="qc-output-label">Order notes</p><p>{order.header_notes}</p></DocumentRegion>}

        {/* LINE-BY-LINE layout: a priced item list (item / description / qty
            / price), rendered identically on the in-app preview, the public
            supplier page, and the print/PDF output. */}
        {isLineByLine ? (
          <div>
            <table className="qc-output-table">
              <thead>
                <tr className="border-b-2 border-slate-300 text-left">
                  <th className="py-2 pr-3 font-semibold text-slate-600">Item / Description</th>
                  {lblShowQuantityColumn && <th className="qc-output-numeric">Qty</th>}
                  <th className="qc-output-numeric">
                    {lblHideLinePrices ? '' : 'Price'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {lblLines.length === 0 ? (
                  <tr>
                    <td colSpan={lblShowQuantityColumn ? 3 : 2} className="py-4 text-center text-slate-400 italic">No items on this order.</td>
                  </tr>
                ) : (
                  lblLines.map((line) => (
                    <tr key={line.id} data-pdf-block {...documentRegion(selection, `line:${line.id}`)}>
                      <td>{lineDisplayText(line)}<DocumentEditTarget selection={selection} id={`line:${line.id}`} label={line.text || 'order item'} /></td>
                      {lblShowQuantityColumn && <td className="qc-output-numeric">{line.quantity}</td>}
                      <td className="qc-output-numeric">
                        {!lblHideLinePrices && line.showPrice ? formatCurrency(line.amount, currency) : ''}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {lblHasPrices ? (
                <tfoot {...documentRegion(selection, 'taxes')}>
                  {lblTaxLines.length > 0 ? (
                    <>
                      <tr className="border-t border-slate-200">
                        <td colSpan={lblShowQuantityColumn ? 2 : 1} className="py-1.5 pr-3 text-right text-slate-600">Subtotal</td>
                        <td className="py-1.5 pl-3 text-right text-slate-800 whitespace-nowrap tabular-nums">
                          {formatCurrency(lblSubtotal, currency)}
                        </td>
                      </tr>
                      {lblTaxLines.map((tl) => (
                        <tr key={tl.id}>
                          <td colSpan={lblShowQuantityColumn ? 2 : 1} className="py-1.5 pr-3 text-right text-slate-600">
                            {tl.name} ({tl.ratePercent}%)
                          </td>
                          <td className="py-1.5 pl-3 text-right text-slate-800 whitespace-nowrap tabular-nums">
                            {formatCurrency(tl.amount, currency)}
                          </td>
                        </tr>
                      ))}
                    </>
                  ) : null}
                  <tr data-pdf-block className="qc-output-total-row">
                    <td colSpan={lblShowQuantityColumn ? 2 : 1} className="text-right">Total<DocumentEditTarget selection={selection} id="taxes" label="order taxes and total" /></td>
                    <td className="py-2 pl-3 text-right font-bold text-slate-900 whitespace-nowrap tabular-nums">
                      {formatCurrency(lblTotal, currency)}
                    </td>
                  </tr>
                </tfoot>
              ) : null}
            </table>
            {lblFooter.trim() ? (
              <div className="qc-output-footer" {...documentRegion(selection, 'footer')}>
                <p className="text-sm text-slate-600 italic whitespace-pre-line">{lblFooter}</p><DocumentEditTarget selection={selection} id="footer" label="footer and terms" />
              </div>
            ) : null}
          </div>
        ) : (
        /* COMPONENTS layout.
            The order's saved `layout_mode` controls single- vs two-column
            grid here. The print stylesheet inherits the same grid (we
            don't override grid-template-columns in @media print) so the
            printed/PDF output matches what the user sees and what they
            chose when saving. */
        <div
          data-layout-mode={order.layout_mode === 'double' ? 'double' : 'single'}
          className="qc-output-order-grid"
        >
          {lines.map((line, index) => {
            const flashing = line.flashing_id ? flashings.find((f) => f.id === line.flashing_id) : null;
            const drawingUrl = flashing?.image_url || line.flashing_image_url;
            return (
              <div key={line.id} data-print-card data-pdf-block className="qc-output-component" {...documentRegion(selection, `line:${line.id}`)}>
                <DocumentEditTarget selection={selection} id={`line:${line.id}`} label={line.item_name || 'component'} />
                {line.show_component_name !== false ? (
                  <p className="qc-output-component-title">
                    <span className="qc-output-component-number">{String(index + 1).padStart(2, '0')}</span>{line.item_name}
                  </p>
                ) : null}

                {line.show_flashing_image !== false && drawingUrl ? (
                  <div className="mb-3">
                    <img src={drawingUrl} alt={flashing?.name ?? line.item_name ?? ''} className="qc-output-component-image" />
                  </div>
                ) : null}

                {line.show_measurements !== false ? (
                  <div className="qc-output-measurements">
                    {line.entry_mode === 'single' ? (
                      <p>
                        Quantity: <span className="font-medium text-black">{line.priced_quantity ?? line.quantity}</span>
                        {line.measurement_display && (
                          <span className="text-slate-400 ml-1">({line.measurement_display})</span>
                        )}
                      </p>
                    ) : line.lengths ? (
                      <div>
                        {line.priced_quantity != null ? (
                          <p>
                            Quantity: <span className="font-medium text-black">{line.priced_quantity}</span>
                            {line.measurement_display && (
                              <span className="text-slate-400 ml-1">({line.measurement_display})</span>
                            )}
                          </p>
                        ) : (
                          <>
                            <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-1">
                              {line.entry_mode === 'area' ? 'Areas' : line.entry_mode === 'volume' ? 'Volumes' : 'Lengths'} ({(line.length_unit || 'm').toUpperCase()})
                            </p>
                            <ul className="space-y-1">
                              {((line.lengths as unknown) as LengthEntry[]).map((entry, idx) => (
                                <li key={idx}>
                                  <span className="font-medium">{String(entry.length)}{line.length_unit}</span>
                                  {' × '}{String(entry.multiplier)}
                                  {entry.calcLength != null && entry.calcWidth != null && (
                                    <span className="text-slate-400 text-xs italic ml-1">
                                      ({entry.calcLength}×{entry.calcWidth}{entry.calcDepth != null ? `×${entry.calcDepth}` : ''})
                                    </span>
                                  )}
                                  {entry.variables && entry.variables.length > 0 && (
                                    <div className="text-xs text-slate-500 pl-3 mt-0.5">
                                      {entry.variables.map((v, vi) => (
                                        <span key={vi} className="mr-2">{v.name}={String(v.value)}{v.unit}</span>
                                      ))}
                                    </div>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </>
                        )}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {line.item_notes ? (
                  <p className="qc-output-component-notes">{line.item_notes}</p>
                ) : null}
              </div>
            );
          })}
          {/* Keep an odd final card at half width in the existing segmented PDF exporter. */}
          {order.layout_mode === 'double' && lines.length % 2 === 1 && <div aria-hidden="true" data-pdf-block className="qc-output-column-spacer" />}
        </div>
        )}
      </div>

      {/* Download button is now rendered by OrderResponseForm so it
          shares the action row with Confirm / Request changes / Question.
          OrderBody itself only renders the document body + the print
          stylesheet. */}
    </>
  );
}
