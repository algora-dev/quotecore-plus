'use client';
import { useEffect, useRef, useState } from 'react';
import { type DocumentConfig, type ParsedDocument } from './document-model';
import { DocumentServiceError, type DocumentServices } from './document-services';
import { rasterize } from './document-media';
import { Button, Dialog } from './ui';
import { Icon } from './Icon';
import s from './DocumentGenerator.module.css';
export interface AssistInput {mode:'text'|'image';text:string;image:string;filename:string;}
export function DocumentAssist({config,services,onClose,onApply,hasExisting,initial,onInputState,aiPerDay,onIncrease}: {config:DocumentConfig;services:DocumentServices;onClose:()=>void;onApply:(p:ParsedDocument,mode:'replace'|'append',example?:boolean)=>void;hasExisting:boolean;initial?:AssistInput;onInputState?:(state:AssistInput)=>void;aiPerDay:number;onIncrease?:()=>void}) {
  const [mode,setMode]=useState<'text'|'image'>(initial?.mode??'text'),[text,setText]=useState(initial?.text??''),[image,setImage]=useState(initial?.image??''),[filename,setFilename]=useState(initial?.filename??'');
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[result,setResult]=useState<ParsedDocument|null>(null),[example,setExample]=useState(false);
  const [quota,setQuota]=useState(false);
  useEffect(()=>{onInputState?.({mode,text,image,filename});},[mode,text,image,filename,onInputState]);
  const [over,setOver]=useState(false);const fileRef=useRef<HTMLInputElement>(null),controller=useRef<AbortController|null>(null),mounted=useRef(true),requestLock=useRef(false);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;controller.current?.abort();};},[]);
  async function choose(file?:File){if(!file||busy)return;setBusy(true);setError('');try{const url=await rasterize(file,'scan');if(mounted.current){setImage(url);setFilename(file.name);setResult(null);}}
    catch(e){if(mounted.current)setError(e instanceof Error?e.message:'The image could not be opened.');}finally{if(mounted.current)setBusy(false);}}
  async function extract(){
    if(requestLock.current)return;
    requestLock.current=true;setBusy(true);setError('');setQuota(false);controller.current=new AbortController();
    const timeout=setTimeout(()=>controller.current?.abort(),60000);
    try{const data=await services.parse(config.kind,mode==='text'?{mode:'text',content:text}:{mode:'image',image,imageMime:'image/jpeg'},controller.current.signal);
      if(mounted.current){setResult(data);setExample(services.preview);}}
    catch(e){if(mounted.current){setQuota(e instanceof DocumentServiceError&&e.status===429);setError(e instanceof Error&&e.name==='AbortError'?'That took too long. Your quote has not changed. Try again or enter the items manually.':e instanceof Error?e.message:'Unable to read the document.');}}
    finally{clearTimeout(timeout);requestLock.current=false;if(mounted.current)setBusy(false);}
  }
  return <Dialog title={result?'Check before adding.':'A head start, not a black box.'} eyebrow="OPTIONAL · QUOTE ASSIST" onClose={onClose} tone="focus">
    {!result?<>
      <p className={s.dialogIntro}>Describe the job or upload an existing quote. Review what’s found before anything is added.</p>
      <p className={s.assistAllowance}><Icon name="spark"/>{aiPerDay} AI draft{aiPerDay===1?'':'s'} per day · shared across text and photos</p>
      <div className={s.segment} role="group" aria-label="Import method"><button type="button" aria-pressed={mode==='text'} onClick={()=>{setMode('text');setError('');}} disabled={busy}><Icon name="message"/>Describe or paste</button><button type="button" aria-pressed={mode==='image'} onClick={()=>{setMode('image');setError('');}} disabled={busy}><Icon name="image"/>Upload a photo</button></div>
      {mode==='text'?<div className={s.field}><label htmlFor="assist-text">What needs quoting?</label><textarea id="assist-text" rows={6} maxLength={20000} value={text} onChange={e=>setText(e.target.value)} disabled={busy} placeholder="For Alex at 24 Oak Street: 120 m² of roofing at 48 per m², 24 m of flashing at 22.50 per m, plus 280 for waste removal. Valid for 30 days."/><p className={s.hint}>Include quantities and prices you know. You can edit every detail afterwards.</p></div>:
        <div className={`${s.dropzone} ${over?s.dragOver:''}`} onDragOver={e=>{e.preventDefault();setOver(true);}} onDragLeave={()=>setOver(false)} onDrop={e=>{e.preventDefault();setOver(false);void choose(e.dataTransfer.files[0]);}}>
          {image?<img src={image} alt="Selected quote, not yet sent"/>:<Icon name="upload"/>}<strong>{filename||'Drop a quote photo here'}</strong><span>PNG, JPEG or WebP · up to 10MB</span><Button icon="image" onClick={()=>fileRef.current?.click()} disabled={busy}>{image?'Choose a different photo':'Choose a photo'}</Button>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" aria-label="Choose a quote image" hidden onChange={e=>{void choose(e.target.files?.[0]);e.target.value='';}}/>
        </div>}
      <p className={s.privacyLine}><Icon name="lock"/>{services.preview?'Offline preview: your input stays here. Extraction returns a fixed, labelled sample, not live AI.': 'Only when you press Extract, your text or photo is sent to the existing AI processing service. Always check the result.'}</p>
      {error&&<div role="alert" className={s.errorBox}><p>{error}</p>{quota&&onIncrease&&<Button onClick={onIncrease}>Increase AI allowance — free</Button>}</div>}
      <div className={s.dialogActions}>{services.preview&&<Button disabled={busy} onClick={()=>{setMode('text');setText('For Alex Morgan: 120 m² of roofing at 48 per m², 24 m of flashing at 22.50, and 280 for waste removal.');}}>Use example text</Button>}<Button variant="primary" icon="spark" pending={busy} disabled={mode==='text'?!text.trim():!image} onClick={()=>void extract()}>{busy?'Reading your quote…':services.preview?'Preview extraction (sample)':'Extract quote details'}</Button></div>
    </>:<>
      <div className={s.notice}><Icon name="shield"/><div><strong>{example?'Example extraction — not live AI':`${result.lines.length} items found · ${result.confidence||'unknown'} confidence`}</strong><p>Nothing has changed in your quote yet.</p></div></div>
      {result.clientName&&<p className={s.hint}>Customer: {result.clientName}</p>}
      <div className={s.extractedItems}>{result.lines.map((l,i)=><div key={i}><strong>{l.description||'No description'}</strong><span>{l.qty} {l.unit} × {l.rate}</span></div>)}</div>
      {result.warnings?.length ? <ul className={s.warningList}>{result.warnings.map((w,i)=><li key={i}>{w}</li>)}</ul>:null}
      <p className={s.hint}>{hasExisting?'“Replace details & items” replaces your current items and the details found above. “Add items only” keeps your existing details.':'You’ll return to the editor to check details, units, prices and tax.'}</p>
      <div className={s.dialogActions}><Button onClick={()=>setResult(null)}>Back</Button>{hasExisting&&<Button onClick={()=>onApply(result,'append',example)}>Add items only</Button>}<Button variant="primary" icon="check" onClick={()=>onApply(result,'replace',example)}>{hasExisting?'Replace details & items':'Use these details'}</Button></div>
    </>}
  </Dialog>;
}
