'use client';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { calculate, calculateArea, componentPayload, convertSystem, exampleFor, format, initialState, money,
  quoteHref, resetActive, restoreState, resultText, transferToBattens, transferToPricing,
  type CalculatorState, type Tab } from './calculator-model';
import { Dialog, Icon, Segments } from './CalculatorUI';
import { CalculatorDiagram } from './CalculatorDiagrams';
import { profileFor, storageKey, type Trade } from './calculator-profile';
import { CalculatorForms } from './CalculatorForms';

export interface CalculatorServices {
  /** Persists the established smart-component envelope, then returns an app URL.
   * The app must enforce paid entitlement. Never a free-tools entitlement grant. */
  saveComponent?: (state:CalculatorState)=>Promise<string>;
  track?: (event:string,properties:Record<string,string>)=>void;
}
interface Props {trade:Trade;services?:CalculatorServices;preview?:boolean;linkOrigin?:string}
type Confirm = 'example'|'reset'|'pricing'|'battens'|'save'|null;
function downloadBlob(content:string,type:string,name:string){const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function csvCell(text:string){const safe=/^[=+\-@\t\r]/.test(text)?"'"+text:text;return '"'+safe.replace(/"/g,'""')+'"';}
export function TradeCalculator({trade,services={},preview=false,linkOrigin=''}:Props) {
  const profile=profileFor(trade),TABS=profile.tabs,STORAGE_KEY=storageKey(trade);
  const [state,setState]=useState<CalculatorState>(()=>initialState(trade)),[hydrated,setHydrated]=useState(false),[storage,setStorage]=useState<'saved'|'unavailable'|'pending'>('pending');
  const [restored,setRestored]=useState(false),[confirm,setConfirm]=useState<Confirm>(null),[toast,setToast]=useState(''),[copyText,setCopyText]=useState<string|null>(null);
  const [resultVisible,setResultVisible]=useState(false);
  const [saving,setSaving]=useState(false),[saveError,setSaveError]=useState(''),[announcement,setAnnouncement]=useState('');
  const resultsRef=useRef<HTMLElement>(null),currentState=useRef(state),lastToastTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  currentState.current=state;
  useEffect(()=>{try {const saved=restoreState(sessionStorage.getItem(STORAGE_KEY),trade);if(saved){setState(saved);setRestored(true);}}catch{setStorage('unavailable');}setHydrated(true);},[STORAGE_KEY,trade]);
  useEffect(()=>{if(!hydrated)return;const timer=setTimeout(()=>{try{sessionStorage.setItem(STORAGE_KEY,JSON.stringify(state));setStorage('saved');}catch{setStorage('unavailable');}},220);return()=>clearTimeout(timer);},[state,hydrated,STORAGE_KEY]);
  // Flush the latest input on navigation/unmount instead of losing the debounce window.
  useEffect(()=>{if(!hydrated)return;const flush=()=>{try{sessionStorage.setItem(STORAGE_KEY,JSON.stringify(currentState.current));}catch{/* Optional tab-local convenience. */}};window.addEventListener('pagehide',flush);return()=>{window.removeEventListener('pagehide',flush);flush();};},[hydrated,STORAGE_KEY]);
  useEffect(()=>()=>{if(lastToastTimer.current)clearTimeout(lastToastTimer.current);},[]);
  useEffect(()=>{const panel=resultsRef.current;if(!panel||typeof IntersectionObserver==='undefined')return;const observer=new IntersectionObserver(([entry])=>setResultVisible(entry.isIntersecting&&entry.intersectionRatio>=.15),{threshold:[0,.15],rootMargin:'-78px 0px -90px 0px'});observer.observe(panel);return()=>observer.disconnect();},[]);
  const calculation=useMemo(()=>calculate(state),[state]),result=calculation.result;
  const title=state.tab==='members'?(state.members.kind==='birdsmouth'?{title:'Understand your birdsmouth cut.',subtitle:'A pitch, a seat length and the actual timber depth.'}:{title:trade==='birdsmouth'?'Find your rafter length.':'Find your angled member length.',subtitle:'From a horizontal run and angle. Check the geometry, then add your cutting allowances.'}):profile.headings[state.tab];
  const link=(path:string)=>linkOrigin+path;
  function track(action:string){try{services.track?.(state.trade+'_calculator_'+action,{tool:state.tab,unit_system:state.system});}catch{/* Analytics must never interrupt a calculation. */}}
  function notify(message:string){setToast(message);if(lastToastTimer.current)clearTimeout(lastToastTimer.current);lastToastTimer.current=setTimeout(()=>setToast(''),4500);}
  function change(next:CalculatorState){setState(next);setSaveError('');}
  function goTab(tab:Tab){setState(s=>({...s,tab}));setSaveError('');}
  function focusEditor(){requestAnimationFrame(()=>{const h=document.getElementById('qck-editor-title');h?.scrollIntoView({block:'start',behavior:'auto'});h?.focus({preventScroll:true});});}
  function showResults(){resultsRef.current?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});resultsRef.current?.focus({preventScroll:true});}
  useEffect(()=>{const timer=setTimeout(()=>{setAnnouncement(result?`${result.label}: ${state.tab==='pricing'?money(result.value,state.currency):format(result.value)+' '+result.unit}`:calculation.status==='invalid'?'Check the highlighted measurements.':'');},650);return()=>clearTimeout(timer);},[result,state.tab,state.currency,calculation.status]);
  function chooseExample(){const baseline=resetActive(state);if(JSON.stringify(state[state.tab])!==JSON.stringify(baseline[state.tab]))setConfirm('example');else{change(exampleFor(state));notify('Example loaded for this tool. Other calculations are unchanged.');track('example');}}
  function usePricing(){if(!result||result.power===0||result.value<=0)return;const p=state.pricing;if(p.amount.trim()!==''||p.price.trim()!==''){setConfirm('pricing');return;}change(transferToPricing(state,result));focusEditor();notify('Measurement transferred. Add your material rate.');track('transfer_pricing');}
  function useBattens(){const r=calculateArea(state.area,state.system).result;if(!r||r.value<=0)return;if(state.battens.direct||state.battens.width||state.battens.length){setConfirm('battens');return;}change(transferToBattens(state,r));focusEditor();notify('Net surface transferred without applying pitch again.');track('transfer_battens');}
  async function copy(){if(!result)return;const text=resultText(state,result);try {if(!navigator.clipboard)throw new Error('Clipboard unavailable');await navigator.clipboard.writeText(text);notify('Result and assumptions copied.');}catch{setCopyText(text);}track('copy');}
  function csv(){if(!result)return;const rows=[['QuoteCore+ '+profile.name,'Value','Unit'],[result.label,String(result.value),result.unit],...result.metrics.map(m=>[m.label,String(m.value),m.unit??'']),['Formula',result.formula,''],['Assumptions',result.summary,''],...result.notes.map(n=>['Note',n,''])];downloadBlob('\uFEFF'+rows.map(row=>row.map(csvCell).join(',')).join('\r\n'),'text/csv;charset=utf-8',`quotecore-${state.trade}-${state.tab}.csv`);notify('Calculation summary downloaded.');track('download_csv');}
  function downloadComponent(){try{const payload=componentPayload(state,true);downloadBlob(JSON.stringify(payload,null,2),'application/json',`quotecore-${state.trade}-component.json`);notify('Component draft downloaded.');track('download_component');}catch(error){notify(error instanceof Error?error.message:'Complete your pricing before downloading.');}}
  async function save(){if(!services.saveComponent)return;setSaving(true);setSaveError('');try{const href=await services.saveComponent(currentState.current);window.location.assign(href);}catch(error){setSaveError(error instanceof Error?error.message:'We could not save the draft. Your calculation is still here.');setSaving(false);}}
  function confirmAction(){
    if(confirm==='example'){change(exampleFor(state));notify('Example loaded. Your other calculators are unchanged.');track('example');}
    if(confirm==='reset'){change(resetActive(state));notify('This tool has been reset. Other calculations are unchanged.');track('reset');}
    if(confirm==='pricing'&&result){change(transferToPricing(state,result));focusEditor();notify('Measurement transferred. The old material rate was cleared for you to review.');track('transfer_pricing');}
    if(confirm==='battens'){const r=calculateArea(state.area,state.system).result;if(r)change(transferToBattens(state,r));focusEditor();notify('Net surface transferred. Gauge and waste are unchanged.');track('transfer_battens');}
    setConfirm(null);
  }
  function tabKeys(e:KeyboardEvent<HTMLDivElement>){const i=TABS.findIndex(t=>t.id===state.tab);let next:number|undefined;if(e.key==='ArrowRight')next=(i+1)%TABS.length;if(e.key==='ArrowLeft')next=(i-1+TABS.length)%TABS.length;if(e.key==='Home')next=0;if(e.key==='End')next=TABS.length-1;if(next!==undefined){e.preventDefault();goTab(TABS[next].id);document.getElementById('qck-tab-'+TABS[next].id)?.focus();}}
  const display=result?(state.tab==='pricing'?money(result.value,state.currency):format(result.value,result.unit==='°'?1:2)):'—';
  return <>
    <section className="qck-hero"><div className="qck-container"><a href={link('/free-tools')} className="qck-breadcrumb"><Icon name="back" size={14}/> Free Tools <span>/</span> Calculate</a><div className="qck-hero-copy"><div><div className="qck-eyebrow"><span/> {profile.eyebrow}</div><h1>{profile.heroTitle}<span>.</span></h1><p>{profile.intro}</p></div><div className="qck-hero-assurance"><span><Icon name="check" size={16}/> Free to use</span><span><Icon name="check" size={16}/> No signup needed</span><span><Icon name="check" size={16}/> Calculations in your browser</span></div></div>
      <nav className="qck-tool-nav" data-count={TABS.length} aria-label={profile.name}><div role="tablist" aria-label="Choose a calculation" onKeyDown={tabKeys}>{TABS.map(t=><button key={t.id} id={'qck-tab-'+t.id} type="button" role="tab" aria-selected={state.tab===t.id} aria-controls="qck-calculator-panel" tabIndex={state.tab===t.id?0:-1} onClick={()=>goTab(t.id)}><span className="qck-tab-icon"><Icon name={t.icon}/></span><span><strong>{t.label}</strong><small>{t.description}</small></span>{state.tab===t.id&&<span className="qck-tab-check"><Icon name="check" size={13}/></span>}</button>)}</div></nav>
      <div className="qck-mobile-task"><label htmlFor="qck-mobile-tool">What do you need to calculate?</label><select id="qck-mobile-tool" value={state.tab} onChange={e=>goTab(e.target.value as Tab)}>{TABS.map(t=><option value={t.id} key={t.id}>{t.label}</option>)}</select></div>
    </div></section>
    <main id="qck-main" className="qck-container qck-workspace">
      <div className="qck-work-toolbar"><div><span className="qck-live-dot"/> Results update as you type</div><div className="qck-toolbar-actions"><Segments label="Measurement units" value={state.system} options={[{value:'metric',label:'Metric'},{value:'imperial',label:'Imperial'}]} onChange={v=>{change(convertSystem(state,v as CalculatorState['system']));notify('Measurements and per-unit rates converted.');}}/><button type="button" className="qck-button qck-glass qck-small" onClick={()=>setConfirm('reset')}><Icon name="reset" size={15}/><span>Reset tool</span></button></div></div>
      {restored&&<div className="qck-restored"><span><Icon name="check" size={16}/> Your calculations were restored from this tab.</span><button type="button" aria-label="Dismiss restored notice" onClick={()=>setRestored(false)}><Icon name="close" size={16}/></button></div>}
      <div id="qck-calculator-panel" role="tabpanel" aria-labelledby="qck-editor-title" className="qck-work-grid">
        <div className="qck-editor"><div className="qck-editor-heading"><div><span className="qck-eyebrow">{TABS.find(t=>t.id===state.tab)?.label}</span><h2 id="qck-editor-title" tabIndex={-1}>{title.title}</h2><p>{title.subtitle}</p></div><button type="button" className="qck-button qck-glass qck-small" onClick={chooseExample}><Icon name="spark" size={16}/> Try an example</button></div>
          <CalculatorForms state={state} onChange={change} calculation={calculation} useRoofArea={useBattens}/>
          <div className="qck-editor-foot"><Icon name={storage==='unavailable'?'info':'lock'} size={14}/><span>{storage==='unavailable'?'Browser storage is unavailable. Copy or download your result before leaving.':storage==='saved'?'Kept in this browser tab, not an account. Download to keep a record.':'Your calculations stay in this browser tab.'}</span></div>
        </div>
        <div className="qck-results-column"><section ref={resultsRef} tabIndex={-1} aria-label="Calculation result" className="qck-result-panel" data-testid="result-panel">
          <div className="qck-result-top" data-print-title={"QuoteCore+ · "+profile.name}><span className="qck-eyebrow">YOUR CALCULATION</span><span className="qck-live"><span/>{result?'Live result':'Live preview'}</span></div>
          <CalculatorDiagram state={state} result={result}/>
          <div className="qck-result-content"><div className="qck-result-label">{result?.label??(state.tab==='pricing'?'Estimated materials + labour':state.tab==='battens'?'Batten length to allow':state.tab==='members'?(state.members.kind==='birdsmouth'?'Perpendicular notch depth':'Sloping length'):state.tab==='angles'?'Finished included angle':'Surface area')}</div>
            <div className="qck-result-value" data-testid="main-result"><span>{display}</span>{state.tab!=='pricing'&&<small>{result?.unit??(state.tab==='angles'?'°':state.tab==='members'&&state.members.kind==='birdsmouth'?(state.system==='metric'?'mm':'in'):state.tab==='members'||state.tab==='battens'?(state.system==='metric'?'m':'ft'):state.system==='metric'?'m²':'ft²')}</small>}</div>
            {!result&&<p className={calculation.status==='invalid'?'qck-result-warning':'qck-result-empty'}>{calculation.status==='invalid'?'Check the highlighted inputs. No result is shown until the measurements are valid.':`Enter ${calculation.missing.slice(0,3).join(', ')}${calculation.missing.length>3?' and the remaining details':''} to see your result.`}</p>}
            {calculation.errors.total&&<p className="qck-result-warning">{calculation.errors.total}</p>}
            {result&&<>
              {result.cut && <div className={`qck-cut-comparison${result.cut.exceeds?' is-over':''}`} data-testid="depth-comparison">
                <div><Icon name="info" size={16}/><strong>{result.cut.exceeds?'Exceeds selected comparison':'Within selected comparison'}</strong></div>
                <p>{format(result.cut.notch/result.cut.depth*100,1)}% of timber depth used · {format(result.cut.fraction*100,1)}% comparison</p>
                <div className="qck-depth-meter" aria-hidden="true"><span style={{width:`${Math.min(100,result.cut.notch/result.cut.depth*100)}%`}}/><i style={{left:`${Math.min(100,result.cut.fraction*100)}%`}}/></div>
                <small>{format(result.cut.allowance)} {result.unit} at the selected fraction. Not structural approval.</small>
              </div>}
              <div className="qck-result-metrics">{result.metrics.map(m=><div key={m.label}><span>{m.label}</span><strong>{m.unit&&['GBP','USD','EUR','AUD','NZD','CAD'].includes(m.unit)?money(m.value,m.unit):<>{format(m.value,m.digits??2)} <small>{m.unit}</small></>}</strong></div>)}</div>
              <div className="qck-result-actions">
                {state.tab==='pricing'?<a className="qck-button qck-primary" href={link(quoteHref(state,result))} onClick={()=>track('free_quote')}>Create a free quote <Icon name="arrow" size={18}/></a>:result.power>0&&result.value>0?<button type="button" className="qck-button qck-primary" onClick={usePricing}>Price this {result.power===2?'area':'length'} <Icon name="arrow" size={18}/></button>:null}
                {result.power>0&&result.value>0&&state.tab!=='pricing'&&<a className="qck-button qck-glass" href={link(quoteHref(state,result))} onClick={()=>track('free_quote')}><Icon name="file" size={17}/> Add to a free quote</a>}
                <div className="qck-result-utilities"><button type="button" className="qck-button qck-glass qck-small" onClick={copy}><Icon name="copy" size={15}/> Copy</button><button type="button" className="qck-button qck-glass qck-small" onClick={csv}><Icon name="download" size={15}/> CSV</button><button type="button" className="qck-button qck-glass qck-small" onClick={()=>{track('print');window.print();}}><Icon name="print" size={15}/> Print</button></div>
                {state.tab==='area'&&result.value>0&&<button type="button" className="qck-text-button" onClick={useBattens}>Use this area for battens <Icon name="arrow" size={15}/></button>}
              </div>
              <details className="qck-result-explanation"><summary>How this is calculated <Icon name="chevron" size={16}/></summary><p className="qck-formula">{result.formula}</p><p>{result.summary}</p></details>
              <div className="qck-result-notes">{result.notes.map(n=><p key={n}>{n}</p>)}</div></>}
          </div><div className="qck-result-footer"><Icon name="info" size={14}/> Planning estimate · verify before ordering</div>
        </section>
        {state.tab==='pricing'&&result&&<div className="qck-component-save"><span className="qck-eyebrow">LESS REPEAT WORK</span><h3>Keep the way you price.</h3><p>Reuse this as a Smart Component™ in the paid QuoteCore+ app. Your free calculation does not require an account.</p><button type="button" className="qck-button qck-glass" onClick={()=>{setSaveError('');setConfirm('save');}}><Icon name="cloud" size={17}/> Save component to QuoteCore+</button><button type="button" className="qck-text-button" onClick={downloadComponent}>Download component draft <Icon name="download" size={15}/></button></div>}
        </div>
      </div>
      <div className="qck-assumptions-bar"><Icon name="info" size={18}/><p>These tools calculate geometry and estimate quantities. They do not assess structural suitability, fixing schedules or manufacturer requirements.</p></div>
    </main>
    {result&&!resultVisible&&<div className="qck-mobile-result-bar"><div><span>Live result</span><strong>{display} {state.tab==='pricing'?'':result.unit}</strong></div><button type="button" className="qck-button qck-primary qck-small" onClick={showResults}>View result <Icon name="arrow" size={16}/></button></div>}
    <div className="qck-sr" role="status" aria-live="polite" aria-atomic="true">{announcement}</div>
    {toast&&<div className="qck-toast" role="status"><Icon name="check" size={16}/>{toast}</div>}
    {confirm&&confirm!=='save'&&<Dialog title={confirm==='reset'?'Reset this tool?':confirm==='example'?'Load the example?':confirm==='pricing'?'Use this measurement for pricing?':'Use your calculated surface area?'} onClose={()=>setConfirm(null)}>
      <p>{confirm==='reset'?'This clears the inputs for the current tool. Your other calculator tabs stay exactly as they are.':confirm==='example'?'This replaces the inputs in the current tool only. Your other calculations are kept.':confirm==='pricing'?'This replaces the pricing measurement and clears the old material rate so you can check the new unit. Existing labour is kept. Pitch will not be applied twice. For battens, waste will not be added twice either.':'This replaces the batten area with your calculated net surface area and clears any old opening deduction. Your gauge and waste allowance are kept. No additional pitch factor is applied.'}</p>
      <div className="qck-dialog-actions"><button type="button" autoFocus className="qck-button qck-glass" onClick={()=>setConfirm(null)}>Keep my work</button><button type="button" className="qck-button qck-primary" onClick={confirmAction}>{confirm==='reset'?'Reset this tool':confirm==='example'?'Load example':'Use measurement'}</button></div>
    </Dialog>}
    {confirm==='save'&&<Dialog title="Make this a reusable component." onClose={()=>{if(!saving)setConfirm(null);}}><p>A paid QuoteCore+ workspace is required to reuse Smart Components. A free-tools account alone does not include paid-app access.</p><div className="qck-dialog-benefits"><span><Icon name="check" size={16}/> Keep materials, waste and labour together</span><span><Icon name="check" size={16}/> Reuse your rules on future quotes</span></div>
      {preview?<div className="qck-quiet-note"><Icon name="info" size={17}/><p>This standalone preview does not save to an account. The production adapter uses the existing draft service and app handoff.</p></div>:null}
      {saveError&&<p className="qck-error" role="alert">{saveError}</p>}
      <div className="qck-dialog-actions">{services.saveComponent?<button type="button" className="qck-button qck-primary" disabled={saving} onClick={save}>{saving?'Saving draft…':'Continue to QuoteCore+'}<Icon name="arrow" size={17}/></button>:<button type="button" className="qck-button qck-primary" onClick={downloadComponent}>Download draft instead <Icon name="download" size={17}/></button>}<a className="qck-button qck-glass" href={link('/takeoff-demo')} onClick={()=>track('demo')}>Try the Demo <Icon name="play" size={16}/></a></div><p className="qck-hint">Your calculator inputs stay in this tab. No account or payment is created here.</p>
    </Dialog>}
    {copyText&&<Dialog title="Copy your calculation" onClose={()=>setCopyText(null)}><p>The browser could not access your clipboard. Select and copy the text below.</p><textarea aria-label="Calculation text to copy" value={copyText} readOnly rows={10} data-dialog-initial-focus onFocus={e=>e.target.select()}/><button type="button" className="qck-button qck-primary" onClick={()=>setCopyText(null)}>Done</button></Dialog>}
  </>;
}
