'use client';

import type { MaterialOrderRow, MaterialOrderLineRow, FlashingLibraryRow } from '@/app/lib/types';
import { useRef } from 'react';

interface Props {
  order: MaterialOrderRow;
  lines: MaterialOrderLineRow[];
  flashings: Pick<FlashingLibraryRow, 'id' | 'name' | 'image_url'>[];
}

interface LengthEntry {
  length: number | string;
  multiplier: number | string;
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
export function OrderBody({ order, lines, flashings }: Props) {
  const printRootRef = useRef<HTMLDivElement | null>(null);

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

          /* Keep each line card together — a tall flashing card (e.g.
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
        className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 mb-6 space-y-6"
      >
        {/* Header: TO / FROM blocks */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pb-6 border-b border-slate-200">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">To</p>
            {order.to_supplier ? <p className="text-sm font-semibold text-slate-900">{order.to_supplier}</p> : null}
            {order.reference ? <p className="text-sm text-slate-700 mt-1">Ref: {order.reference}</p> : null}
            {order.order_type ? <p className="text-sm text-slate-700">Order type: {order.order_type}</p> : null}
            {order.colours ? <p className="text-sm text-slate-700">Colours: {order.colours}</p> : null}
            {order.delivery_address ? (
              <div className="mt-3">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-1">Delivery</p>
                <p className="text-sm text-slate-700 whitespace-pre-line">{order.delivery_address}</p>
              </div>
            ) : null}
            {order.delivery_date ? (
              <p className="text-sm text-slate-700 mt-2">
                Delivery date: {new Date(order.delivery_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
              </p>
            ) : null}
          </div>

          <div className="sm:text-right">
            {order.logo_url ? (
              <img
                src={order.logo_url}
                alt=""
                className="max-h-16 max-w-full sm:ml-auto object-contain mb-3"
              />
            ) : null}
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">From</p>
            {order.from_company ? <p className="text-sm font-semibold text-slate-900">{order.from_company}</p> : null}
            {order.contact_person ? <p className="text-sm text-slate-700">{order.contact_person}</p> : null}
            {order.contact_details ? <p className="text-sm text-slate-700 whitespace-pre-line">{order.contact_details}</p> : null}
            {order.order_date ? (
              <p className="text-sm text-slate-700 mt-2">
                Order date: {new Date(order.order_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
              </p>
            ) : null}
          </div>
        </div>

        {/* Header notes */}
        {order.header_notes ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm text-slate-700 whitespace-pre-line">{order.header_notes}</p>
          </div>
        ) : null}

        {/* Line items.
            The order's saved `layout_mode` controls single- vs two-column
            grid here. The print stylesheet inherits the same grid (we
            don't override grid-template-columns in @media print) so the
            printed/PDF output matches what the user sees and what they
            chose when saving. */}
        <div
          data-layout-mode={order.layout_mode === 'double' ? 'double' : 'single'}
          className={
            order.layout_mode === 'double'
              ? 'grid grid-cols-1 sm:grid-cols-2 gap-4'
              : 'space-y-4'
          }
        >
          {lines.map((line, index) => {
            const flashing = line.flashing_id ? flashings.find((f) => f.id === line.flashing_id) : null;
            return (
              <div key={line.id} data-print-card className="rounded-xl border border-slate-200 p-4 break-inside-avoid">
                {line.show_component_name !== false ? (
                  <p className="font-semibold text-slate-900 mb-2">
                    {index + 1}. {line.item_name}
                  </p>
                ) : null}

                {line.show_flashing_image !== false && flashing?.image_url ? (
                  <div className="mb-3">
                    <img src={flashing.image_url} alt={flashing.name ?? ''} className="max-w-full h-auto border border-slate-200 rounded" />
                  </div>
                ) : null}

                {line.show_measurements !== false ? (
                  <div className="text-sm text-slate-700">
                    {line.entry_mode === 'single' ? (
                      <p>
                        Quantity: <span className="font-medium">{line.quantity}</span> {line.unit}
                      </p>
                    ) : line.lengths ? (
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-1">
                          Lengths ({(line.length_unit || 'm').toUpperCase()})
                        </p>
                        <ul className="space-y-0.5">
                          {((line.lengths as unknown) as LengthEntry[]).map((entry, idx) => (
                            <li key={idx}>
                              {String(entry.length)}
                              {line.length_unit} \u00d7 {String(entry.multiplier)}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {line.item_notes ? (
                  <p className="text-sm text-slate-600 italic mt-2 whitespace-pre-line">{line.item_notes}</p>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      {/* Download button is now rendered by OrderResponseForm so it
          shares the action row with Confirm / Request changes / Question.
          OrderBody itself only renders the document body + the print
          stylesheet. */}
    </>
  );
}
