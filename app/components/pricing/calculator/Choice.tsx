'use client';
import { useId, type ReactNode } from 'react';
export function Choice({ name, value, checked, onChange, title, description, badge, icon, multiple = false, compact = false }: {
  name: string; value: string; checked: boolean; onChange: () => void; title: string;
  description?: string; badge?: string; icon?: ReactNode; multiple?: boolean; compact?: boolean;
}) {
  const id = useId();
  return <label className={`qcp-choice${compact ? ' qcp-choice-compact' : ''}`} data-selected={checked || undefined} data-multiple={multiple || undefined}>
    <input type={multiple ? 'checkbox' : 'radio'} name={name} value={value} checked={checked}
      onChange={onChange} form={`${name}-detached`} aria-describedby={description ? `${id}-help` : undefined} />
    {icon && <span className="qcp-choice-icon" aria-hidden="true">{icon}</span>}
    <span className="qcp-choice-copy"><span className="qcp-choice-title">{title}{badge && <span className="qcp-badge">{badge}</span>}</span>
      {description && <span className="qcp-muted" id={`${id}-help`}>{description}</span>}
    </span>
    <span className="qcp-check" aria-hidden="true">{checked && <Icon name="check" />}</span>
  </label>;
}
export type IconName = 'phone' | 'desktop' | 'mixed' | 'ruler' | 'plan' | 'spark' | 'check' | 'arrow' | 'back' | 'chevron' | 'cut' | 'printer' | 'shield' | 'clock' | 'bolt' | 'edit' | 'roof' | 'sliders' | 'play' | 'people' | 'close';
export function Icon({ name, size = 24 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, string> = {
    play: 'm9 5 11 7-11 7V5Z',
    people: 'M9 3a3 3 0 1 0 .01 0ZM3 20v-3a6 6 0 0 1 12 0v3M17 4a3 3 0 0 1 0 6m1 4a5 5 0 0 1 3 4v2',
    close: 'm6 6 12 12M18 6 6 18',
    phone: 'M8 3h8a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm3 15h2',
    desktop: 'M3 4h18v12H3V4Zm9 12v4m-4 0h8',
    mixed: 'M3 4h14v9H3V4Zm7 9v5m-3 0h6m3-8h5v11h-5V10Z',
    ruler: 'm4 16 12-12 4 4L8 20l-4-4Zm3-3 2 2m1-5 2 2m1-5 2 2',
    plan: 'M5 3h10l4 4v14H5V3Zm9 0v5h5M8 15l4-4 4 4v3H8v-3Z',
    spark: 'm12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z',
    check: 'm5 12 4 4L19 6', arrow: 'M4 12h16m-6-6 6 6-6 6', back: 'M20 12H4m6-6-6 6 6 6', chevron: 'm6 9 6 6 6-6',
    cut: 'M6 3a3 3 0 1 0 0 6a3 3 0 1 0 0-6Zm0 12a3 3 0 1 0 0 6a3 3 0 1 0 0-6ZM8 8l13 13M8 16 21 3',
    printer: 'M7 8V3h10v5M7 17H3V8h18v9h-4M7 14h10v7H7v-7Zm10-3h1',
    shield: 'm12 3 8 3v5c0 5-4 8-8 10-4-2-8-5-8-10V6l8-3Zm-4 9 3 3 5-6',
    clock: 'M12 3a9 9 0 1 0 .01 0Zm0 4v5l3 2', bolt: 'M13 2 4 14h7l-1 8 10-13h-7l0-7Z',
    edit: 'm4 16 12-12 4 4L8 20H4v-4Zm9-9 4 4',
    roof: 'M2 13 12 4l10 9M5 11v10h14V11m-7-7v17m-7-8h14',
    sliders: 'M4 7h16M4 17h16M8 4v6m8 4v6',
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" focusable="false"><path d={paths[name]} strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
