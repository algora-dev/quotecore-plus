'use client';

/**
 * Client-side helpers that turn an OrderBundleData payload into a single PDF
 * (the order sheet) and zip one-or-many orders into a download.
 *
 * RENDERING APPROACH (changed 2026-06-09, Shaun's "Option 1"):
 * Instead of a text-based jsPDF rebuild that drifts from the live order, we
 * render the EXACT on-screen `OrderBody` component off-screen and
 * html2canvas-capture it, so the downloaded PDF is a pixel match of the order
 * preview screen (same TO/FROM blocks, line/line-by-line layout, flashing
 * images, totals).
 *
 * Output:
 *   - single order  -> Order-<number>-<supplier>.zip   (one PDF inside)
 *   - many orders    -> QuoteCore-Orders-YYYY-MM-DD-N-orders.zip
 *
 * Renders sequentially (caller loops one order at a time) to bound memory at
 * the 25-item cap. Best-effort per item: a failed render logs and is skipped.
 */

import JSZip from 'jszip';
import type { OrderBundleData } from '../actions-bulk';
import { renderComponentToPdfBuffer } from '@/app/lib/pdf/renderComponentToPdf';
import { OrderBody } from '@/app/orders/[token]/OrderBody';
import type { MaterialOrderRow, MaterialOrderLineRow, FlashingLibraryRow } from '@/app/lib/types';

/** Replace filesystem-hostile characters with `_`. */
export function sanitizeFilename(input: string): string {
  return input
    .replace(/[\\/:*?"<>|\r\n\t]+/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80) || 'Order';
}

/** Render one order's PDF (the real OrderBody) as an ArrayBuffer, or null on failure. */
export async function renderOrderPdfBuffer(b: OrderBundleData): Promise<ArrayBuffer | null> {
  const p = b.preview;
  try {
    return await renderComponentToPdfBuffer(
      <OrderBody
        order={p.order as unknown as MaterialOrderRow}
        lines={p.lines as unknown as MaterialOrderLineRow[]}
        flashings={p.flashings as Pick<FlashingLibraryRow, 'id' | 'name' | 'image_url'>[]}
        currency={p.currency}
      />,
    );
  } catch (err) {
    console.warn('[renderOrderPdfBuffer] render failed for', b.order.orderNumber, err);
    return null;
  }
}

/**
 * Add a single order's PDF to a JSZip instance (flat, one file per order).
 * Returns the file name used, or null if the render failed (so the caller can
 * count it as a failure and continue).
 */
export async function addOrderToZip(zip: JSZip, b: OrderBundleData): Promise<string | null> {
  const buf = await renderOrderPdfBuffer(b);
  if (!buf) return null;
  const supplier = b.order.toSupplier || b.order.supplierName || '';
  const namePart = sanitizeFilename([b.order.orderNumber, supplier].filter(Boolean).join('-'));
  const fileName = `${namePart}.pdf`;
  zip.file(fileName, buf);
  return fileName;
}

/** Trigger a browser download of a Blob with the given filename. */
export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5_000);
}
