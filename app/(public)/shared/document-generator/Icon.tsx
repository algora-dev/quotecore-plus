import type { SVGProps } from 'react';
export type IconName = 'arrow'|'back'|'check'|'plus'|'file'|'download'|'expand'|'close'|'chevron'|'image'|'message'|'spark'|'shield'|'refresh'|'copy'|'trash'|'eye'|'eyeOff'|'settings'|'help'|'save'|'external'|'user'|'building'|'clock'|'edit'|'lock'|'upload'|'alert'|'minus'|'play';
const paths: Record<IconName,string> = {
  play:'m8 5 11 7-11 7V5',
  arrow:'M5 12h14m-6-6 6 6-6 6', back:'M19 12H5m6-6-6 6 6 6', check:'m5 12 4 4L19 6', plus:'M12 5v14M5 12h14',
  file:'M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8zM14 3v5h5M8 12h8M8 16h6',
  download:'M12 3v12m-4-4 4 4 4-4M5 16v4h14v-4',expand:'M8 3H3v5m13-5h5v5M3 16v5h5m8 0h5v-5',close:'m6 6 12 12M18 6 6 18',
  chevron:'m6 9 6 6 6-6',image:'M3 3h18v18H3zM3 16l6-6 5 5 3-3 4 4M15 7h.01',message:'M4 4h16v13H9l-5 4V4M8 8h8M8 12h5',
  spark:'m12 3 2.6 6.4L21 12l-6.4 2.6L12 21l-2.6-6.4L3 12l6.4-2.6L12 3',
  shield:'m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3m-4 9 3 3 5-5',refresh:'M20 11a8 8 0 0 0-14-5L3 9m0-6v6h6m-5 4a8 8 0 0 0 14 5l3-3m0 6v-6h-6',
  copy:'M9 9h12v12H9zM15 5V3H3v12h2',trash:'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7',
  eye:'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12m13 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  eyeOff:'m3 3 18 18M10 5h2c6 0 10 7 10 7a17 17 0 0 1-4 4M6 6a20 20 0 0 0-4 6s4 7 10 7c2 0 3-.5 4-1M10 10a3 3 0 0 0 4 4',
  settings:'M4 6h16M4 12h16M4 18h16M8 3v6M16 9v6M10 15v6',help:'M9 9a3 3 0 1 1 5 2c-2 1-2 2-2 3m0 3h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  save:'M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h12l4 4v12a2 2 0 0 1-2 2M7 3v6h10V3M7 21v-8h10v8',
  external:'M14 3h7v7m0-7L10 14M10 3H3v18h18v-7',user:'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0M4 21v-3a8 8 0 0 1 16 0v3',
  building:'M4 21V3h12v18M16 11h4v10M8 7h4M8 11h4M8 15h4M9 21v-3h2v3',clock:'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0M12 6v6l4 2',
  edit:'m16 3 5 5L8 21H3v-5L16 3m-2 2 5 5',lock:'M5 10h14v11H5V10m3 0V7a4 4 0 0 1 8 0v3',
  upload:'M12 16V3m-4 4 4-4 4 4M5 14v7h14v-7',alert:'m12 3 10 18H2L12 3m0 6v5m0 3h.01',minus:'M5 12h14',
};
export function Icon({name,...props}:SVGProps<SVGSVGElement>&{name:IconName}) { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><path d={paths[name]}/></svg>; }
