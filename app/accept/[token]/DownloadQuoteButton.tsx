'use client';

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

      <button
        onClick={handleClick}
        data-print-hide
        className="px-4 py-2.5 text-sm font-medium rounded-full border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition"
      >
        Download / Print PDF
      </button>
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
