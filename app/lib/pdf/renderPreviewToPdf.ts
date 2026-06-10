'use client';

/**
 * Shared client-side PDF rendering helper.
 *
 * Single source of truth for "render the actual on-screen preview to an image
 * and slice it into an A4 PDF". Both the single-download buttons and the bulk
 * (ZIP) bundles call into here so a downloaded PDF is a pixel match of the
 * preview the customer sees.
 *
 * Why html2canvas-of-the-real-DOM instead of text jsPDF: Shaun's explicit
 * request (2026-06-09) was that downloads look EXACTLY like the preview. The
 * text-based jsPDF bundles drifted from the live preview (different layout,
 * no logo, no styling). Capturing the rendered component removes that drift.
 *
 * Three gotchas this helper centralises (all learned from the working
 * DownloadPDFButton):
 *   (a) Tailwind 4 emits oklch()/lab()/lch() colors that html2canvas (1.4.1)
 *       cannot parse and throws on. The onclone pass normalises any computed
 *       color/background/border that contains those functions to an rgb()
 *       fallback BEFORE capture.
 *   (b) Remote images (company logos) must finish loading before capture or
 *       they render blank. We await every <img> decode/onload first.
 *   (c) Web fonts must be ready (document.fonts.ready) or text reflows after
 *       capture. We await that too.
 *   (d) Tall content (long orders/invoices) is sliced across multiple A4
 *       pages using the same height math as the reference button.
 */

import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// A4 portrait geometry (mm). Matches DownloadPDFButton exactly.
const PAGE_WIDTH_MM = 210;
const PAGE_HEIGHT_MM = 297;
const MARGIN_MM = 15;

/**
 * Pixel width used when mounting a preview component off-screen for capture.
 * Roughly the A4 printable width at ~96dpi so the captured layout matches the
 * on-screen preview proportions. The single-download path captures the live
 * DOM node at its natural width instead, so this only applies to offscreen
 * mounts.
 */
export const OFFSCREEN_PREVIEW_WIDTH_PX = 794; // ~210mm @ 96dpi

