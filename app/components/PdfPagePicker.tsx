'use client';

/**
 * PdfPagePicker - client-side PDF page selection via pdfjs-dist.
 *
 * Usage: const { convertIfNeeded } = usePdfPagePicker();
 * In any file input onChange: const f = await convertIfNeeded(rawFile);
 * - Non-PDF files pass through unchanged (same File object).
 * - PDF files open a modal with lazy-rendered page thumbnails; the user
 *   picks a page, we render it at high resolution to a PNG File.
 * - Cancel/escape resolves to null (caller aborts the upload).
 *
 * Zero backend involvement: rendering happens in the user's browser.
 * The worker is served from /public/pdf.worker.min.mjs.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';

const THUMB_WIDTH = 150;
const MAX_RENDER_WIDTH = 3000;
const MAX_RENDER_SCALE = 4;

let pdfjsPromise: Promise<typeof import('pdfjs-dist')> | null = null;
async function getPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      // Bundle the worker as a build asset via new URL(..., import.meta.url).
      // DO NOT serve it from public/ and point workerSrc at a root path:
      // www.quote-core.com redirects to the apex domain, which redirects to
      // app.quote-core.com, where auth middleware bounces the file to /login.
      // Workers must be same-origin, so that chain broke PDF loading on the
      // free tools. Build assets under /_next/static are same-origin everywhere.
      const worker = new Worker(
        new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url),
        { type: 'module' }
      );
      const lib = await import('pdfjs-dist');
      lib.GlobalWorkerOptions.workerPort = worker;
      return lib;
    })();
  }
  return pdfjsPromise;
}

type PdfPagePickerState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'picking'; doc: PDFDocumentProxy; fileName: string }
  | { kind: 'error'; message: string };

/** Render one PDF page to a PNG blob at high resolution. */
async function renderPageToBlob(doc: PDFDocumentProxy, pageNumber: number): Promise<Blob> {
  const page = await doc.getPage(pageNumber);
  const base = page.getViewport({ scale: 1 });
  const scale = Math.min(MAX_RENDER_WIDTH / base.width, MAX_RENDER_SCALE);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvas, canvasContext: ctx, viewport }).promise;
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('PNG conversion failed'))), 'image/png');
  });
}

function isPdf(file: File): boolean {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
}

