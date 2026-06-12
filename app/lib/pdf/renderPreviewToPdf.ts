'use client';

/**
 * Shared client-side PDF rendering helper.
 *
 * Single source of truth for "render the actual on-screen preview and lay it
 * out into a clean, page-aware A4 PDF". Both the single-download buttons and
 * the bulk (ZIP) bundles call into here so a downloaded PDF is a pixel match
 * of the preview the customer sees AND paginates the same way the browser's
 * own print-to-PDF does (no line/diagram/image is ever cut across a page
 * boundary).
 *
 * ── Why this is "per-segment", not "one giant canvas" ──────────────────────
 * The browser's native print path (window.print() + an `@media print`
 * stylesheet with `page-break-inside: avoid`) produces perfect output because
 * the print engine paginates element-by-element. html2canvas does NOT - it
 * flattens the whole document to one tall bitmap, leaving pagination to us. An
 * earlier version sliced that single bitmap at computed offsets; that math is
 * fragile and produced split/ghosted blocks.
 *
 * This version instead captures each ATOMIC block (`[data-pdf-block]`) - and
 * the chrome around them (headers/footers) - as its OWN image, then places
 * those images into the PDF with simple, robust pagination: if the next block
 * doesn't fit in the remaining space on the current page, it starts a new
 * page. This mirrors `page-break-inside: avoid` exactly. There is no shared
 * tall canvas to mis-slice, so the whole class of "cut/ghosted item" bugs is
 * gone.
 *
 * A block taller than a full printable page is the only thing that still gets
 * sliced across pages (unavoidable - it cannot fit whole anywhere).
 *
 * Gotchas centralised here (all learned from the working DownloadPDFButton):
 *   (a) Tailwind 4 emits oklch()/lab()/lch() colours that html2canvas (1.4.1)
 *       cannot parse. The onclone pass normalises them to rgb() before capture.
 *   (b) Remote images (company logos) must finish loading before capture.
 *   (c) Web fonts must be ready (document.fonts.ready) or text reflows.
 */

import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// A4 portrait geometry (mm).
const PAGE_WIDTH_MM = 210;
const PAGE_HEIGHT_MM = 297;
const MARGIN_MM = 15;

const PRINTABLE_WIDTH_MM = PAGE_WIDTH_MM - MARGIN_MM * 2;
const PRINTABLE_HEIGHT_MM = PAGE_HEIGHT_MM - MARGIN_MM * 2;

/**
 * Pixel width used when mounting a preview component off-screen for capture.
 * Roughly the A4 printable width at ~96dpi so the captured layout matches the
 * on-screen preview proportions.
 */
export const OFFSCREEN_PREVIEW_WIDTH_PX = 794; // ~210mm @ 96dpi

/** html2canvas capture scale. Higher = sharper PDF, more memory. */
const CAPTURE_SCALE = 2;

/**
 * Normalise lab/lch/oklch colours on a cloned document so html2canvas 1.4.1
 * can parse them. Mutates the clone in place.
 */
function normalizeUnsupportedColors(clonedDoc: Document) {
  const win = clonedDoc.defaultView ?? window;
  const all = clonedDoc.querySelectorAll('*');
  all.forEach((node) => {
    const el = node as HTMLElement;
    let computed: CSSStyleDeclaration;
    try {
      computed = win.getComputedStyle(el);
    } catch {
      return;
    }
    const bad = (v: string | null | undefined) =>
      !!v && (v.includes('lab') || v.includes('lch') || v.includes('oklch') || v.includes('oklab'));
    if (bad(computed.color)) el.style.color = 'rgb(15, 23, 42)';
    if (bad(computed.backgroundColor)) el.style.backgroundColor = 'rgb(255, 255, 255)';
    if (bad(computed.borderColor)) el.style.borderColor = 'rgb(203, 213, 225)';
  });
}

