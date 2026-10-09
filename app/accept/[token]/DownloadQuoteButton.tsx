'use client';

import { QcButton } from '@/app/components/ui/v2/QcButton';

/**
 * Download button on the public quote accept page. Uses the browser's
 * print-to-PDF dialog instead of `html2canvas` rasterisation \u2014 the same
 * approach the public order page (`/orders/[token]`) uses.
 *
 * Why print rather than html2canvas: html2canvas rasterises the DOM into
 * a single bitmap and naively page-breaks, which can cut content mid-line
 * on multi-page quotes. CSS @page + print-only visibility lets the
 * browser handle proper pagination, headers, footers, and reflow.
 *
 * The trade-off is that the user sees a print dialog rather than a
 * direct file download, but the recipient gets a real PDF via the
 * dialog's "Save as PDF" destination on every major browser.
 */
export function DownloadQuoteButton({ printTargetId }: { printTargetId: string }) {
  function handleClick() {
    // Add a transient body class so the global @media print rules know
    // which element to show; cleared on afterprint.
    document.body.setAttribute('data-print-mode', 'quote');
    const onAfterPrint = () => {
      document.body.removeAttribute('data-print-mode');
      window.removeEventListener('afterprint', onAfterPrint);
    };
    window.addEventListener('afterprint', onAfterPrint);
    // Make sure the print root id matches the element we want to render.
    document.body.setAttribute('data-print-target', printTargetId);
    window.print();
  }

  return (
    <>
      <style jsx global>{`
        @media print {
          body[data-print-mode='quote'] * { visibility: hidden !important; }
          body[data-print-mode='quote'] #${cssId(printTargetId)},
          body[data-print-mode='quote'] #${cssId(printTargetId)} * { visibility: visible !important; }
          body[data-print-mode='quote'] #${cssId(printTargetId)} {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 12mm !important;
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
          }
          body[data-print-mode='quote'] [data-print-hide] { display: none !important; }
          @page { margin: 0; }
        }
      `}</style>

      <div data-print-hide>
        <QcButton variant="ghost" size="lg" onClick={handleClick}>
          <svg className="qc-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h3.9a2 2 0 011.69.9l.81 1.2a2 2 0 001.67.9H18a2 2 0 012 2v10a2 2 0 01-2 2z" />
          </svg>
          Download / Print PDF
        </QcButton>
      </div>
    </>
  );
}

/**
 * Escape an id for use inside a CSS selector. CSS doesn't allow many
 * special characters in identifiers without escaping; the simplest safe
 * thing is to verify it's alnum + dash + underscore at the call site
 * and reject anything else. Here we just round-trip what we received.
 */
function cssId(id: string): string {
  // Validate at the boundary; we control the call sites.
  if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(id)) {
    return 'public-quote-document';
  }
  return id;
}
