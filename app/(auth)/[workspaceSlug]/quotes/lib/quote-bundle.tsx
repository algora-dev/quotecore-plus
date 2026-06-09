'use client';

/**
 * Client-side helpers that turn a QuoteBundleData payload into a quote's
 * downloadable archive entry inside a JSZip.
 *
 * RENDERING APPROACH (changed 2026-06-09, Shaun's "Option 1"):
 * We no longer build text-based jsPDF documents that drift from the live
 * preview. Instead we render the EXACT on-screen preview components off-screen
 * and html2canvas-capture them, so a downloaded PDF is a pixel match of what
 * the user sees:
 *   - 01-Customer-Quote.pdf -> <QuotePreview>        (customer-edit preview)
 *   - 02-Labour-Sheet.pdf   -> <LaborSheetDocument>  (only if visible labour lines)
 * The machine-readable 03-Quote-Details.json and the original storage files
 * (plans / supporting / takeoff snapshots) are kept unchanged.
 *
 * Each render is sequential (the caller loops one quote at a time) to bound
 * memory at the 25-item cap.
 */

import JSZip from 'jszip';
import type { QuoteBundleData } from '../actions-bulk';
import { renderComponentToPdfBuffer } from '@/app/lib/pdf/renderComponentToPdf';
import { QuotePreview } from '../[id]/customer-edit/QuotePreview';
import { LaborSheetDocument } from '../[id]/labor/LaborSheetPreview';
import type { QuoteRow } from '@/app/lib/types';

/** Replace filesystem-hostile characters with `_`. */
export function sanitizeFilename(input: string): string {
  return input
    .replace(/[\\/:*?"<>|\r\n\t]+/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80) || 'Quote';
}

/**
 * Add a single quote's contents to a JSZip folder.
 * Returns the folder name used (so callers can keep a manifest).
 *
 * Best-effort per PDF: if one render throws (e.g. a tainted logo canvas), we
 * log and continue so the rest of the bundle still downloads.
 */
export async function addQuoteToZip(zip: JSZip, b: QuoteBundleData): Promise<string> {
  const safeCustomer = sanitizeFilename(b.quote.customerName);
  const numberPart = b.quote.quoteNumber !== null ? String(b.quote.quoteNumber).padStart(4, '0') : 'DRAFT';
  const folderName = `Quote-${numberPart}-${safeCustomer}`;
  const folder = zip.folder(folderName)!;

  const p = b.preview;

  // 1. Customer quote (the real on-screen QuotePreview). showEditButtons=false
  //    strips the inline edit pencils so the capture matches the clean
  //    customer-facing view. onEdit* handlers are omitted (read-only render).
  try {
    const buf = await renderComponentToPdfBuffer(
      <QuotePreview
        quote={p.quote as unknown as QuoteRow}
        lines={p.lines}
        subtotal={p.subtotal}
        taxLines={p.taxLines}
        taxTotal={p.taxTotal}
        total={p.total}
        companyName={p.companyName}
        companyAddress={p.companyAddress}
        companyPhone={p.companyPhone}
        companyEmail={p.companyEmail}
        companyLogoUrl={p.companyLogoUrl}
        footerText={p.footerText}
        showEditButtons={false}
        currency={p.currency}
      />,
    );
    folder.file('01-Customer-Quote.pdf', buf);
  } catch (err) {
    console.warn('[addQuoteToZip] customer quote render failed for', folderName, err);
  }

  // 2. Labour sheet (only when the quote has a visible labour sheet, matching
  //    the previous bundle behaviour). Renders the same LaborSheetDocument the
  //    on-screen labour page shows under [data-pdf-content].
  if (p.labor) {
    try {
      const buf = await renderComponentToPdfBuffer(
        <LaborSheetDocument
          quote={p.labor.quote as unknown as QuoteRow}
          components={p.labor.components as never}
          savedLines={p.labor.savedLines as never}
          quoteTaxes={p.labor.quoteTaxes as never}
        />,
      );
      folder.file('02-Labour-Sheet.pdf', buf);
    } catch (err) {
      console.warn('[addQuoteToZip] labour sheet render failed for', folderName, err);
    }
  }

  // 3. Machine-readable details (unchanged).
  folder.file('03-Quote-Details.json', JSON.stringify(b, null, 2));

  // 4. Original storage files (plans + supporting + canvas snapshots).
  const plans = b.files.filter((f) => f.fileType === 'plan');
  const supporting = b.files.filter((f) => f.fileType === 'supporting');
  const canvases = b.files.filter((f) => f.fileType === 'canvas');

  const fetchToZip = async (folderPath: string, fileName: string, url: string) => {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        console.warn('[addQuoteToZip] file fetch failed:', res.status, url);
        return;
      }
      const buf = await res.arrayBuffer();
      folder.file(`${folderPath}/${sanitizeFilename(fileName)}`, buf);
    } catch (err) {
      console.warn('[addQuoteToZip] fetch threw for', fileName, err);
    }
  };

  await Promise.all([
    ...plans.map((f) => fetchToZip('plans', f.fileName, f.url)),
    ...supporting.map((f) => fetchToZip('files', f.fileName, f.url)),
    ...canvases.map((f) => fetchToZip('takeoff', f.fileName, f.url)),
  ]);

  return folderName;
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
