'use client';
import type { HTMLAttributes, ReactNode } from 'react';
import './qc.css';

/** C18. Solid data surface. Glass is reserved for floating controls. */
export function QcSurface({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} data-qc-component="C18" className={`qc-surface ${className}`} />;
}
/** C30. Copy and the decision to announce it belong to the feature. */
export function QcNotice({ children, tone = 'neutral', className = '', ...props }: HTMLAttributes<HTMLDivElement> & {
  tone?: 'neutral' | 'info' | 'warning' | 'danger' | 'success';
}) {
  return <div {...props} data-qc-component="C30" data-qc-tone={tone} className={`qc-notice ${className}`}>
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <circle cx="12" cy="12" r="9" /><path strokeLinecap="round" d="M12 11v6m0-10v.1" />
    </svg>
    <div>{children}</div>
  </div>;
}
/** C13. Display only. The caller supplies the existing status, never a transition. */
export function QcStatusBadge({ children, tone = 'neutral' }: {
  children: ReactNode; tone?: 'neutral' | 'success' | 'warning' | 'info';
}) {
  return <span data-qc-component="C13" data-qc-tone={tone} className="qc-status">{children}</span>;
}
