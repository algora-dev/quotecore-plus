import type {ReactNode,ButtonHTMLAttributes} from 'react';
import controls from '@/components/marketing/MarketingButton.module.css';
import s from './hub.module.css';
export type IconName='measure'|'calculate'|'documents'|'arrow'|'chevron'|'close'|'check'|'message'|'mic'|'send'|'search'|'plan'|'pricing'|'play'|'library'|'workflow'|'help'|'external';
export function Icon({name,className=''}:{name:IconName;className?:string}) {
 const paths:Record<IconName,ReactNode>={
  measure:<><path d="m3 11 9-7 9 7M6 9v8h12V9M3 21h18M3 19v3m18-3v3"/><path d="M10 17v-5h4v5"/></>,
  calculate:<><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 11h1m3 0h1m3 0h.01M8 15h1m3 0h1m3 0h.01M8 18h1m3 0h1m3 0h.01"/></>,
  documents:<><path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8l-5-5Z"/><path d="M14 3v5h5M9 12h6m-6 4h6"/></>,
  arrow:<path d="M4 12h15m-6-6 6 6-6 6"/>,chevron:<path d="m6 9 6 6 6-6"/>,close:<path d="m6 6 12 12M6 18 18 6"/>,check:<path d="m5 12 4 4L19 6"/>,
  message:<><path d="M20 15a3 3 0 0 1-3 3H9l-5 3V6a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3Z"/><path d="M8 9h8m-8 4h5"/></>,
  mic:<><rect x="9" y="2" width="6" height="13" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-3 0h6"/></>,
  send:<path d="M12 20V4m-7 7 7-7 7 7"/>,search:<><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></>,
  plan:<><path d="m3 4 6 2 6-2 6 2v15l-6-2-6 2-6-2ZM9 6v15m6-17v15"/><path d="m5 12 3-3 7 5 4-3"/></>,
  pricing:<><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8M8 11h3m-3 4h3m3 0h3m-1.5-1.5v3"/></>,
  play:<path d="m8 4 12 8-12 8Z"/>,library:<><rect x="3" y="4" width="5" height="16" rx="1"/><rect x="10" y="4" width="5" height="16" rx="1"/><path d="m17 5 4 14M4 8h3m4 0h3"/></>,
  workflow:<><rect x="3" y="9" width="5" height="6" rx="1"/><rect x="16" y="3" width="5" height="6" rx="1"/><rect x="16" y="15" width="5" height="6" rx="1"/><path d="M8 12h4V6h4m-4 6v6h4"/></>,
  help:<><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 2-2.5 2-2.5 4m0 3h.01"/></>,external:<><path d="M14 3h7v7m0-7L10 14"/><path d="M10 4H4v16h16v-6"/></>
 };
 return <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{paths[name]}</svg>;
}
export function Action({children,variant='glass',className='',...props}:ButtonHTMLAttributes<HTMLButtonElement>&{variant?:'primary'|'glass'|'ghost'}) {
 return <button type="button" {...props} className={`${controls.button} ${controls[variant]} ${s.action} ${className}`}>{children}</button>;
}
export function ActionLink({href,children,variant='glass',className='',onClick,ariaLabel}:{href:string;children:ReactNode;variant?:'primary'|'glass'|'ghost';className?:string;onClick?:()=>void;ariaLabel?:string}) {
 return <a href={href} onClick={onClick} aria-label={ariaLabel} className={`${controls.button} ${controls[variant]} ${s.action} ${className}`}>{children}</a>;
}
export function Eyebrow({children}:{children:ReactNode}) {return <p className={s.eyebrow}><span aria-hidden="true"/>{children}</p>;}