function PageThumb({
  doc,
  pageNumber,
  selected,
  onClick,
}: {
  doc: PDFDocumentProxy;
  pageNumber: number;
  selected: boolean;
  onClick: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [visible, setVisible] = useState(false);
  const [rendered, setRendered] = useState(false);
  const [failed, setFailed] = useState(false);
  const wrapRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: '300px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || rendered || failed) return;
    let cancelled = false;
    (async () => {
      try {
        const page = await doc.getPage(pageNumber);
        if (cancelled) return;
        const base = page.getViewport({ scale: 1 });
        const scale = THUMB_WIDTH / base.width;
        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('no ctx');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvas, canvasContext: ctx, viewport }).promise;
        if (!cancelled) setRendered(true);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, rendered, failed, doc, pageNumber]);

  return (
    <button
      ref={wrapRef}
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center gap-1 rounded-xl border-2 p-2 transition-all ${
        selected
          ? 'border-[#FF6B35] bg-orange-50 shadow-[0_0_8px_rgba(255,107,53,0.15)]'
          : 'border-slate-200 bg-white hover:border-orange-200 hover:bg-orange-50/40'
      }`}
    >
      <div className="flex items-center justify-center bg-white border border-slate-200 rounded-md overflow-hidden" style={{ width: THUMB_WIDTH, height: Math.round(THUMB_WIDTH * 1.414) }}>
        {failed ? (
          <span className="text-xs text-slate-400">Preview unavailable</span>
        ) : (
          <canvas ref={canvasRef} className={rendered ? '' : 'opacity-0'} style={{ maxWidth: '100%', maxHeight: '100%' }} />
        )}
      </div>
      <span className={`text-xs font-medium ${selected ? 'text-[#BD4A1A]' : 'text-slate-500'}`}>Page {pageNumber}</span>
    </button>
  );
}

export function usePdfPagePicker() {
  const [state, setState] = useState<PdfPagePickerState>({ kind: 'idle' });
  const [selectedPage, setSelectedPage] = useState<number | null>(null);
  const [converting, setConverting] = useState(false);
  const resolverRef = useRef<((f: File | null) => void) | null>(null);
  const docRef = useRef<PDFDocumentProxy | null>(null);

  const cleanup = useCallback(() => {
    // pdfjs v6: destroy() lives on the loading task; the proxy exposes it
    // at runtime but not in every published d.ts revision.
    const doc = docRef.current as (PDFDocumentProxy & { destroy?: () => Promise<void> }) | null;
    if (doc?.destroy) doc.destroy().catch(() => undefined);
    else doc?.cleanup?.();
    docRef.current = null;
    setSelectedPage(null);
    setConverting(false);
    setState({ kind: 'idle' });
  }, []);

  const finish = useCallback(
    (file: File | null) => {
      const resolve = resolverRef.current;
      resolverRef.current = null;
      cleanup();
      resolve?.(file);
    },
    [cleanup]
  );

  /**
   * If the file is a PDF, show the page picker and resolve with a PNG File
   * of the chosen page. Otherwise resolve immediately with the same file.
   */
  const convertIfNeeded = useCallback(async (file: File): Promise<File | null> => {
    if (!isPdf(file)) return file;
    setState({ kind: 'loading' });
    try {
      const pdfjs = await getPdfjs();
      const data = await file.arrayBuffer();
      const doc = await pdfjs.getDocument({ data }).promise;
      docRef.current = doc;
      setSelectedPage(doc.numPages === 1 ? 1 : null);
      setState({ kind: 'picking', doc, fileName: file.name });
      return await new Promise<File | null>((resolve) => {
        resolverRef.current = resolve;
      });
    } catch (err) {
      const message = err instanceof Error && /password/i.test(err.message)
        ? 'This PDF is password protected. Please screenshot the plan page and upload it as an image instead.'
        : 'Could not read this PDF. Please screenshot the plan page and upload it as an image instead.';
      setState({ kind: 'error', message });
      return await new Promise<File | null>((resolve) => {
        resolverRef.current = resolve;
      });
    }
  }, []);

  const confirmPage = useCallback(async () => {
    const doc = docRef.current;
    if (!doc || selectedPage === null) return;
    setConverting(true);
    try {
      const blob = await renderPageToBlob(doc, selectedPage);
      const pngFile = new File([blob], 'plan-page.png', { type: 'image/png' });
      finish(pngFile);
    } catch {
      setConverting(false);
      setState({ kind: 'error', message: 'Could not convert the selected page. Please screenshot it and upload as an image instead.' });
    }
  }, [selectedPage, finish]);

  const modal = (() => {
    if (state.kind === 'idle') return null;

    return (
      <div className="fixed inset-0 backdrop-blur-sm bg-black/40 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200 mx-4 max-h-[90vh] flex flex-col">
          {state.kind === 'loading' && (
            <>
              <div className="px-6 pt-5 pb-4 border-b border-slate-100">
                <h2 className="text-lg font-semibold text-slate-900">Reading PDF…</h2>
              </div>
              <div className="px-6 py-8 text-center">
                <p className="text-sm text-slate-500">Loading pages, this takes a moment.</p>
              </div>
            </>
          )}

          {state.kind === 'error' && (
            <>
              <div className="px-6 pt-5 pb-4 border-b border-slate-100">
                <h2 className="text-lg font-semibold text-slate-900">PDF could not be opened</h2>
              </div>
              <div className="px-6 py-5">
                <p className="text-sm text-slate-600">{state.message}</p>
              </div>
              <div className="px-6 pb-5 flex justify-end">
                <button
                  type="button"
                  onClick={() => finish(null)}
                  className="px-4 py-2 text-sm font-medium rounded-full bg-black text-white hover:bg-slate-800 transition-all"
                >
                  OK
                </button>
              </div>
            </>
          )}

          {state.kind === 'picking' && (
            <>
              <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Choose a plan page</h2>
                  <p className="text-xs text-slate-500 mt-0.5 truncate max-w-xs">{state.fileName} · {state.doc.numPages} {state.doc.numPages === 1 ? 'page' : 'pages'}</p>
                </div>
                <button
                  type="button"
                  onClick={() => finish(null)}
                  disabled={converting}
                  className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-400 hover:text-slate-600"
                  aria-label="Close"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="px-6 py-5 overflow-y-auto flex-1">
                <div className="rounded-xl border border-slate-200 bg-orange-50/40 px-4 py-3 mb-4">
                  <p className="text-xs text-slate-600">
                    <span className="font-medium text-slate-700">Tip:</span> for the best results, screenshot just the plan area with the scale or known measurements visible, then upload that image. Otherwise continue with your selected PDF page - you can calibrate the canvas afterwards.
                  </p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {Array.from({ length: state.doc.numPages }, (_, i) => (
                    <PageThumb
                      key={i + 1}
                      doc={state.doc}
                      pageNumber={i + 1}
                      selected={selectedPage === i + 1}
                      onClick={() => setSelectedPage(i + 1)}
                    />
                  ))}
                </div>
              </div>

              <div className="px-6 pb-5 pt-3 border-t border-slate-100 flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => finish(null)}
                  disabled={converting}
                  className="px-4 py-2 text-sm font-medium rounded-full border border-slate-300 hover:bg-slate-50 disabled:opacity-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmPage}
                  disabled={selectedPage === null || converting}
                  className="inline-flex items-center gap-1.5 rounded-full bg-black px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-slate-800 hover:shadow-[0_0_16px_rgba(255,107,53,0.5)] ring-2 ring-transparent hover:ring-orange-400/30 disabled:opacity-50 disabled:hover:shadow-none"
                >
                  {converting ? 'Converting…' : 'Use this page'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  })();

  return { convertIfNeeded, modal };
}
