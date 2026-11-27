'use client';
import { useId, useRef, useState } from 'react';
import type { RoofingReviewService } from '../../lib/intelligence/roofing/review';
import type { JobFact, JobIssue } from '../../lib/intelligence/contracts/brief';
import { QcButton } from '../ui/v2/QcButton';
import { QcSurface, QcNotice, QcStatusBadge } from '../ui/v2/QcSurface';
import { QcField, QcInput } from '../ui/v2/QcField';
import { QcActionNotice, type QcActionResult } from '../ui/v2/QcActionNotice';

export type RoofingReviewSnapshot = Awaited<ReturnType<RoofingReviewService['view']>>;
export type ReviewCommand =
  | {kind:'confirm_fact'|'reject_fact';recordId:string;recordVersion:number;reason:string}
  | {kind:'correct_fact';recordId:string;recordVersion:number;reason:string;correction:Omit<JobFact,'id'|'version'|'state'|'review'>}
  | {kind:'resolve_issue';recordId:string;recordVersion:number;reason:string;outcome:'resolved'|'not_applicable'}
  | {kind:'select_pages';pages:{revisionId:string;pageIndex:number}[]};
type Edit={kind:'fact';record:JobFact}|{kind:'issue';record:JobIssue};
/** Unmounted presentation component. Parent owns fresh auth, server actions, current snapshot,
 * route and private source viewer. onApply resolves only after authoritative commit + refresh.
 * No provider, storage, geometry, pricing or policy logic enters the browser. */
