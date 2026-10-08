'use client';
import { useEffect, useId, useRef, useState, type ReactNode, type KeyboardEvent } from 'react';
import { format, pitchMode, pitchValue, type Pitch } from './calculator-model';

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
  return <div className="qck-field"><label htmlFor={id}>{label}</label><div className={`qck-input-wrap${error?' is-invalid':''}`}><input id={id} type="text" inputMode={text?'text':'decimal'} autoComplete="off" spellCheck={text} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} maxLength={text?120:24} aria-invalid={!!error} aria-label={unit?`${label} (${unit})`:undefined} aria-describedby={error||hint?id+'-help':undefined}/>{unit&&<span className="qck-unit" aria-hidden="true">{unit}</span>}</div>{(hint||error)&&<p id={id+'-help'} className={error?'qck-error':'qck-hint'}>{error||hint}</p>}</div>;
}
export function SelectField({label,value,onChange,options,hint}:{label:string;value:string;onChange:(v:string)=>void;options:{value:string;label:string}[];hint?:string}) {
  const id=useId();return <div className="qck-field"><label htmlFor={id}>{label}</label><select id={id} value={value} onChange={e=>onChange(e.target.value)} aria-describedby={hint?id+'-hint':undefined}>{options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select>{hint&&<p id={id+'-hint'} className="qck-hint">{hint}</p>}</div>;
}
export function Segments({label,value,options,onChange}:{label:string;value:string;options:{value:string;label:string}[];onChange:(v:string)=>void}) {
  return <div className="qck-segments" role="group" aria-label={label}>{options.map(o=><button type="button" key={o.value} aria-pressed={value===o.value} onClick={()=>onChange(o.value)}>{value===o.value&&<Icon name="check" size={14}/>}<span>{o.label}</span></button>)}</div>;
}
export function Section({number,title,description,children}:{number:string;title:string;description?:string;children:ReactNode}) {
  return <section className="qck-form-section"><div className="qck-section-heading"><span className="qck-section-number" aria-hidden="true">{number}</span><div><h3>{title}</h3>{description&&<p>{description}</p>}</div></div><div className="qck-section-body">{children}</div></section>;
}
export function PitchFields({value,onChange,errors,label='Pitch / angle'}:{value:Pitch;onChange:(v:Pitch)=>void;errors:Record<string,string>;label?:string}) {
  const deg=pitchValue(value);
  return <div className="qck-pitch-fields"><div className="qck-pitch-top"><span>Choose the angle format</span><Segments label="Pitch input format" value={value.mode} options={[{value:'degrees',label:'Degrees'},{value:'ratio',label:'Rise : run'}]} onChange={v=>onChange(pitchMode(value,v as Pitch['mode']))}/></div>
    {value.mode==='degrees'?<Field id="roof-pitch" label={label} unit="°" value={value.degrees} onChange={v=>onChange({...value,degrees:v})} error={errors.pitch} hint="Angle above horizontal. Both ratio dimensions must use the same unit."/>:
      <><div className="qck-two"><Field label="Rise" value={value.rise} onChange={v=>onChange({...value,rise:v})} error={errors.rise}/><Field label="Run" value={value.run} onChange={v=>onChange({...value,run:v})} error={errors.run}/></div><p className="qck-hint">Use the same unit for both. {Number.isFinite(deg)&&deg>=0&&deg<=89?`Equivalent to ${format(deg,2)}°.`:''}</p></>}
    <div className="qck-presets" aria-label="Common angles">{[15,22.5,30,35,40,45,60].map(n=><button type="button" key={n} aria-pressed={Number.isFinite(deg)&&Math.abs(deg-n)<0.0001} onClick={()=>onChange({...value,mode:'degrees',degrees:String(n)})}>{n}°</button>)}</div>
  </div>;
}
export function Dialog({title,children,onClose}:{title:string;children:ReactNode;onClose:()=>void}) {
  const ref=useRef<HTMLDialogElement>(null),id=useId();
  const previousFocus=useRef<HTMLElement|null>(typeof document==='undefined'?null:document.activeElement as HTMLElement);
  useEffect(()=>{const dialog=ref.current,previous=previousFocus.current;dialog?.showModal();
    const initial=dialog?.querySelector<HTMLElement>('[data-dialog-initial-focus], .qck-dialog-actions button:not([disabled]), .qck-dialog-actions a, .qck-primary');
    initial?.focus();
    return()=>{dialog?.close();if(previous?.isConnected)previous.focus();};},[]);
  function trapFocus(e:KeyboardEvent<HTMLDialogElement>){
    if(e.key!=='Tab'||!ref.current)return;
    const items=Array.from(ref.current.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex="0"]')).filter(el=>el.getClientRects().length>0);
    const first=items[0],last=items[items.length-1];if(!first)return;
    if(e.shiftKey&&(document.activeElement===first||!ref.current.contains(document.activeElement))){e.preventDefault();last.focus();}
    else if(!e.shiftKey&&(document.activeElement===last||!ref.current.contains(document.activeElement))){e.preventDefault();first.focus();}
  }
  return <dialog ref={ref} className="qck-dialog" aria-labelledby={id} onKeyDown={trapFocus} onCancel={e=>{e.preventDefault();onClose();}} onClick={e=>{if(e.target===ref.current){const r=ref.current.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)onClose();}}}><div className="qck-dialog-top"><span className="qck-eyebrow">QUOTECORE+ FREE TOOLS</span><button type="button" className="qck-button qck-glass qck-icon-button" aria-label="Close dialog" onClick={onClose}><Icon name="close"/></button></div><h2 id={id}>{title}</h2>{children}</dialog>;
}

/** Open a disclosure to reveal invalid inputs; keep it open while the user fixes them. */
export function Disclosure({children,hasError=false}:{children:ReactNode;hasError?:boolean}) {
  const [open,setOpen]=useState(hasError);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- one-way validity sync: an errored optional section auto-opens and stays open while corrected (repo precedent: FreeTakeoffApp.tsx)
  useEffect(()=>{if(hasError)setOpen(true);},[hasError]);
  return <details className="qck-disclosure" open={open} onToggle={e=>setOpen(e.currentTarget.open)}>{children}</details>;
}
