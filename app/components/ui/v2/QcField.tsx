'use client';
import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes, type ReactNode } from 'react';
import './qc.css';

/** C05. Pass numeric strings, units, events and validation through unchanged. */
export const QcInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function QcInput(
  { className = '', ...props }, ref,
) {
  return <input {...props} ref={ref} data-qc-component="C05" className={`qc-input ${className}`} />;
});
/** C06. Keep native keyboard selection and the caller's complete option set. */
export const QcSelect = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function QcSelect(
  { className = '', ...props }, ref,
) {
  return <select {...props} ref={ref} data-qc-component="C06" className={`qc-select ${className}`} />;
});
/** C04. Callers connect help/error ids to their control with aria-describedby. */
export function QcField({ label, htmlFor, children, help, helpId, className = '' }: {
  label: ReactNode; htmlFor: string; children: ReactNode; help?: ReactNode; helpId?: string; className?: string;
}) {
  return <div data-qc-component="C04" className={`qc-field ${className}`}>
    <label htmlFor={htmlFor} className="qc-label">{label}</label>
    {children}
    {help && <p id={helpId} className="qc-help">{help}</p>}
  </div>;
}
