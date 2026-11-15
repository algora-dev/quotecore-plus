'use client';
import {useState} from 'react';
import {QcButton} from '@/app/components/ui/v2/QcButton';
import {QcInput,QcField} from '@/app/components/ui/v2/QcField';
import '../setup.css';import '../assistant/assistant.css';
export function QuickStartClient({checkout,orders}:{checkout:string;orders:{id:string;status:string;created_at:string}[]}){
 const [notes,setNotes]=useState('');const [files,setFiles]=useState<File[]>([]);const [loading,setLoading]=useState(false);const [error,setError]=useState('');
 async function start(){setLoading(true);setError('');try{
   const fd=new FormData();fd.set('notes',notes);files.forEach(f=>fd.append('files',f));
   const res=await fetch('/api/pricing-setup/quick-start',{method:'POST',body:fd});const val=await res.json();
   if(!res.ok||!val.url)throw Error(val.error||'Checkout is not available.');window.location.assign(val.url);
  }catch(e){setError(e instanceof Error?e.message:'Unable to start checkout.');setLoading(false);}}
 return <div className="pa-panel" style={{maxWidth:800}}>
  <h2 style={{fontWeight:700,fontSize:22}}>From US$49 <small style={{fontSize:14,fontWeight:400}}>one time</small></h2>
  <ul style={{paddingLeft:25,lineHeight:1.8,fontSize:14,margin:'16px 0 24px'}}>
   <li>Up to 15 Smart Components from your supplied materials, labour or service information.</li>
   <li>We follow up for missing details needed to finish your components.</li>
   <li>Components prepared in your workspace for your final review.</li>
   <li>Access to our existing tutorials for creating quotes.</li>
  </ul>
  <p style={{fontSize:13,color:'var(--qc-text-secondary)'}}>This is a pricing-entry service, not Full Done For You setup. It does not include custom one-to-one training, a subscription upgrade or three months of personalised support. Your workspace's component allowance still applies. US$49 covers up to 15 components — if you need more, we'll agree any adjusted price with you before extra work starts.</p>
  {checkout==='success'&&<div className="pa-success" role="status">Checkout returned successfully. We will confirm payment from Stripe before starting your setup. Refresh to view your request's status.</div>}
  {checkout==='cancelled'&&<div className="pa-alert" role="status">Checkout was cancelled. No new payment has been confirmed.</div>}
  {error&&<div className="pa-alert" role="alert">{error}</div>}
  <QcField label="Tell us about your pricing and what you want configured" htmlFor="quick-notes" help="What kinds of roofing or other services do you provide? Are these purchase costs or customer prices? Include how you charge labour.">
   <textarea id="quick-notes" className="qc-input pa-textarea" value={notes} maxLength={3000} onChange={e=>setNotes(e.target.value)} placeholder="For example: long-run metal roofing, flashings, gutters. I have a supplier price list and a separate labour rate sheet."/>
  </QcField>
  <QcField label="Attach your pricing files (optional)" htmlFor="quick-files" help="Upload up to 3 files (PDF, CSV, XLSX, PNG, JPEG, WebP or TXT); 4 MB combined. For larger files, send details in the notes and our team can arrange a secure transfer. Private files are available to our setup team.">
   <QcInput id="quick-files" type="file" accept=".pdf,.csv,.xlsx,.png,.jpg,.jpeg,.webp,.txt" multiple onChange={e=>setFiles(Array.from(e.target.files??[]))}/>
  </QcField>
  <div className="pa-actions"><QcButton variant="primary" disabled={loading||(!notes.trim()&&files.length===0)} pending={loading} onClick={start}>Continue to secure checkout · US$49</QcButton></div>
  {orders.length>0&&<section style={{marginTop:30}}><h3 style={{fontWeight:650,marginBottom:8}}>Your recent requests</h3>{orders.map(o=><p key={o.id} style={{fontSize:13,marginBottom:4}}>{new Date(o.created_at).toLocaleDateString()} · {o.status.replaceAll('_',' ')} · {o.id.slice(0,8)}</p>)}</section>}
 </div>;
}
