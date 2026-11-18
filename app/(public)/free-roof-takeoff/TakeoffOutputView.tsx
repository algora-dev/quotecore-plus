'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import type {TakeoffFinishPayload} from '@/app/lib/takeoff/finishPayload';
import type {TakeoffUnitSystem,TakeoffComponentSpec,TakeoffTradeConfig} from './tradeConfig';
import {buildReport,reportCsv,type TakeoffTrade} from './takeoff-report-model';
import type {TakeoffCurrency} from './takeoff-examples';
import {Button,ActionLink,Dialog,Icon} from './TakeoffUI';
import {printTakeoffReport} from './takeoff-print';
import s from './TakeoffExperience.module.css';
import {WorkspaceUpsellModal} from '../shared/WorkspaceUpsellModal';
export type {TakeoffTrade} from './takeoff-report-model';
export interface TakeoffOutputExtras {planDataUrl:string;elapsedMs:number;}
const number=(n:number)=>n.toLocaleString(undefined,{maximumFractionDigits:2,minimumFractionDigits:0});
const money=(n:number,currency:string)=>new Intl.NumberFormat('en-NZ',{style:'currency',currency,currencyDisplay:'code'}).format(n);
const WS_UPSELL:Record<TakeoffTrade,{slug:string;eyebrow:string;headline:string;blurb:string;signupHref:string}>={
 roofing:{slug:'free-roof-takeoff',eyebrow:'Your roofing takeoff is ready',headline:'Same tool. More power. Free.',blurb:'In your Free Workspace you get access to more features, like AI Scan Assist: the faster way to draw your roof outline and internal components.',signupHref:'/signup?ref=free-roof-takeoff'},
 flooring:{slug:'free-flooring-takeoff',eyebrow:'Your flooring takeoff is ready',headline:'Same tool. More power. Free.',blurb:'In your Free Workspace you get access to more features, like AI Scan Assist: the faster way to draw your floor areas and internal components.',signupHref:'/signup?ref=free-flooring-takeoff'},
 cladding:{slug:'free-cladding-takeoff',eyebrow:'Your wall and cladding takeoff is ready',headline:'Same tool. More power. Free.',blurb:'In your Free Workspace you get access to more features, like AI Scan Assist: the faster way to draw your wall areas and internal components.',signupHref:'/signup?ref=free-cladding-takeoff'},
};
const WS_FEATURES=['Save your pricing to reuse on all your jobs','Turn measurements into quotes in a few clicks','Create quotes, invoices and material orders','See when customers open, accept or decline your quote, so you follow up on time','Upload photos or files and AI extracts the measurements, quantities and pricing'];
export function TakeoffOutputView({payload,extras,unitSystem='metric',specs=[],trade='roofing',reportNote=null,currency='NZD',tutorial,onRestart,onBackToCanvas}:{
 payload:TakeoffFinishPayload;extras:TakeoffOutputExtras;unitSystem?:TakeoffUnitSystem;specs?:TakeoffComponentSpec[];trade?:TakeoffTrade;reportNote?:string|null;
 currency?:TakeoffCurrency;tutorial?:TakeoffTradeConfig['tutorial'];onRestart:()=>void;onBackToCanvas:()=>void;onOpenQuote?:(url:string)=>void;
}){
 const report=useMemo(()=>buildReport(payload,specs,unitSystem,trade,currency),[payload,specs,unitSystem,trade,currency]);
 const upsell=WS_UPSELL[trade];
 const paper=useRef<HTMLDivElement>(null);const [showPlan,setShowPlan]=useState(false),[notice,setNotice]=useState(''),[confirmNew,setConfirmNew]=useState(false);
 const hasWork=report.components.length>0||report.areas.length>0;
 const heading=useRef<HTMLHeadingElement>(null);useEffect(()=>{heading.current?.focus({preventScroll:true});},[]);
 const tradeTitle=trade[0].toUpperCase()+trade.slice(1),areaNoun=trade==='roofing'?'Roof':trade==='cladding'?'Wall':'Floor';
 function download(){try{const url=URL.createObjectURL(new Blob([reportCsv(report)],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`QuoteCore-${trade}-takeoff.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setNotice('CSV download requested. Check your browser’s downloads.');}catch{setNotice('The browser blocked the download. Try Print / Save PDF.');}}
 function print(){if(paper.current&&!printTakeoffReport(paper.current))setNotice('Your browser blocked the print window. Allow pop-ups for this page and try again.');}
 return <div className={`${s.root} ${s.page}`} onKeyDown={e=>e.stopPropagation()} onKeyUp={e=>e.stopPropagation()} data-takeoff-output>
  <div className={s.container}><div className={s.crumb}><span>Digital takeoff</span><span>/</span><span>{tradeTitle}</span><span>/</span><span>Results</span></div>
   <div className={s.outputTitle}><div><p className={s.eyebrow}>Measurement complete</p><h2 ref={heading} tabIndex={-1}>Your {trade} takeoff, ready.</h2><p>Check your quantities and download the report.</p></div><div className={s.outputActions}><Button onClick={onBackToCanvas}><Icon name="back"/>Back to measurements</Button></div></div>
   {notice&&<div className={`${s.notice} ${s.info}`} role="status">{notice}</div>}
   {report.issues.length>0&&<div className={s.error} role="alert"><strong>Review before creating a quote</strong><ul>{report.issues.map(i=><li key={i}>{i}</li>)}</ul></div>}
   <div className={s.resultGrid}><div>
    <div className={s.stats}><div className={s.stat}><span>{trade==='roofing'?'Roof surface':'Measured area'}</span><strong>{number(report.surfaceArea)} <small>{report.areaUnit}</small></strong><small>{trade==='roofing'?'Pitch adjusted · before waste':'As drawn · before waste'}</small></div>
      <div className={s.stat}><span>Components used</span><strong>{report.components.length}</strong><small>{report.components.reduce((n,c)=>n+c.entries.length,0)} measured entries</small></div>
      <div className={s.stat}><span>{report.hasExamples?'Example estimate':'Estimated cost'}</span><strong>{report.hasPrices?number(report.total):'–'}</strong><small>{currency} · before tax</small></div></div>
    {report.hasExamples&&<div className={s.notice}><Icon name="info"/><p><strong>Example prices are included.</strong> These figures teach the workflow; they are not market rates or a customer-ready quote.</p></div>}
    <div ref={paper} className={`${s.root} ${s.paper}`} data-takeoff-paper>
      <div className={s.paperHeader}><div><h2>{tradeTitle} takeoff report</h2><p>{new Date().toLocaleDateString('en-NZ',{day:'numeric',month:'long',year:'numeric'})} · {unitSystem==='squares'?'Roofing squares / feet':unitSystem==='imperial'?'Imperial':'Metric'} · {currency}</p></div><div className={s.paperMark}>QuoteCore<span>+</span></div></div>
      {report.hasExamples&&<div className={s.notice}><strong>EXAMPLE PRICING: replace with your own rates before quoting.</strong></div>}
      {!hasWork&&<div className={s.empty}><Icon name="ruler"/><h3>No measurements yet</h3><p>Return to your plan and add an area, length or counted item.</p><Button onClick={onBackToCanvas} data-print-hide>Back to measurements</Button></div>}
      {report.areas.map(a=><div key={a.id} className={s.areaSummary} data-print-keep><div><strong>{a.name}</strong><small>{areaNoun} outline{trade==='roofing'?` · pitch ${number(a.pitch)}°`:''}</small></div><div><strong>{number(a.surface)} {report.areaUnit}</strong>{trade==='roofing'&&<small>{number(a.plan)} {report.areaUnit} plan</small>}</div></div>)}
      {report.areas.length>0&&report.components.length===0&&<p className={s.help}>Outlines are measured but no priced components are assigned. You can transfer these areas as unpriced quote items.</p>}
      {report.components.map(c=><div className={s.reportGroup} key={c.id} data-print-group>
       <div className={s.reportGroupHead} data-print-keep><div><strong>{c.name}</strong><small>{number(c.raw)} {c.unit} measured{c.pitchApplied?` → ${number(c.pitched)} ${c.unit} pitched`:''}</small><small>{c.wasteLabel}{c.packs!=null?` · ${c.packs} whole packs`:''}</small></div>
        <div className={s.reportGroupValue}><strong>{number(c.quantity)} {c.unit}</strong><small>{c.cost!=null?money(c.cost,currency):'Not priced'}</small>{c.example&&<span className={`${s.chip} ${s.exampleChip}`}>Example rate</span>}</div></div>
       <details><summary>{c.entries.length} {c.entries.length===1?'measurement':'measurements'} · view working</summary><table className={s.entryTable}><thead><tr><th>Area / entry</th><th>Measured</th>{trade==='roofing'&&<th>After pitch</th>}<th>Incl. waste</th></tr></thead><tbody>{c.entries.map((e,i)=><tr key={i}><td>{report.areas.find(a=>a.id===e.areaId)?.name??(e.areaId===null&&report.areas.length===1?report.areas[0].name:'Unassigned')} · {i+1}</td><td>{number(e.raw)} {c.unit}</td>{trade==='roofing'&&<td>{number(e.pitched)} {c.unit}</td>}<td>{number(e.quantity)} {c.unit}</td></tr>)}</tbody></table>
       {c.cost!=null&&<p>Material {money(c.material??0,currency)} + labour {money(c.labour??0,currency)}. {c.packs!=null?'Packs round up once for this component across all areas.':'Rates apply to the quantity including waste.'}</p>}</details>
      </div>)}
      {report.hasPrices&&<div className={s.totals} data-print-keep><p><span>Materials</span><span>{money(report.materials,currency)}</span></p><p><span>Labour</span><span>{money(report.labour,currency)}</span></p><p><span>{report.hasExamples?'Example estimate':'Estimated total'}</span><span>{money(report.total,currency)}</span></p></div>}
      <div className={s.paperNote}><p>Measurement report, not a customer quote. Costs exclude tax and margin. Check scale, quantities and rates before ordering or quoting. {trade==='roofing'?'Roof pitch is applied once using each measurement’s assigned area and component rule. Hip/valley factors use the existing app engine.':'Wall and floor quantities are measured as drawn; no roof-pitch factor is applied.'}</p>{reportNote&&<p>{reportNote}</p>}{report.notes.map(n=><p key={n}>{n}</p>)}{report.issues.map(i=><p key={i}>CHECK REQUIRED: {i}</p>)}</div>
    </div>
    <div className={s.outputFoot}><div className={s.outputActions}><Button onClick={print} disabled={!hasWork}><Icon name="download"/>Print / Save PDF</Button><Button onClick={download} disabled={!hasWork}>Download CSV</Button>{extras.planDataUrl&&<Button quiet onClick={()=>setShowPlan(true)}>View plan</Button>}</div></div>
   </div><aside className={s.resultSidebar}>
    <div className={`${s.nextCard} ${s.dark}`}><p className={s.eyebrow}>Your next step</p><h3>Create your free workspace.</h3><p>Save your pricing and reuse it on every job. Create quotes, invoices and material orders, and see when customers open, accept or decline them. Plus AI features like Scan Assist.</p><ActionLink primary href={upsell.signupHref} data-analytics-action="free_workspace">Create my Free Workspace<Icon name="arrow"/></ActionLink><small>Free · No card · No trial clock</small><small><a href="/" data-analytics-action="learn_more" style={{textDecoration:'underline',textUnderlineOffset:3}}>Learn more about the app</a></small></div>
    {tutorial&&<div><ActionLink href={tutorial.href} target="_blank" rel="noopener noreferrer"><Icon name="play"/>Watch the workflow guide</ActionLink>{tutorial.olderLayout&&<p className={s.help}>The guide shows the earlier layout; the workflow is similar.</p>}</div>}
   </aside></div>
   <div className={s.outputFoot}><Button quiet onClick={()=>setConfirmNew(true)}><Icon name="plus"/>Start a new takeoff</Button><span>Session only. Download your results before closing this page.</span></div>
  </div>
  <WorkspaceUpsellModal slug={upsell.slug} eyebrow={upsell.eyebrow} headline={upsell.headline} blurb={upsell.blurb} features={WS_FEATURES} signupHref={upsell.signupHref}/>
  {showPlan&&<Dialog title="Your source plan" description="Reference image only. Open the measurement workspace to view or edit drawings." onClose={()=>setShowPlan(false)}><img src={extras.planDataUrl} alt="The plan uploaded for this takeoff" style={{width:'100%',display:'block'}}/></Dialog>}
  {confirmNew&&<Dialog title="Start a new takeoff?" description="This clears the current measurement session. Download the report first if you need to keep it." onClose={()=>setConfirmNew(false)} footer={<><Button onClick={()=>setConfirmNew(false)}>Keep this takeoff</Button><Button primary onClick={onRestart}>Start new takeoff</Button></>}><p>Your current components stay available until you choose a different trade or close the page.</p></Dialog>}
 </div>;
}
