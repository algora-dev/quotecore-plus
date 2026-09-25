'use client';

import { QcDialog } from '@/app/components/ui/v2/QcDialog';
import { QcButton } from '@/app/components/ui/v2/QcButton';
import '@/app/components/ui/v2/qc-document.css';

/** C57. Two content families, not three editors. Keep the stored/query values
 * and existing routing contract: choosing Visual emits `single`; historic
 * `double` links and saved layouts are still understood by the create page.
 * The existing Visual editor owns the 1 / 2 column switch and save payload.
 */
export type LayoutChoice = 'line_by_line' | 'single' | 'double';

interface Props {
  onSelect: (layout: LayoutChoice) => void;
  onClose: () => void;
}

const OPTIONS: { key: LayoutChoice; title: string; blurb: string; img: string }[] = [
  {
    key: 'line_by_line',
    title: 'Line-by-line order',
    blurb: 'A list of items, descriptions and quantities, with optional prices. Familiar quote-style editing.',
    img: '/order-layout-line-by-line.png',
  },
  {
    key: 'single',
    title: 'Visual order',
    blurb: 'Component cards with drawings, images and measurements. Choose one or two columns inside the editor.',
    img: '/order-layout-double-column.png',
  },
];

export function OrderLayoutPickerModal({ onSelect, onClose }: Props) {
  return (
    <QcDialog open title="What kind of order?" size="md" onRequestClose={onClose}
      description="Choose the content format. Visual orders can switch between one and two columns while editing."
      footer={<QcButton onClick={onClose}>Cancel</QcButton>}>
      <div data-copilot="order-layout-picker" className="qc-document-type-options">
        {OPTIONS.map((opt) => (
          <button key={opt.key} type="button"
            data-copilot={opt.key === 'line_by_line' ? 'order-layout-line-by-line' : undefined}
            onClick={() => onSelect(opt.key)} className="qc-document-type-option">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={opt.img} alt="" draggable={false} />
            <span><strong>{opt.title}</strong><small>{opt.blurb}</small></span>
          </button>
        ))}
      </div>
      <p className="qc-document-help">The content format stays with this order. Column layout is a setting within Visual order.</p>
    </QcDialog>
  );
}
