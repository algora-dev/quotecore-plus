'use client';
import { useEffect, useRef, useState, type SetStateAction } from 'react';
import { applyUrlImport, blankDraft, isCurrency, restoreDraft, DOCUMENT_ROUTES, localDate, type DocumentDraft, type DocumentKind } from './document-model';
import { readAuthResume, sameQuote, sweepAuthResumes, type AuthResume } from './auth-resume';
import type { DocumentServices } from './document-services';
export type SaveStatus = 'loading' | 'saving' | 'saved' | 'unavailable';
/** Session storage remains tab-local. Explicit inbound data wins restored fields;
 * geo is only a fallback and can never overwrite a deliberate currency choice. */
export function useDocumentDraft(sessionKey: string, search: string, services: DocumentServices,kind:DocumentKind='quote') {
  const [draft, setState] = useState<DocumentDraft>(() => blankDraft('', '',kind));
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<SaveStatus>('loading');
  const [notice, setNotice] = useState('');
  const [authResume,setAuthResume]=useState<AuthResume|null>(null);
  const storageOK = useRef(true), currencyPinned = useRef(false), initializedQuery = useRef<string | null>(null);
  const current = useRef(draft); current.current = draft;
  const serviceRef = useRef(services); serviceRef.current = services;
  useEffect(() => {
    if (initializedQuery.current === search) return;
    initializedQuery.current = search;
    const fallback = blankDraft(window.location.hostname,localDate(),kind);
    let restored: DocumentDraft | null = null;
    let restoreWarning = '';
    try {
      const raw = sessionStorage.getItem(sessionKey);
      if (raw) { try { restored = restoreDraft(JSON.parse(raw), fallback); }
        catch { restoreWarning = 'The previous tab draft could not be read. Start here, or import your items again.'; } }
    } catch { storageOK.current = false; }
    const recovery=readAuthResume(new URLSearchParams(search).get('qc_resume'),undefined,Date.now(),DOCUMENT_ROUTES[kind]);
    if(recovery){
      if(!restored || sameQuote(restored,recovery.draft)){restored=recovery.draft;setAuthResume(recovery);}
      else restoreWarning='A different document is already open in this tab. It has been kept instead of replacing it with the sign-in backup.';
    }
    const incoming = applyUrlImport(restored ?? fallback, search);
    if(recovery&&restored===recovery.draft&&!sameQuote(incoming.draft,recovery.draft))setAuthResume({...recovery,generated:false});
    currencyPinned.current = incoming.currencyPinned || !!(restored && isCurrency(restored.currencyCode)) || /(^|\.)quote-core\.co\.nz$/.test(window.location.hostname);
    setState(incoming.draft); current.current = incoming.draft;
    setNotice(incoming.warning || restoreWarning || (incoming.imported ? 'Your items have been brought across. Check descriptions, units and prices before generating.' : restored ? 'Your draft has been restored in this tab.' : ''));
    setReady(true); setStatus(storageOK.current ? 'saved' : 'unavailable');
  }, [search,sessionKey,kind]);
  useEffect(()=>{
    const clean=()=>{try{sweepAuthResumes(localStorage);}catch{/* restricted storage is supported */}};
    clean();const timer=window.setInterval(clean,60000);window.addEventListener('focus',clean);
    return()=>{clearInterval(timer);window.removeEventListener('focus',clean);};
  },[]);
  // Separate lifetime: React StrictMode's effect replay must not abort the only geo lookup.
  useEffect(() => {
    if (!ready || currencyPinned.current) return;
    const controller = new AbortController();
    if (!currencyPinned.current) void serviceRef.current.currency(controller.signal).then(code => {
      if (code && !currencyPinned.current && !controller.signal.aborted) setState(d => ({...d,currencyCode:code}));
    });
    return () => controller.abort();
  }, [ready,search]);
  useEffect(() => {
    if (!ready || !storageOK.current) return;
    setStatus('saving');
    const timer = window.setTimeout(() => {
      try { sessionStorage.setItem(sessionKey,JSON.stringify(current.current)); setStatus('saved'); }
      catch { storageOK.current = false; setStatus('unavailable'); }
    }, 350);
    return () => clearTimeout(timer);
  }, [draft,ready,sessionKey]);
  useEffect(() => {
    const flush = () => {
      if (!ready) return;
      try { sessionStorage.setItem(sessionKey,JSON.stringify(current.current)); } catch { /* truthful unavailable state already displayed */ }
    };
    window.addEventListener('pagehide',flush);
    return () => { flush(); window.removeEventListener('pagehide',flush); };
  }, [ready,sessionKey]);
  function update(action: SetStateAction<DocumentDraft>) {
    currencyPinned.current = true; // once editing begins, never change money settings behind the user
    setState(previous => { const next = typeof action === 'function' ? action(previous) : action; current.current = next; return next; });
  }
  return { draft, update, ready, status, notice, setNotice, authResume };
}
