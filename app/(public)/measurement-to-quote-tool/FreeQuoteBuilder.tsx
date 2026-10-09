'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import Link from 'next/link';
import type {MeasureMode} from './types';
import {type Job,type Trade,type Spec,type Units,type Currency,TRADE_COPY,CONFIGS,newJob,exampleJob,calculateJob,convertJob,restoreJob,DRAFT_KEY,componentLimit} from './measurement-model';
import {TradeEntry,Setup} from './MeasurementSetup';
import {MeasurementWorkspace} from './MeasurementWorkspace';
import {MeasurementReport} from './MeasurementReport';
import {MeasurementComponentEditor} from './MeasurementComponentEditor';
import {MeasurementCsvImport} from './MeasurementCsvImport';
import {Button,Icon,StepBar,Notice,darkClass} from './MeasurementUI';
import {trackFreeToolEvent} from '../lib/trackFreeToolEvent';
import s from '../free-roof-takeoff/TakeoffExperience.module.css';
import m from './MeasurementPricing.module.css';
/** Existing public route owner. Shared component library lives with digital
 * takeoffs; this component never imports or mounts a drawing workspace. */
export default function FreeQuoteBuilder({initialMode,initialTrade}:{initialMode?:MeasureMode;initialTrade?:Trade}){
 const [job,setJob]=useState<Job|null>(()=>initialTrade?newJob(initialTrade,'metric',initialMode??'actual'):null),[phase,setPhase]=useState<'setup'|'measure'|'report'>('setup');
 const [resume,setResume]=useState<Job|null>(null),[ready,setReady]=useState(false),[storageError,setStorageError]=useState(false);
 const [notice,setNotice]=useState(''),[undo,setUndo]=useState<{job:Job;label:string}|null>(null),[editing,setEditing]=useState<Spec|null|undefined>(undefined),[csv,setCsv]=useState(false);
 const result=useMemo(()=>job?calculateJob(job):null,[job]);const focusRef=useRef<HTMLDivElement>(null),hasMoved=useRef(false);
 // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-only restore of the sessionStorage tab draft (external system); not derivable during render
 useEffect(()=>{try{const raw=sessionStorage.getItem(DRAFT_KEY);if(raw){const restored=restoreJob(raw);if(restored)setResume(restored);else setNotice('A previous tab draft could not be restored safely. Start a new estimate; no account data was changed.');}}catch{setStorageError(true);}setReady(true);},[]);
 useEffect(()=>{if(!ready||!job||resume)return;const timer=setTimeout(()=>{try{sessionStorage.setItem(DRAFT_KEY,JSON.stringify(job));setStorageError(false);}catch{setStorageError(true);}},300);return()=>clearTimeout(timer);},[ready,job,resume]);
 useEffect(()=>{if(!result?.entryCount)return;const handler=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};window.addEventListener('beforeunload',handler);return()=>window.removeEventListener('beforeunload',handler);},[result?.entryCount]);
 useEffect(()=>{if(!hasMoved.current){hasMoved.current=true;return;}focusRef.current?.focus({preventScroll:true});focusRef.current?.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});},[phase,job?.trade]);
 function notify(text:string){setNotice(text);}
 function change(next:Job,undoLabel?:string){if(undoLabel&&job)setUndo({job,label:undoLabel});else setUndo(null);setJob(next);setResume(null);if(!undoLabel)setNotice('');}
 function choose(trade:Trade){if(resume&&!window.confirm('Start a new estimate instead of the one kept in this tab?'))return;setResume(null);setJob(newJob(trade,'metric',initialMode??'actual'));setPhase('setup');setNotice('');setUndo(null);}
 function changeTrade(){if(job&&(result?.entryCount||job.choice==='custom'||job.areas.length>1)&&!window.confirm('Start a new trade? This clears the current estimate and component edits from this tab. Export your results first if you need them.'))return;setJob(null);setResume(null);setUndo(null);setPhase('setup');setNotice('');try{sessionStorage.removeItem(DRAFT_KEY);}catch{/* browser may disallow storage */}}
 function example(){if(!job)return;if((result?.entryCount||job.choice==='custom'||job.areas.length>1)&&!window.confirm('Replace this estimate with a filled example? All example rates are fictitious.'))return;change(exampleJob(job.trade,job.units,job.currency));setPhase('measure');notify('Loaded a practice job with fictitious prices. Edit it freely, or start a new job.');}
 function removeSpec(c:Spec){if(!job)return;if(job.areas.some(a=>a.components.some(ac=>ac.componentId===c.id))){notify(`${c.name} is used in an area. Remove it from those areas before removing it from the library.`);return;}change({...job,components:job.components.filter(x=>x.id!==c.id)},`Removed ${c.name} from the library`);}
 function saveSpec(c:Spec){if(!job)return;const exists=job.components.some(x=>x.id===c.id);if(!exists&&job.components.length>=componentLimit(CONFIGS[job.trade])){notify('Remove an unused component before adding another.');return;}change({...job,choice:'custom',components:exists?job.components.map(x=>x.id===c.id?c:x):[...job.components,c]});setEditing(undefined);}
 function goMeasure(){setPhase('measure');setNotice('');}
 function goReport(){if(!result?.valid){notify('Add a valid measurement and correct any errors first.');return;}setPhase('report');setNotice('');trackFreeToolEvent('result',{trade:job!.trade,areas:job!.areas.length});}
 return <main className={`${s.root} ${m.root}`}><div className={m.page} ref={focusRef} tabIndex={-1}>
 <nav className={m.breadcrumb} aria-label="Breadcrumb"><Link href="/free-tools">Free tools</Link><Icon name="chevron"/><span>Measurements to pricing</span>{job&&<><Icon name="chevron"/><span>{TRADE_COPY[job.trade].name}</span></>}</nav>
 {job&&<><header className={`${m.toolHeader} ${darkClass}`}><div><p className={m.eyebrow}>FREE MEASUREMENTS TO PRICING <span>{TRADE_COPY[job.trade].name}</span></p><h1>{phase==='setup'?'A familiar start. Your own measurements.':phase==='measure'?'You measure. Components do the maths.':'From measured work to your next quote.'}</h1><p>{phase==='measure'?TRADE_COPY[job.trade].hint:'The same Smart Components as digital takeoff, without needing a plan.'}</p></div><Button onClick={changeTrade}><Icon name="back"/> Start a new job</Button></header><div className={m.progressBar}><StepBar step={phase} onSetup={()=>setPhase('setup')} onMeasure={goMeasure} canMeasure={!!job.components.length}/><div className={m.progressMeta}><span>{job.units==='metric'?'Metric':job.units==='imperial'?'Imperial':'Roofing squares'} · {job.currency}</span>{phase!=='setup'&&<Button quiet onClick={()=>setPhase('setup')}><Icon name="edit"/> Setup &amp; rates</Button>}</div></div></>}
 {notice&&<div className={m.feedback} role="status"><span>{notice}</span><button type="button" aria-label="Dismiss message" onClick={()=>setNotice('')}><Icon name="close"/></button></div>}
 {undo&&<div className={m.undo} role="status"><span>{undo.label}.</span><Button onClick={()=>{setJob(undo.job);setUndo(null);setNotice('Restored.');}}>Undo</Button><small>Available until your next edit.</small></div>}
 {storageError&&<Notice>Browser storage is unavailable. Keep this page open until you export; a refresh may lose your work.</Notice>}
 {job&&resume&&<div className={m.resume}><p>A previous estimate is still in this tab.</p><Button onClick={()=>setResume(null)}>Start fresh</Button><Button primary onClick={()=>{setJob(resume);setResume(null);setPhase('measure');}}>Resume estimate</Button></div>}
 {!job?<TradeEntry onChoose={choose} resume={resume} onResume={()=>{if(resume){setJob(resume);setPhase(resume.areas.some(a=>a.components.length)?'measure':'setup');setResume(null);}}} onDiscard={()=>{setResume(null);try{sessionStorage.removeItem(DRAFT_KEY);}catch{setStorageError(true);}}}/>:
 phase==='setup'?<Setup job={job} onChangeUnits={(u:Units)=>{change(convertJob(job,u));notify('Measurements and dimensional rates have been converted, not relabelled.');}} onChangeCurrency={(currency:Currency)=>{if(job.components.some(c=>c.pricingOrigin==='user')&&!window.confirm(`Change the label to ${currency}? This does not convert currency amounts. Recheck your rates.`))return;change({...job,currency});}} onChoice={choice=>{change({...job,choice});if(choice==='examples'&&job.choice==='custom')notify('Your component edits are kept. This choice does not overwrite your library.');}} onEdit={setEditing} onAdd={()=>setEditing(null)} onDelete={removeSpec} onImport={()=>setCsv(true)} onContinue={goMeasure} onExample={example} onTrade={changeTrade}/>:
 phase==='measure'?<MeasurementWorkspace job={job} result={result!} onChange={change} onEditComponent={setEditing} onLibrary={()=>{setPhase('setup');change({...job,choice:'custom'});}} onReview={goReport} onNotify={notify}/>:
 <MeasurementReport job={job} result={result!} onBack={goMeasure} onChange={change} onNotify={notify} onTrack={action=>trackFreeToolEvent(action,{trade:job.trade})}/>}
 {job&&<footer className={m.toolFooter}><span><Icon name="info"/> This tab keeps your draft. The paid app saves your library and jobs.</span><a href={TRADE_COPY[job.trade].digital}>Need to measure a plan instead? <Icon name="arrow"/></a></footer>}
 {job&&editing!==undefined&&<MeasurementComponentEditor initial={editing} job={job} onSave={saveSpec} onClose={()=>setEditing(undefined)}/>}
 {job&&csv&&<MeasurementCsvImport job={job} onClose={()=>setCsv(false)} onSave={specs=>{change({...job,choice:'custom',components:[...job.components,...specs]});setCsv(false);notify(`Added ${specs.length} CSV components. Review their waste and pack rules before measuring.`);}}/>}
 </div></main>;
}
