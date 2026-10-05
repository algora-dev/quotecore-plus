import type { CSSProperties } from 'react';
export type IconName = 'arrow' | 'play' | 'calendar' | 'check' | 'roof' | 'document' | 'calculator' | 'ruler' | 'close' | 'expand' | 'chevron' | 'quote' | 'people' | 'spark' | 'clock';
const paths: Record<IconName, string> = {
  arrow: 'M4 12h16m-6-6 6 6-6 6',
  play: 'm9 5 11 7-11 7V5Z',
  calendar: 'M8 3v4m8-4v4M4 10h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Z',
  check: 'm8 12 3 3 5-6M22 12a10 10 0 1 1-5-8.66',
  roof: 'm3 11 9-8 9 8v9h-6v-6H9v6H3v-9Z',
  document: 'M14 3H5v18h14V8l-5-5Zm0 0v6h5M8 13h8m-8 4h5',
  calculator: 'M5 3h14v18H5V3Zm3 3h8v4H8V6Zm0 8h1m6 0h1m-8 3h1m6 0h1',
  ruler: 'm3 16 13-13 5 5L8 21l-5-5Zm10-10 3 3m-6 0 2 2m-5 1 3 3m-6 0 2 2',
  close: 'm6 6 12 12M6 18 18 6',
  expand: 'M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5',
  chevron: 'm6 9 6 6 6-6',
  quote: 'M4 13h5v6H3v-6c0-4 2-7 6-8m6 8h5v6h-6v-6c0-4 2-7 6-8',
  people: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  spark: 'm12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z',
  clock: 'M12 7v5l3 2m7-2a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z',
};
export function Icon({ name, size = 20, className, style }: { name: IconName; size?: number; className?: string; style?: CSSProperties }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className} style={style}><path d={paths[name]} /></svg>;
}
