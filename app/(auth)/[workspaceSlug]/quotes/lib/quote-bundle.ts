/**
 * Client-side helpers that turn a QuoteBundleData payload into:
 *   - 1–3 PDF buffers (summary, customer quote, labour sheet)
 *   - a JSON metadata blob
 *   - a folder of original storage files
 *
 * The output is a single ZIP file named QuoteCore-Export-YYYY-MM-DD.zip when
 * exporting many quotes, or Quote-####-CustomerName.zip for a single quote.
 *
 * We intentionally generate text-based PDFs with jsPDF rather than screenshotting
 * existing pages with html2canvas. Reasons:
 *   - No off-screen rendering of complex client components (more reliable)
 *   - Searchable / accessible PDFs
 *   - Same data the summary page sees (uses the same pricing engine on the server)
 *   - Works for 1 quote or 50 without locking the browser for minutes
 */

import jsPDF from 'jspdf';
import JSZip from 'jszip';
import type { QuoteBundleData } from '../actions-bulk';
import { normalizeMeasurementSystem } from '@/app/lib/types';
import type { MeasurementSystem } from '@/app/lib/types';
import {
  formatArea,
  getUnitLabel,
  describeMeasurementSystem,
} from '@/app/lib/measurements/displayHelpers';
import {
  convertLinear,
  convertArea,
  convertAreaFt2,
} from '@/app/lib/measurements/conversions';

/**
 * Convert the canonical metric quantity stored on a component into the value
 * that should be printed in the PDF (already rounded to the conversion's
 * native precision). Quantity types that don't carry a unit (point counts /
 * fixed) pass through untouched.
 */
function displayQuantity(
  rawQty: number,
  measurementType: string | null,
  system: MeasurementSystem | null | undefined
): number {
  const sys = normalizeMeasurementSystem(system);
  if (measurementType === 'area') {
    if (sys === 'imperial_ft') return convertAreaFt2(rawQty);
    if (sys === 'imperial_rs') return Number(convertArea(rawQty));
    return rawQty;
  }
  if (measurementType === 'lineal') {
    return sys === 'metric' ? rawQty : convertLinear(rawQty);
  }
  // quantity / fixed: no conversion applies.
  return rawQty;
}

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

