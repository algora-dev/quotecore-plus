'use client';

/**
 * Thin convenience wrapper around `renderReactPreviewToPdfBuffer` in
 * renderPreviewToPdf.ts.
 *
 * The heavy lifting (off-screen createRoot mount, double-rAF paint flush,
 * await document.fonts.ready, await every <img>, oklch/lab colour
 * normalisation via html2canvas onclone, A4 multi-page slicing, unmount +
 * cleanup) all lives in renderReactPreviewToPdfBuffer. This file just gives the
 * bulk bundles a clearly-named entry point and a couple of ergonomic return
 * shapes (ArrayBuffer for zipping, Blob for single downloads).
 *
 * Used by:
 *   - quotes/lib/quote-bundle.ts   -> <QuotePreview> / <LaborSheetDocument>
 *   - material-orders/lib/order-bundle.ts -> <OrderBody>
 *   - invoices/lib/invoice-bundle.ts -> <InvoicePreview>
 *
 * Render SEQUENTIALLY in bulk loops (one item at a time) to bound memory at
 * the 25-item cap; renderReactPreviewToPdfBuffer always unmounts before
 * returning so roots don't accumulate.
 */

import { renderReactPreviewToPdfBuffer, OFFSCREEN_PREVIEW_WIDTH_PX } from './renderPreviewToPdf';

export { OFFSCREEN_PREVIEW_WIDTH_PX };

/**
 * Mount a preview component off-screen, capture it, return the PDF as an
 * ArrayBuffer (ready to drop straight into a JSZip entry).
 */
export async function renderComponentToPdfBuffer(
  element: React.ReactElement,
  opts?: { widthPx?: number },
): Promise<ArrayBuffer> {
  return renderReactPreviewToPdfBuffer(element, opts);
}

/** Same as above but returns a Blob (handy for a single owner download). */
export async function renderComponentToPdfBlob(
  element: React.ReactElement,
  opts?: { widthPx?: number },
): Promise<Blob> {
  const buf = await renderReactPreviewToPdfBuffer(element, opts);
  return new Blob([buf], { type: 'application/pdf' });
}
