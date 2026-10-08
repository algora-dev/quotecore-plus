'use client';
import { useEffect,useId,useRef,type ReactNode,type ButtonHTMLAttributes,type AnchorHTMLAttributes } from 'react';
import { createPortal } from 'react-dom';
import s from './TakeoffExperience.module.css';
export type IconName='arrow'|'back'|'roof'|'wall'|'floor'|'ruler'|'spark'|'upload'|'check'|'file'|'edit'|'plus'|'trash'|'close'|'download'|'play'|'info'|'layers'|'save'|'chevron';
export function Icon({name,...props}:{name:IconName}&React.SVGProps<SVGSVGElement>){
  const paths:Record<IconName,ReactNode>={
    arrow:<path d="M4 12h16m-6-6 6 6-6 6"/>,back:<path d="M20 12H4m6-6-6 6 6 6"/>,
    roof:<><path d="M2.5 12.5 12 5l9.5 7.5M5.5 11v8.5h13V11"/></>,
    wall:<><rect x="3" y="4" width="18" height="16" rx="1"/><path d="M3 9h18M3 15h18M9 4v5m7 0v6M8 15v5"/></>,
    floor:<><path d="m12 3 10 6-10 6L2 9l10-6ZM2 14l10 6 10-6M7 6l10 6M7 12l10-6"/></>,
    ruler:<><path d="m4 16 12-12 4 4L8 20l-4-4ZM13 7l3 3m-6 0 2 2m-5 1 3 3"/></>,
    spark:<><path d="m12 3 2.6 6.4L21 12l-6.4 2.6L12 21l-2.6-6.4L3 12l6.4-2.6L12 3Z"/></>,
    upload:<><path d="M12 16V3m-5 5 5-5 5 5M4 15v5h16v-5"/></>,
    check:<path d="m5 12 4 4L19 6"/>,file:<><path d="M5 3h9l5 5v13H5V3Zm9 0v5h5M8 12h8m-8 4h6"/></>,
    edit:<><path d="m4 16 12-12 4 4L8 20H4v-4Zm10-10 4 4M4 22h16"/></>,
    plus:<path d="M12 4v16M4 12h16"/>,trash:<><path d="M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7"/></>,
    close:<path d="m6 6 12 12M6 18 18 6"/>,download:<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>,
    play:<><path d="m9 6 9 6-9 6V6Z"/></>,info:<><circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/></>,
    layers:<><path d="m12 3 10 5-10 5L2 8l10-5ZM2 12l10 5 10-5M2 16l10 5 10-5"/></>,
    save:<><path d="M4 3h13l3 3v15H4V3ZM8 3v6h8V3M8 21v-7h8v7"/></>,chevron:<path d="m6 9 6 6 6-6"/>,
  };
  return <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name]}</svg>;
}
export function Button({primary=false,quiet=false,className='',children,...props}:ButtonHTMLAttributes<HTMLButtonElement>&{primary?:boolean;quiet?:boolean}){
  return <button type="button" {...props} className={`${s.control} ${primary?s.primary:quiet?s.quiet:s.glass} ${className}`}>{children}</button>;
}
export function ActionLink({primary=false,quiet=false,className='',children,...props}:AnchorHTMLAttributes<HTMLAnchorElement>&{primary?:boolean;quiet?:boolean}){
  return <a {...props} className={`${s.control} ${primary?s.primary:quiet?s.quiet:s.glass} ${className}`}>{children}</a>;
}
/** Native dialog supplies modal semantics, focus containment and Escape. */
export function Dialog({title,description,children,footer,onClose}:{title:string;description?:string;children:ReactNode;footer?:ReactNode;onClose:()=>void}){
  const ref=useRef<HTMLDialogElement>(null),id=useId();
  const closeRef=useRef(onClose);closeRef.current=onClose;
  useEffect(()=>{const el=ref.current;if(!el)return;const focus=document.activeElement as HTMLElement|null;
    const previous=document.body.style.overflow;document.body.style.overflow='hidden';el.showModal();el.querySelector<HTMLElement>('[data-initial-focus]')?.focus();
    return()=>{el.close();document.body.style.overflow=previous;focus?.focus();};},[]);
  if(typeof document==='undefined')return null;
  return createPortal(<dialog ref={ref} className={`${s.root} ${s.dialog}`} aria-labelledby={id} aria-describedby={description?`${id}-desc`:undefined}
    onCancel={e=>{e.preventDefault();closeRef.current();}}>
    <div className={s.dialogHeading}><div><h2 id={id}>{title}</h2>{description&&<p id={`${id}-desc`}>{description}</p>}</div>
      <Button quiet onClick={onClose} aria-label="Close dialog"><Icon name="close"/></Button></div>
    <div className={s.dialogBody}>{children}</div>{footer&&<div className={s.dialogFooter}>{footer}</div>}
  </dialog>,document.body);
}
export function Steps({current,onSelect}:{current:number;onSelect:(step:1|2|3)=>void}){
  return <nav className={s.steps} aria-label="Takeoff setup"><ol>{['Units','Components','Plan'].map((label,i)=><li key={label}>
    <button type="button" aria-current={current===i+1?'step':undefined} disabled={i+1>current} onClick={()=>onSelect((i+1) as 1|2|3)}>
      <span>{i+1<current?<Icon name="check"/>:i+1}</span>{label}</button>{i<2&&<i aria-hidden="true"/>}</li>)}</ol></nav>;
}
