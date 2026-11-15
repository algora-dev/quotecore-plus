'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { QcButton } from '@/app/components/ui/v2/QcButton';
import { QcInput, QcField, QcSelect } from '@/app/components/ui/v2/QcField';
import { QcIcon } from '@/app/components/ui/v2/QcIcon';
import { ComponentTestPanel } from '@/app/components/pricing/ComponentTestPanel';
import { FileUploader } from '@/app/components/FileUploader';
import type {MeasurementSystem} from '@/app/lib/types';
import type {PricingDraftRow,PricingDraft,EditableDraft,PricingSession} from '@/app/lib/pricing-setup/domain';
import {validateForConfirmation} from '@/app/lib/pricing-setup/domain';
import {confirmPricingDraft,deletePricingSession,loadPricingAssistantData,prepareReadyMadeLibraries,saveConfirmedPricingDrafts,savePricingDraft,selectPricingDrafts} from './actions';
import type { StarterLibrarySummary } from '@/app/lib/pricing-setup/starter-libraries.server';
import {createComponentCollection} from '@/app/(auth)/[workspaceSlug]/components/actions';
import '../setup.css';import './assistant.css';

type Props={workspaceSlug:string;data:{sessions:PricingSession[];current:{session:PricingSession;drafts:PricingDraftRow[]}|null};loadError:string;
 collections:{id:string;name:string;is_bootstrap:boolean}[];currency:string;measurementSystem:MeasurementSystem;
 starterLibraries:StarterLibrarySummary[];starterError:string;capacity:{limit:number|null;used:number|null;available:number|null;reliable:boolean};initialMode:'choose'|'own'|'ready'};
const common={area:'Area (m²)',lineal:'Length (m)',quantity:'Quantity (each)',fixed:'Fixed charge',quantity_by_spacing:'Quantity by spacing'};
const pitch={none:'No pitch factor',rafter:'Rafter pitch',valley_hip:'Hip / valley pitch'};
const waste={unknown:'Not found: must decide',none:'No waste',percent:'Percentage',fixed:'Fixed allowance',fixed_per_segment:'Allowance per segment'};
const origins:Record<string,string>={source:'Extracted',rule:'Roofing rule',inference:'Suggested',missing:'Not found',user:'Edited'};
const fmt=(v:number|null,cur:string)=>v==null?'Not found':new Intl.NumberFormat('en',{style:'currency',currency:cur,maximumFractionDigits:2}).format(v);
const editorValue=(d:PricingDraft):EditableDraft=>({sku:d.sku,name:d.name,notes:d.notes,sourceUnit:d.sourceUnit,sourcePrice:d.sourcePrice,
 priceBasis:d.priceBasis,materialRate:d.materialRate,labourRate:d.labourRate,measurementType:d.measurementType,componentType:d.componentType,
 soldBy:d.soldBy,coverWidthMm:d.coverWidthMm,quantitySpacingM:d.quantitySpacingM,spacingAllowancePercent:d.spacingAllowancePercent,spacingRoundUp:d.spacingRoundUp,unitsPerAreaEnabled:d.unitsPerAreaEnabled,unitsPerArea:d.unitsPerArea,
 pitchType:d.pitchType,wasteKind:d.wasteKind,wasteValue:d.wasteValue,pricingStrategy:d.pricingStrategy,packPrice:d.packPrice,packSize:d.packSize});
function currencyNumber(raw:string):number|null{return raw.trim()===''?null:Number.isFinite(Number(raw))&&Number(raw)>=0?Number(raw):null;}

