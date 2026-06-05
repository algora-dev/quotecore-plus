'use client';

/**
 * OrderLayoutPickerModal
 * ======================
 * Shown BEFORE the order editor opens. The user must define the document
 * layout up front, because the two layouts are different editor families and
 * cannot be switched between afterwards:
 *
 *   - 'components' : the current "Components + Images" editor (single/double
 *                    column is a cosmetic toggle WITHIN this family).
 *   - 'line_by_line': a customer-quote-style line list (Item / description /
 *                     qty / price, with per-line show/hide/edit). Reuses the
 *                     CustomerQuoteEditor.
 *
 * Three cards, two underlying editors:
 *   - 'line_by_line'   -> customer-quote-style line editor.
 *   - 'single'/'double'-> the same Components + Images editor, pre-set to that
 *                         column mode. Both resolve to layout family
 *                         'components' downstream; the column is carried as a
 *                         second hint so the editor lands ready-configured.
 *
 * The choice is passed downstream via query params; the create page routes to
 * the matching editor and persists it on the order.
 */

export type LayoutChoice = 'line_by_line' | 'single' | 'double';

interface Props {
  onSelect: (layout: LayoutChoice) => void;
  onClose: () => void;
}

const OPTIONS: {
  key: LayoutChoice;
  title: string;
  blurb: string;
  img: string;
}[] = [
  {
    key: 'line_by_line',
    title: 'Line by Line',
    blurb: 'A clean text list — item, description, qty and price. Show, hide and edit each line like a customer quote.',
    img: '/order-layout-line-by-line.png',
  },
  {
    key: 'single',
    title: 'Single Column',
    blurb: 'Item blocks with images/drawings and measurements, stacked in one column.',
    img: '/order-layout-single-column.png',
  },
  {
    key: 'double',
    title: 'Double Column',
    blurb: 'The same item blocks with images/drawings and measurements, arranged two per row.',
    img: '/order-layout-double-column.png',
  },
];

export function OrderLayoutPickerModal({ onSelect, onClose }: Props) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="border-b px-6 py-4 flex items-center justify-between sticky top-0 bg-white">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Choose an order layout</h3>
            <p className="text-sm text-slate-500 mt-0.5">
              Pick how this order should look. You can&rsquo;t switch layout later, so choose the one you want now.
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 shrink-0" aria-label="Close">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div data-copilot="order-layout-picker" className="p-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {OPTIONS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              data-copilot={opt.key === 'line_by_line' ? 'order-layout-line-by-line' : undefined}
              onClick={() => onSelect(opt.key)}
              className="group text-left border-2 border-slate-200 rounded-xl overflow-hidden hover:border-[#FF6B35] hover:shadow-lg transition-all focus:outline-none focus:border-[#FF6B35]"
            >
              <div className="bg-slate-50 border-b border-slate-100 aspect-[4/3] overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={opt.img}
                  alt={opt.title}
                  className="w-full h-full object-contain transition-transform duration-200 group-hover:scale-[1.03]"
                  draggable={false}
                />
              </div>
              <div className="p-4">
                <h4 className="font-semibold text-slate-900">{opt.title}</h4>
                <p className="text-sm text-slate-600 mt-1">{opt.blurb}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