/** Await every <img> inside the node so logos/remote images are painted. */
async function awaitImages(root: HTMLElement): Promise<void> {
  const imgs = Array.from(root.querySelectorAll('img'));
  await Promise.all(
    imgs.map((img) => {
      if (!img.crossOrigin && /^https?:\/\//i.test(img.src)) {
        try {
          img.crossOrigin = 'anonymous';
        } catch {
          /* ignore */
        }
      }
      if (img.complete && img.naturalWidth > 0) return Promise.resolve();
      return new Promise<void>((resolve) => {
        const done = () => resolve();
        img.addEventListener('load', done, { once: true });
        img.addEventListener('error', done, { once: true });
        setTimeout(done, 4000);
      });
    }),
  );
}

/** Await web fonts so text doesn't reflow after capture. Best-effort. */
async function awaitFonts(): Promise<void> {
  try {
    if (typeof document !== 'undefined' && (document as Document).fonts) {
      await (document as Document).fonts.ready;
    }
  } catch {
    /* ignore */
  }
}

/**
 * Build the ordered list of "segment" elements to capture from `root`.
 *
 * A segment is an atomic unit placed whole on a page (like a print
 * `page-break-inside: avoid` box). The rule:
 *   - An element marked `[data-pdf-block]` is always its own segment.
 *   - Any other element is a segment IF it contains no `[data-pdf-block]`
 *     descendants (it's "chrome" - a header, notes box, footer, etc.).
 *   - An element that DOES contain blocks is not itself a segment; we descend
 *     into its children so each block becomes a segment and the non-block bits
 *     around it become their own chrome segments.
 *
 * This yields, e.g. for an order: [[header], [header-notes?], [card1],
 * [card2], …, [totals?]] - exactly the boxes the print stylesheet keeps
 * together. Each entry is a ROW: usually one element, but a multi-column
 * layout (2-up order cards) yields rows of 2+ elements placed side by side so
 * the columns are preserved instead of collapsing into a single stack.
 *
 * If the document marks NO blocks at all, we return [[root]] - callers then
 * fall back to whole-image (single-segment) capture.
 */