export function RoofingReviewPanel({view,onApply,onOpenSource,onManual}:{
  view:RoofingReviewSnapshot;
  onApply:(expectedRevision:number,command:ReviewCommand)=>Promise<void>;
  onOpenSource:(source:{revisionId:string;pageIndex:number;box?:[number,number,number,number]})=>void;
  onManual:()=>void;
}){
  const formId=useId();const [edit,setEdit]=useState<Edit|null>(null);
  const [reason,setReason]=useState('');const [title,setTitle]=useState('');const [finding,setFinding]=useState('');
  const [pending,setPending]=useState(false);const locked=useRef(false);
  const [notice,setNotice]=useState<QcActionResult|null>(null);
  const [editRevision,setEditRevision]=useState(view.revision);
  function start(next:Edit){setEdit(next);setEditRevision(view.revision);setReason('');setTitle(next.record.title);setFinding(next.record.finding);}
  async function submit(command:ReviewCommand,revision=view.revision){
    if(locked.current)return;locked.current=true;setPending(true);setNotice(null);
    try{await onApply(revision,command);setEdit(null);setNotice({title:'Review updated',description:'The server confirmed the update and refreshed the brief.',tone:'success'});}
    catch{setNotice({title:'Update not confirmed',description:'Refresh the brief and check the current record before trying again. No automatic retry was made.',tone:'warning'});}
    finally{locked.current=false;setPending(false);}
  }
  function evidenceLinks(ids:string[]){return <ul className="space-y-2">{ids.map(id=>{const e=view.evidence.find(x=>x.id===id);return <li key={id} className="break-words">{e?<><QcButton size="sm" disabled={!e.current||pending} onClick={()=>onOpenSource({revisionId:e.revisionId,pageIndex:e.pageIndex,box:e.box})}>{e.filename} · p. {e.pageNumber}</QcButton><p className="text-sm">{e.excerpt}{!e.current?' (stale source)':''}</p></>:<p>Source unavailable</p>}</li>;})}</ul>;}
  const staleEdit=editRevision!==view.revision;
  return <section data-qc-ui="v2" aria-label="Roofing Job Brief" className="space-y-4 min-w-0">
    <QcSurface className="space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-semibold">Roofing Job Brief</h2><QcStatusBadge tone={view.ready?'success':'warning'}>{view.ready?'Brief reviewed':'Review required'}</QcStatusBadge></div>
      <p>Revision {view.revision} · {view.coverage.analyzed}/{view.coverage.expected} pages analyzed</p>
      <p className="text-sm">{view.coverage.failed} failed · {view.coverage.screened} screened only · {view.coverage.pending} pending · {view.coverage.missing} missing</p>
      <QcNotice tone={view.ready?'info':'warning'}>{view.nextAction}. This is not measurement, pricing or quote approval.</QcNotice>
      <QcButton variant="secondary" disabled={pending} onClick={onManual}>Continue manually</QcButton>
    </QcSurface>
    <QcActionNotice result={notice} onDismiss={()=>setNotice(null)}/>
    {edit&&<QcSurface className="space-y-3 p-4">
      <h3 className="font-semibold">Review: {edit.record.title}</h3>
      {staleEdit&&<QcNotice tone="warning">The brief changed. Cancel and reopen the record before saving.</QcNotice>}
      <QcField label="Review reason" htmlFor={`${formId}-reason`}><QcInput id={`${formId}-reason`} value={reason} maxLength={2000} disabled={pending} onChange={e=>setReason(e.target.value)}/></QcField>
      {edit.kind==='fact'&&<>
        <QcField label="Corrected title" htmlFor={`${formId}-title`}><QcInput id={`${formId}-title`} value={title} maxLength={200} disabled={pending} onChange={e=>setTitle(e.target.value)}/></QcField>
        <QcField label="Corrected finding" htmlFor={`${formId}-finding`}><textarea id={`${formId}-finding`} className="qc-input w-full" rows={3} maxLength={2000} value={finding} disabled={pending} onChange={e=>setFinding(e.target.value)}/></QcField>
        <p className="text-sm">Wording corrections preserve source links, quantity and basis, and require another confirmation. Use the existing manual workflow for measurement changes.</p>
      </>}
      <div className="flex flex-wrap gap-2">
        {edit.kind==='fact'?<>
          <QcButton variant="primary" disabled={pending||staleEdit||!reason.trim()||title!==edit.record.title||finding!==edit.record.finding} onClick={()=>void submit({kind:'confirm_fact',recordId:edit.record.id,recordVersion:edit.record.version,reason},editRevision)}>Confirm original</QcButton>
          <QcButton disabled={pending||staleEdit||!reason.trim()} onClick={()=>void submit({kind:'reject_fact',recordId:edit.record.id,recordVersion:edit.record.version,reason},editRevision)}>Reject</QcButton>
          <QcButton disabled={pending||staleEdit||!reason.trim()||!title.trim()||!finding.trim()||(title===edit.record.title&&finding===edit.record.finding)} onClick={()=>{const f=edit.record;void submit({kind:'correct_fact',recordId:f.id,recordVersion:f.version,reason,correction:{category:f.category,title,finding,basis:f.basis,evidenceIds:f.evidenceIds,...(f.quantity?{quantity:f.quantity}:{})}},editRevision);}}>Save correction</QcButton>
        </>:<>
          <QcButton variant="primary" disabled={pending||staleEdit||!reason.trim()} onClick={()=>void submit({kind:'resolve_issue',recordId:edit.record.id,recordVersion:edit.record.version,reason,outcome:'resolved'},editRevision)}>Mark resolved</QcButton>
          <QcButton disabled={pending||staleEdit||!reason.trim()} onClick={()=>void submit({kind:'resolve_issue',recordId:edit.record.id,recordVersion:edit.record.version,reason,outcome:'not_applicable'},editRevision)}>Not applicable</QcButton>
        </>}
        <QcButton disabled={pending} onClick={()=>setEdit(null)}>Cancel</QcButton>
      </div>
    </QcSurface>}
    <QcSurface className="space-y-3 p-4"><h3 className="font-semibold">Review items ({view.issues.length})</h3>
      {!view.issues.length&&<p>No issues extracted; this does not prove none exist.</p>}
      {view.issues.map(i=><article key={i.id} className="space-y-2 border-b pb-3 last:border-0"><h4 className="font-medium break-words">{i.priority.toUpperCase()} · {i.title}</h4><p>{i.finding}</p><p className="text-sm">Pricing consideration: {i.pricingImpact}</p><p>Status: {i.state}</p>{evidenceLinks(i.evidenceIds)}{i.decision&&<p>Decision: {i.decision.outcome} — {i.decision.reason}</p>}<QcButton size="sm" disabled={pending||!!edit||i.state==='superseded'} onClick={()=>start({kind:'issue',record:i})}>Review issue</QcButton></article>)}
    </QcSurface>
    <QcSurface className="space-y-3 p-4"><h3 className="font-semibold">Findings ({view.facts.length})</h3>
      {view.facts.map(f=><article key={f.id} className="space-y-2 border-b pb-3 last:border-0"><h4 className="font-medium break-words">{f.title}</h4><p>{f.finding}</p><p className="text-sm">{f.category} · {f.basis} · {f.state}</p>{f.quantity&&<p>Stated quantity: {f.quantity.value} {f.quantity.unit} ({f.quantity.basis}); source: {f.quantity.sourceText}</p>}{evidenceLinks(f.evidenceIds)}{f.review&&<p>Review: {f.review.reason}</p>}<QcButton size="sm" disabled={pending||!!edit||f.state==='superseded'} onClick={()=>start({kind:'fact',record:f})}>Review finding</QcButton></article>)}
    </QcSurface>
    <QcSurface className="space-y-3 p-4"><h3 className="font-semibold">Working pages</h3><p className="text-sm">Selection changes the working view only. It does not delete sources or change analysis coverage.</p>
      {view.pages.map(p=><div key={`${p.revisionId}:${p.pageIndex}`} className="flex flex-wrap items-center gap-2 border-b pb-2 last:border-0"><label className="flex items-center gap-2 min-w-0 break-words"><input type="checkbox" checked={p.selected} disabled={pending||!!edit||p.status==='missing'} onChange={e=>{const pages=view.pages.filter(x=>x.selected&&!(x.revisionId===p.revisionId&&x.pageIndex===p.pageIndex)).map(x=>({revisionId:x.revisionId,pageIndex:x.pageIndex}));if(e.target.checked)pages.push({revisionId:p.revisionId,pageIndex:p.pageIndex});void submit({kind:'select_pages',pages});}}/>{p.filename} · page {p.pageIndex+1}</label><span className="text-sm">{p.status}{p.failureReason?` · ${p.failureReason}`:''}</span><QcButton size="sm" disabled={pending||p.status==='missing'} onClick={()=>onOpenSource({revisionId:p.revisionId,pageIndex:p.pageIndex})}>Open source</QcButton></div>)}
    </QcSurface>
    <QcSurface className="space-y-2 p-4"><h3 className="font-semibold">Blocking checks</h3>{view.blockers.length?<ul className="list-disc pl-5">{view.blockers.map((b,i)=><li key={`${b.code}:${b.recordId??i}`} className="break-words">{b.code.replace(/_/g,' ')}{b.recordId?` — ${view.facts.find(f=>f.id===b.recordId)?.title??view.issues.find(x=>x.id===b.recordId)?.title??b.recordId}`:''}</li>)}</ul>:<p>Document brief checks complete. Separate downstream authorization is still required.</p>}</QcSurface>
  </section>;
}
