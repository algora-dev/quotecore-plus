'use client';

import { ShowcaseIcon } from './ShowcaseIcon';
import type { Capture } from './showcase-types';
import s from './DocumentsShowcase.module.css';

/** The front sheet is the owner's authentic quote. Rear sheets are decorative
 * document-type labels, with no fabricated app screens or document details.
 * The CSS viewport trims only the capture's surrounding canvas and action bar;
 * the original, complete image opens in the shared accessible image dialog.
 */
export function DocumentsShowcase({ capture, onExpand }: {
  capture: Capture;
  onExpand: (capture: Capture) => void;
}) {
  return <div className={s.stage} role="group" aria-label="A finished customer quote, with purchase order and invoice sheets behind it">
    <div className={s.orbit} aria-hidden="true" />
    <div className={s.floor} aria-hidden="true" />

    <div className={`${s.backSheet} ${s.order}`} aria-hidden="true">
      <div className={s.sheetHeading}><ShowcaseIcon name="document" size={18} /><span>Purchase order</span></div>
      <div className={s.sheetRule} />
      <div className={s.sheetLines}><i /><i /><i /><i /><i /></div>
      <div className={s.sheetFoot} />
    </div>
    <div className={`${s.backSheet} ${s.invoice}`} aria-hidden="true">
      <div className={s.sheetHeading}><ShowcaseIcon name="document" size={18} /><span>Invoice</span></div>
      <div className={s.sheetRule} />
      <div className={s.sheetLines}><i /><i /><i /><i /><i /></div>
      <div className={s.sheetFoot} />
    </div>

    <button type="button" className={s.quote} data-capture-trigger="true"
      aria-label="View the finished customer quote in full" aria-haspopup="dialog"
      onClick={() => onExpand(capture)}>
      <span className={s.paperWindow}>
        <img className={s.quoteImage} src={capture.src} alt={capture.alt}
          width={capture.width} height={capture.height} loading="lazy" decoding="async" />
      </span>
      <span className={s.viewLabel}><ShowcaseIcon name="expand" size={14} /><span>View full quote</span></span>
    </button>
  </div>;
}
