'use client';
import {useState} from 'react';
import {QcButton} from '@/app/components/ui/v2/QcButton';
import {quickStartFileLink,setQuickStartStatus} from './actions';
type Order={id:string;contact_email:string;notes:string;file_paths:string[];status:string;created_at:string;company_id:string;paid_at:string|null};
export function OrdersPanel({orders}:{orders:Order[]}){
 const [error,setError]=useState('');const [busy,setBusy]=useState('');
 async function file(orderId:string,path:string){setError('');setBusy(path);
  try{const result=await quickStartFileLink(orderId,path);if(!result.ok||!result.url)throw Error(result.message);
   window.open(result.url,'_blank','noopener,noreferrer');}catch(e){setError(e instanceof Error?e.message:'Unable to open file.');}finally{setBusy('');}}
 async function next(o:Order,status:'in_progress'|'ready_for_review'|'completed'){
  setBusy(o.id);setError('');const r=await setQuickStartStatus(o.id,status);if(!r.ok)setError(r.message||'Unable to update status.');setBusy('');}
 return <section data-qc-ui="v2">
  {error&&<p role="alert" style={{color:'var(--qc-color-danger)',padding:12}}>{error}</p>}
  {orders.length===0&&<p>No Quick Start requests yet.</p>}
  <div style={{display:'grid',gap:18}}>{orders.map(o=><article key={o.id} style={{border:'1px solid var(--qc-border-divider)',borderRadius:16,background:'var(--qc-bg-surface)',padding:20}}>
   <div style={{display:'flex',justifyContent:'space-between',flexWrap:'wrap',gap:12}}><strong>{o.contact_email}</strong><span>{o.status.replaceAll('_',' ')} · {new Date(o.created_at).toLocaleDateString()}</span></div>
   <p style={{fontSize:12,margin:'10px 0'}}>Order {o.id} · Workspace {o.company_id}</p>
   <p style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',fontSize:14}}>{o.notes||'No written notes supplied.'}</p>
   <div style={{display:'flex',flexWrap:'wrap',gap:8,marginTop:12}}>{o.file_paths.map((path,i)=><QcButton variant="secondary" key={path} disabled={busy===path} onClick={()=>file(o.id,path)}>Open private file {i+1}</QcButton>)}</div>
   <div style={{display:'flex',flexWrap:'wrap',gap:8,marginTop:12}}>
    {o.status==='paid'&&<QcButton variant="primary" disabled={busy===o.id} onClick={()=>next(o,'in_progress')}>Start preparation</QcButton>}
    {o.status==='in_progress'&&<QcButton variant="primary" disabled={busy===o.id} onClick={()=>next(o,'ready_for_review')}>Mark ready for customer review</QcButton>}
    {o.status==='ready_for_review'&&<QcButton variant="primary" disabled={busy===o.id} onClick={()=>next(o,'completed')}>Mark completed</QcButton>}
   </div>
  </article>)}</div>
 </section>;
}
