import { fromQuoteCore, type QuoteCoreSnapshot } from '../adapters/quotecore';
import { captureLiveTakeoff, prepareLiveCapture, type CaptureHooks, type LiveInputCapture } from '../adapters/liveSnapshot';
import { checkpointLiveCapture, type SnapshotStorage } from '../adapters/snapshotStore';
import { mountWorkbench, type WorkbenchHandle } from './workbench';
import type { QuoteQuantityProposal } from '../core/quantities';
import type { Draft } from '../core/types';
import { tokenFallbacks } from './theme';
export interface LaunchOptions { createWorker?: () => Worker; onExport?: (draft: Draft) => void; onQuantityProposal?: (proposal:QuoteQuantityProposal)=>void;
  snapshotStorage?:SnapshotStorage|null; onCapture?:(capture:LiveInputCapture)=>void;
}
export interface LiveLaunchOptions extends LaunchOptions, CaptureHooks {}
const openingReaders=new WeakSet<()=>QuoteCoreSnapshot>();
/** Preferred integration entry: commit live edits -> settle -> capture ->
 * checkpoint -> derive. Never loads ai_scan_result or saved measurements. */
export async function launchLiveQuoteCoreOffcuts(readSnapshot:()=>QuoteCoreSnapshot,options:LiveLaunchOptions={}):Promise<WorkbenchHandle> {
  if(openingReaders.has(readSnapshot))throw new Error('Find offcuts is already opening.');
  openingReaders.add(readSnapshot);
  try {
    const capture=checkpointLiveCapture(await prepareLiveCapture(readSnapshot,options),options.snapshotStorage);
    options.onCapture?.(capture);
    return mountCapturedLive(readSnapshot,capture,options);
  } finally {openingReaders.delete(readSnapshot);}
}

/** Native top-layer dialog: background inertness, focus containment and nested
 * Escape behaviour are provided by the browser, not arbitrary z-indexes. This
 * is a scoped optical adapter to the supplied QcDialog G-A/IF-01 contracts; the
 * host's existing React dialog/controller must not be replaced globally. */