/**
 * Normalise lab/lch/oklch colours on a cloned document so html2canvas 1.4.1
 * can parse them. Mutates the clone in place. Kept identical in spirit to the
 * working DownloadPDFButton onclone, just hoisted so every caller shares it.
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
    if (bad(computed.color)) el.style.color = 'rgb(15, 23, 42)'; // slate-900-ish
    if (bad(computed.backgroundColor)) el.style.backgroundColor = 'rgb(255, 255, 255)';
    if (bad(computed.borderColor)) el.style.borderColor = 'rgb(203, 213, 225)'; // slate-300
  });
}

/** Await every <img> inside the node so logos/remote images are painted. */
async function awaitImages(root: HTMLElement): Promise<void> {
  const imgs = Array.from(root.querySelectorAll('img'));
  await Promise.all(
    imgs.map((img) => {
      // Best-effort CORS so remote logos can be drawn onto the canvas.
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
        img.addEventListener('error', done, { once: true }); // don't block on a broken logo
        // Safety timeout so one stuck image can't hang the whole batch.
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
 * Capture a live DOM element into a multi-page A4 jsPDF document.
 *
 * Used by the single-download buttons, which already have the preview mounted
 * on screen (under [data-pdf-content] / similar). The element is captured at
 * its natural rendered width.
 */
export async function elementToPdf(element: HTMLElement): Promise<jsPDF> {
  await awaitFonts();
  await awaitImages(element);

  // Capture block boundaries BEFORE html2canvas (measured against the live
  // DOM) so the slicer can avoid cutting through line items / diagrams.
  const blockTopsCssPx = collectBlockTops(element);
  const sourceCssHeight = element.getBoundingClientRect().height;

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff',
    allowTaint: true,
    foreignObjectRendering: false,
    onclone: (clonedDoc) => normalizeUnsupportedColors(clonedDoc),
  });

  return canvasToPdf(canvas, { blockTopsCssPx, sourceCssHeight });
}

/**
 * Collect page-break-safe boundaries from a captured element.
 *
 * Any element tagged `[data-pdf-block]` is treated as an atomic unit that must
 * NOT be split across a page boundary (a line item, a diagram/image, a totals
 * block, etc.). We return each block's TOP offset (in element-local CSS px,
 * relative to `root`), which the slicer uses as candidate page-break points:
 * it will start a new page at a block top rather than cutting through the
 * block.
 *
 * Returns a sorted, de-duped list of top offsets. The list is in the SAME
 * coordinate space as the element's rendered height; the slicer scales it to
 * canvas px using the capture scale factor.
 */
export function collectBlockTops(root: HTMLElement): number[] {
  const rootTop = root.getBoundingClientRect().top;
  const blocks = Array.from(root.querySelectorAll<HTMLElement>('[data-pdf-block]'));
  const tops = blocks.map((b) => b.getBoundingClientRect().top - rootTop);
  // De-dupe + sort ascending. Drop anything < 1px (the first block at the very
  // top is implicit).
  const uniq = Array.from(new Set(tops.map((t) => Math.round(t)))).filter((t) => t > 1);
  uniq.sort((a, b) => a - b);
  return uniq;
}

/**
 * Slice a captured canvas into an A4 multi-page jsPDF.
 *
 * `blockTopsCssPx` are page-break-safe boundaries in the SAME CSS-px space as
 * the source element (see collectBlockTops). `sourceCssHeight` is the source
 * element's rendered height in CSS px, used to map CSS px -> canvas px.
 *
 * Page-aware behaviour: instead of cutting at fixed printable-height intervals
 * (which slices straight through diagrams/line items), we walk down the
 * document and, for each page, take as many whole blocks as fit. If the next
 * block would overflow the page bottom, we break BEFORE it so the whole block
 * moves to the next page. A single block taller than one page is the only case
 * we still hard-slice (unavoidable) - it starts at a page top and overflows.
 *
 * When `blockTopsCssPx` is empty we fall back to the legacy fixed-interval
 * slice so callers that don't mark blocks keep working.
 */
export function canvasToPdf(
  canvas: HTMLCanvasElement,
  opts?: { blockTopsCssPx?: number[]; sourceCssHeight?: number },
): jsPDF {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const imgData = canvas.toDataURL('image/png');
  const printableWidth = PAGE_WIDTH_MM - MARGIN_MM * 2;
  const printableHeight = PAGE_HEIGHT_MM - MARGIN_MM * 2;

  const imgWidth = printableWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  const blockTops = opts?.blockTopsCssPx ?? [];
  const sourceCssHeight = opts?.sourceCssHeight ?? 0;

  // No block info -> legacy fixed-interval slice (kept for safety/fallback).
  if (blockTops.length === 0 || sourceCssHeight <= 0) {
    let heightLeft = imgHeight;
    let position = 0;
    pdf.addImage(imgData, 'PNG', MARGIN_MM, MARGIN_MM + position, imgWidth, imgHeight);
    heightLeft -= printableHeight;
    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', MARGIN_MM, MARGIN_MM + position, imgWidth, imgHeight);
      heightLeft -= printableHeight;
    }
    return pdf;
  }

  // Map CSS-px breakpoints into mm of the rendered image. The image is
  // imgHeight mm tall and represents sourceCssHeight CSS px, so:
  const cssToMm = imgHeight / sourceCssHeight;
  const breakMm = blockTops.map((t) => t * cssToMm).filter((mm) => mm > 0.5 && mm < imgHeight - 0.5);

  // Build the list of page-start offsets (mm from the top of the full image).
  // Greedy: from the current page start, the page can show `printableHeight`
  // mm. The next page should start at the LAST block boundary that still fits
  // within [pageStart, pageStart + printableHeight]. If no boundary falls in
  // that window (a single block taller than a page), we hard-advance by a
  // full page so we always make progress.
  const pageStarts: number[] = [0];
  let guard = 0;
  while (true) {
    if (guard++ > 1000) break; // safety: never spin forever
    const start = pageStarts[pageStarts.length - 1];
    const limit = start + printableHeight;
    if (limit >= imgHeight - 0.5) break; // remainder fits on this page

    // Last block boundary that fits within this page (and is past the start).
    let nextStart = -1;
    for (const mm of breakMm) {
      if (mm > start + 0.5 && mm <= limit) nextStart = mm;
    }
    // No usable boundary in the window -> oversized block; hard-advance.
    if (nextStart < 0) nextStart = limit;
    if (nextStart <= start + 0.5) nextStart = limit; // guarantee progress
    pageStarts.push(nextStart);
  }

  // Render: each page draws the full image shifted up by the page start, so
  // only the [start, start+printableHeight] band lands inside the printable
  // area. We CLIP to the printable rectangle so the rest of the (tall) image
  // doesn't bleed into the top/bottom margins of adjacent pages - that keeps
  // the page margins clean white and prevents the previous/next block from
  // ghosting into the margin.
  pageStarts.forEach((start, i) => {
    if (i > 0) pdf.addPage();
    pdf.saveGraphicsState();
    // Clip path = the printable rectangle on this page.
    pdf.rect(MARGIN_MM, MARGIN_MM, imgWidth, printableHeight);
    pdf.clip();
    // jsPDF needs the path consumed after clip(); discard with a no-op fill.
    pdf.discardPath();
    pdf.addImage(imgData, 'PNG', MARGIN_MM, MARGIN_MM - start, imgWidth, imgHeight);
    pdf.restoreGraphicsState();
  });

  return pdf;
}

/**
 * Mount a React element into a hidden off-screen container, wait for it to
 * paint (fonts + images), capture it, then unmount. Returns an ArrayBuffer of
 * the resulting PDF so the caller can drop it straight into a ZIP.
 *
 * Used by the bulk bundles: each selected item's preview component is rendered
 * exactly the way it appears on screen, captured, and zipped.
 *
 * Sequential by design (callers loop one item at a time) to bound memory at
 * the 25-item cap.
 */
export async function renderReactPreviewToPdfBuffer(
  element: React.ReactElement,
  opts?: { widthPx?: number },
): Promise<ArrayBuffer> {
  const { createRoot } = await import('react-dom/client');

  const widthPx = opts?.widthPx ?? OFFSCREEN_PREVIEW_WIDTH_PX;

  // Hidden host that's still laid out (off-screen, not display:none) so
  // html2canvas can measure and paint it.
  const host = document.createElement('div');
  host.style.position = 'fixed';
  host.style.left = '-99999px';
  host.style.top = '0';
  host.style.width = `${widthPx}px`;
  host.style.background = '#ffffff';
  host.setAttribute('data-offscreen-pdf', 'true');

  // Inner wrapper carries the white background + padding so the captured
  // image has document-like breathing room (mirrors the on-screen card).
  const inner = document.createElement('div');
  inner.style.width = `${widthPx}px`;
  inner.style.background = '#ffffff';
  inner.style.padding = '24px';
  inner.style.boxSizing = 'border-box';
  host.appendChild(inner);
  document.body.appendChild(host);

  const root = createRoot(inner);

  try {
    // Mount and let React flush + the browser paint.
    await new Promise<void>((resolve) => {
      root.render(element);
      // Two RAFs ensures the committed DOM has actually painted.
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });

    await awaitFonts();
    await awaitImages(inner);
    // A short settle so any state-driven layout (rare in pure previews) lands.
    await new Promise((r) => setTimeout(r, 60));

    // Block boundaries measured against the freshly-painted offscreen DOM.
    const blockTopsCssPx = collectBlockTops(inner);
    const sourceCssHeight = inner.getBoundingClientRect().height;

    const canvas = await html2canvas(inner, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      allowTaint: true,
      foreignObjectRendering: false,
      onclone: (clonedDoc) => normalizeUnsupportedColors(clonedDoc),
    });

    const pdf = canvasToPdf(canvas, { blockTopsCssPx, sourceCssHeight });
    return pdf.output('arraybuffer');
  } finally {
    // Always unmount + detach so we don't leak roots across a 25-item batch.
    try {
      root.unmount();
    } catch {
      /* ignore */
    }
    if (host.parentNode) host.parentNode.removeChild(host);
  }
}
