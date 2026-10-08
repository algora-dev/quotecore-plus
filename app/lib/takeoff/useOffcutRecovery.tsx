'use client';
import {useEffect,useRef,useState,useCallback} from 'react';
import type {RecoveryHint} from './offcuts/persistence/recoveryStore';
import {RecoverySession} from './offcuts/persistence/recoverySession';
import {createRecoveryDocument,parseRecoveryDocument,recoveryStateFingerprint,type RecoveryDocument,type WorkstationRecoveryState} from './offcuts/persistence/recoveryData';
import {reviewScopeKey,type ReviewDocument,type ReviewScope} from './offcuts/persistence/reviews';
import type {CalculationJournal} from './offcuts/reliability/protocol';
import type {LiveInputCapture} from './offcuts/adapters/liveSnapshot';
import {getOffcutRecoveryServices,type RecoveryServices} from './offcutRecoveryPersistence';
import {withTimeout} from './offcuts/reliability/timeout';
interface Options {scope:ReviewScope;imageKey:string;ready:boolean;disabled:boolean;readState:()=>WorkstationRecoveryState;restoreState:(state:WorkstationRecoveryState)=>void;openScope?:(scope:ReviewScope)=>Promise<void>;}
export function useOffcutRecovery(options:Options){
  const latest=useRef(options);latest.current=options;
  const session=useRef<RecoverySession|null>(null),services=useRef<RecoveryServices|null>(null),epoch=useRef(0);
  const [otherScope,setOtherScope]=useState<RecoveryHint|null>(null);
  const [candidate,setCandidate]=useState<RecoveryDocument|null>(null),[notice,setNotice]=useState(''),[restoring,setRestoring]=useState(false);
  const dismissed=useRef<string|null>(null),lastLocal=useRef<RecoveryDocument|null>(null),knownRevision=useRef<number|null>(null);
  const [saveError,setSaveError]=useState(false);const scopeKey=reviewScopeKey(options.scope);
  useEffect(()=>{
    const generation=++epoch.current;session.current?.dispose();session.current=null;services.current=null;setCandidate(null);setOtherScope(null);setNotice('');dismissed.current=null;knownRevision.current=null;lastLocal.current=null;setSaveError(false);
    if(options.disabled||!options.ready||!options.scope.pageId)return;
    void (async()=>{
      try{
        const s=await getOffcutRecoveryServices();if(generation!==epoch.current)return;services.current=s;
        const [cloud,device]=await Promise.allSettled([s.repository.load(options.scope),withTimeout(s.backup.load(options.scope),5000,'Device recovery read timed out.')]);
        if(generation!==epoch.current)return;
        const a=cloud.status==='fulfilled'?cloud.value?.document:null,b=device.status==='fulfilled'?device.value:null;
        if(cloud.status==='fulfilled')knownRevision.current=cloud.value?.revision??0;
        const d=a&&b?(a.savedAt>=b.savedAt?a:b):a??b;
        if(d?.status==='active'&&d.imageKey===latest.current.imageKey&&recoveryStateFingerprint(d.workstation)!==recoveryStateFingerprint(latest.current.readState()))setCandidate(d);
        if(!d||d.status!=='active'){
          const lists=await Promise.allSettled([s.repository.listPage?.(options.scope.quoteId,options.scope.pageId),s.backup.listPage?.(options.scope.quoteId,options.scope.pageId)]);
          if(generation!==epoch.current)return;
          const hints=new Map<string,RecoveryHint>();for(const list of lists)if(list.status==='fulfilled')for(const h of list.value??[]){const key=reviewScopeKey(h.scope),old=hints.get(key);if(!old||h.savedAt>old.savedAt)hints.set(key,h);}
          const other=[...hints.values()].filter(h=>h.status==='active'&&h.imageKey===latest.current.imageKey&&reviewScopeKey(h.scope)!==scopeKey).sort((a,b)=>b.savedAt.localeCompare(a.savedAt))[0];
          if(other)setOtherScope(other);
        }
        if(cloud.status==='rejected')setNotice('Account recovery could not be checked. A migration or connection may need attention; Find offcuts will require a confirmed save.');
      }catch(e){if(generation===epoch.current)setNotice(e instanceof Error?e.message:'Recovery check failed.');}
    })();
    return()=>{epoch.current++;session.current?.dispose();session.current=null;};
  // The state reader is refreshed through latest; source edits must not reload
  // old checkpoints or interrupt an active save on every React render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[scopeKey,options.imageKey,options.ready,options.disabled]);
  const persistCapture=useCallback(async(capture:LiveInputCapture)=>{
    if(latest.current.disabled)return;const generation=epoch.current,opts=latest.current;
    if(candidate&&dismissed.current!==candidate.id)throw new Error('Restore the unfinished takeoff or choose Keep current before replacing its recovery checkpoint.');
    const state=opts.readState(),document=createRecoveryDocument(capture,state,opts.imageKey);lastLocal.current=document;setSaveError(false);setNotice('Saving measurements for recovery…');
    let s:RecoveryServices;try{s=services.current??await getOffcutRecoveryServices();services.current=s;}catch(error){setSaveError(true);setNotice(error instanceof Error?error.message:'Account save is unavailable. Export recovery before leaving.');throw error;}
    // A durable local copy precedes the account load/save. Failure is visible;
    // cloud can still provide the required durability if local storage is blocked.
    try{await withTimeout(s.backup.put(document),5000,'Device checkpoint timed out.');}catch{/* account save remains required */}
    if(session.current){try{await session.current.retry();knownRevision.current=session.current.revision();}catch(error){setSaveError(true);setNotice(error instanceof Error?error.message:'Checkpoint save failed.');throw error;}}
    let previous;
    try{previous=await s.repository.load(opts.scope);
      if(!session.current&&previous?.document?.status==='active'&&previous.document.id!==dismissed.current&&previous.document.imageKey===opts.imageKey&&recoveryStateFingerprint(previous.document.workstation)!==recoveryStateFingerprint(state)){setCandidate(previous.document);throw new Error('An unfinished takeoff already exists. Restore it or choose Keep current before replacing the checkpoint.');}
      if(knownRevision.current!==null&&(previous?.revision??0)!==knownRevision.current)throw new Error('A newer takeoff checkpoint was saved in another tab. Reload or export your drawing before replacing it.');
    }catch(error){setSaveError(true);setNotice(error instanceof Error?error.message:'Account recovery failed.');throw error;}
    if(generation!==epoch.current)throw new Error('Page changed while saving the takeoff checkpoint.');
    session.current?.dispose();const active=new RecoverySession(s.repository,s.backup,{revision:previous?.revision??0,document},text=>{if(generation===epoch.current)setNotice(text);});
    session.current=active;try{await active.checkpoint(document);knownRevision.current=active.revision();}catch(error){setSaveError(true);throw error;}
    if(generation!==epoch.current)throw new Error('The saved checkpoint belongs to the previous page.');
    setCandidate(null);setNotice('Measurements saved for recovery.');
  },[candidate]);
  const beforeCalculation=useCallback(async(document:ReviewDocument,journal:CalculationJournal)=>{
    if(latest.current.disabled)return;
    if(!session.current){
      // Resume may have been opened without a fresh Find offcuts click.
      const s=services.current??await getOffcutRecoveryServices();services.current=s;
      const existing=await s.repository.load(latest.current.scope);
      if(!existing?.document||existing.document.capture.inputFingerprint!==document.sourceFingerprint)throw new Error('Restore the saved measurements, then open Find offcuts to create a recovery checkpoint before calculating.');
      session.current=new RecoverySession(s.repository,s.backup,{revision:existing.revision,document:existing.document},setNotice);
    }
    await session.current.beforeCalculation(document,journal);
  },[]);
  const onReviewCheckpoint=useCallback((document:ReviewDocument)=>{session.current?.review(document);},[]);
  const onCalculationChange=useCallback((journal:CalculationJournal)=>{session.current?.journal(journal);},[]);
  const exportCheckpoint=useCallback(()=>{
    const d=candidate??session.current?.document()??lastLocal.current;if(!d)return;
    const url=URL.createObjectURL(new Blob([JSON.stringify(d,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='quotecore-takeoff-recovery-v2.20.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  },[candidate]);
  const restore=useCallback(async()=>{
    if(!candidate||restoring)return;const opts=latest.current,generation=epoch.current;
    if(candidate.imageKey!==opts.imageKey)throw new Error('The plan image changed. Do not restore coordinates onto another image.');
    if(!window.confirm('Restore the measurements saved before Find offcuts? This replaces the current drawing for this roof area only. It does not change quote prices.'))return;
    setRestoring(true);
    try{
      const d=parseRecoveryDocument(candidate,opts.scope);
      if(generation!==epoch.current)return;
      opts.restoreState(d.workstation);dismissed.current=d.id;setCandidate(null);
      setNotice('Measurements restored. Resume offcuts reopens the saved review; Find offcuts starts from this restored drawing.');
    }catch(e){setNotice(e instanceof Error?e.message:'Recovery failed. The current drawing was kept.');}
    finally{setRestoring(false);}
  },[candidate,restoring]);
  const complete=useCallback(async()=>{const active=session.current;if(!active)return;const d=active.document();d.status='completed';await active.checkpoint(d);},[]);
  const getRecoveredReview=useCallback(async()=>{
    if(latest.current.disabled)return null;const s=services.current??await getOffcutRecoveryServices();services.current=s;
    const [cloud,device]=await Promise.allSettled([s.repository.load(latest.current.scope),withTimeout(s.backup.load(latest.current.scope),5000,'Device recovery read timed out.')]);
    const a=cloud.status==='fulfilled'?cloud.value?.document:null,b=device.status==='fulfilled'?device.value:null;const d=a&&b?(a.savedAt>=b.savedAt?a:b):a??b;
    if(!d&&cloud.status==='rejected')throw cloud.reason;
    return d?.imageKey===latest.current.imageKey?d:null;
  },[]);
  const banner=otherScope&&options.openScope?<section role="status" className="mx-3 my-2 rounded-xl border border-orange-200 bg-orange-50 p-3 text-sm"><strong>Unfinished takeoff saved for another roof area</strong><p>This plan has a recovery checkpoint in another area. Open that area to restore it without mixing measurements.</p><button type="button" className="mt-2 rounded-lg border bg-white px-3 py-2" onClick={()=>void options.openScope?.(otherScope.scope).catch(e=>setNotice(e instanceof Error?e.message:'Could not open the saved area.'))}>Open saved roof area</button><button type="button" className="ml-2 px-3 py-2" onClick={()=>setOtherScope(null)}>Keep current area</button></section>:candidate?<section role="status" className="mx-3 my-2 rounded-xl border border-orange-200 bg-orange-50 p-3 text-sm text-slate-800" data-takeoff-recovery>
    <strong>Resume your unfinished takeoff</strong><p>Measurements saved before Find offcuts ({new Date(candidate.savedAt).toLocaleString()}). {candidate.calculation?.status==='running'?'The previous calculation was interrupted; it will not restart automatically.':''}</p>
    <div className="mt-2 flex flex-wrap gap-2"><button type="button" className="rounded-lg border bg-white px-3 py-2" disabled={restoring} onClick={()=>void restore()}>Restore measurements</button><button type="button" className="rounded-lg border bg-white px-3 py-2" onClick={exportCheckpoint}>Export recovery</button><button type="button" className="rounded-lg border bg-white px-3 py-2" onClick={()=>{dismissed.current=candidate.id;setCandidate(null);setNotice('Current drawing kept. The saved checkpoint has not been deleted.');}}>Keep current</button></div></section>:notice?<div className="mx-3 my-2 text-xs text-slate-600" role="status">{notice}{saveError?<button type="button" className="ml-3 rounded-lg border bg-white px-3 py-2" onClick={exportCheckpoint}>Export recovery copy</button>:null}</div>:null;
  return{persistCapture,beforeCalculation,onReviewCheckpoint,onCalculationChange,getRecoveredReview,complete,banner};
}