export function launchQuoteCoreOffcuts(readSnapshot: () => QuoteCoreSnapshot, options: LaunchOptions = {}): WorkbenchHandle {
  const capture=checkpointLiveCapture(captureLiveTakeoff(readSnapshot()),options.snapshotStorage);
  options.onCapture?.(capture);
  return mountCapturedLive(readSnapshot,capture,options);
}
/** The synchronous API remains for hosts that already flush edits themselves. */
function mountCapturedLive(readSnapshot:()=>QuoteCoreSnapshot,capture:LiveInputCapture,options:LaunchOptions):WorkbenchHandle {
  const captured=capture.adapted;
  let previousFocus = document.activeElement as HTMLElement | null;
  while (previousFocus?.shadowRoot?.activeElement instanceof HTMLElement) previousFocus = previousFocus.shadowRoot.activeElement;
  const modal = document.createElement('dialog'), host = document.createElement('div'), css = document.createElement('style');
  modal.className = 'qc-offcuts-dialog'; modal.setAttribute('aria-label', 'Find offcuts review');
  Object.assign(host.style, { width: '100%', height: '100%', minHeight: '0' });
  modal.append(host);
  css.textContent = `
    .qc-offcuts-dialog,.qc-offcuts-close{${tokenFallbacks}font:14px/1.5 var(--of-font-sans);color:var(--of-text-body);background:var(--of-glass-dialog-bg);border:1px solid var(--of-glass-b-border);border-radius:var(--of-radius-dialog);box-shadow:var(--of-shadow-dialog);padding:0;overflow:hidden;overscroll-behavior:contain}
    .qc-offcuts-dialog{position:fixed;inset:12px;margin:0;width:calc(100vw - 24px);height:calc(100dvh - 24px);max-width:none;max-height:none}
    .qc-offcuts-dialog::backdrop,.qc-offcuts-close::backdrop{background:var(--qc-glass-a-tint,rgba(246,247,249,.55));backdrop-filter:blur(12px) saturate(1.05);-webkit-backdrop-filter:blur(12px) saturate(1.05)}
    .qc-offcuts-close{max-width:min(440px,calc(100vw - 32px));padding:24px}
    .qc-offcuts-close h2{font-size:20px;color:var(--of-text-primary);margin:0 0 12px}.qc-offcuts-close p{font-size:14px;color:var(--of-text-secondary);margin:0 0 20px}
    .qc-offcuts-close-actions{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap}
    .qc-offcuts-close button{font:600 14px var(--of-font-sans);min-height:var(--of-control-md);padding:10px 14px;border-radius:var(--of-radius-control);border:1px solid var(--of-border-control);background:var(--of-bg-surface);color:var(--of-text-primary);cursor:pointer;transition:background var(--of-motion-fast),border-color var(--of-motion-fast),box-shadow var(--of-motion-fast)}
    .qc-offcuts-close button[data-discard]{background:var(--of-color-danger);color:var(--of-color-surface);border-color:var(--of-color-danger)}
    @media(hover:hover){.qc-offcuts-close button:hover{background:var(--of-color-orange-wash);border-color:var(--of-color-orange-ink)}.qc-offcuts-close button[data-discard]:hover{background:var(--of-color-danger-hover);border-color:var(--of-color-danger-hover)}}
    .qc-offcuts-close button:active{box-shadow:inset 0 2px 3px rgba(25,27,32,.12)}.qc-offcuts-close button:focus-visible{outline:2px solid var(--of-focus-ring);outline-offset:3px}
    @supports not (backdrop-filter:blur(1px)){.qc-offcuts-dialog::backdrop,.qc-offcuts-close::backdrop{background:var(--qc-glass-a-fallback,rgba(246,247,249,.94))}}
    @media(prefers-reduced-motion:reduce){.qc-offcuts-close button{transition:none}.qc-offcuts-dialog::backdrop,.qc-offcuts-close::backdrop{backdrop-filter:none;-webkit-backdrop-filter:none;background:var(--qc-glass-a-fallback,rgba(246,247,249,.94))}}
    @media(max-width:700px){.qc-offcuts-dialog{inset:0;width:100vw;height:100dvh;border-radius:0}.qc-offcuts-close button{min-height:var(--of-touch-min)}}
    @media(forced-colors:active){.qc-offcuts-dialog,.qc-offcuts-close{border:1px solid CanvasText;background:Canvas;color:CanvasText;box-shadow:none}.qc-offcuts-close button{background:Canvas;color:ButtonText;border-color:ButtonText}.qc-offcuts-close button:focus-visible{outline-color:Highlight}}
  `;
  const previousOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden'; document.head.append(css); document.body.append(modal);
  let closed = false, handle: WorkbenchHandle | undefined, closeDialog: HTMLDialogElement | null = null;
  function destroy(): void {
    if (closed) return; closed = true;
    closeDialog?.close(); closeDialog?.remove(); closeDialog = null;
    handle?.destroy(); modal.close(); modal.remove(); css.remove();
    document.body.style.overflow = previousOverflow;
    if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
  }
  function requestClose(): void {
    if (closed || closeDialog) return;
    const confirm = document.createElement('dialog'); closeDialog = confirm;
    confirm.className = 'qc-offcuts-close'; confirm.setAttribute('aria-label', 'Close this draft?');
    confirm.innerHTML = `<h2>Close this draft?</h2><p>Offcut reviews are not saved automatically. Keep reviewing to export the draft, or close without keeping these local changes.</p><div class="qc-offcuts-close-actions"><button data-keep autofocus>Keep reviewing</button><button data-discard>Close draft</button></div>`;
    const keep = (): void => { confirm.close(); confirm.remove(); closeDialog = null; host.shadowRoot?.querySelector<HTMLElement>('[data-action="close"]')?.focus(); };
    confirm.querySelector('[data-keep]')!.addEventListener('click', keep);
    confirm.querySelector('[data-discard]')!.addEventListener('click', destroy);
    confirm.addEventListener('cancel', event => { event.preventDefault(); event.stopPropagation(); keep(); });
    // Backdrop clicks intentionally do not dismiss either dialog.
    modal.append(confirm); confirm.showModal(); confirm.querySelector<HTMLButtonElement>('[data-keep]')!.focus();
  }
  modal.addEventListener('cancel', event => { event.preventDefault(); event.stopPropagation(); requestClose(); });
  try {
    // Establish real layout dimensions BEFORE the first SVG/handle render.
    modal.showModal();
    handle = mountWorkbench(host, captured.roof, {
      inputCapture: capture, initialIssues: captured.issues, onClose: requestClose, onExport: options.onExport, onQuantityProposal:options.onQuantityProposal,
      readCurrentSourceRevision: () => fromQuoteCore(readSnapshot()).roof.sourceRevision,
      createWorker: options.createWorker ?? (() => new Worker(new URL('../worker.ts', import.meta.url), { type: 'module' })),
    });
    host.shadowRoot?.querySelector<HTMLElement>('[data-action="close"]')?.focus();
  } catch (error) { destroy(); throw error; }
  return { destroy, getDraft: () => handle!.getDraft(), getDebugBundle:()=>handle!.getDebugBundle!() };
}
