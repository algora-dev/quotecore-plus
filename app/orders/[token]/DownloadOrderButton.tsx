'use client';

/**
 * Download button for the public supplier order page. Styled to match
 * the public quote page's Download button (blue outline, brand-glow
 * hover) so both customer-facing surfaces feel like the same product.
 *
 * Uses the browser's print-to-PDF dialog with a print-only stylesheet
 * targeting the `[data-print-root]` element rendered by OrderBody.
 * Same approach as the quote page; pagination is handled by CSS @page
 * rather than html2canvas rasterisation so multi-page orders don't
 * cut content mid-line.
 */
export function DownloadOrderButton() {
  function handleClick() {
    window.print();
  }
  return (
    <button
      onClick={handleClick}
      data-print-hide
      className="px-6 py-2.5 text-sm font-semibold rounded-full bg-white text-blue-600 border border-blue-300 hover:bg-blue-50 hover:shadow-[0_0_12px_rgba(59,130,246,0.35)] transition-all"
    >
      Download / Print PDF
    </button>
  );
}
