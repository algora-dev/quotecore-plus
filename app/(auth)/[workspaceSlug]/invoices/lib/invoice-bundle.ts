/**
 * Client-side helpers that turn an InvoiceBundleData payload into a single PDF
 * (the invoice) and zip one-or-many invoices into a download.
 *
 * Mirrors quotes/lib/quote-bundle.ts. As with quotes, we build a text-based
 * PDF with jsPDF rather than screenshotting the existing print view
 * (InvoicePreview / the public /invoice/[token] page). Reasons match the quote
 * bundle: deterministic, searchable, no off-screen rendering, scales to 25
 * invoices without locking the browser.
 *
 * Output:
 *   - single invoice -> Invoice-<number>-<customer>.zip   (one PDF inside)
 *   - many invoices   -> QuoteCore-Invoices-YYYY-MM-DD-N-invoices.zip
 */

import jsPDF from 'jspdf';
import JSZip from 'jszip';
import type { InvoiceBundleData } from '../actions-bulk';

// Page geometry (A4 portrait, mm).
const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN = 15;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const LINE_HEIGHT = 5;

interface PdfCursor {
  doc: jsPDF;
  y: number;
}

/** Deterministic currency format (code prefix, no locale tricks). */
function fmtCurrency(amount: number, currency: string): string {
  const sign = amount < 0 ? '-' : '';
  const abs = Math.abs(amount);
  return `${sign}${currency} ${abs.toFixed(2)}`;
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Replace filesystem-hostile characters with `_`. */
export function sanitizeFilename(input: string): string {
  return input
    .replace(/[\\/:*?"<>|\r\n\t]+/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80) || 'Invoice';
}

function writeLine(
  cur: PdfCursor,
  text: string,
  opts: { bold?: boolean; size?: number; align?: 'left' | 'right'; x?: number } = {},
) {
  const { bold = false, size = 10, align = 'left', x } = opts;
  cur.doc.setFont('helvetica', bold ? 'bold' : 'normal');
  cur.doc.setFontSize(size);
  const baseX = x ?? (align === 'right' ? PAGE_WIDTH - MARGIN : MARGIN);
  const wrapped = cur.doc.splitTextToSize(text, CONTENT_WIDTH);
  for (const piece of wrapped) {
    if (cur.y > PAGE_HEIGHT - MARGIN) {
      cur.doc.addPage();
      cur.y = MARGIN;
    }
    cur.doc.text(piece, baseX, cur.y, { align });
    cur.y += LINE_HEIGHT;
  }
}

function writeKeyValue(cur: PdfCursor, key: string, value: string) {
  cur.doc.setFont('helvetica', 'bold');
  cur.doc.setFontSize(10);
  cur.doc.text(key, MARGIN, cur.y);
  cur.doc.setFont('helvetica', 'normal');
  const wrapped = cur.doc.splitTextToSize(value || '-', CONTENT_WIDTH - 50);
  cur.doc.text(wrapped, MARGIN + 50, cur.y);
  cur.y += LINE_HEIGHT * Math.max(1, wrapped.length);
  if (cur.y > PAGE_HEIGHT - MARGIN) {
    cur.doc.addPage();
    cur.y = MARGIN;
  }
}

function drawDivider(cur: PdfCursor) {
  cur.doc.setDrawColor(200);
  cur.doc.line(MARGIN, cur.y, PAGE_WIDTH - MARGIN, cur.y);
  cur.y += 3;
}

function advance(cur: PdfCursor, lines = 1) {
  cur.y += lines * LINE_HEIGHT;
  if (cur.y > PAGE_HEIGHT - MARGIN) {
    cur.doc.addPage();
    cur.y = MARGIN;
  }
}

function writeHeader(cur: PdfCursor, title: string, subtitle: string) {
  cur.doc.setFont('helvetica', 'bold');
  cur.doc.setFontSize(18);
  cur.doc.text(title, MARGIN, cur.y);
  cur.y += 8;
  if (subtitle) {
    cur.doc.setFont('helvetica', 'normal');
    cur.doc.setFontSize(11);
    cur.doc.setTextColor(90);
    cur.doc.text(subtitle, MARGIN, cur.y);
    cur.doc.setTextColor(0);
    cur.y += 8;
  }
  drawDivider(cur);
}

/** ---------- Invoice PDF ---------- */
function buildInvoicePdf(b: InvoiceBundleData): ArrayBuffer {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const cur: PdfCursor = { doc, y: MARGIN };
  const currency = b.invoice.currency;

  // Branding header (best-effort - no logo embedding to keep output deterministic).
  if (b.invoice.branding.companyName) {
    writeLine(cur, b.invoice.branding.companyName, { bold: true, size: 16 });
  }
  if (b.invoice.branding.companyAddress) writeLine(cur, b.invoice.branding.companyAddress, { size: 9 });
  const contactBits = [b.invoice.branding.companyPhone, b.invoice.branding.companyEmail].filter(Boolean).join(' · ');
  if (contactBits) writeLine(cur, contactBits, { size: 9 });
  if (b.invoice.branding.companyName || b.invoice.branding.companyAddress || contactBits) {
    drawDivider(cur);
  }

  writeHeader(
    cur,
    `Invoice ${b.invoice.invoiceNumber}`,
    b.invoice.customerName,
  );

  if (b.invoice.customerEmail) writeKeyValue(cur, 'Customer Email', b.invoice.customerEmail);
  writeKeyValue(cur, 'Status', b.invoice.status);
  writeKeyValue(cur, 'Invoice Date', fmtDate(b.invoice.invoiceDate));
  if (b.invoice.dueDate) writeKeyValue(cur, 'Due Date', fmtDate(b.invoice.dueDate));
  writeKeyValue(cur, 'Payment Reference', b.invoice.paymentReference);
  advance(cur);

  // Line items.
  writeLine(cur, 'Items', { bold: true, size: 12 });
  drawDivider(cur);

  const visibleLines = b.lines.filter((l) => l.isVisible);
  if (visibleLines.length === 0) {
    writeLine(cur, '(no line items)', { size: 9 });
  } else {
    for (const line of visibleLines) {
      const priceText = line.showPrice ? fmtCurrency(line.lineTotal, currency) : '';
      cur.doc.setFont('helvetica', 'normal');
      cur.doc.setFontSize(10);
      const qtyBit = line.showQuantity && line.quantity ? `${line.quantity} ${line.unit} · ` : '';
      const titleText = `${qtyBit}${line.title || ''}`;
      const textWidth = priceText ? CONTENT_WIDTH - 40 : CONTENT_WIDTH;
      const wrapped = cur.doc.splitTextToSize(titleText, textWidth);
      if (cur.y > PAGE_HEIGHT - MARGIN) {
        cur.doc.addPage();
        cur.y = MARGIN;
      }
      cur.doc.text(wrapped, MARGIN, cur.y);
      if (priceText) cur.doc.text(priceText, PAGE_WIDTH - MARGIN, cur.y, { align: 'right' });
      cur.y += LINE_HEIGHT * Math.max(1, wrapped.length);
      if (line.showDescription && line.description) {
        writeLine(cur, `  ${line.description}`, { size: 9 });
      }
    }
  }

  // Totals.
  advance(cur);
  drawDivider(cur);
  writeKeyValue(cur, 'Subtotal', fmtCurrency(b.invoice.subtotal, currency));
  if (b.invoice.discountTotal !== 0) {
    writeKeyValue(cur, 'Discount', fmtCurrency(-Math.abs(b.invoice.discountTotal), currency));
  }
  if (b.invoice.taxTotal !== 0) {
    writeKeyValue(cur, 'Tax', fmtCurrency(b.invoice.taxTotal, currency));
  }
  writeKeyValue(cur, 'TOTAL', fmtCurrency(b.invoice.total, currency));

  if (b.invoice.notes) {
    advance(cur);
    writeLine(cur, 'Notes', { bold: true, size: 11 });
    drawDivider(cur);
    writeLine(cur, b.invoice.notes, { size: 9 });
  }
  if (b.invoice.terms) {
    advance(cur);
    writeLine(cur, 'Terms', { bold: true, size: 11 });
    drawDivider(cur);
    writeLine(cur, b.invoice.terms, { size: 9 });
  }
  if (b.invoice.branding.footerText) {
    advance(cur, 2);
    drawDivider(cur);
    writeLine(cur, b.invoice.branding.footerText, { size: 9 });
  }

  return doc.output('arraybuffer');
}

/**
 * Add a single invoice's PDF to a JSZip instance (flat, one file per invoice).
 * Returns the file name used.
 */
export function addInvoiceToZip(zip: JSZip, b: InvoiceBundleData): string {
  const namePart = sanitizeFilename(
    [b.invoice.invoiceNumber, b.invoice.customerName].filter(Boolean).join('-'),
  );
  const fileName = `${namePart}.pdf`;
  zip.file(fileName, buildInvoicePdf(b));
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
