'use client';

import { useRef, useState, type FormEvent } from 'react';
import styles from './JobDemo.module.css';

type Step = 0 | 1 | 2 | 3;
const headings = [
  ['How did you get the measurements?', 'Choose what best describes the job you have already quoted.'],
  ['Share what you used for the job.', 'Upload your final quote, original measurements, plans or any photos. Or just type what you have.'],
  ['How did you build the quote?', 'A short explanation and rough time estimate helps us make the video relevant.'],
  ['Where should we send the video?', 'We will reply if anything important is missing. Otherwise, we will send you your recording.'],
] as const;
const durations = ['About 10 minutes','10 to 20 minutes','20 to 30 minutes','30 to 40 minutes','40 minutes to 1 hour','Over 1 hour'];
const MAX_TOTAL = 10 * 1024 * 1024;
const MAX_FILES = 8;
export function JobDemoInquiryForm() {
  const [step,setStep] = useState<Step>(0);
  const [measurementFlow,setMeasurementFlow] = useState<'measured' | 'provided' | ''>('');
  const [method,setMethod] = useState('');
  const [measurements,setMeasurements] = useState('');
  const [address,setAddress] = useState('');
  const [pricingProcess,setPricingProcess] = useState('');
  const [duration,setDuration] = useState('');
  const [name,setName] = useState('');
  const [email,setEmail] = useState('');
  const [consent,setConsent] = useState(false);
  const [files,setFiles] = useState<File[]>([]);
  const [error,setError] = useState('');
  const [pending,setPending] = useState(false);
  const [sent,setSent] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  function go(next:Step) { setError(''); setStep(next); requestAnimationFrame(()=>headingRef.current?.focus({preventScroll:true})); }
  function fileError(chosen:File[]) {
    if (chosen.length > MAX_FILES || chosen.reduce((n,f)=>n+f.size,0) > MAX_TOTAL) return 'Choose up to eight files, 10 MB total. If you have more files, we can arrange a secure transfer after you enquire.';
    return '';
  }
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || sent) return;
    const fileProblem=fileError(files);
    if (fileProblem) { go(1); setError(fileProblem); return; }
    if (files.length===0 && !measurements.trim() && !pricingProcess.trim()) { go(1); setError('Add at least one file or a few details about the job so we know what to demonstrate.'); return; }
    if (!name.trim() || !/^\S+@\S+\.\S+$/.test(email.trim()) || !consent) { setError('Enter your name and valid email, then confirm you have permission to share the details.'); return; }
    setPending(true); setError('');
    try {
      const data=new FormData();
      for (const [key,value] of Object.entries({measurementFlow,method,measurements,address,pricingProcess,duration,name,email,consent:consent?'yes':'no'})) data.set(key,value);
      files.forEach(file=>data.append('files',file));
      const response=await fetch('/api/job-demo-inquiry',{method:'POST',body:data});
      const result:{error?:string}=await response.json().catch(()=>({}));
      if (!response.ok) throw new Error(result.error||'Unable to send your job. Please try again.');
      setSent(true);
    } catch (err) { setError(err instanceof Error?err.message:'Unable to send your job.'); }
    finally { setPending(false); }
  }
  if (sent) return <div className={styles.formShell}><div className={styles.success} role="status"><p className={styles.lightEyebrow}>JOB RECEIVED</p><h3>Thanks, {name.trim().split(' ')[0]}.</h3><p>We’ll review what you sent. If anything is missing, we’ll email you. Otherwise, we’ll send your personalized recording when it’s ready.</p></div></div>;
  return <div className={styles.formShell}>
    <div className={styles.progress} aria-label={`Step ${step+1} of 4`}>{headings.map((_,i)=><span key={i} className={i<=step?styles.progressActive:''}/>)}</div>
    <div className={styles.formHeading}><span className={styles.stepNum}>0{step+1} / 04</span><h3 tabIndex={-1} ref={headingRef}>{headings[step][0]}</h3><p>{headings[step][1]}</p></div>
    <form onSubmit={submit}>
      {step===0 && <>
        <fieldset className={styles.fieldset}><legend>How were the measurements obtained?</legend><div className={styles.choices}>
          <label className={styles.choice}><input type="radio" name="measurementFlow" checked={measurementFlow==='measured'} onChange={()=>{setMeasurementFlow('measured');setMethod('');}}/><span><strong>I measured the job myself</strong><small>On site, with satellite imagery or using a plan.</small></span></label>
          <label className={styles.choice}><input type="radio" name="measurementFlow" checked={measurementFlow==='provided'} onChange={()=>{setMeasurementFlow('provided');setMethod('');}}/><span><strong>I was given the measurements</strong><small>From a customer, builder, surveyor or another contractor.</small></span></label>
        </div></fieldset>
        {measurementFlow && <div className={styles.fieldGroup} style={{marginTop:23}}><label className={styles.label} htmlFor="job-method">{measurementFlow==='measured'?'How did you measure it?':'Where did the measurements come from?'} <small>(Optional)</small></label><select className={styles.select} id="job-method" value={method} onChange={e=>setMethod(e.target.value)}><option value="">Select an option</option>{(measurementFlow==='measured'?['Site measurement','Satellite or aerial image','Blueprints or roof plan','Combination of methods','Another method']:['Customer or homeowner','Builder or architect','Surveyor or contractor','Existing takeoff','Another source']).map(x=><option key={x} value={x}>{x}</option>)}</select></div>}
        <p className={styles.hint}>You can skip this and just send the original files if that's easier.</p>
      </>}
      {step===1 && <>
        <div className={styles.fieldGroup}><label className={styles.label} htmlFor="job-demo-files">Job documents or images <small>(Optional)</small></label><label className={styles.fileBox} htmlFor="job-demo-files"><strong>Choose files or take a photo</strong><small>Original customer quote, roof plan, site sketch, handwritten measurements, price breakdown or satellite screenshot.</small><small>Up to 8 files, 10 MB total. PDF, XLSX, CSV, JPG, PNG, WebP or TXT.</small></label><input className={styles.fileInput} type="file" multiple id="job-demo-files" accept=".pdf,.xlsx,.csv,.txt,.jpg,.jpeg,.png,.webp" onChange={e=>{const chosen=Array.from(e.currentTarget.files||[]);setFiles(chosen);setError(fileError(chosen));}}/>{files.length>0&&<p className={styles.fileNames}>{files.length} selected: {files.map(f=>f.name).join(', ')}</p>}</div>
        <div className={styles.fieldGroup}><label className={styles.label} htmlFor="job-demo-measurements">Or describe your measurements <small>(Optional)</small></label><textarea id="job-demo-measurements" className={styles.textarea} rows={4} value={measurements} onChange={e=>setMeasurements(e.target.value)} placeholder="For example: Two roof faces, 140 m², ridge 11 m, 25° pitch. I measured from a site sketch."/></div>
        <div className={styles.fieldGroup}><label className={styles.label} htmlFor="job-demo-address">Job address or area <small>(Optional)</small></label><input id="job-demo-address" className={styles.input} value={address} onChange={e=>setAddress(e.target.value)} placeholder="Street address or general area if you prefer"/><p className={styles.hint}>Only if you're comfortable sharing it. It may help us understand the roof.</p></div>
      </>}
      {step===2 && <>
        <div className={styles.fieldGroup}><label className={styles.label} htmlFor="job-demo-pricing">How did you work out and send the quote? <small>(Optional)</small></label><textarea id="job-demo-pricing" className={styles.textarea} rows={4} value={pricingProcess} onChange={e=>setPricingProcess(e.target.value)} placeholder="For example: I transferred the measurements to a spreadsheet, added materials and labour, then emailed the PDF."/></div>
        <fieldset className={styles.fieldset}><legend>Roughly how long did everything take? (Optional)</legend><div className={styles.timing}>{durations.map(value=><label key={value}><input type="radio" name="duration" value={value} checked={duration===value} onChange={()=>setDuration(value)}/>{value}</label>)}</div></fieldset>
        <p className={styles.hint}>From starting the measurements or receiving them, to sending the customer the final quote.</p>
      </>}
      {step===3 && <>
        <div className={styles.contactGrid}><div className={styles.fieldGroup}><label className={styles.label} htmlFor="job-demo-name">Your name *</label><input className={styles.input} id="job-demo-name" autoComplete="name" required value={name} onChange={e=>setName(e.target.value)} /></div><div className={styles.fieldGroup}><label className={styles.label} htmlFor="job-demo-email">Email address *</label><input className={styles.input} id="job-demo-email" autoComplete="email" type="email" required value={email} onChange={e=>setEmail(e.target.value)} /></div></div>
        <label className={styles.consent}><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)} required/><span className={styles.consentText}>I have permission to share these documents and understand<span className={styles.consentNote}>QuoteCore+ will review them to prepare a personalized demonstration. *</span></span></label>
        <p className={styles.hint}>You can remove customer names and other private details before uploading. No payment or call is required.</p>
      </>}
      {error && <p className={styles.error} role="alert">{error}</p>}
      <div className={styles.actions}>
        {step>0&&<button type="button" className={styles.secondary} disabled={pending} onClick={()=>go((step-1) as Step)}>Back</button>}
        {step<3?<button type="button" className={styles.primary} onClick={()=>{if (step===1&&fileError(files)) {setError(fileError(files));return;} go((step+1) as Step);}}>Continue <span aria-hidden="true">→</span></button>:<button type="submit" className={styles.primary} disabled={pending||!name.trim()||!email.trim()||!consent}>{pending?'Sending…':'Send my job'} <span aria-hidden="true">→</span></button>}
      </div>
    </form>
  </div>;
}
