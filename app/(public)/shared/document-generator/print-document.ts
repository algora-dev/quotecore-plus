import { DOCUMENT_CSS } from './DocumentPaper';
/** Print an isolated document, not the editing interface/SEO/footer. React's
 * rendered DOM has already escaped all text. No quote JSON is interpolated
 * into HTML or scripts. No new PDF dependency and no network upload. */
export async function printDocument(source: HTMLElement, name: string): Promise<void> {
  const frame=document.createElement('iframe');
  frame.title='Printable quote';frame.setAttribute('aria-hidden','true');frame.dataset.qcDocumentPrint='true';
  Object.assign(frame.style,{position:'fixed',width:'1px',height:'1px',right:'0',bottom:'0',border:'0',opacity:'0',pointerEvents:'none'});
  document.body.appendChild(frame);
  const target=frame.contentDocument,win=frame.contentWindow;
  if(!target||!win){frame.remove();throw new Error('The print window could not be opened. Try opening this page in a full browser tab.');}
  target.open();target.write(`<!doctype html><html lang="en"><head><meta charset="utf-8"><style>${DOCUMENT_CSS}</style></head><body></body></html>`);target.close();
  target.title=name.replace(/[<>]/g,'').slice(0,100);
  const copy=source.cloneNode(true) as HTMLElement;
  // Resolve same-origin brand assets before moving into an about:blank frame.
  copy.querySelectorAll<HTMLImageElement>('img').forEach(img=>{img.src=new URL(img.getAttribute('src')||'',document.baseURI).href;});
  target.body.appendChild(copy);
  await Promise.all(Array.from(target.images).map(img=>img.complete?Promise.resolve():new Promise<void>(resolve=>{img.onload=()=>resolve();img.onerror=()=>resolve();setTimeout(resolve,2000);} )));
  await new Promise<void>(resolve=>win.requestAnimationFrame(()=>resolve()));
  const clean=()=>{clearTimeout(timer);frame.remove();};
  const timer=setTimeout(clean,120000);win.addEventListener('afterprint',clean,{once:true});
  try{win.focus();win.print();}catch{clean();throw new Error('Printing is unavailable in this preview window. Open the HTML in a separate browser tab and try again.');}
}