function collectSegments(root: HTMLElement): HTMLElement[][] {
  const hasBlocks = !!root.querySelector('[data-pdf-block]');
  if (!hasBlocks) return [[root]];

  const rows: HTMLElement[][] = [];

  const visit = (el: HTMLElement) => {
    if (el.hasAttribute('data-pdf-block')) {
      rows.push([el]);
      return;
    }
    const containsBlock = !!el.querySelector('[data-pdf-block]');
    if (!containsBlock) {
      // Pure chrome - capture whole. Skip empties.
      if (el.getBoundingClientRect().height > 0.5) rows.push([el]);
      return;
    }
    const children = Array.from(el.children).filter(
      (c): c is HTMLElement => c instanceof HTMLElement,
    );
    if (children.length === 0) {
      rows.push([el]);
      return;
    }

    // Multi-column detection: do any two direct block children share a row
    // (vertical spans overlap)? If so this is a 2-up grid; group children into
    // visual rows by top offset and keep each row together.
    const directBlocks = children.filter((c) => c.hasAttribute('data-pdf-block'));
    const looksColumnar =
      directBlocks.length >= 2 &&
      directBlocks.some((a, i) =>
        directBlocks.slice(i + 1).some((b) => {
          const ra = a.getBoundingClientRect();
          const rb = b.getBoundingClientRect();
          return Math.abs(ra.top - rb.top) < ra.height * 0.5;
        }),
      );

    if (looksColumnar) {
      const sorted = [...children].sort(
        (a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top,
      );
      let current: HTMLElement[] = [];
      const flush = () => {
        if (current.length) rows.push(current);
        current = [];
      };
      for (const child of sorted) {
        if (current.length === 0) {
          current.push(child);
          continue;
        }
        const refTop = current[0].getBoundingClientRect().top;
        const refH = current[0].getBoundingClientRect().height;
        if (Math.abs(child.getBoundingClientRect().top - refTop) < refH * 0.5) {
          current.push(child); // same visual row
        } else {
          flush();
          current.push(child);
        }
      }
      flush();
      return;
    }

    // Single-column mixed container: descend so blocks + chrome split out in
    // document order.
    for (const child of children) visit(child);
  };

  const topChildren = Array.from(root.children).filter(
    (c): c is HTMLElement => c instanceof HTMLElement,
  );
  if (topChildren.length === 0) return [[root]];
  for (const child of topChildren) visit(child);

  return rows.length > 0 ? rows : [[root]];
}

interface CapturedSegment {
  dataUrl: string;
  /** Natural canvas pixel dimensions. */
  pxWidth: number;
  pxHeight: number;
}

/** A captured row = one or more cells placed side by side. */
interface CapturedRow {
  cells: CapturedSegment[];
}

/** Capture one element to a PNG data URL + its pixel dims. */
async function captureElement(el: HTMLElement): Promise<CapturedSegment | null> {
  const rect = el.getBoundingClientRect();
  if (rect.height < 0.5 || rect.width < 0.5) return null;
  const canvas = await html2canvas(el, {
    scale: CAPTURE_SCALE,
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff',
    allowTaint: true,
    foreignObjectRendering: false,
    onclone: (clonedDoc) => normalizeUnsupportedColors(clonedDoc),
  });
  return {
    dataUrl: canvas.toDataURL('image/png'),
    pxWidth: canvas.width,
    pxHeight: canvas.height,
  };
}

/** Capture a row of elements (side-by-side cells), preserving document order. */
async function captureRow(els: HTMLElement[]): Promise<CapturedRow | null> {
  const cells: CapturedSegment[] = [];
  for (const el of els) {
    const c = await captureElement(el);
    if (c) cells.push(c);
  }
  return cells.length > 0 ? { cells } : null;
}

/**
 * Lay captured segments into an A4 PDF with page-break-inside-avoid
 * pagination. All segments share the same target width (the printable width),
 * scaled proportionally; each segment's height in mm is derived from its
 * aspect ratio.
 */
function segmentsToPdf(rows: CapturedRow[]): jsPDF {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const fullWidth = PRINTABLE_WIDTH_MM;
  const COL_GAP_MM = 4;
  const pageBottom = PAGE_HEIGHT_MM - MARGIN_MM;

  let cursorY = MARGIN_MM;
  let firstOnPage = true;

  const newPage = () => {
    pdf.addPage();
    cursorY = MARGIN_MM;
    firstOnPage = true;
  };

  for (const row of rows) {
    const n = row.cells.length;

    // ── Single-cell row ────────────────────────────────────────────────────
    if (n === 1) {
      const seg = row.cells[0];
      const segHeight = (seg.pxHeight * fullWidth) / seg.pxWidth;

      // Oversized (taller than a page): place on a fresh page and slice (the
      // only unavoidable split). Mirrors an un-breakable box in print.
      if (segHeight > PRINTABLE_HEIGHT_MM + 0.5) {
        if (!firstOnPage) newPage();
        let remaining = segHeight;
        let drawTop = MARGIN_MM;
        let firstSlice = true;
        while (remaining > 0.5) {
          if (!firstSlice) newPage();
          pdf.saveGraphicsState();
          pdf.rect(MARGIN_MM, MARGIN_MM, fullWidth, PRINTABLE_HEIGHT_MM);
          pdf.clip();
          pdf.discardPath();
          pdf.addImage(seg.dataUrl, 'PNG', MARGIN_MM, drawTop, fullWidth, segHeight);
          pdf.restoreGraphicsState();
          remaining -= PRINTABLE_HEIGHT_MM;
          drawTop -= PRINTABLE_HEIGHT_MM;
          firstSlice = false;
        }
        cursorY = MARGIN_MM + (segHeight % PRINTABLE_HEIGHT_MM);
        firstOnPage = false;
        continue;
      }

      if (!firstOnPage && cursorY + segHeight > pageBottom + 0.5) newPage();
      pdf.addImage(seg.dataUrl, 'PNG', MARGIN_MM, cursorY, fullWidth, segHeight);
      cursorY += segHeight;
      firstOnPage = false;
      continue;
    }

    // ── Multi-cell row (side-by-side columns) ─────────────────────────────
    // Split the printable width evenly across cells (gaps between). Each cell
    // keeps its own aspect ratio; the row's height is the tallest cell. The
    // whole row is kept together (never split across a page).
    const cellWidth = (fullWidth - COL_GAP_MM * (n - 1)) / n;
    const cellHeights = row.cells.map((c) => (c.pxHeight * cellWidth) / c.pxWidth);
    const rowHeight = Math.max(...cellHeights);

    if (rowHeight > PRINTABLE_HEIGHT_MM + 0.5) {
      // A side-by-side row taller than a page is pathological; fall back to
      // stacking its cells vertically (each handled as a single-cell row).
      for (const cell of row.cells) {
        rows.push({ cells: [cell] });
      }
      continue;
    }

    if (!firstOnPage && cursorY + rowHeight > pageBottom + 0.5) newPage();
    row.cells.forEach((cell, i) => {
      const x = MARGIN_MM + i * (cellWidth + COL_GAP_MM);
      pdf.addImage(cell.dataUrl, 'PNG', x, cursorY, cellWidth, cellHeights[i]);
    });
    cursorY += rowHeight;
    firstOnPage = false;
  }

  return pdf;
}

/**
 * Capture a root element's segments and lay them into a page-aware A4 PDF.
 * Shared by the live-DOM (single download) and offscreen (bulk) paths.
 */
async function rootToPdf(root: HTMLElement): Promise<jsPDF> {
  const segmentRows = collectSegments(root);
  const captured: CapturedRow[] = [];
  for (const els of segmentRows) {
    const c = await captureRow(els);
    if (c) captured.push(c);
  }
  if (captured.length === 0) {
    // Fallback: capture the whole root as one image.
    const c = await captureElement(root);
    if (c) captured.push({ cells: [c].filter(Boolean) as CapturedSegment[] });
  }
  return segmentsToPdf(captured);
}

/**
 * Capture a live, on-screen DOM element into a page-aware A4 jsPDF.
 * Used by the single-download buttons (preview already mounted on screen).
 */
export async function elementToPdf(element: HTMLElement): Promise<jsPDF> {
  await awaitFonts();
  await awaitImages(element);
  return rootToPdf(element);
}

/**
 * Mount a React element off-screen, wait for paint (fonts + images), capture
 * it segment-by-segment into a page-aware A4 PDF, then unmount. Returns an
 * ArrayBuffer ready to drop into a ZIP.
 *
 * Used by the bulk bundles. Sequential by design (callers loop one item at a
 * time) to bound memory at the 25-item cap; always unmounts before returning.
 */
export async function renderReactPreviewToPdfBuffer(
  element: React.ReactElement,
  opts?: { widthPx?: number },
): Promise<ArrayBuffer> {
  const { createRoot } = await import('react-dom/client');

  const widthPx = opts?.widthPx ?? OFFSCREEN_PREVIEW_WIDTH_PX;

  const host = document.createElement('div');
  host.style.position = 'fixed';
  host.style.left = '-99999px';
  host.style.top = '0';
  host.style.width = `${widthPx}px`;
  host.style.background = '#ffffff';
  host.setAttribute('data-offscreen-pdf', 'true');

  const inner = document.createElement('div');
  inner.style.width = `${widthPx}px`;
  inner.style.background = '#ffffff';
  inner.style.padding = '24px';
  inner.style.boxSizing = 'border-box';
  host.appendChild(inner);
  document.body.appendChild(host);

  const root = createRoot(inner);

  try {
    await new Promise<void>((resolve) => {
      root.render(element);
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });

    await awaitFonts();
    await awaitImages(inner);
    await new Promise((r) => setTimeout(r, 60));

    const pdf = await rootToPdf(inner);
    return pdf.output('arraybuffer');
  } finally {
    try {
      root.unmount();
    } catch {
      /* ignore */
    }
    if (host.parentNode) host.parentNode.removeChild(host);
  }
}
