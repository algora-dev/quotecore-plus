'use client';
import { useEffect, useId, useRef, useState, type InputHTMLAttributes, type ReactNode, type KeyboardEvent } from 'react';
import { QcButton, type QcButtonProps } from '@/app/components/ui/v2/QcButton';
import { Icon, type IconName } from './Icon';
import s from './DocumentGenerator.module.css';
export function Button({icon, className='', variant='glass', children,...props}: QcButtonProps & {icon?:IconName}) {
  return <QcButton {...props} variant={variant} className={`${s.button} ${className}`}>{icon && <Icon name={icon}/>}<span>{children}</span></QcButton>;
}
export function IconButton({name,label,variant='ghost',...props}:QcButtonProps&{name:IconName;label:string}) {return <QcButton {...props} variant={variant} className={`${s.button} ${s.iconButton}`} aria-label={label} title={label}><Icon name={name}/></QcButton>;}
export function Field({label,hint,error,optional,children,id,...props}:InputHTMLAttributes<HTMLInputElement>&{label:string;hint?:string;error?:string;optional?:boolean;children?:ReactNode}) {
  const automatic = useId(), fieldId=id || automatic;
  return <div className={s.field}><label htmlFor={fieldId}>{label}{optional && <span className={s.optional}>Optional</span>}</label>
    {children ?? <input {...props} id={fieldId} aria-invalid={error?true:undefined} aria-describedby={error?`${fieldId}-error`:hint?`${fieldId}-hint`:undefined}/>}
    {error ? <p className={s.fieldError} id={`${fieldId}-error`}>{error}</p> : hint && <p className={s.hint} id={`${fieldId}-hint`}>{hint}</p>}
  </div>;
}
/** Raw text is owned by the control while focused so 0, decimal separators,
 * intermediate minus signs and selection/caret are never eaten by rerenders. */
export function NumberField({value,onNumber,...props}:Omit<InputHTMLAttributes<HTMLInputElement>,'value'|'onChange'|'type'>&{value:number;onNumber:(n:number)=>void}) {
  const [raw,setRaw] = useState(String(value)), focused = useRef(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- one-way external-value sync while the control is unfocused (repo precedent: FreeTakeoffApp.tsx)
  useEffect(() => {if (!focused.current) setRaw(String(value));},[value]);
  return <input {...props} type="text" inputMode="decimal" value={raw}
    onFocus={e=>{focused.current=true;props.onFocus?.(e);}}
    onChange={e=>{const v=e.target.value;if (!/^-?\d*([.,]\d*)?$/.test(v)) return;setRaw(v);const n=Number(v.replace(',','.'));if(Number.isFinite(n))onNumber(n);}}
    onBlur={e=>{focused.current=false;const n=Number(raw.replace(',','.'));const next=Number.isFinite(n)?n:0;setRaw(String(next));onNumber(next);props.onBlur?.(e);}}/>;
}
export function Disclosure({title,subtitle,children,open=false,icon}: {title:string;subtitle?:string;children:ReactNode;open?:boolean;icon?:IconName}) {
  return <details className={s.disclosure} open={open || undefined}><summary>{icon&&<Icon name={icon}/>}<span>{title}{subtitle&&<small>{subtitle}</small>}</span><Icon name="chevron"/></summary><div className={s.disclosureBody}>{children}</div></details>;
}
export function Dialog({title,eyebrow='QUOTECORE+ FREE TOOLS',onClose,children,wide=false,tone='light'}: {title:string;eyebrow?:string;onClose:()=>void;children:ReactNode;wide?:boolean;tone?:'light'|'focus'}) {
  const ref=useRef<HTMLDialogElement>(null), titleRef=useRef<HTMLHeadingElement>(null), id=useId(), started=useRef(false);
  useEffect(()=>{
    const el=ref.current;if(!el)return;const previous=document.activeElement instanceof HTMLElement?document.activeElement:null;
    const overflow=document.body.style.overflow;document.body.style.overflow='hidden';el.showModal();titleRef.current?.focus({preventScroll:true});
    return()=>{el.close();document.body.style.overflow=overflow;if(previous?.isConnected)previous.focus({preventScroll:true});};
  },[]);
  const outside=(x:number,y:number)=>{const b=ref.current?.getBoundingClientRect();return !!b&&(x<b.left||x>b.right||y<b.top||y>b.bottom);};
  function trap(e:KeyboardEvent<HTMLDialogElement>){if(e.key!=='Tab')return;const targets=Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),a[href],summary,[tabindex="0"]')??[]).filter(el=>el.getClientRects().length>0);
    const first=targets[0],last=targets[targets.length-1];if(!first){e.preventDefault();return;}
    if(e.shiftKey&&(document.activeElement===first||!targets.includes(document.activeElement as HTMLElement))){e.preventDefault();last.focus();}
    else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
  return <dialog data-qc-ui="v2" ref={ref} className={`${s.root} ${s.dialog} ${wide?s.wideDialog:''} ${tone==='focus'?s.focusDialog:''}`} aria-labelledby={id} onKeyDown={trap}
    onCancel={e=>{e.preventDefault();onClose();}} onPointerDown={e=>{started.current=e.target===e.currentTarget&&outside(e.clientX,e.clientY);}}
    onClick={e=>{if(started.current&&e.target===e.currentTarget&&outside(e.clientX,e.clientY))onClose();started.current=false;}}>
    <div className={s.dialogHeader}><p className={s.eyebrow}>{eyebrow}</p><h2 ref={titleRef} tabIndex={-1} id={id}>{title}</h2><IconButton variant="glass" name="close" label="Close dialog" onClick={onClose}/></div>
    <div className={s.dialogBody}>{children}</div>
  </dialog>;
}
