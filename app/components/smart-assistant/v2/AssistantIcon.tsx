import type { SVGProps, ReactNode } from 'react';

export type AssistantIconName = 'mic' | 'keyboard' | 'attach' | 'send' | 'speaker' | 'muted' | 'pause' | 'play' | 'stop' | 'close' | 'hide' | 'search' | 'quote' | 'draft' | 'order' | 'invoice' | 'component' | 'customer' | 'camera' | 'image' | 'file' | 'chevron' | 'check' | 'edit' | 'history' | 'settings' | 'plus' | 'alert' | 'arrowDown' | 'lock';

/** A single, fixed SVG vocabulary. No emoji, remote icons or model-supplied SVG. */
export function AssistantIcon({ name, ...props }: SVGProps<SVGSVGElement> & { name: AssistantIconName }) {
  const shapes: Record<AssistantIconName, ReactNode> = {
    mic: <><rect x="9" y="2" width="6" height="13" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-3 0h6"/></>,
    keyboard: <><rect x="2" y="5" width="20" height="14" rx="3"/><path d="M6 9h.01M10 9h.01M14 9h.01M18 9h.01M6 12h.01M10 12h.01M14 12h.01M18 12h.01M7 15h10"/></>,
    attach: <path d="m8 12 6-6a3 3 0 0 1 4 4l-8 8a5 5 0 0 1-7-7l9-9m-6 13 8-8"/>,
    send: <><path d="m12 19 0-14m-6 6 6-6 6 6"/></>,
    speaker: <><path d="m11 5-6 4H2v6h3l6 4zM15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/></>,
    muted: <><path d="m11 5-6 4H2v6h3l6 4zM17 9l5 6m0-6-5 6"/></>,
    pause: <><path d="M8 5v14M16 5v14" strokeWidth="3"/></>,
    play: <path d="m8 4 12 8-12 8z"/>,
    stop: <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none"/>,
    close: <path d="m6 6 12 12M18 6 6 18"/>,
    hide: <path d="m5 9 7 7 7-7"/>,
    search: <><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></>,
    quote: <><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6M8 13h8m-8 4h5"/></>,
    draft: <><path d="M11 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5m-9-3 7-7a2 2 0 0 1 3 3l-7 7-4 1z"/></>,
    order: <><path d="m3 7 9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4m-9 4v10M7 5l9 4"/></>,
    invoice: <><path d="M5 3h14v18l-3-2-4 2-4-2-3 2zM9 7h6m-6 4h6m-6 4h3"/></>,
    component: <><path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z"/></>,
    customer: <><circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/></>,
    camera: <><path d="M8 5l2-2h4l2 2h4a2 2 0 0 1 2 2v12H2V7a2 2 0 0 1 2-2z"/><circle cx="12" cy="12" r="4"/></>,
    image: <><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.5"/><path d="m3 17 6-6 4 4 3-3 5 5"/></>,
    file: <><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6"/></>,
    chevron: <path d="m9 5 7 7-7 7"/>,
    check: <path d="m5 12 4 4L19 6"/>,
    edit: <><path d="m4 16 12-12a2 2 0 0 1 4 4L8 20H4zM14 6l4 4"/></>,
    history: <><path d="M3 5v5h5M3 10a9 9 0 1 1 1 8m8-12v6l4 2"/></>,
    settings: <><path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="15" cy="17" r="3"/></>,
    plus: <path d="M12 5v14M5 12h14"/>,
    alert: <><path d="m12 3 10 18H2zM12 9v5m0 3h.01"/></>,
    arrowDown: <path d="M12 4v16m-7-7 7 7 7-7"/>,
    lock: <><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 4v3"/></>,
  };
  return <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...props}>{shapes[name]}</svg>;
}
