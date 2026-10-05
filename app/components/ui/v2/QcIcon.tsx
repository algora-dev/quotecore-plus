import type { SVGProps } from 'react';

const paths = {
  polygon: 'm4 8 9-5 7 7-4 10H5L4 8Z',
  line: 'M5 19 19 5M3 17h4v4H3v-4ZM17 3h4v4h-4V3Z',
  point: 'M12 8v8M8 12h8M20 12a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z',
  pitch: 'M3 19 21 5v14H3ZM15 19v-5h6',
  trash: 'M3 6h18M5 6l1 15h12l1-15M9 6V3h6v3M10 10v7M14 10v7',
  undo: 'M9 15 3 9l6-6M3 9h12a6 6 0 0 1 0 12h-3',
  redo: 'm15 15 6-6-6-6m6 6H9a6 6 0 0 0 0 12h3',
  minus: 'M5 12h14',
  home: 'M3 10.5 12 3l9 7.5M5 9v11h5v-6h4v6h5V9',
  quote: 'M7 3h7l4 4v14H6V3h1m7 0v5h4M9 12h6m-6 4h6',
  orders: 'm3 7 9-4 9 4-9 4-9-4Zm0 0v10l9 4 9-4V7M12 11v10M7.5 5l9 4',
  invoice: 'M6 3h12v18l-3-2-3 2-3-2-3 2V3Zm3 5h6m-6 4h6m-6 4h3',
  pricing: 'M4 8h16v12H4V8Zm2 0V5h12v3M8 5V2h8v3M9 12h6m-6 4h6',
  library: 'M4 4h6v6H4V4Zm10 0h6v6h-6V4ZM4 14h6v6H4v-6Zm10 0h6v6h-6v-6Z',
  supplier: 'M3 21V10l6 3V8l6 3V3h6v18H3Zm4-4h1m3 0h1m5 0h1',
  help: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm-3-12a3 3 0 1 1 4 2.8c-1 .4-1 1.2-1 2.2m0 3v.1',
  account: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-8 8a8 8 0 0 1 16 0',
  assistant: 'M4 4h16v12h-8l-5 4v-4H4V4Zm4 6h.1m3.9 0h.1m3.9 0h.1',
  menu: 'M4 6h16M4 12h16M4 18h16',
  close: 'm6 6 12 12M6 18 18 6',
  collapse: 'M4 4h16v16H4V4Zm5 0v16m7-12-4 4 4 4',
  expand: 'M4 4h16v16H4V4Zm5 0v16m3-12 4 4-4 4',
  focus: 'M9 3H3v6m12-6h6v6M3 15v6h6m12-6v6h-6',
  arrow: 'M4 12h16m-6-6 6 6-6 6',
  back: 'M20 12H4m6-6-6 6 6 6',
  chevron: 'm9 5 7 7-7 7',
  plus: 'M12 5v14M5 12h14',
  lock: 'M6 10h12v11H6V10Zm3 0V6a3 3 0 0 1 6 0v4m-3 4v3',
  measure: 'm4 16 12-12 4 4L8 20l-4-4Zm9-9 3 3m-6 0 2 2m-5 1 3 3',
  file: 'M6 3h8l4 4v14H6V3Zm8 0v5h4M9 12h6m-6 4h6',
  folder: 'M3 6h7l2 2h9v12H3V6Z',
  notes: 'M5 3h14v14l-4 4H5V3Zm10 18v-5h4M8 7h8m-8 4h8m-8 4h3',
  activity: 'M3 12h4l3-8 4 16 3-8h4',
  mail: 'M3 5h18v14H3V5Zm0 1 9 7 9-7',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-14v5l3 2',
  check: 'm5 12 4 4L19 6',
  edit: 'm15 4 5 5M4 20l5-1L21 7l-4-4L5 15l-1 5Z',
  upload: 'M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5',
  download: 'M12 3v13m-5-5 5 5 5-5M4 16v5h16v-5',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Zm13 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
  more: 'M5 12h.1m6.9 0h.1m6.9 0h.1',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-11v6m0-9v.1',
  labour: 'M8 7V5h8v2m-13 0h18v13H3V7Zm0 6 9 3 9-3m-9 1v4',
} as const;
export type QcIconName = keyof typeof paths;
/** Shared outline vocabulary. Always pair an icon-only control with an accessible name. */
export function QcIcon({ name, ...props }: SVGProps<SVGSVGElement> & { name: QcIconName }) {
  return <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d={paths[name]} />
  </svg>;
}