/** Format an amount with the quote's currency code (no fancy locale tricks — keeps the PDF deterministic). */
function fmtCurrency(amount: number, currency: string): string {
  const sign = amount < 0 ? '-' : '';
  const abs = Math.abs(amount);
  return `${sign}${currency} ${abs.toFixed(2)}`;
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-NZ', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Replace filesystem-hostile characters with `_`. */
export function sanitizeFilename(input: string): string {
  return input
    .replace(/[\\/:*?"<>|\r\n\t]+/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80) || 'Quote';
}

/** Move down by N lines, paginating when we run out of room. */
function advance(cur: PdfCursor, lines = 1) {
  cur.y += lines * LINE_HEIGHT;
  if (cur.y > PAGE_HEIGHT - MARGIN) {
    cur.doc.addPage();
    cur.y = MARGIN;
  }
}

function writeLine(cur: PdfCursor, text: string, opts: { bold?: boolean; size?: number; align?: 'left' | 'right'; x?: number } = {}) {
  const { bold = false, size = 10, align = 'left', x } = opts;
  cur.doc.setFont('helvetica', bold ? 'bold' : 'normal');
  cur.doc.setFontSize(size);
  const baseX = x ?? (align === 'right' ? PAGE_WIDTH - MARGIN : MARGIN);
  // jsPDF wraps long text using splitTextToSize; we honour CONTENT_WIDTH.
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
  // Right-aligned value column at content edge.
  const wrapped = cur.doc.splitTextToSize(value || '—', CONTENT_WIDTH - 50);
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

/** ---------- Internal Summary PDF ---------- */
function buildSummaryPdf(b: QuoteBundleData): ArrayBuffer {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const cur: PdfCursor = { doc, y: MARGIN };

  writeHeader(
    cur,
    `Quote #${b.quote.quoteNumber ?? 'DRAFT'} — Internal Summary`,
    `${b.quote.customerName}${b.quote.jobName ? ` · ${b.quote.jobName}` : ''}`
  );

  // Meta block.
  writeKeyValue(cur, 'Status', `${b.quote.status}${b.quote.jobStatus ? ` · ${b.quote.jobStatus}` : ''}`);
  writeKeyValue(cur, 'Created', fmtDate(b.quote.createdAt));
  writeKeyValue(cur, 'Updated', fmtDate(b.quote.updatedAt));
  if (b.quote.siteAddress) writeKeyValue(cur, 'Site Address', b.quote.siteAddress);
  if (b.quote.customerEmail) writeKeyValue(cur, 'Customer Email', b.quote.customerEmail);
  if (b.quote.customerPhone) writeKeyValue(cur, 'Customer Phone', b.quote.customerPhone);
  writeKeyValue(cur, 'Currency', b.quote.currency);
  writeKeyValue(
    cur,
    'Measurement',
    b.quote.measurementSystem
      ? describeMeasurementSystem(b.quote.measurementSystem as MeasurementSystem)
      : '—'
  );
  advance(cur);

  const system = (b.quote.measurementSystem ?? 'metric') as MeasurementSystem;

  // Roof areas.
  if (b.roofAreas.length > 0) {
    writeLine(cur, 'Roof Areas', { bold: true, size: 12 });
    drawDivider(cur);
    for (const area of b.roofAreas) {
      const areaComps = b.components.filter((c) => c.roofAreaLabel === area.label);
      writeLine(cur, `${area.label} — ${formatArea(area.computedSqm, system)}`, { bold: true });
      if (areaComps.length === 0) {
        writeLine(cur, '  (no components)', { size: 9 });
      } else {
        for (const c of areaComps) {
          const total = c.materialCost + c.labourCost;
          // Prefer the measurement-aware unit label; fall back to the
          // user-typed pricing_unit if the component is non-metric (e.g. "each").
          const dispQty = displayQuantity(c.finalQuantity, c.measurementType, system);
          const unit = c.measurementType === 'area' || c.measurementType === 'lineal'
            ? getUnitLabel(c.measurementType, system)
            : (c.pricingUnit ?? '');
          writeLine(
            cur,
            `  ${c.name} — qty ${dispQty.toFixed(1)} ${unit} · mat ${fmtCurrency(c.materialCost, b.quote.currency)} · lab ${fmtCurrency(c.labourCost, b.quote.currency)} · total ${fmtCurrency(total, b.quote.currency)}`,
            { size: 9 }
          );
        }
      }
      advance(cur);
    }
  }

  // Extras (components without a roof area).
  const extras = b.components.filter((c) => !c.roofAreaLabel);
  if (extras.length > 0) {
    writeLine(cur, 'Extras', { bold: true, size: 12 });
    drawDivider(cur);
    for (const c of extras) {
      const total = c.materialCost + c.labourCost;
      const dispQty = displayQuantity(c.finalQuantity, c.measurementType, system);
      const unit = c.measurementType === 'area' || c.measurementType === 'lineal'
        ? getUnitLabel(c.measurementType, system)
        : (c.pricingUnit ?? '');
      writeLine(
        cur,
        `${c.name} — qty ${dispQty.toFixed(1)} ${unit} · mat ${fmtCurrency(c.materialCost, b.quote.currency)} · lab ${fmtCurrency(c.labourCost, b.quote.currency)} · total ${fmtCurrency(total, b.quote.currency)}`,
        { size: 9 }
      );
    }
    advance(cur);
  }



  // Totals.
  writeLine(cur, 'Totals', { bold: true, size: 12 });
  drawDivider(cur);
  writeKeyValue(cur, 'Material Subtotal', fmtCurrency(b.totals.materialSubtotal, b.quote.currency));
  writeKeyValue(cur, 'Labour Subtotal', fmtCurrency(b.totals.labourSubtotal, b.quote.currency));
  writeKeyValue(cur, 'Subtotal (with margins)', fmtCurrency(b.totals.subtotalWithMargins, b.quote.currency));
  if (b.totals.customLinesTotal !== 0) {
    writeKeyValue(cur, 'Customer Line Adjustments', fmtCurrency(b.totals.customLinesTotal, b.quote.currency));
  }
  writeKeyValue(cur, 'Adjusted Subtotal', fmtCurrency(b.totals.adjustedSubtotal, b.quote.currency));
  for (const t of b.totals.taxLines) {
    writeKeyValue(cur, `Tax — ${t.name} (${t.ratePercent.toFixed(2)}%)`, fmtCurrency(t.amount, b.quote.currency));
  }
  writeKeyValue(cur, 'GRAND TOTAL', fmtCurrency(b.totals.grandTotal, b.quote.currency));

  return doc.output('arraybuffer');
}

/** ---------- Customer Quote PDF ---------- */
function buildCustomerQuotePdf(b: QuoteBundleData): ArrayBuffer | null {
  // Only build if there are visible customer lines.
  const visibleLines = b.customerLines.filter((l) => l.isVisible);
  if (visibleLines.length === 0) return null;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const cur: PdfCursor = { doc, y: MARGIN };

  // Branding header (best-effort — no logo embedding to keep the bundle deterministic).
  if (b.quote.branding.companyName) {
    writeLine(cur, b.quote.branding.companyName, { bold: true, size: 16 });
  }
  if (b.quote.branding.companyAddress) writeLine(cur, b.quote.branding.companyAddress, { size: 9 });
  const contactBits = [b.quote.branding.companyPhone, b.quote.branding.companyEmail].filter(Boolean).join(' · ');
  if (contactBits) writeLine(cur, contactBits, { size: 9 });
  drawDivider(cur);

  writeHeader(
    cur,
    `Quote #${b.quote.quoteNumber ?? 'DRAFT'}`,
    b.quote.customerName + (b.quote.jobName ? ` · ${b.quote.jobName}` : '')
  );

  if (b.quote.siteAddress) writeKeyValue(cur, 'Site Address', b.quote.siteAddress);
  writeKeyValue(cur, 'Date', fmtDate(b.quote.createdAt));
  advance(cur);

  writeLine(cur, 'Quote Details', { bold: true, size: 12 });
  drawDivider(cur);

  let runningTotal = 0;
  for (const line of visibleLines) {
    const priceText = line.showPrice ? fmtCurrency(line.amount, b.quote.currency) : '';
    if (line.includeInTotal) runningTotal += line.amount;
    // Two-column layout: text on left, price on right.
    cur.doc.setFont('helvetica', 'normal');
    cur.doc.setFontSize(10);
    const textWidth = priceText ? CONTENT_WIDTH - 40 : CONTENT_WIDTH;
    const wrapped = cur.doc.splitTextToSize(line.text || '', textWidth);
    if (cur.y > PAGE_HEIGHT - MARGIN) {
      cur.doc.addPage();
      cur.y = MARGIN;
    }
    cur.doc.text(wrapped, MARGIN, cur.y);
    if (priceText) {
      cur.doc.text(priceText, PAGE_WIDTH - MARGIN, cur.y, { align: 'right' });
    }
    cur.y += LINE_HEIGHT * Math.max(1, wrapped.length);
  }

  advance(cur);
  drawDivider(cur);
  writeKeyValue(cur, 'Subtotal', fmtCurrency(runningTotal, b.quote.currency));
  for (const t of b.totals.taxLines) {
    writeKeyValue(cur, `${t.name} (${t.ratePercent.toFixed(2)}%)`, fmtCurrency(t.amount, b.quote.currency));
  }
  writeKeyValue(cur, 'TOTAL', fmtCurrency(runningTotal + b.totals.taxTotal, b.quote.currency));

  if (b.quote.branding.footerText) {
    advance(cur, 2);
    drawDivider(cur);
    writeLine(cur, b.quote.branding.footerText, { size: 9 });
  }

  return doc.output('arraybuffer');
}

/** ---------- Labour Sheet PDF ---------- */
function buildLabourSheetPdf(b: QuoteBundleData): ArrayBuffer | null {
  const visibleLines = b.labourLines.filter((l) => l.isVisible);
  if (visibleLines.length === 0) return null;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const cur: PdfCursor = { doc, y: MARGIN };

  writeHeader(
    cur,
    `Quote #${b.quote.quoteNumber ?? 'DRAFT'} — Labour Sheet`,
    b.quote.customerName + (b.quote.jobName ? ` · ${b.quote.jobName}` : '')
  );

  let runningTotal = 0;
  for (const line of visibleLines) {
    const priceText = line.showPrice ? fmtCurrency(line.amount, b.quote.currency) : '';
    if (line.includeInTotal) runningTotal += line.amount;
    cur.doc.setFont('helvetica', 'normal');
    cur.doc.setFontSize(10);
    const textWidth = priceText ? CONTENT_WIDTH - 40 : CONTENT_WIDTH;
    const wrapped = cur.doc.splitTextToSize(line.text || '', textWidth);
    if (cur.y > PAGE_HEIGHT - MARGIN) {
      cur.doc.addPage();
      cur.y = MARGIN;
    }
    cur.doc.text(wrapped, MARGIN, cur.y);
    if (priceText) cur.doc.text(priceText, PAGE_WIDTH - MARGIN, cur.y, { align: 'right' });
    cur.y += LINE_HEIGHT * Math.max(1, wrapped.length);
  }

  advance(cur);
  drawDivider(cur);
  writeKeyValue(cur, 'Total', fmtCurrency(runningTotal, b.quote.currency));

  return doc.output('arraybuffer');
}

/**
 * Add a single quote's contents to a JSZip folder.
 * Returns the folder name used (so callers can keep a manifest).
 */
export async function addQuoteToZip(zip: JSZip, b: QuoteBundleData): Promise<string> {
  const safeCustomer = sanitizeFilename(b.quote.customerName);
  const numberPart = b.quote.quoteNumber !== null ? String(b.quote.quoteNumber).padStart(4, '0') : 'DRAFT';
  const folderName = `Quote-${numberPart}-${safeCustomer}`;
  const folder = zip.folder(folderName)!;

  // 1. Internal summary
  folder.file('01-Summary.pdf', buildSummaryPdf(b));

  // 2. Customer quote (only if it has visible lines)
  const customerPdf = buildCustomerQuotePdf(b);
  if (customerPdf) folder.file('02-Customer-Quote.pdf', customerPdf);

  // 3. Labour sheet (only if it exists)
  const labourPdf = buildLabourSheetPdf(b);
  if (labourPdf) folder.file('03-Labour-Sheet.pdf', labourPdf);

  // 4. Machine-readable details
  folder.file('04-Quote-Details.json', JSON.stringify(b, null, 2));

  // 5. Original storage files (plans + supporting + canvas snapshots)
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
