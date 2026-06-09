'use client';

/**
 * Client-side helpers that turn an InvoiceBundleData payload into a single PDF
 * (the invoice) and zip one-or-many invoices into a download.
 *
 * RENDERING APPROACH (changed 2026-06-09, Shaun's "Option 1"):
 * Instead of a text-based jsPDF rebuild, we render the EXACT on-screen
 * owner-side `InvoicePreview` component off-screen and html2canvas-capture it,
 * so the downloaded PDF is a pixel match of the invoice preview the owner sees
 * in the editor. We deliberately use InvoicePreview (the clean, form-free
 * visual) rather than the public PublicInvoiceView, which embeds recipient
 * action forms (PaymentSentForm / DisputeForm / Pay buttons) that must never
 * appear in a downloaded PDF.
 *
 * Output:
 *   - single invoice -> Invoice-<number>-<customer>.zip   (one PDF inside)
 *   - many invoices   -> QuoteCore-Invoices-YYYY-MM-DD-N-invoices.zip
 *
 * Renders sequentially (caller loops one invoice at a time) to bound memory at
 * the 25-item cap. Best-effort per item: a failed render logs and is skipped.
 */

import JSZip from 'jszip';
import type { InvoiceBundleData } from '../actions-bulk';
import { renderComponentToPdfBuffer } from '@/app/lib/pdf/renderComponentToPdf';
import { InvoicePreview } from '../[id]/InvoicePreview';
import type { InvoiceRow, EditableLine } from '../[id]/InvoiceEditor';

/** Replace filesystem-hostile characters with `_`. */
export function sanitizeFilename(input: string): string {
  return input
    .replace(/[\\/:*?"<>|\r\n\t]+/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80) || 'Invoice';
}

/** Render one invoice's PDF (the real InvoicePreview) as an ArrayBuffer, or null on failure. */
export async function renderInvoicePdfBuffer(b: InvoiceBundleData): Promise<ArrayBuffer | null> {
  const p = b.preview;
  try {
    return await renderComponentToPdfBuffer(
      <InvoicePreview
        invoice={p.invoice as unknown as InvoiceRow}
        lines={p.lines as unknown as EditableLine[]}
        currency={p.currency}
        companyName={p.companyName}
        companyAddress={p.companyAddress}
        companyEmail={p.companyEmail}
        companyPhone={p.companyPhone}
        companyLogoUrl={p.companyLogoUrl}
        footerText={p.footerText}
        notes={p.notes}
        terms={p.terms}
        invoiceDate={p.invoiceDate}
        dueDate={p.dueDate}
        subtotal={p.subtotal}
        taxTotal={p.taxTotal}
        total={p.total}
        paymentDetails={p.paymentDetails}
      />,
    );
  } catch (err) {
    console.warn('[renderInvoicePdfBuffer] render failed for', b.invoice.invoiceNumber, err);
    return null;
  }
}

/**
 * Add a single invoice's PDF to a JSZip instance (flat, one file per invoice).
 * Returns the file name used, or null if the render failed (so the caller can
 * count it as a failure and continue).
 */
export async function addInvoiceToZip(zip: JSZip, b: InvoiceBundleData): Promise<string | null> {
  const buf = await renderInvoicePdfBuffer(b);
  if (!buf) return null;
  const namePart = sanitizeFilename(
    [b.invoice.invoiceNumber, b.invoice.customerName].filter(Boolean).join('-'),
  );
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
