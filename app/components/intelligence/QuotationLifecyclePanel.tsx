'use client';
import {useRef,useState} from 'react';
import {QcButton} from '../ui/v2/QcButton';
import {QcNotice,QcStatusBadge,QcSurface} from '../ui/v2/QcSurface';
import {deliveryLabels,nextActionLabels,quotationStatusLabels,releaseBlockerLabels,quotationAttention,type QuotationReleaseView,type QuotationTrackingView} from '../../lib/intelligence/hub/quotation-model';

/** Unmounted extension for R2's selected canonical job. Host owns ACL, exact
 * canonical render viewer and human approval action. This panel never dispatches
 * mail, mints a receipt, opens an unverified URL or claims an action succeeded. */
export function QuotationLifecyclePanel({tracking,release,onOpenEditor,onOpenActivity,onReviewRelease,onRefresh}: {
 tracking:QuotationTrackingView;release?:QuotationReleaseView;
 onOpenEditor:(quoteId:string)=>void;onOpenActivity:(quoteId:string)=>void;
 onReviewRelease:(quoteId:string,version:number,kind:QuotationReleaseView['kind'],previewDigest:string)=>Promise<void>;
 onRefresh:()=>Promise<void>;
}){
 const lock=useRef(false);const [busy,setBusy]=useState(false);const [notice,setNotice]=useState('');
 const current=release?.quoteId===tracking.quoteId&&release.version===tracking.version?release:undefined;
 const attention=quotationAttention(tracking);
 async function run(fn:()=>Promise<void>){if(lock.current)return;lock.current=true;setBusy(true);setNotice('');try{await fn();}catch{setNotice('Action not confirmed. Refresh the canonical job and check delivery history before trying again.');}finally{lock.current=false;setBusy(false);}}
 return <QcSurface className="p-4 space-y-4 min-w-0" aria-label="Quotation lifecycle">
  <header className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-lg font-semibold">Quotation lifecycle</h2><p className="text-sm">Canonical version {tracking.version}{tracking.viewed?' · Viewed':''}</p></div><QcStatusBadge tone={tracking.status==='accepted'?'success':tracking.status==='revision_requested'?'warning':'neutral'}>{quotationStatusLabels[tracking.status]}</QcStatusBadge></header>
  {notice&&<QcNotice role="status" tone="warning">{notice}</QcNotice>}
  {attention&&<QcNotice tone="warning">{attention.label}</QcNotice>}
  <div className="flex flex-wrap gap-2"><QcButton disabled={busy} onClick={()=>onOpenEditor(tracking.quoteId)}>Open existing quote editor</QcButton><QcButton disabled={busy} onClick={()=>onOpenActivity(tracking.quoteId)}>Open existing activity</QcButton><QcButton disabled={busy} onClick={()=>void run(onRefresh)}>Refresh</QcButton></div>
  <p className="text-sm">Next: {nextActionLabels[tracking.nextAction]}. Manual tools remain available.</p>
  {current&&<section className="border-t pt-3 space-y-2" aria-label="Release review"><h3 className="font-semibold">{current.kind==='followup'?'Follow-up review':'Final release review'}</h3><p className="font-medium">{current.quoteNumber} · {current.currency} {current.total.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</p><dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm"><dt>To</dt><dd className="break-words">{current.recipientName} · {current.recipientEmail}</dd><dt>From</dt><dd className="break-words">{current.senderEmail}</dd><dt>Subject</dt><dd className="break-words">{current.subject}</dd><dt>Attachments</dt><dd className="break-words">{current.attachmentNames.join(', ')||'None'}</dd></dl>
  {current.blockers.map(b=><p key={b} className="text-sm">{releaseBlockerLabels[b]??'Additional verification required.'}</p>)}
  {!current.sandboxReleaseEnabled&&<QcNotice tone="info">Release is disabled pending sandbox integration. No messages can be sent from this panel.</QcNotice>}
  <QcButton variant="primary" disabled={busy||!current.readyForApproval||!current.sandboxReleaseEnabled} onClick={()=>void run(()=>onReviewRelease(current.quoteId,current.version,current.kind,current.previewDigest))}>Review exact document and message</QcButton><p className="text-sm">Review opens the current canonical rendering and exact email. A separate human approval is required before any release.</p></section>}
  <section className="border-t pt-3 space-y-2" aria-label="Delivery history"><h3 className="font-semibold">Delivery history</h3>{tracking.delivery.length===0?<p className="text-sm">No Intelligence release recorded.</p>:tracking.delivery.map((d,i)=><p className="text-sm" key={`${d.version}-${d.kind}-${i}`}>Version {d.version} · {d.kind==='followup'?'Follow-up':'Quote'} · {deliveryLabels[d.state]}</p>)}</section>
  <section className="border-t pt-3 space-y-2" aria-label="Canonical customer activity"><h3 className="font-semibold">Customer activity</h3>{tracking.timeline.length===0?<p className="text-sm">No verified activity supplied.</p>:<ol className="space-y-2">{tracking.timeline.map(e=><li className="text-sm" key={e.id}><span className="font-medium">{e.kind==='viewed'?'Viewed':quotationStatusLabels[e.kind]}</span> · Version {e.version}{e.current?'':' (history)'} · <time dateTime={new Date(e.atMs).toISOString()}>{new Date(e.atMs).toLocaleString()}</time></li>)}</ol>}</section>
 </QcSurface>;
}
