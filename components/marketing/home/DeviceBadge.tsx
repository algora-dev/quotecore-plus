import s from './DeviceBadge.module.css';
export function DeviceBadge({ label = 'On site or in the office' }: { label?: string }) {
  return <div className={s.badge}><span className={s.icons} role="img" aria-label="Mobile and desktop">
    <svg width="19" height="26" viewBox="0 0 20 28" fill="none" aria-hidden="true"><rect x="3" y="2" width="14" height="24" rx="3" stroke="currentColor" strokeWidth="2.5"/><path d="M8 5h4M9 23h2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
    <svg width="29" height="26" viewBox="0 0 30 28" fill="none" aria-hidden="true"><rect x="2" y="3" width="26" height="17" rx="2" stroke="currentColor" strokeWidth="2.5"/><path d="M15 20v5M9 25h12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>
  </span><span>{label}</span></div>;
}
