/**
 * Client-side helpers that turn an OrderBundleData payload into a single PDF
 * (the order sheet) and zip one-or-many orders into a download.
 *
 * Mirrors quotes/lib/quote-bundle.ts. As with quotes, we intentionally build a
 * text-based PDF with jsPDF rather than screenshotting the existing print
 * view (OrderBody's @media print stylesheet). Reasons match the quote bundle:
 * deterministic, searchable, no off-screen rendering, scales to 25 orders
 * without locking the browser.
 *
 * Output:
 *   - single order  -> Order-<number>-<supplier>.zip   (one PDF inside)
 *   - many orders    -> QuoteCore-Orders-YYYY-MM-DD-N-orders.zip
 */

import jsPDF from 'jspdf';
import JSZip from 'jszip';
import type { OrderBundleData } from '../actions-bulk';

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
    .slice(0, 80) || 'Order';
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

/** Render the lengths JSON into a short human string (best-effort). */
function describeLengths(lengths: unknown, lengthUnit: string | null): string {
  if (!lengths) return '';
  try {
    if (Array.isArray(lengths)) {
      const parts = lengths
        .map((v) => {
          if (typeof v === 'number') return String(v);
          if (v && typeof v === 'object') {
            const o = v as Record<string, unknown>;
            const len = o.length ?? o.value ?? o.size;
            const qty = o.qty ?? o.quantity ?? o.count;
            if (len != null && qty != null) return `${qty} x ${len}`;
            if (len != null) return String(len);
          }
          return '';
        })
        .filter(Boolean);
      if (parts.length === 0) return '';
      return parts.join(', ') + (lengthUnit ? ` ${lengthUnit}` : '');
    }
  } catch {
    /* ignore - best effort only */
  }
  return '';
}

/** ---------- Order Sheet PDF ---------- */
function buildOrderPdf(b: OrderBundleData): ArrayBuffer {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const cur: PdfCursor = { doc, y: MARGIN };

  // Branding header (best-effort).
  if (b.order.fromCompany) {
    writeLine(cur, b.order.fromCompany, { bold: true, size: 16 });
    drawDivider(cur);
  }

  writeHeader(
    cur,
    `Order ${b.order.orderNumber}`,
    [b.order.reference, b.order.jobName].filter(Boolean).join(' · '),
  );

  // Supplier / delivery meta block.
  const supplier = b.order.toSupplier || b.order.supplierName;
  if (supplier) writeKeyValue(cur, 'Supplier', supplier);
  if (b.order.supplierContact) writeKeyValue(cur, 'Supplier Contact', b.order.supplierContact);
  if (b.order.contactPerson) writeKeyValue(cur, 'Contact', b.order.contactPerson);
  if (b.order.contactDetails) writeKeyValue(cur, 'Contact Details', b.order.contactDetails);
  writeKeyValue(cur, 'Status', b.order.status);
  if (b.order.orderDate) writeKeyValue(cur, 'Order Date', fmtDate(b.order.orderDate));
  else writeKeyValue(cur, 'Created', fmtDate(b.order.createdAt));
  if (b.order.deliveryDate) writeKeyValue(cur, 'Delivery Date', fmtDate(b.order.deliveryDate));
  if (b.order.deliveryAddress) writeKeyValue(cur, 'Delivery Address', b.order.deliveryAddress);
  const colours = b.order.colours || (b.order.jobColours && b.order.jobColours.length > 0 ? b.order.jobColours.join(', ') : null);
  if (colours) writeKeyValue(cur, 'Colours', colours);
  advance(cur);

  if (b.order.headerNotes) {
    writeLine(cur, 'Notes', { bold: true, size: 12 });
    drawDivider(cur);
    writeLine(cur, b.order.headerNotes, { size: 9 });
    advance(cur);
  }

  // Line items.
  writeLine(cur, 'Order Items', { bold: true, size: 12 });
  drawDivider(cur);
  if (b.lines.length === 0) {
    writeLine(cur, '(no items)', { size: 9 });
  } else {
    for (const line of b.lines) {
      const qty = line.quantity != null ? `${line.quantity}${line.unit ? ` ${line.unit}` : ''}` : '';
      const head = qty ? `${line.itemName} - ${qty}` : line.itemName;
      writeLine(cur, head, { bold: true, size: 10 });
      const lengthsText = line.showMeasurements ? describeLengths(line.lengths, line.lengthUnit) : '';
      if (lengthsText) writeLine(cur, `  ${lengthsText}`, { size: 9 });
      if (line.notes) writeLine(cur, `  ${line.notes}`, { size: 9 });
    }
  }

  return doc.output('arraybuffer');
}

/**
 * Add a single order's PDF to a JSZip instance (flat, one file per order).
 * Returns the file name used.
 */
export function addOrderToZip(zip: JSZip, b: OrderBundleData): string {
  const supplier = b.order.toSupplier || b.order.supplierName || '';
  const namePart = sanitizeFilename([b.order.orderNumber, supplier].filter(Boolean).join('-'));
  const fileName = `${namePart}.pdf`;
  zip.file(fileName, buildOrderPdf(b));
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
