import { restoreReviewDocument, type ReviewRepository, type ReviewScope, type StoredReview } from '../persistence/reviews';
import { fromQuoteCore, type QuoteCoreSnapshot } from '../adapters/quotecore';
import { captureLiveTakeoff, prepareLiveCapture, type CaptureHooks, type LiveInputCapture } from '../adapters/liveSnapshot';
import { checkpointLiveCapture, type SnapshotStorage } from '../adapters/snapshotStore';
import { mountWorkbench, type WorkbenchHandle, type WorkbenchOptions, type OffcutOnePagerPayload } from './workbench';
import type { QuoteQuantityProposal } from '../core/quantities';
import type { Draft } from '../core/types';
import { tokenFallbacks } from './theme';
export interface LaunchOptions extends Pick<WorkbenchOptions,'beforeCalculation'|'onReviewCheckpoint'|'onCalculationChange'|'initialCalculation'|'calculationLimitMs'> {
  /** Durable host checkpoint gate, separate from review/source measurement saving. */
  persistCapture?: (capture:LiveInputCapture) => Promise<void>; onPlanInvalidated?:()=>void; onClosed?:()=>void; createWorker?: () => Worker; onExport?: (draft: Draft) => void; onQuantityProposal?: (proposal:QuoteQuantityProposal)=>void; onSaveOnePager?: (payload:OffcutOnePagerPayload)=>void|Promise<void>;
  reviewRepository?:ReviewRepository;
  /** Explicit restore; normally use launchStoredQuoteCoreOffcuts. */
  initialSavedReview?:StoredReview; savedInputMode?:boolean;
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
    await options.persistCapture?.(capture);
    if(options.signal?.aborted)throw new Error('Opening Find offcuts cancelled. The checkpoint is retained.');
    const current=captureLiveTakeoff(readSnapshot());
    if(current.inputFingerprint!==capture.inputFingerprint)throw new Error('The takeoff changed while its checkpoint was saving. Open Find offcuts again.');
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
  const beforeUnload=(event:BeforeUnloadEvent):void=>{
    const status=handle?.getSaveState?.()?.status;
    if(options.reviewRepository&&status&&['dirty','saving','error','conflict'].includes(status)){event.preventDefault();event.returnValue='';}
  };
  window.addEventListener('beforeunload',beforeUnload);
  function destroy(): void {
    if (closed) return; closed = true;window.removeEventListener('beforeunload',beforeUnload);
    closeDialog?.close(); closeDialog?.remove(); closeDialog = null;
    handle?.destroy(); modal.close(); modal.remove(); css.remove();
    document.body.style.overflow = previousOverflow;
    if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    options.onClosed?.();
  }
  function requestClose(): void {
    if (closed || closeDialog) return;
    const confirm = document.createElement('dialog'); closeDialog = confirm;
    confirm.className = 'qc-offcuts-close'; confirm.setAttribute('aria-label', 'Close this draft?');
    confirm.innerHTML = `<h2>Close this draft?</h2><p>${options.reviewRepository?'Save this structured review before closing. This does not change takeoff measurements or quote prices.':'Account saving is not connected. Export the draft before closing to keep it.'}</p><div class="qc-offcuts-close-actions"><button data-keep autofocus>Keep reviewing</button><button data-discard>${options.reviewRepository?'Save & close':'Close draft'}</button></div>`;
    const keep = (): void => { confirm.close(); confirm.remove(); closeDialog = null; host.shadowRoot?.querySelector<HTMLElement>('[data-action="close"]')?.focus(); };
    confirm.querySelector('[data-keep]')!.addEventListener('click', keep);
    confirm.querySelector('[data-discard]')!.addEventListener('click',async()=>{
      if(!options.reviewRepository){destroy();return;}
      const button=confirm.querySelector<HTMLButtonElement>('[data-discard]')!;button.disabled=true;
      try{await handle?.flushReview?.();destroy();}catch(error){button.disabled=false;
        confirm.querySelector('p')!.textContent=error instanceof Error?error.message:'Save failed. Keep reviewing and export a backup.';
        if(!confirm.querySelector('[data-close-unsaved]')){const leave=document.createElement('button');leave.dataset.closeUnsaved='true';leave.textContent='Close without saving';leave.onclick=destroy;confirm.querySelector('.qc-offcuts-close-actions')!.append(leave);}
      }
    });
    confirm.addEventListener('cancel', event => { event.preventDefault(); event.stopPropagation(); keep(); });
    // Backdrop clicks intentionally do not dismiss either dialog.
    modal.append(confirm); confirm.showModal(); confirm.querySelector<HTMLButtonElement>('[data-keep]')!.focus();
  }
  modal.addEventListener('cancel', event => { event.preventDefault(); event.stopPropagation(); requestClose(); });
  try {
    // Establish real layout dimensions BEFORE the first SVG/handle render.
    modal.showModal();
    handle = mountWorkbench(host, captured.roof, {
      beforeCalculation:options.beforeCalculation,onReviewCheckpoint:options.onReviewCheckpoint,onCalculationChange:options.onCalculationChange,initialCalculation:options.initialCalculation,calculationLimitMs:options.calculationLimitMs,
      inputCapture: capture, initialIssues: captured.issues, reviewRepository:options.reviewRepository, initialSavedReview:options.initialSavedReview, onClose: requestClose, onExport: options.onExport, onQuantityProposal:options.onQuantityProposal, onSaveOnePager:options.onSaveOnePager, onPlanInvalidated:options.onPlanInvalidated,
      readCurrentSourceRevision: options.savedInputMode?undefined:() => fromQuoteCore(readSnapshot()).roof.sourceRevision,
      createWorker: options.createWorker ?? (() => new Worker(new URL('../worker.ts', import.meta.url), { type: 'module' })),
    });
    host.shadowRoot?.querySelector<HTMLElement>('[data-action="close"]')?.focus();
  } catch (error) { destroy(); throw error; }
  return { destroy, getDraft: () => handle!.getDraft(), getDebugBundle:()=>handle!.getDebugBundle!(), flushReview:()=>handle!.flushReview!(), getSaveState:()=>handle!.getSaveState!() };
}

/** Explicit recovery entry for a fresh browser visit with no in-memory calibration.
 * Restores the saved input in its own review, never merges it into live takeoff.
 * The host must provide current image access separately; signed URLs aren't saved. */
export async function launchStoredQuoteCoreOffcuts(scope:ReviewScope,options:LaunchOptions&{imageUrl?:string}):Promise<WorkbenchHandle>{
  if(!options.reviewRepository)throw new Error('Account draft saving is not connected.');
  const stored=options.initialSavedReview??await options.reviewRepository.load(scope);if(!stored)throw new Error('No saved offcut review exists for this roof.');
  const restored=restoreReviewDocument(stored.document,scope),capture=restored.document.capture;
  if(!capture)throw new Error('This saved review has no original live-input capture. Import its reviewed draft explicitly.');
  if(options.imageUrl){capture.snapshot.imageUrl=options.imageUrl;capture.adapted.roof.imageUrl=options.imageUrl;}
  return mountCapturedLive(()=>capture.snapshot,capture,{...options,savedInputMode:true,initialSavedReview:{revision:stored.revision,document:restored.document}});
}
