'use client';
import { useEffect, useId, useRef, type ReactNode, type KeyboardEvent } from 'react';
import { format, pitchMode, pitchValue, type Pitch, type Result, type Tab } from './roofing-model';

export function Icon({name,size=20}:{name:string;size?:number}) {
  const paths:Record<string,ReactNode>={
    arrow:<><path d="M4 12h15m-6-6 6 6-6 6"/></>,back:<path d="m14 5-7 7 7 7"/>,
    area:<><path d="m3 10 9-7 9 7v10H3Z"/><path d="M8 20v-7h8v7"/></>,
    ruler:<><path d="m3 16 13-13 5 5-13 13Z"/><path d="m7 12 3 3m1-7 3 3m1-7 3 3"/></>,
    battens:<><path d="M4 4h16v16H4Z"/><path d="M4 8h16M4 12h16M4 16h16"/></>,
    calculator:<><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M8 6h8M8 10h1m6 0h1m-8 4h1m6 0h1m-8 4h1m6 0h1"/></>,
    angle:<><path d="M4 3v17h17M4 20 19 6"/><path d="M4 12a8 8 0 0 1 6 2"/></>,
    spark:<><path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z"/></>,
    check:<path d="m5 12 4 4L19 6"/>,chevron:<path d="m6 9 6 6 6-6"/>,
    info:<><circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.1"/></>,
    copy:<><rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V3H3v13h5"/></>,
    download:<><path d="M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5"/></>,
    print:<><path d="M6 9V3h12v6M6 17H3V9h18v8h-3M6 14h12v7H6Z"/><path d="M17 12h1"/></>,
    reset:<><path d="M3 11a9 9 0 1 1 2 7M3 4v7h7"/></>,
    play:<path d="m8 4 12 8L8 20Z"/>,file:<><path d="M5 2h9l5 5v15H5Z"/><path d="M14 2v6h5M9 12h6m-6 4h6"/></>,
    close:<path d="m6 6 12 12M6 18 18 6"/>,lock:<><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4"/></>,
    cloud:<><path d="M6 18H5a4 4 0 0 1-.3-8 7 7 0 0 1 13.4-1A4.5 4.5 0 0 1 19 18h-1M12 21V11m-4 4 4-4 4 4"/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{paths[name]??paths.area}</svg>;
}
export function Field({label,value,onChange,unit,hint,error,text=false,placeholder='0',id:givenId}:{label:string;value:string;onChange:(v:string)=>void;unit?:string;hint?:string;error?:string;text?:boolean;placeholder?:string;id?:string}) {
  const autoId=useId(),id=givenId??autoId;
  return <div className="qcr-field"><label htmlFor={id}>{label}</label><div className={`qcr-input-wrap${error?' is-invalid':''}`}><input id={id} type="text" inputMode={text?'text':'decimal'} autoComplete="off" spellCheck={text} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} maxLength={text?120:24} aria-invalid={!!error} aria-label={unit?`${label} (${unit})`:undefined} aria-describedby={error||hint?id+'-help':undefined}/>{unit&&<span className="qcr-unit" aria-hidden="true">{unit}</span>}</div>{(hint||error)&&<p id={id+'-help'} className={error?'qcr-error':'qcr-hint'}>{error||hint}</p>}</div>;
}
export function SelectField({label,value,onChange,options,hint}:{label:string;value:string;onChange:(v:string)=>void;options:{value:string;label:string}[];hint?:string}) {
  const id=useId();return <div className="qcr-field"><label htmlFor={id}>{label}</label><select id={id} value={value} onChange={e=>onChange(e.target.value)} aria-describedby={hint?id+'-hint':undefined}>{options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select>{hint&&<p id={id+'-hint'} className="qcr-hint">{hint}</p>}</div>;
}
export function Segments({label,value,options,onChange}:{label:string;value:string;options:{value:string;label:string}[];onChange:(v:string)=>void}) {
  return <div className="qcr-segments" role="group" aria-label={label}>{options.map(o=><button type="button" key={o.value} aria-pressed={value===o.value} onClick={()=>onChange(o.value)}>{value===o.value&&<Icon name="check" size={14}/>}<span>{o.label}</span></button>)}</div>;
}
export function Section({number,title,description,children}:{number:string;title:string;description?:string;children:ReactNode}) {
  return <section className="qcr-form-section"><div className="qcr-section-heading"><span className="qcr-section-number" aria-hidden="true">{number}</span><div><h3>{title}</h3>{description&&<p>{description}</p>}</div></div><div className="qcr-section-body">{children}</div></section>;
}
export function PitchFields({value,onChange,errors}:{value:Pitch;onChange:(v:Pitch)=>void;errors:Record<string,string>}) {
  const deg=pitchValue(value);
  return <div className="qcr-pitch-fields"><div className="qcr-pitch-top"><span>How is your pitch measured?</span><Segments label="Pitch input format" value={value.mode} options={[{value:'degrees',label:'Degrees'},{value:'ratio',label:'Rise : run'}]} onChange={v=>onChange(pitchMode(value,v as Pitch['mode']))}/></div>
    {value.mode==='degrees'?<Field id="roof-pitch" label="Roof pitch" unit="°" value={value.degrees} onChange={v=>onChange({...value,degrees:v})} error={errors.pitch} hint="Angle of the roof above horizontal. 0° is flat."/>:
      <><div className="qcr-two"><Field label="Rise" value={value.rise} onChange={v=>onChange({...value,rise:v})} error={errors.rise}/><Field label="Run" value={value.run} onChange={v=>onChange({...value,run:v})} error={errors.run}/></div><p className="qcr-hint">Use the same unit for both. {Number.isFinite(deg)&&deg>=0&&deg<=89?`Equivalent to ${format(deg,2)}°.`:''}</p></>}
    <div className="qcr-presets" aria-label="Common roof pitches">{[10,15,20,25,30,35,40,45].map(n=><button type="button" key={n} aria-pressed={Number.isFinite(deg)&&Math.abs(deg-n)<0.0001} onClick={()=>onChange({...value,mode:'degrees',degrees:String(n)})}>{n}°</button>)}</div>
  </div>;
}
export function Dialog({title,children,onClose}:{title:string;children:ReactNode;onClose:()=>void}) {
  const ref=useRef<HTMLDialogElement>(null),id=useId();
  const previousFocus=useRef<HTMLElement|null>(typeof document==='undefined'?null:document.activeElement as HTMLElement);
  useEffect(()=>{const dialog=ref.current,previous=previousFocus.current;dialog?.showModal();
    const initial=dialog?.querySelector<HTMLElement>('[data-dialog-initial-focus], .qcr-dialog-actions button:not([disabled]), .qcr-dialog-actions a, .qcr-primary');
    initial?.focus();
    return()=>{dialog?.close();if(previous?.isConnected)previous.focus();};},[]);
  function trapFocus(e:KeyboardEvent<HTMLDialogElement>){
    if(e.key!=='Tab'||!ref.current)return;
    const items=Array.from(ref.current.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex="0"]')).filter(el=>el.getClientRects().length>0);
    const first=items[0],last=items[items.length-1];if(!first)return;
    if(e.shiftKey&&(document.activeElement===first||!ref.current.contains(document.activeElement))){e.preventDefault();last.focus();}
    else if(!e.shiftKey&&(document.activeElement===last||!ref.current.contains(document.activeElement))){e.preventDefault();first.focus();}
  }
  return <dialog ref={ref} className="qcr-dialog" aria-labelledby={id} onKeyDown={trapFocus} onCancel={e=>{e.preventDefault();onClose();}} onClick={e=>{if(e.target===ref.current){const r=ref.current.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)onClose();}}}><div className="qcr-dialog-top"><span className="qcr-eyebrow">QUOTECORE+ FREE TOOLS</span><button type="button" className="qcr-button qcr-glass qcr-icon-button" aria-label="Close dialog" onClick={onClose}><Icon name="close"/></button></div><h2 id={id}>{title}</h2>{children}</dialog>;
}
export function RoofDiagram({tab,result,kind}:{tab:Tab;result:Result|null;kind?:string}) {
  const rid=useId().replace(/:/g,''),p=result?.pitch??25;
  if(tab==='pricing')return <div className="qcr-price-visual" aria-hidden="true"><span><Icon name="ruler" size={22}/><b>Measure</b></span><i>→</i><span><Icon name="battens" size={22}/><b>Allow waste</b></span><i>→</i><span><Icon name="calculator" size={22}/><b>Price it</b></span></div>;
  if(tab==='members'){
    const top=200-Math.min(130,Math.max(10,Math.tan(p*Math.PI/180)*170));
    return <svg className="qcr-diagram" viewBox="0 0 500 300" role="img" aria-label="Sloping length shown above the horizontal plan run. Diagram not to scale."><defs><linearGradient id={rid} x2="0" y2="1"><stop stopColor="#ff7931" stopOpacity=".2"/><stop offset="1" stopColor="#ff7931" stopOpacity=".02"/></linearGradient></defs><path d={`M80 210H400V${top}Z`} fill={`url(#${rid})`} stroke="#8c98a9" strokeDasharray="5 6"/><path d={`M80 210 400 ${top}`} stroke="#ff773b" strokeWidth="5" strokeLinecap="round"/><path d="M380 210v-20h20" stroke="#77818e" fill="none"/><path d="M80 239H400M80 234v10m320-10v10" stroke="#7d8795"/><text x="240" y="267" textAnchor="middle">{kind==='hip'?'Plan diagonal':'Horizontal run · wall to ridge'}</text><text x="130" y="198" className="qcr-diagram-accent">{format(kind==='hip'?Math.atan(Math.tan(p*Math.PI/180)/Math.sqrt(2))*180/Math.PI:p,1)}°</text><text x="270" y={top+42} textAnchor="middle" className="qcr-diagram-accent">{kind==='hip'?'Hip / valley':'Rafter'}</text><circle cx="80" cy="210" r="4" fill="#ff7931"/><circle cx="400" cy={top} r="4" fill="#ff7931"/></svg>;
  }
  if(tab==='angles'){
    const a=result?.value??130,theta=a*Math.PI/180;
    const x=250+130*Math.cos(theta),y=150-130*Math.sin(theta);
    return <svg className="qcr-diagram" viewBox="0 0 500 300" role="img" aria-label="Schematic of the finished included flashing angle; not a fabrication drawing."><path d="M78 150H420" stroke="#647183" strokeDasharray="5 7"/><path d={`M400 150H250L${x} ${y}`} stroke="#ff773b" strokeWidth="6" fill="none" strokeLinejoin="round"/><path d={`M300 150A50 50 0 ${a>180?1:0} 0 ${250+50*Math.cos(theta)} ${150-50*Math.sin(theta)}`} stroke="#bec6d0" fill="none"/><text x="320" y="215" className="qcr-diagram-accent">{format(a,1)}° included</text><text x="80" y="270">Dashed line = flat sheet</text></svg>;
  }
  const battens=tab==='battens';
  return <svg className="qcr-diagram" viewBox="0 0 500 320" role="img" aria-label={battens?'Roof plane with regularly spaced battens. Diagram not to scale.':'Roof surface shown above its flat footprint. The pitched surface is larger than the footprint. Diagram not to scale.'}>
    <defs><linearGradient id={rid} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#ff994d" stopOpacity=".36"/><stop offset="1" stopColor="#ff6333" stopOpacity=".06"/></linearGradient><clipPath id={rid+'clip'}><path d="m160 146 172-96 80 96-172 96Z"/></clipPath></defs>
    <path d="m80 231 160 52 172-96-160-52Z" fill="#91a0b4" fillOpacity=".04" stroke="#647183" strokeDasharray="5 6"/>
    <path d="M80 190v41m160 11v41m172-137v41" stroke="#536070" strokeDasharray="4 5"/>
    <path d="m80 190 172-96 80-44-172 96Z" fill="#222a35" stroke="#707d8e"/>
    <path d="m160 146 172-96 80 96-172 96Z" fill={`url(#${rid})`} stroke="#ff7931" strokeWidth="1.7"/>
    <g clipPath={`url(#${rid}clip)`} stroke={battens?'#ffba85':'#f2a877'} strokeOpacity={battens ? .75 : .24} strokeWidth={battens?3:1}>{Array.from({length:battens?8:12},(_,i)=>battens?<path key={i} d={`M${160+i*12} ${146+i*14}l172-96`}/>:<path key={i} d={`M${160+i*18} ${146-i*10}l80 96`}/>)}</g>
    <path d="m80 190 80-44 80 96" stroke="#8894a5" fill="none"/><path d="m160 146 172-96" stroke="#ffd0aa" strokeWidth="2"/>
    <circle cx="160" cy="146" r="3.5" fill="#ff9b55"/>
    <text x="302" y="160" textAnchor="middle" className="qcr-diagram-accent">{battens?'Evenly spaced battens':result?`${format(result.value)} ${result.unit}`:'Roof surface'}</text>
    <text x="100" y="299">{battens?'Gauge is measured up the slope':'Dashed outline = flat footprint'}</text>
  </svg>;
}
