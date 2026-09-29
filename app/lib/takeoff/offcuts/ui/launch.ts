import { fromQuoteCore, type QuoteCoreSnapshot } from '../adapters/quotecore';
import { mountWorkbench, type WorkbenchHandle } from './workbench';
import type { Draft } from '../core/types';
export interface LaunchOptions { createWorker?: () => Worker; onExport?: (draft: Draft) => void }
/** QuoteCore/Next integration entry. The .ts worker URL is intentional: Next
 * bundles the source worker. Demo tooling rewrites only emitted dist files to
 * .js / Blob URLs; production source imports and worker URLs stay unchanged. */
export function launchQuoteCoreOffcuts(readSnapshot: () => QuoteCoreSnapshot, options: LaunchOptions = {}): WorkbenchHandle {
  const captured=fromQuoteCore(readSnapshot()), priorFocus=document.activeElement as HTMLElement|null;
  const modal=document.createElement('div');
  modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-label','Find offcuts review');
  Object.assign(modal.style,{position:'fixed',inset:'12px',zIndex:'1000',background:'#fff',boxShadow:'0 15px 100px #14273870',borderRadius:'12px',overflow:'hidden'});
  const shade=document.createElement('div');Object.assign(shade.style,{position:'fixed',inset:'0',zIndex:'999',background:'#14273888'});
  const previousOverflow=document.body.style.overflow;document.body.style.overflow='hidden';document.body.append(shade,modal);
  let closed=false;let handle:WorkbenchHandle;
  function destroy():void {
    if(closed)return;closed=true;document.removeEventListener('keydown',keyDown,true);
    handle?.destroy();modal.remove();shade.remove();document.body.style.overflow=previousOverflow;priorFocus?.focus();
  }
  function requestClose():void {if(window.confirm('Close offcut review? This prototype does not save automatically. Export the draft to keep it.'))destroy();}
  function keyDown(e:KeyboardEvent):void {
    if(e.key==='Escape'){e.preventDefault();e.stopPropagation();requestClose();}
    if(e.key==='Tab'){
      const focusable=[...(modal.shadowRoot?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select,textarea')??[])].filter(el=>el.getClientRects().length);
      if(!focusable.length)return;const active=modal.shadowRoot?.activeElement,first=focusable[0],last=focusable[focusable.length-1];
      if(e.shiftKey&&(active===first||!active)){e.preventDefault();last.focus();}else if(!e.shiftKey&&(active===last||!active)){e.preventDefault();first.focus();}
    }
  }
  try{
    handle=mountWorkbench(modal,captured.roof,{initialIssues:captured.issues,onClose:requestClose,onExport:options.onExport,
      readCurrentSourceRevision:()=>fromQuoteCore(readSnapshot()).roof.sourceRevision,
      createWorker:options.createWorker??(()=>new Worker(new URL('../worker.ts',import.meta.url),{type:'module'})),
    });
    document.addEventListener('keydown',keyDown,true);modal.shadowRoot?.querySelector<HTMLElement>('button')?.focus();
  }catch(error){destroy();throw error;}
  return{destroy,getDraft:()=>handle.getDraft()};
}
