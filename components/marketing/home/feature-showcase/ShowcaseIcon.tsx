import type { ShowcaseIconName } from './showcase-types';

/** Small interface glyphs, not generated product illustrations. */
export function ShowcaseIcon({ name, size = 20 }: { name: ShowcaseIconName; size?: number }) {
  const paths = {
    assistant: <><path d="M19 11.5a7.5 7.5 0 0 1-7.5 7.5H5l-3 3V11.5A7.5 7.5 0 0 1 9.5 4H12"/><path d="m18 2 1.2 3.8L23 7l-3.8 1.2L18 12l-1.2-3.8L13 7l3.8-1.2Z"/><path d="M7 11h3m-3 4h6"/></>,
    components: <><path d="m12 3 9 5-9 5-9-5Z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/></>,
    measurements: <><path d="M4 5h16v14H4zM8 5v5m4-5v3m4-3v5"/><path d="M7 15h10"/></>,
    takeoff: <><path d="m3 11 9-8 9 8M5 10v11h14V10M9 21v-7h6v7"/></>,
    workflow: <><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><path d="M14 6h3a1 1 0 0 1 1 1v4m-8 7H7a1 1 0 0 1-1-1v-4"/></>,
    mic: <><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v1a7 7 0 0 0 14 0v-1M12 18v4m-4 0h8"/></>,
    arrow: <path d="M4 12h16m-6-6 6 6-6 6"/>,
    left: <path d="m14 5-7 7 7 7"/>,
    right: <path d="m10 5 7 7-7 7"/>,
    check: <path d="m5 12 4 4L19 6"/>,
    image: <><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1"/><path d="m4 18 5-5 3 3 4-6 5 7"/></>,
    expand: <path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>,
    close: <path d="m6 6 12 12M6 18 18 6"/>,
    phone: <><rect x="6" y="2" width="12" height="20" rx="3"/><path d="M10 5h4m-3 14h2"/></>,
    document: <><path d="M14 3H5v18h14V8ZM14 3v5h5M8 12h8m-8 4h6"/></>,
    search: <><circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/></>,
    list: <><path d="m3 5 1 1 2-2m-3 8 1 1 2-2m-3 8 1 1 2-2M10 5h11M10 12h11M10 19h11"/></>,
  };
  return <svg aria-hidden="true" focusable="false" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}