export function PricingAssistantClient({workspaceSlug,data,loadError,collections:initialCollections,currency,measurementSystem,starterLibraries,starterError,capacity,initialMode}:Props){
 const router=useRouter();const [current,setCurrent]=useState(data.current);
 const [sessions,setSessions]=useState(data.sessions);const [busy,setBusy]=useState(false);const [error,setError]=useState(loadError);
 const [notice,setNotice]=useState('');const [file,setFile]=useState<File|null>(null);const [text,setText]=useState('');
 const [contextTypes,setContextTypes]=useState<Array<'purchase'|'selling'|'labour'|'mixed'>>([]);
 const [entryMode,setEntryMode]=useState<'choose'|'own'|'ready'>(initialMode);
 const [starterSlugs,setStarterSlugs]=useState<string[]>([]);
 const [foreignCurrencyAccepted,setForeignCurrencyAccepted]=useState(false);
 const [practiceAcknowledged,setPracticeAcknowledged]=useState(false);
 const [voice,setVoice]=useState(false);
 const [recording,setRecording]=useState(false);const recorder=useRef<MediaRecorder|null>(null);const audioStream=useRef<MediaStream|null>(null);
 const [phase,setPhase]=useState<'choose'|'review'|'done'>(current?'choose':'choose');
 const [chosen,setChosen]=useState<string[]>(current?.drafts.filter(d=>d.status==='selected'||d.status==='confirmed').slice(0,25).map(d=>d.id)??[]);
 const [reviewIndex,setReviewIndex]=useState(0);const [editor,setEditor]=useState<EditableDraft|null>(null);const [verified,setVerified]=useState(false);
 const [selectedLibrary,setSelectedLibrary]=useState(initialCollections.find(c=>c.is_bootstrap)?.id??initialCollections[0]?.id??'');
 const [libraries,setLibraries]=useState(initialCollections);const [newLibrary,setNewLibrary]=useState('');const [addingLibrary,setAddingLibrary]=useState(false);
 const [testOpen,setTestOpen]=useState(false);const [ask,setAsk]=useState('');const [answer,setAnswer]=useState('');const [asking,setAsking]=useState(false);
 const [savedCount,setSavedCount]=useState(0);const [savedDestination,setSavedDestination]=useState('');const [filter,setFilter]=useState('');const [confirmDelete,setConfirmDelete]=useState(false);
 const isStarterSession=Boolean(current?.drafts.some(d=>d.draft_data.starterLibrarySlug));
 const isPracticeSession=Boolean(current?.drafts.some(d=>d.draft_data.practicePricing));
 const chosenLimit=isStarterSession&&capacity.available!==null?Math.min(25,capacity.available):25;
 const ordered=(current?.drafts??[]).filter(d=>chosen.includes(d.id)&&d.status!=='saved');
 const reviewed=ordered[reviewIndex]??ordered[0];
 const hasUnsavedChanges=!!reviewed&&!!editor&&JSON.stringify(editor)!==JSON.stringify(editorValue(reviewed.draft_data));
 const refresh=async(id?:string)=>{
  const d=await loadPricingAssistantData(id??current?.session.id);
  setSessions(d.sessions);setCurrent(d.current);
  return d.current;
 };
 const reload=async()=>{const next=await refresh();if(next)setChosen(next.drafts.filter(d=>d.status==='selected'||d.status==='confirmed').slice(0,25).map(d=>d.id));};
 useEffect(()=>{setCurrent(data.current);setSessions(data.sessions);setChosen(data.current?.drafts.filter(d=>d.status==='selected'||d.status==='confirmed').slice(0,25).map(d=>d.id)??[]);setPhase('choose');},[data.current?.session.id]);
 useEffect(()=>{if(reviewed&&phase==='review'){
  setEditor(editorValue(reviewed.draft_data));setVerified(false);setTestOpen(false);setAsk('');setAnswer('');
 }},[reviewed?.id,phase]);
 useEffect(()=>()=>{recorder.current?.state==='recording'&&recorder.current.stop();audioStream.current?.getTracks().forEach(t=>t.stop());},[]);
 async function upload(){
  setBusy(true);setError('');setNotice('');
  try{
   const form=new FormData();if(file)form.set('file',file);else form.set('text',text.trim());
   form.set('context_types',JSON.stringify(contextTypes));
   form.set('basis',contextTypes.length===1&&['purchase','selling'].includes(contextTypes[0])?contextTypes[0]:contextTypes.length?'mixed':'unknown');
   if(voice)form.set('voice','true');
   const response=await fetch('/api/pricing-setup/import',{method:'POST',body:form});const result=await response.json();
   if(!response.ok||!result.ok)throw Error(result.error||'Could not analyse your pricing.');
   const next=await refresh(result.sessionId);setChosen([]);setPhase('choose');setFile(null);setText('');setVoice(false);
   setNotice(`${result.count} items extracted. Select which ones to review.`);
   router.replace(`/${workspaceSlug}/pricing/assistant?session=${result.sessionId}`);
   if(!next)throw Error('Import saved but results could not be loaded. Refresh this page.');
  }catch(e){setError(e instanceof Error?e.message:'Import failed.');}finally{setBusy(false);}
 }
 async function prepareReadyMade(){
  if(!starterSlugs.length)return;
  setBusy(true);setError('');setNotice('');
  try{
   const result=await prepareReadyMadeLibraries(starterSlugs,foreignCurrencyAccepted);
   if(!result.ok||result.saved<=0)throw Error(result.message||'No components could be prepared. Check your Smart Component places and try again.');
   setStarterSlugs([]);setForeignCurrencyAccepted(false);
   router.push(`/${workspaceSlug}/components?starterSaved=${result.saved}&starterTotal=${result.total}`);
  }catch(e){setError(e instanceof Error?e.message:'Could not prepare the ready-made libraries.');}
  finally{setBusy(false);}
 }
 function toggleStarter(slug:string){setStarterSlugs(old=>old.includes(slug)?old.filter(s=>s!==slug):[...old,slug]);}
 function toggleContext(kind:'purchase'|'selling'|'labour'|'mixed'){
  setContextTypes(old=>old.includes(kind)?old.filter(x=>x!==kind):kind==='mixed'?['mixed']:[...old.filter(x=>x!=='mixed'),kind]);
 }
 async function removeCurrentImport(){
  if(!current)return;setBusy(true);setError('');
  try{const result=await deletePricingSession(current.session.id);if(!result.ok)throw Error(result.message);
   const next=await loadPricingAssistantData();setCurrent(next.current);setSessions(next.sessions);setChosen([]);setPhase('choose');setConfirmDelete(false);setSavedCount(0);
   router.replace(`/${workspaceSlug}/pricing/assistant${next.current?`?session=${next.current.session.id}`:''}`);
   setNotice('Import drafts deleted. Previously saved Smart Components remain in your library.');
  }catch(e){setError(e instanceof Error?e.message:'Unable to remove import.');}finally{setBusy(false);}
 }
 async function toggleRecording(){
  if(recorder.current?.state==='recording'){recorder.current.stop();return;}
  if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){setError('Voice recording is not supported in this browser. You can type instead.');return;}
  setError('');
  try{
   const stream=await navigator.mediaDevices.getUserMedia({audio:true});audioStream.current=stream;
   const mime=['audio/webm','audio/mp4'].find(type=>MediaRecorder.isTypeSupported(type));
   if(!mime){stream.getTracks().forEach(t=>t.stop());throw Error('No supported recording format. Type your pricing instead.');}
   const chunks:Blob[]=[];const r=new MediaRecorder(stream,{mimeType:mime});recorder.current=r;
   r.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
   r.onstop=async()=>{
    stream.getTracks().forEach(t=>t.stop());audioStream.current=null;setRecording(false);setBusy(true);
    try{const blob=new Blob(chunks,{type:mime});const fd=new FormData();fd.set('audio',new File([blob],`pricing.${mime==='audio/mp4'?'m4a':'webm'}`,{type:mime}));
     const res=await fetch('/api/pricing-setup/transcribe',{method:'POST',body:fd});const out=await res.json();if(!res.ok)throw Error(out.error||'Transcription failed.');
     setText(v=>[v,out.text].filter(Boolean).join('\n'));setVoice(true);
    }catch(e){setError(e instanceof Error?e.message:'Transcription failed.');}finally{setBusy(false);}
   };
   r.start();setRecording(true);
  }catch(e){setError(e instanceof Error?e.message:'Microphone unavailable.');setRecording(false);}
 }
 function toggle(id:string){setChosen(old=>old.includes(id)?old.filter(x=>x!==id):old.length<chosenLimit?[...old,id]:old);setPracticeAcknowledged(false);}
 async function importAsPractice(){
  if(!current||!isPracticeSession||!practiceAcknowledged||!chosen.length)return;
  setBusy(true);setError('');setNotice('');
  try {
   const choice=await selectPricingDrafts(current.session.id,chosen);
   if(!choice.ok)throw Error(choice.message);
   const result=await saveConfirmedPricingDrafts(current.session.id,'starter:auto',true);
   if('firstCollectionId' in result&&typeof result.firstCollectionId==='string')setSavedDestination(result.destinationCount===1?result.firstCollectionId:'');
   setSavedCount(v=>v+result.saved);await reload();
   if(result.errors.length)setError(result.errors.join('\n'));
   else setNotice(result.message);
   if(result.saved>0)setPhase('done');
  }catch(e){setError(e instanceof Error?e.message:'Could not save practice components.');}
  finally{setBusy(false);}
 }
 async function beginReview(){
  if(!current||chosen.length===0)return;
  setBusy(true);setError('');
  try{const result=await selectPricingDrafts(current.session.id,chosen);
   if(!result.ok)throw Error(result.message);
   const next=await refresh();if(next)setChosen(next.drafts.filter(d=>d.status==='selected'||d.status==='confirmed').map(d=>d.id));
   setReviewIndex(0);setPhase('review');
  }catch(e){setError(e instanceof Error?e.message:'Could not save selection.');}finally{setBusy(false);}
 }
 const edit=(patch:Partial<EditableDraft>)=>{setEditor(old=>old?{...old,...patch}:old);setVerified(false);};
 async function reviewAction(confirm:boolean){
  if(!reviewed||!current||!editor)return;
  setBusy(true);setError('');setNotice('');
  try{
   const result=confirm?await confirmPricingDraft(current.session.id,reviewed.id,editor):await savePricingDraft(current.session.id,reviewed.id,editor);
   if(!result.ok)throw Error(result.message);
   await refresh();setNotice(confirm?'Component confirmed.':'Draft saved for later.');
   if(confirm){const next=ordered.findIndex(d=>d.id===reviewed.id);setReviewIndex(Math.min(next+1,Math.max(ordered.length-1,0)));}
  }catch(e){setError(e instanceof Error?e.message:'Could not save this item.');}finally{setBusy(false);}
 }
 async function saveAll(){
  if(!current||(!isStarterSession&&!selectedLibrary))return;
  setBusy(true);setError('');setNotice('');
  try{
   const result=await saveConfirmedPricingDrafts(current.session.id,isStarterSession?'starter:auto':selectedLibrary);
   if('firstCollectionId' in result&&typeof result.firstCollectionId==='string')setSavedDestination(result.destinationCount===1?result.firstCollectionId:'');
   setSavedCount(v=>v+result.saved);await reload();
   if(result.errors.length)setError(result.errors.join('\n'));
   else setNotice(result.message);
   if(result.saved>0)setPhase('done');
  }catch(e){setError(e instanceof Error?e.message:'Could not save approved components.');}finally{setBusy(false);}
 }
 async function addLibrary(){
  if(!newLibrary.trim())return;setAddingLibrary(true);setError('');
  try{const result=await createComponentCollection(newLibrary.trim());if(!result.ok)throw Error(result.message);
   setLibraries(old=>[...old,{id:result.id,name:result.name,is_bootstrap:false}]);setSelectedLibrary(result.id);setNewLibrary('');
  }catch(e){setError(e instanceof Error?e.message:'Unable to create library.');}finally{setAddingLibrary(false);}
 }
 async function explain(){
  if(!reviewed||!current||!ask.trim())return;setAsking(true);setAnswer('');
  try{const res=await fetch('/api/pricing-setup/explain',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:current.session.id,draftId:reviewed.id,question:ask})});
   const val=await res.json();if(!res.ok)throw Error(val.error||'Assistant not available.');setAnswer(val.answer);
  }catch(e){setAnswer(e instanceof Error?e.message:'Unable to answer.');}finally{setAsking(false);}
 }
 const remaining=current?.drafts.filter(d=>d.status!=='saved'&&d.status!=='skipped')??[];
 const fullyConfirmed=ordered.filter(d=>d.status==='confirmed').length;
 const resumableSessions=sessions.filter(s=>s.id!==current?.session.id);
 return <main className="ps-page pa-page" aria-labelledby="pa-title">
  <div className="pa-top"><Link href={`/${workspaceSlug}/pricing/setup`} className="pa-back"><QcIcon name="back"/> Setup options</Link><Link href={`/${workspaceSlug}/components`}>My Pricing Library</Link></div>
  <header className="ps-head"><p className="ps-eyebrow">PRICING SETUP ASSISTANT</p><h1 id="pa-title">Get your products, rates and services set up.</h1>
   <p>Upload a spreadsheet, PDF or photo of your pricing, paste a list, or speak your rates — or start from a ready-made roofing library. We'll help you verify each component before it becomes usable in a real quote.</p></header>
  {error&&<div className="pa-alert" role="alert" style={{whiteSpace:'pre-line'}}>{error}</div>}
  {notice&&<div className="pa-success" role="status">{notice}</div>}
  {entryMode==='choose'&&!current&&<section className="pa-entry-options" aria-label="Choose a pricing setup method">
   <button type="button" className="pa-entry-card" onClick={()=>setEntryMode('own')}>
    <span className="pa-entry-tag">I HAVE MY OWN PRICES</span>
    <strong>Upload or add my prices</strong>
    <span>Upload a spreadsheet, PDF, photo or text document — wherever you keep your materials, services and rates — or type them in. We'll extract the information we can find, then you confirm or edit it.</span>
   </button>
   <button type="button" className="pa-entry-card" onClick={()=>setEntryMode('ready')}>
    <span className="pa-entry-tag">I NEED A STARTING POINT</span>
    <strong>Start with a ready-made library</strong>
    <span>{starterLibraries.length?`${starterLibraries.length} editable example libraries`:'Editable example libraries'} based on the roofing products you normally work with. Start quoting while you figure out your own pricing.</span>
   </button>
   {resumableSessions.length>0&&<div className="pa-entry-card pa-entry-resume">
    <span className="pa-entry-tag">PICK UP WHERE YOU LEFT OFF</span>
    <strong>Resume an import</strong>
    <div className="pa-resume-list">{resumableSessions.map(s=><Link key={s.id} href={`/${workspaceSlug}/pricing/assistant?session=${s.id}`}>{s.source_name} <small>({s.remaining??s.extracted_count} left)</small></Link>)}</div>
   </div>}
  </section>}
  {!current&&entryMode!=='choose'&&<div className="pa-method-switch"><QcButton variant="ghost" size="sm" disabled={busy} onClick={()=>setEntryMode('choose')}><QcIcon name="back"/> Choose a different method</QcButton></div>}
  {entryMode==='own'&&!current&&<section className="pa-panel pa-capture" aria-labelledby="pa-source-title">
   <div className="pa-section-heading"><h2 id="pa-source-title">1. Upload your pricing</h2><span>However you currently store it — or type or speak it below</span></div>
   <FileUploader appearance="v2" accept=".csv,.xlsx,.txt,.pdf,.png,.jpg,.jpeg,.webp" maxSize={4194304}
    label="Upload your pricing however you store it"
    description="Click to browse or drag and drop · CSV, XLSX, TXT, PDF, PNG, JPEG or WebP · max 4 MB · originals not retained"
    onUpload={async next=>{setFile(next);setText('');setVoice(false);}}/>
   {file&&<div className="pa-file-chip" role="status"><span>{file.name}</span><small>{Math.max(1,Math.round(file.size/1024))} KB selected</small>
    <QcButton variant="ghost" size="sm" disabled={busy} onClick={()=>setFile(null)}>Remove</QcButton></div>}
   <p className="pa-or">OR</p>
   <QcField label="Type, paste or speak what you charge or pay" htmlFor="pa-text">
    <textarea className="qc-input pa-textarea" id="pa-text" value={text} maxLength={20000} disabled={busy||!!file} onChange={e=>{setText(e.target.value);setVoice(false);}} placeholder="For example: Roof sheeting: supplier cost $32 per m². Labour $18 per m². Or paste your existing list here."/>
   </QcField>
   <QcButton variant="ghost" onClick={toggleRecording} disabled={busy||!!file} className="pa-voice"><QcIcon name="assistant"/>{recording?'Stop recording':'Speak instead of typing'}</QcButton>
   <fieldset className="pa-context"><legend>What kinds of prices are included? <span>(Optional)</span></legend>
    <p>Only if it's useful, select any that apply. This helps identify your costs; you can leave it blank.</p>
    <div className="pa-context-options">
    {([{id:'purchase',label:'Supplier / purchase costs'},{id:'selling',label:'Prices I charge customers'},{id:'labour',label:'Labour rates'},{id:'mixed',label:'A mixture of these'}] as const).map(option=><label key={option.id}>
      <input type="checkbox" checked={contextTypes.includes(option.id)} onChange={()=>toggleContext(option.id)}/>{option.label}
    </label>)}
    </div>
   </fieldset>
   <QcButton variant="primary" disabled={busy||(!file&&!text.trim())} pending={busy} onClick={upload}><QcIcon name="upload"/> Find pricing items</QcButton>
  </section>}
  {entryMode==='ready'&&<section className="pa-panel pa-ready" aria-labelledby="pa-ready-title">
    <div className="pa-section-heading"><h2 id="pa-ready-title">Choose your roofing systems</h2><span>One or more</span></div>
    <p>Select the roof coverings you normally estimate or install. These complete <strong>practice-priced</strong> examples include material cost, labour, example waste, measurement and pitch rules.</p>
    {starterError&&<p className="pa-alert" role="alert">{starterError}</p>}
    <div className="pa-ready-grid" role="group" aria-label="Ready-made roofing libraries">
     {starterLibraries.map(lib=><div className={`pa-ready-option ${starterSlugs.includes(lib.slug)?'pa-ready-selected':''}`} key={lib.slug}>
      <label className="pa-ready-heading">
       <input type="checkbox" checked={starterSlugs.includes(lib.slug)} onChange={()=>toggleStarter(lib.slug)} disabled={busy}/>
       <span><strong>{lib.name}</strong><small>{lib.description}</small><small>{lib.count} components · Template v{lib.version}</small></span>
      </label>
      <details className="pa-ready-preview"><summary>Preview what's included</summary>
       <ul>{lib.items.map(item=><li key={item.code}><strong>{item.name}</strong><span>{item.sourceUnit} · {pitch[item.pitchType as keyof typeof pitch]??'Check pitch'} · Material {fmt(item.materialRate,'USD')} / Labour {fmt(item.labourRate,'USD')} · Waste {item.wasteKind==='percent'?`${item.wasteValue}%`:item.wasteKind==='none'?'None':'Review'} · {item.notes}</span></li>)}</ul>
      </details>
     </div>)}
    </div>
    <p className="pa-caution"><strong>Practice prices, NOT supplier quotes.</strong> These example rates are research-informed USD 2026 cost allocations, not verified prices in any region. The included waste percentages are illustrative. QuoteCore+ currently applies waste to both material and labour quantities. They exclude tax, profit, overhead and job-specific costs. You can test a practice quote, but customer sending is blocked until you verify the rates and create a new quote.</p>
    {currency.toUpperCase()!=='USD'&&<label className="pa-check pa-caution"><input type="checkbox" checked={foreignCurrencyAccepted} onChange={e=>setForeignCurrencyAccepted(e.target.checked)}/><span>My workspace uses <strong>{currency}</strong>. I understand these are USD-origin example numbers that will display as <strong>{currency} without any currency conversion</strong>. They are fictitious practice figures, not real local material or labour rates.</span></label>}
    {capacity.available!==null&&<p className="pa-capacity" role="status">Your workspace has <strong>{capacity.available} of {capacity.limit}</strong> Smart Component places available. Select whichever items fit when reviewing. <Link href={`/${workspaceSlug}/account/billing/build-setup`}>See paid-plan options</Link>.</p>}
    <div className="pa-actions"><span>{starterSlugs.length} library{starterSlugs.length===1?'':'ies'} selected · {starterLibraries.filter(lib=>starterSlugs.includes(lib.slug)).reduce((total,lib)=>total+lib.count,0)} candidate components</span>
     <QcButton variant="primary" disabled={busy||starterSlugs.length===0||(currency.toUpperCase()!=='USD'&&!foreignCurrencyAccepted)||(capacity.available!==null&&capacity.available<=0)} pending={busy} onClick={prepareReadyMade}>Prepare selected libraries <QcIcon name="arrow"/></QcButton></div>
   </section>}
  {current&&<section className="pa-panel" aria-label="Extracted pricing items">
   <div className="pa-section-heading"><h2>2. Review items from {current.session.source_name}</h2><span>{current.drafts.length} found</span></div>
   <div className="pa-delete-import">{!confirmDelete?<QcButton variant="ghost" size="sm" disabled={busy} onClick={()=>setConfirmDelete(true)}>Delete this import</QcButton>:<div role="group" aria-label="Confirm delete import"><span>Delete all draft items from this import? Already saved components will remain.</span><QcButton variant="danger" size="sm" disabled={busy} onClick={removeCurrentImport}>Delete drafts</QcButton><QcButton variant="ghost" size="sm" onClick={()=>setConfirmDelete(false)}>Cancel</QcButton></div>}</div>
   {phase==='choose'&&<>
    <p>Choose up to {chosenLimit} components in this batch. {isPracticeSession?'Import priced examples directly for a practice quote, or review them individually to understand the settings.':'Review each imported item individually before saving.'} Roofing-system groups are preserved. You can return for the rest.</p>
    {isPracticeSession&&<p className="pa-caution" role="note"><strong>PRACTICE PRICES — NOT VERIFIED.</strong> USD 2026 illustrative direct costs with sample waste; no FX conversion, tax, overhead or margins. The current engine applies waste to both material and labour. A practice quote cannot be shared with customers.</p>}
    <QcButton variant="ghost" disabled={busy||chosenLimit===0} onClick={()=>{setChosen(current.drafts.filter(d=>d.status!=='saved').slice(0,chosenLimit).map(d=>d.id));setPracticeAcknowledged(false);}}>{isPracticeSession?`Select available examples (up to ${chosenLimit})`:`Select all items (up to ${chosenLimit})`}</QcButton>
    <QcField label="Find an item" htmlFor="pa-search"><QcInput id="pa-search" value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Search SKU or name"/></QcField>
    <div className="pa-list" role="group" aria-label="Select extracted items">
    {current.drafts.filter(d=>!filter||`${d.draft_data.sku} ${d.draft_data.name}`.toLowerCase().includes(filter.toLowerCase())).map(d=>
     <label className="pa-candidate" key={d.id}>
      <input type="checkbox" checked={chosen.includes(d.id)} disabled={d.status==='saved'||(chosen.length>=chosenLimit&&!chosen.includes(d.id))} onChange={()=>toggle(d.id)}/>
      <div className="pa-candidate-content"><span className="pa-sku">{d.draft_data.sku||'No SKU'}</span>
       <strong>{d.draft_data.name}</strong>{d.draft_data.starterLibraryName&&<span className="pa-system-label">{d.draft_data.starterLibraryName}</span>}<span>Material {fmt(d.draft_data.materialRate,currency)} · Labour {fmt(d.draft_data.labourRate,currency)} · {common[d.draft_data.measurementType]}{d.draft_data.practicePricing?' · PRACTICE': ''}</span>
       <span className="pa-meta">Pitch: {pitch[d.draft_data.pitchType]} · Waste: {d.draft_data.wasteKind==='percent'?`${d.draft_data.wasteValue}%` : waste[d.draft_data.wasteKind]} · {d.status==='saved'?'Saved':d.status==='confirmed'?'Confirmed for saving':`${d.draft_data.confidence} rule match`}</span></div>
     </label>)}
    </div>
    {isPracticeSession&&<label className="pa-check pa-caution"><input type="checkbox" checked={practiceAcknowledged} onChange={e=>setPracticeAcknowledged(e.target.checked)}/><span>I understand that these are fictional learning prices, not verified costs. I will not send a customer quote with these components; I must check and verify my own material, labour, waste and pitch rules first.</span></label>}
    <div className="pa-actions"><strong>{chosen.length} of {chosenLimit} selected</strong>
     {isPracticeSession&&<QcButton variant="primary" disabled={busy||chosen.length===0||!practiceAcknowledged} pending={busy} onClick={importAsPractice}>Save to My Pricing Library for practice <QcIcon name="check"/></QcButton>}
     <QcButton variant={isPracticeSession?'secondary':'primary'} disabled={busy||chosen.length===0} pending={busy} onClick={beginReview}>Review components individually <QcIcon name="arrow"/></QcButton></div>
   </>}
   {phase==='review'&&reviewed&&editor&&<>
     {reviewed.draft_data.practicePricing&&<p className="pa-caution"><strong>Practice pricing:</strong> This component will remain marked PRACTICE even if you confirm it here. Edit and verify your real costs later in My Pricing Library. Example numbers come from USD 2026 and are not currency-converted.</p>}
     <p className="pa-progress">Review {Math.min(reviewIndex+1,ordered.length)} of {ordered.length} · {fullyConfirmed} individually confirmed</p>
     <div className="pa-legend" aria-label="Input colour guide"><span><i className="pa-swatch pa-swatch-found"/>Found in your pricing</span><span><i className="pa-swatch pa-swatch-missing"/>Needs your input</span><span><i className="pa-swatch"/>Suggested rule or already filled</span></div>
     <div className="pa-review"><div className="pa-review-head"><div>{reviewed.draft_data.starterLibraryName&&<span className="pa-system-label">{reviewed.draft_data.starterLibraryName}</span>}<span className="pa-sku">{reviewed.draft_data.sku||'No SKU'}</span><h3>{reviewed.draft_data.name}</h3></div><span className="pa-status">{reviewed.status==='confirmed'?'Confirmed':'Needs confirmation'}</span></div>
      <details className="pa-source"><summary>See the original source evidence</summary><blockquote>{reviewed.source_excerpt}</blockquote><p>Fields marked "Roofing rule" are suggestions, not values found in your source.</p></details>
      <div className="pa-fields">
       <QcField label="SKU / product code" htmlFor="pa-sku"><QcInput id="pa-sku" className={reviewed.draft_data.origins.sku==='source'&&editor.sku?'pa-in-found':''} value={editor.sku} onChange={e=>edit({sku:e.target.value})}/></QcField>
       <QcField label="Component name" htmlFor="pa-name"><QcInput id="pa-name" className={reviewed.draft_data.origins.name==='source'?'pa-in-found':''} value={editor.name} onChange={e=>edit({name:e.target.value})}/></QcField>
       <QcField label={`Material cost (${currency} per canonical measurement unit)`} htmlFor="pa-material" help={`Source: ${reviewed.draft_data.origins.materialRate?origins[reviewed.draft_data.origins.materialRate]:''}. Use zero only if the component has no material cost.`}>
        <QcInput id="pa-material" type="number" min="0" step="any" className={editor.materialRate==null?'pa-in-missing':reviewed.draft_data.origins.materialRate==='source'?'pa-in-found':''} value={editor.materialRate??''} onChange={e=>edit({materialRate:currencyNumber(e.target.value)})} placeholder="Not found"/>
       </QcField>
       <QcField label={`Labour cost (${currency} per canonical measurement unit)`} htmlFor="pa-labour" help="Enter zero only if intentional. QuoteCore+ calculates labour on the final quantity after pitch and waste, so verify that matches your charging method.">
        <QcInput id="pa-labour" type="number" min="0" step="any" className={editor.labourRate==null?'pa-in-missing':reviewed.draft_data.origins.labourRate==='source'?'pa-in-found':''} value={editor.labourRate??''} onChange={e=>edit({labourRate:currencyNumber(e.target.value)})} placeholder="Not found"/>
       </QcField>
       <QcField label="Primary or additional component?" htmlFor="pa-component-type">
        <QcSelect id="pa-component-type" value={editor.componentType} onChange={e=>edit({componentType:e.target.value as EditableDraft['componentType']})}>
         <option value="main">Main component</option><option value="extra">Additional item / service</option>
        </QcSelect>
       </QcField>
       <QcField label="How is the component measured?" htmlFor="pa-measure">
        <QcSelect id="pa-measure" value={editor.measurementType} onChange={e=>edit({measurementType:e.target.value as EditableDraft['measurementType']})}>
         {Object.entries(common).map(([v,label])=><option key={v} value={v}>{label}</option>)}
        </QcSelect>
       </QcField>
       <QcField label="Pitch rule for plan-view measurements" htmlFor="pa-pitch" help="The rule is applied only when projected plan lengths/areas need conversion. The hip/valley rule assumes a conventional 45-degree plan diagonal.">
        <QcSelect id="pa-pitch" value={editor.pitchType} onChange={e=>edit({pitchType:e.target.value as EditableDraft['pitchType']})}>
         {Object.entries(pitch).map(([v,label])=><option key={v} value={v}>{label}</option>)}
        </QcSelect>
       </QcField>
       <QcField label="Waste allowance" htmlFor="pa-waste" help="Never guessed by the assistant. Choose no waste, or supply your real allowance.">
        <QcSelect id="pa-waste" value={editor.wasteKind} onChange={e=>edit({wasteKind:e.target.value as EditableDraft['wasteKind'],wasteValue:null})}>
         {Object.entries(waste).map(([v,label])=><option key={v} value={v}>{label}</option>)}
        </QcSelect>
       </QcField>
       {editor.wasteKind!=='unknown'&&editor.wasteKind!=='none'&&<QcField label={editor.wasteKind==='percent'?'Waste percentage':'Fixed waste per item / segment'} htmlFor="pa-waste-value">
        <QcInput id="pa-waste-value" type="number" min="0" step="any" className={editor.wasteValue==null?'pa-in-missing':''} value={editor.wasteValue??''} onChange={e=>edit({wasteValue:currencyNumber(e.target.value)})}/>
       </QcField>}
       <QcField label="Pricing strategy" htmlFor="pa-strategy">
        <QcSelect id="pa-strategy" value={editor.pricingStrategy} onChange={e=>edit({pricingStrategy:e.target.value as EditableDraft['pricingStrategy'],packPrice:null,packSize:null})}>
         <option value="per_unit">Per measured unit</option>
         {editor.measurementType==='lineal'&&<option value="per_pack_length">Purchased by length pack / roll</option>}
         {editor.measurementType==='area'&&<option value="per_pack_area">Purchased by area pack / roll</option>}
        </QcSelect>
       </QcField>
       {editor.pricingStrategy!=='per_unit'&&<>
        <QcField label="Price per pack" htmlFor="pa-pack-price"><QcInput id="pa-pack-price" type="number" min="0" step="any" className={editor.packPrice==null?'pa-in-missing':''} value={editor.packPrice??''} onChange={e=>edit({packPrice:currencyNumber(e.target.value)})}/></QcField>
        <QcField label={editor.pricingStrategy==='per_pack_area'?'Coverage per pack (m²)':'Length per pack (m)'} htmlFor="pa-pack-size"><QcInput id="pa-pack-size" type="number" min="0.0001" step="any" className={editor.packSize==null?'pa-in-missing':''} value={editor.packSize??''} onChange={e=>edit({packSize:currencyNumber(e.target.value)})}/></QcField>
       </>}
       <details className="pa-advanced"><summary>Advanced measurement and quantity settings</summary>
        {editor.measurementType==='area'&&<>
         <QcField label="Sold by" htmlFor="pa-sold-by"><QcSelect id="pa-sold-by" value={editor.soldBy??'area'} onChange={e=>edit({soldBy:e.target.value as 'area'|'lineal',coverWidthMm:null})}>
          <option value="area">Area</option><option value="lineal">Length with a cover width</option>
         </QcSelect></QcField>
         {editor.soldBy==='lineal'&&<QcField label="Cover width (mm)" htmlFor="pa-cover-width"><QcInput id="pa-cover-width" type="number" min="1" step="any" className={editor.coverWidthMm==null?'pa-in-missing':''} value={editor.coverWidthMm??''} onChange={e=>edit({coverWidthMm:currencyNumber(e.target.value)})}/></QcField>}
         <label className="pa-check"><input type="checkbox" checked={editor.unitsPerAreaEnabled} onChange={e=>edit({unitsPerAreaEnabled:e.target.checked})}/> Track supplementary units per square metre</label>
         {editor.unitsPerAreaEnabled&&<QcField label="Supplementary units per m²" htmlFor="pa-area-units"><QcInput id="pa-area-units" type="number" min="0" step="any" className={editor.unitsPerArea==null?'pa-in-missing':''} value={editor.unitsPerArea??''} onChange={e=>edit({unitsPerArea:currencyNumber(e.target.value)})}/></QcField>}
        </>}
        {editor.measurementType==='quantity_by_spacing'&&<>
         <QcField label="Spacing distance (metres)" htmlFor="pa-spacing"><QcInput id="pa-spacing" type="number" min="0.0001" step="any" className={editor.quantitySpacingM==null?'pa-in-missing':''} value={editor.quantitySpacingM??''} onChange={e=>edit({quantitySpacingM:currencyNumber(e.target.value)})}/></QcField>
         <QcField label="Spacing allowance (%)" htmlFor="pa-spacing-allowance"><QcInput id="pa-spacing-allowance" type="number" min="0" max="100" step="any" value={editor.spacingAllowancePercent} onChange={e=>edit({spacingAllowancePercent:Number(e.target.value)||0})}/></QcField>
         <QcField label="Round up quantities to next" htmlFor="pa-round-up"><QcSelect id="pa-round-up" value={editor.spacingRoundUp} onChange={e=>edit({spacingRoundUp:Number(e.target.value) as 1|5|10})}>
          <option value="1">Whole unit</option><option value="5">5 units</option><option value="10">10 units</option>
         </QcSelect></QcField>
        </>}
       </details>
       <QcField label="What kind of source price is this?" htmlFor="pa-price-basis">
        <QcSelect id="pa-price-basis" value={editor.priceBasis} onChange={e=>edit({priceBasis:e.target.value as EditableDraft['priceBasis']})}>
         <option value="unknown">Source type unspecified (verify rates)</option><option value="purchase">Supplier purchase cost</option><option value="selling">Customer selling price</option><option value="mixed">Mixed source (costs separately checked)</option>
        </QcSelect>
       </QcField>
       <QcField label="Notes (optional)" htmlFor="pa-notes"><textarea id="pa-notes" className="qc-input pa-textarea" maxLength={3000} value={editor.notes} onChange={e=>edit({notes:e.target.value})}/></QcField>
      </div>
      {editor.sourcePrice!=null&&<p className="pa-source-price">Original listed rate: {fmt(editor.sourcePrice,currency)} {editor.sourceUnit||'(unit not given)'} · {editor.priceBasis} source</p>}
      {hasUnsavedChanges&&<p className="pa-warnings" role="status">You have changes that are not saved or confirmed. Save your draft or confirm this item before moving on or saving the batch.</p>}
      {reviewed.draft_data.warnings.length>0&&<div className="pa-warnings"><strong>Check these details:</strong><ul>{reviewed.draft_data.warnings.map((w,i)=><li key={i}>{w}</li>)}</ul></div>}
      <div className="pa-help"><strong>Need help with a field?</strong><p>Ask why a pitch, measurement or waste rule was suggested.</p>
       <div className="pa-help-row"><QcInput aria-label="Question for the pricing assistant" value={ask} maxLength={650} onChange={e=>setAsk(e.target.value)} placeholder="Why does this use hip pitch?"/>
        <QcButton disabled={!ask.trim()||asking} pending={asking} variant="secondary" onClick={explain}>Ask</QcButton></div>
       {answer&&<p className="pa-answer" role="status">{answer}</p>}
      </div>
      <div className="pa-test"><QcButton variant="ghost" onClick={()=>setTestOpen(v=>!v)}>{testOpen?'Close calculation tester':'Test this component'} <QcIcon name="chevron"/></QcButton>
       {testOpen&&<ComponentTestPanel currency={currency} measurementSystem={measurementSystem} draft={{name:editor.name,measurementType:editor.measurementType,
        materialRate:String(editor.materialRate??''),labourRate:String(editor.labourRate??''),wasteType:editor.wasteKind==='unknown'?'none':editor.wasteKind,
        wasteAmount:String(editor.wasteValue??0),pitchType:editor.pitchType,strategy:editor.pricingStrategy,packPrice:String(editor.packPrice??''),packSize:String(editor.packSize??''),
        packCoverage:'',heightMm:'',depthMm:'',timeUnit:'hr',soldBy:editor.soldBy??'area',coverWidthMm:String(editor.coverWidthMm??''),
        quantitySpacingM:String(editor.quantitySpacingM??''),quantitySpacingAllowance:String(editor.spacingAllowancePercent),quantitySpacingRoundUp:editor.spacingRoundUp,
        unitsPerAreaEnabled:editor.unitsPerAreaEnabled,unitsPerAreaM2:String(editor.unitsPerArea??'')}}/>}
      </div>
      {validateForConfirmation({...reviewed.draft_data,...editor}).length>0&&<p className="pa-warnings">{validateForConfirmation({...reviewed.draft_data,...editor})[0]}</p>}
      <label className="pa-check"><input type="checkbox" checked={verified} onChange={e=>setVerified(e.target.checked)}/> I have checked this component's rates, measurement, pitch and waste rules.</label>
      <div className="pa-actions">
       <QcButton variant="ghost" onClick={()=>setReviewIndex(v=>Math.max(0,v-1))} disabled={busy||hasUnsavedChanges||reviewIndex===0}>Previous</QcButton>
       <QcButton variant="ghost" disabled={busy} pending={busy} onClick={()=>reviewAction(false)}>Save draft</QcButton>
       <QcButton variant="primary" disabled={busy||!verified||validateForConfirmation({...reviewed.draft_data,...editor}).length>0} pending={busy} onClick={()=>reviewAction(true)}>Confirm component <QcIcon name="check"/></QcButton>
       <QcButton variant="secondary" disabled={busy||hasUnsavedChanges||reviewIndex>=ordered.length-1} onClick={()=>setReviewIndex(v=>v+1)}>Next <QcIcon name="arrow"/></QcButton>
      </div>
     </div>
    </>}
    {phase==='review'&&<div className="pa-save"><div><h3>3. Save approved components</h3><p>{fullyConfirmed} of {ordered.length} confirmed. Only confirmed items can be saved. {isPracticeSession?'Even confirmed examples remain PRACTICE until their real costs are verified in My Pricing Library.':'Unfinished drafts stay here for later.'}</p></div>
      {isStarterSession?<div className="pa-destination-note"><strong>One library per roofing system</strong><p>Confirmed components will be added to new, separate libraries named for each selected roofing system. You can edit them normally in My Pricing Library.</p></div>:<div className="pa-library"><label htmlFor="pa-collection">Destination library</label><QcSelect id="pa-collection" value={selectedLibrary} onChange={e=>setSelectedLibrary(e.target.value)}><option value="">Choose a library</option>{libraries.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</QcSelect>
       <div className="pa-add-library"><QcInput aria-label="New library name" placeholder="Or create a new library" value={newLibrary} onChange={e=>setNewLibrary(e.target.value)}/><QcButton variant="secondary" disabled={addingLibrary||!newLibrary.trim()} onClick={addLibrary}>Create</QcButton></div>
      </div>}
      <QcButton variant="primary" disabled={busy||hasUnsavedChanges||fullyConfirmed===0||(!isStarterSession&&!selectedLibrary)} pending={busy} onClick={saveAll}>Save {fullyConfirmed} approved components <QcIcon name="check"/></QcButton>
      <QcButton variant="ghost" disabled={hasUnsavedChanges} onClick={()=>setPhase('choose')}>Back to item selection</QcButton>
     </div>}
    {phase==='done'&&<div className="pa-done"><h3>{savedCount} components saved to My Pricing Library</h3><p>{isPracticeSession?'These components use PRACTICE PRICES. You can test them on a quote, but the application blocks customer sending. Edit and verify each component using your actual costs, then create a fresh quote for customers.':'You can now use your verified pricing in a quote. Double-check current costs, measurements, tax and margins before sending.'}</p>
      <div className="pa-actions"><Link href={`/${workspaceSlug}/quotes/new`} className="qc-button" data-qc-variant="primary" data-qc-size="md">Create my first quote <QcIcon name="arrow"/></Link>
       <Link href={savedDestination?`/${workspaceSlug}/components?collection=${savedDestination}`:`/${workspaceSlug}/components`} className="qc-button" data-qc-variant="secondary" data-qc-size="md">Open My Pricing Library</Link>
       {remaining.length>0&&<QcButton onClick={()=>{setPhase('choose');setChosen([]);}}>Review remaining items</QcButton>}
      </div></div>}
  </section>}
 </main>;
}
