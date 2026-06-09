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

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff',
    allowTaint: true,
    foreignObjectRendering: false,
    onclone: (clonedDoc) => normalizeUnsupportedColors(clonedDoc),
  });

  return canvasToPdf(canvas);
}

/** Slice a captured canvas into an A4 multi-page jsPDF (shared math). */
export function canvasToPdf(canvas: HTMLCanvasElement): jsPDF {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const imgData = canvas.toDataURL('image/png');
  const printableWidth = PAGE_WIDTH_MM - MARGIN_MM * 2;
  const printableHeight = PAGE_HEIGHT_MM - MARGIN_MM * 2;

  const imgWidth = printableWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

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

    const canvas = await html2canvas(inner, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      allowTaint: true,
      foreignObjectRendering: false,
      onclone: (clonedDoc) => normalizeUnsupportedColors(clonedDoc),
    });

    const pdf = canvasToPdf(canvas);
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
